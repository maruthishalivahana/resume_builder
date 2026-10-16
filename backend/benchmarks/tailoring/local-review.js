/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in isolated live review verification. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const mongoose=require('mongoose');require('tsx/cjs');
if(process.env.JD_LOCAL_REVIEW !== '1') throw new Error('Set JD_LOCAL_REVIEW=1 for a NEW synthetic-only local database and real compiler verification.');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../.env')));
const mongoUrl=new URL(env.MONGODB_URI);
assert.ok(['localhost','127.0.0.1','[::1]'].includes(mongoUrl.hostname),'This verification permits only local MongoDB');
process.env.NODE_ENV='test';process.env.TAILORING_LLM_PROVIDER='ollama';process.env.LLM_PROVIDER='deterministic';
process.env.OLLAMA_BASE_URL='http://127.0.0.1:11435';process.env.OLLAMA_MODEL='qwen3:1.7b';process.env.OLLAMA_TIMEOUT_MS='30000';
const runId=randomUUID(),dbName=`resume_eng_model_review_${runId.replaceAll('-','')}`;
const outputDir=path.resolve(__dirname,`../../../storage/benchmarks/review-${runId}`);
fs.mkdirSync(outputDir,{recursive:true});
const report={runId,database:dbName,syntheticOnly:true,cloudRequests:false,requests:[],checks:[],pdfs:[]};
const save=()=>fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
const sha=value=>createHash('sha256').update(value).digest('hex');
let server,origin;
const networkFetch=global.fetch;
global.fetch=(url,options)=>{
  const target=new URL(url);
  assert.ok(target.origin===origin || (target.origin==='http://127.0.0.1:11435' && target.pathname==='/api/chat'),'Only this audit server and the local model may be contacted');
  return networkFetch(url,{...options,redirect:'error'});
};
async function request(method,url,body,status=200) {
  const response=await fetch(origin+url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
  report.requests.push({method,url,status:response.status});save();
  const payload=await response.json();
  assert.equal(response.status,status,JSON.stringify(payload));
  return payload.data;
}
async function main() {
  await mongoose.connect(env.MONGODB_URI,{dbName,autoCreate:false,autoIndex:false,monitorCommands:true,serverSelectionTimeoutMS:5000});
  assert.equal(mongoose.connection.db.databaseName,dbName);
  mongoose.connection.getClient().on('commandStarted',event=>{
    if(['insert','update','delete','findAndModify'].includes(event.commandName)) assert.equal(event.databaseName,dbName);
  });
  const hello=await mongoose.connection.db.admin().command({hello:1});report.topology=hello.setName?'replica-set':'standalone';
  const {app}=require('../../src/app.ts');
  server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  origin=`http://127.0.0.1:${server.address().port}`;report.origin=origin;
  const {LatexProject}=require('../../src/models/LatexProject.ts'),{LatexFile}=require('../../src/models/LatexFile.ts');
  const {LatexCompilation}=require('../../src/models/LatexCompilation.ts');
  const project=await LatexProject.create({name:'SYNTHETIC LOCAL MODEL REVIEW'});
  const content=['\\documentclass{article}','\\begin{document}','\\section{Experience}','\\begin{itemize}','\\item Built Python REST APIs with SQLite for a coursework project.','\\end{itemize}','\\noindent LOCALMODELBASE731','\\end{document}'].join('\n');
  const file=await LatexFile.create({projectId:project._id,name:'resume.tex',path:'resume.tex',content,contentRevision:0});
  await LatexProject.updateOne({_id:project._id},{$set:{entryFileId:file._id}});
  const projectId=project._id.toString(),fileId=file._id.toString();report.projectId=projectId;report.fileId=fileId;save();
  const scope={projectId,versionId:'v1'};
  const getFile=async()=> (await request('GET',`/api/latex/files/${fileId}`)).file;
  const compile=async()=>{
    const result=await request('POST',`/api/latex/projects/${projectId}/compile`,{entryFileId:fileId});
    assert.equal(result.status,'success',JSON.stringify(result.error));assert.equal(result.entryFileId,fileId);
    const record=await LatexCompilation.findById(result.compilationId).lean();
    assert.equal(record.projectId.toString(),projectId);
    const pdfResponse=await fetch(origin+result.pdf.url,{signal:AbortSignal.timeout(10000)});
    const bytes=Buffer.from(await pdfResponse.arrayBuffer());
    assert.equal(pdfResponse.status,200);assert.match(pdfResponse.headers.get('content-type'),/^application\/pdf/);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
    const artifact=path.resolve(process.cwd(),record.pdfPath);
    assert.equal(sha(bytes),sha(fs.readFileSync(artifact)));
    const pdfPath=path.join(outputDir,`revision-${record.sourceCapture.files[0].contentRevision}.pdf`);fs.writeFileSync(pdfPath,bytes);
    const pdf={compilationId:result.compilationId,url:result.pdf.url,status:pdfResponse.status,contentType:pdfResponse.headers.get('content-type'),contentLength:pdfResponse.headers.get('content-length'),byteLength:bytes.length,sha256:sha(bytes),artifact,pdfPath,sourceCapture:record.sourceCapture};
    report.pdfs.push(pdf);save();return pdf;
  };
  const baseline=await compile();assert.equal(baseline.sourceCapture.files[0].contentRevision,0);report.checks.push('baseline revision 0 compiled and exact artifact downloaded');
  const analyze=async()=>{
    const result=await request('POST','/api/tailoring/analyze',{resumeId:projectId,versionId:'v1',rawJobDescription:'Required: Experience with SQLite.'},201);
    const suggestions=await request('GET',`/api/tailoring/${result.analysisId}/suggestions`);
    report.analyses??=[];report.analyses.push({analysisId:result.analysisId,summary:result.summary,suggestions});save();
    assert.equal(suggestions.length,1,'Real model must produce one safe suggestion; no synthetic fallback is permitted');
    assert.equal(suggestions[0].after,suggestions[0].before.replace('SQLite','\\textbf{SQLite}'),'Only the intended existing skill should be highlighted');
    return suggestions[0];
  };
  const first=await analyze();await request('POST',`/api/tailoring/suggestions/${first.suggestionId}/reject`,scope);
  let persisted=await getFile();assert.equal(persisted.content,content);assert.equal(persisted.contentRevision,0);
  report.checks.push('real suggestion rejected; source byte-identical at revision 0');save();
  const second=await analyze();
  const accepted=await request('POST',`/api/tailoring/suggestions/${second.suggestionId}/accept`,scope);
  assert.equal(accepted.updatedContent,content.replace('SQLite','\\textbf{SQLite}'));assert.equal(accepted.contentRevision,1);assert.equal(accepted.recoveryPending,false);
  const retry=await request('POST',`/api/tailoring/suggestions/${second.suggestionId}/accept`,scope);assert.equal(retry.contentRevision,1);
  await request('PATCH',`/api/latex/files/${fileId}`,{expectedRevision:0,content:'STALE MUST NOT COMMIT'},409);
  persisted=await getFile();assert.equal(persisted.content,accepted.updatedContent);assert.equal(persisted.contentRevision,1);
  report.checks.push('accept commits revision 1; retry is idempotent; stale editor save rejected with 409');
  const savedContent=accepted.updatedContent.replace('\\end{document}','\\par\\noindent LOCALMODELACCEPTED842\n\\end{document}');
  const saved=await request('PATCH',`/api/latex/files/${fileId}`,{expectedRevision:1,content:savedContent});assert.equal(saved.file.contentRevision,2);assert.equal(saved.file.recoveryPending,false);
  persisted=await getFile();assert.equal(persisted.content,savedContent);assert.equal(persisted.contentRevision,2);
  const latest=await compile();assert.equal(latest.sourceCapture.files[0].contentRevision,2);assert.equal(latest.sourceCapture.files[0].sha256,sha(savedContent));
  const oldResponse=await fetch(origin+baseline.url);assert.equal(oldResponse.status,200);assert.equal(sha(Buffer.from(await oldResponse.arrayBuffer())),baseline.sha256);
  const missing=await fetch(`${origin}/api/latex/projects/${projectId}/pdf?compilationId=${new mongoose.Types.ObjectId()}`);assert.equal(missing.status,404);
  report.checks.push('confirmed save revision 2 captured by real compiler','old build still returns original bytes','unknown compilation returns 404');
  report.completed=true;save();console.log(JSON.stringify({outputDir,database:dbName,checks:report.checks,pdfs:report.pdfs.map(item=>({compilationId:item.compilationId,pdfPath:item.pdfPath,byteLength:item.byteLength}))},null,2));
}
main().catch(error=>{report.error=error.message;save();console.error(error.message,outputDir);process.exitCode=1;}).finally(async()=>{
  global.fetch=networkFetch;
  if(server) await new Promise(resolve=>server.close(resolve));
  await mongoose.disconnect();
});
