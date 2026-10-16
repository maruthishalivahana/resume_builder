// Opt-in verification on the configured deployment, in a NEW database only.
// No dropDatabase, cleanup of historical records, or writes to the application DB.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomUUID,createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
require('tsx/cjs');
const mongoose=require('mongoose'),dotenv=require('dotenv');
const {LatexProject}=require('./src/models/LatexProject.ts'),{LatexFile}=require('./src/models/LatexFile.ts'),{LatexFolder}=require('./src/models/LatexFolder.ts'),{LatexCompilation}=require('./src/models/LatexCompilation.ts');
const {captureProjectSource}=require('./src/services/latexSourceCapture.service.ts'),{mutateTree}=require('./src/services/latexTree.service.ts');
const {LatexCompilerService:compiler}=require('./src/services/latexCompiler.service.ts'),controllers=require('./src/controllers/latex.controller.ts');
const {FileSaveManager}=require('../lib/file-save-manager.ts');
if(process.env.CAPTURE_LIVE_AUDIT!=='1')throw Error('Set CAPTURE_LIVE_AUDIT=1 to create a new isolated audit database on the configured server.');
const dbName='resume_eng_capture_audit_'+randomUUID().replaceAll('-','');
const sha=b=>createHash('sha256').update(b).digest('hex');
const doc=text=>`\\documentclass{article}\n\\begin{document}\n${text}\n\\input{parts/shared.tex}\n\\end{document}\n`;
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'source-capture-live-'));
let fileReads=0,projectReads=0,onFile,onProject,majorityReads=0;
const original={fileFind:LatexFile.find,projectFind:LatexProject.findById,availability:compiler.checkCompilerAvailability,command:compiler.getCompilerCommand,storage:compiler.getStorageDir};
async function call(fn,params,body){let result,error;await fn({params,body}, {status(){return this},json:r=>result=r},e=>error=e);if(error)throw Object.assign(error,{status:error.statusCode});return result.data;}
async function save(id,content,revision){return (await call(controllers.updateLatexFile,{fileId:id},{content,expectedRevision:revision})).file;}
async function fixture(label){
 const p=await LatexProject.create({name:'CAPTURE AUDIT '+label}),projectId=p._id.toString();
 const folder=await LatexFolder.create({projectId,name:'parts',path:'parts'});
 const a=await LatexFile.create({projectId,name:'a.tex',path:'a.tex',content:doc('IDENTITY ALPHA 731'),contentRevision:0});
 const b=await LatexFile.create({projectId,name:'b.tex',path:'b.tex',content:doc('IDENTITY BRAVO 842'),contentRevision:0});
 const shared=await LatexFile.create({projectId,folderId:folder._id,name:'shared.tex',path:'parts/shared.tex',content:'SHARED BASE résumé',contentRevision:0});
 await LatexProject.updateOne({_id:p._id},{$set:{entryFileId:a._id}});
 return{projectId,a:a._id.toString(),b:b._id.toString(),shared:shared._id.toString(),folder:folder._id.toString()};
}
function intercept(){
 LatexFile.find=function(...args){const query=original.fileFind.apply(this,args),exec=query.exec;query.exec=async function(...args){const rows=await exec.apply(this,args);if(this.options.readConcern?.level==='majority'){fileReads++;if(onFile)await onFile(fileReads,rows);}return rows};return query;};
 LatexProject.findById=function(...args){const query=original.projectFind.apply(this,args),exec=query.exec;query.exec=async function(...args){const row=await exec.apply(this,args);if(this.options.readConcern?.level==='majority'){projectReads++;if(onProject)await onProject(projectReads,row);}return row};return query;};
}
function reset(){fileReads=projectReads=0;onFile=onProject=undefined;}
async function verify(capture){
 for(const entry of capture.sourceCapture.files){const file=capture.files.find(f=>f._id.toString()===entry.fileId);assert.ok(file);assert.equal(entry.sha256,sha(Buffer.from(file.content??'','utf8')));assert.equal(entry.byteLength,Buffer.byteLength(file.content??'','utf8'));assert.equal(entry.contentRevision,file.contentRevision??0);}
 const {hash,capturedAt,...manifest}=capture.sourceCapture;assert.ok(capturedAt);assert.equal(hash,sha(Buffer.from(JSON.stringify({projectId:capture.project._id.toString(),...manifest}))));
}
async function main(){
 const uri=process.env.MONGODB_URI||dotenv.parse(fs.readFileSync(path.join(__dirname,'.env'))).MONGODB_URI;
 await mongoose.connect(uri,{dbName,autoCreate:false,autoIndex:false,monitorCommands:true,serverSelectionTimeoutMS:5000});
 assert.equal(mongoose.connection.db.databaseName,dbName);
 const hello=await mongoose.connection.db.admin().command({hello:1});
 mongoose.connection.getClient().on('commandStarted',event=>{if(['insert','update','delete','findAndModify'].includes(event.commandName))assert.equal(event.databaseName,dbName,'All writes must stay in the NEW audit database');if(event.databaseName===dbName&&event.command.find&&event.command.readConcern?.level==='majority')majorityReads++;});
 intercept();
 const base=await fixture('baseline');reset();const baseline=await captureProjectSource(base.projectId,base.a);await verify(baseline);assert.equal(fileReads,2);assert.ok(majorityReads>=8);
 console.log(JSON.stringify({database:dbName,topology:hello.setName?'replica-set':'standalone',baselineMajorityReads:majorityReads,baselineFileRevisions:baseline.sourceCapture.files.map(f=>f.contentRevision)}));
 // Real CAS saves/finalization between the file read and metadata read.
 const edits=await fixture('edit during capture');reset();onFile=async n=>{if(n===1)await save(edits.shared,'SHARED UPDATED',0)};
 const edited=await captureProjectSource(edits.projectId,edits.a);await verify(edited);assert.equal(fileReads,4);assert.equal(edited.sourceCapture.files.find(f=>f.fileId===edits.shared).contentRevision,1);assert.equal(edited.files.find(f=>f._id.toString()===edits.shared).content,'SHARED UPDATED');
 // Topology changes after the first complete collection force a new matching pair.
 for(const kind of ['addition','deletion','file rename','folder rename','nested folder','empty folder deletion']){
  const f=await fixture(kind);let empty;
  if(kind==='empty folder deletion')empty=await mutateTree(f.projectId,{kind:'create',type:'folder',name:'empty'});
  reset();let created;
  onProject=async n=>{if(n!==2)return;
   if(kind==='addition')created=await mutateTree(f.projectId,{kind:'create',type:'file',name:'extra.tex',content:doc('EXTRA')});
   if(kind==='deletion')await mutateTree(f.projectId,{kind:'delete',type:'file',id:f.b,expectedRevision:0});
   if(kind==='file rename')await mutateTree(f.projectId,{kind:'rename',type:'file',id:f.b,name:'renamed.tex'});
   if(kind==='folder rename')await mutateTree(f.projectId,{kind:'rename',type:'folder',id:f.folder,name:'renamed.parts'});
   if(kind==='nested folder')created=await mutateTree(f.projectId,{kind:'create',type:'folder',parentId:f.folder,name:'nested'});
   if(kind==='empty folder deletion')await mutateTree(f.projectId,{kind:'delete',type:'folder',id:empty});
  };
  const result=await captureProjectSource(f.projectId,f.a);await verify(result);assert.equal(fileReads,4,kind+' must retry the changed inventory');
  const paths=result.sourceCapture.files.map(f=>f.path),folders=result.sourceCapture.folders;
  if(kind==='addition')assert.ok(result.sourceCapture.files.some(f=>f.fileId===created));
  if(kind==='deletion')assert.ok(!result.sourceCapture.files.some(row=>row.fileId===f.b));
  if(kind==='file rename')assert.ok(paths.includes('renamed.tex'));
  if(kind==='folder rename')assert.ok(paths.includes('renamed.parts/shared.tex'));
  if(kind==='nested folder')assert.ok(folders.some(f=>f.folderId===created&&f.path==='parts/nested'));
  if(kind==='empty folder deletion')assert.ok(!folders.some(f=>f.folderId===empty));
  console.log('Live interleaving passed: '+kind);
 }
 const within=await fixture('rename inside collection');reset();onFile=async n=>{if(n===1)await mutateTree(within.projectId,{kind:'rename',type:'folder',id:within.folder,name:'changed'})};
 await assert.rejects(captureProjectSource(within.projectId,within.a),e=>e.statusCode===409&&e.code==='TREE_CHANGED');
 const autosave=await fixture('autosave flush');const manager=new FileSaveManager((id,text,rev)=>save(id,text,rev),()=>{},100000);
 try{for(const id of [autosave.a,autosave.b]){const file=await LatexFile.findById(id);manager.merge({id,path:file.path,content:file.content,contentRevision:0,contentLoaded:true},autosave.projectId);manager.edit(id,doc(id===autosave.a?'AUTOSAVE ALPHA':'AUTOSAVE BRAVO'));}
  reset();onFile=async n=>{if(n===1)await manager.flush(autosave.projectId)};const captured=await captureProjectSource(autosave.projectId,autosave.a);await verify(captured);assert.equal(fileReads,4);assert.equal(manager.status(autosave.projectId),'saved');assert.equal(captured.sourceCapture.files.find(f=>f.fileId===autosave.a).contentRevision,1);assert.equal(captured.sourceCapture.files.find(f=>f.fileId===autosave.b).contentRevision,1);
  assert.equal(captured.files.find(f=>f._id.toString()===autosave.a).content,doc('AUTOSAVE ALPHA'));assert.equal(captured.files.find(f=>f._id.toString()===autosave.b).content,doc('AUTOSAVE BRAVO'));
 }finally{manager.deactivate();}
 // Two actual writers on revision zero: one succeeds, the other receives 409.
 const conflict=await fixture('CAS');reset();const writers=await Promise.allSettled([save(conflict.b,doc('WRITER ONE'),0),save(conflict.b,doc('WRITER TWO'),0)]);assert.equal(writers.filter(r=>r.status==='fulfilled').length,1);assert.equal(writers.find(r=>r.status==='rejected').reason.statusCode,409);const winning=await captureProjectSource(conflict.projectId,conflict.a);assert.equal(winning.sourceCapture.files.find(f=>f.fileId===conflict.b).contentRevision,1);
 assert.equal(winning.files.find(f=>f._id.toString()===conflict.b).content,doc(writers[0].status==='fulfilled'?'WRITER ONE':'WRITER TWO'));
 // Persistent live saves after every collection exhaust 3 attempts. Exercise HTTP.
 const churn=await fixture('persistent churn');reset();onFile=async n=>{const file=await LatexFile.findById(churn.b);await save(churn.b,doc('CHURN '+n),file.contentRevision)};
 let compilerCalls=0;compiler.checkCompilerAvailability=async()=>{compilerCalls++;throw Error('Must not reach compiler during churn')};
 const app=require('express')();app.use(require('express').json());app.post('/projects/:projectId/compile',(q,r,n)=>controllers.compileProject(q,r,n));app.use((e,q,r,n)=>r.status(e.statusCode||500).json({code:e.code,message:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/projects/${churn.projectId}/compile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entryFileId:churn.a})});const body=await response.json();assert.equal(response.status,409);assert.equal(body.code,'SOURCE_CAPTURE_CHANGED');assert.equal(fileReads,6);assert.equal(compilerCalls,0);assert.equal(await LatexCompilation.countDocuments({projectId:churn.projectId}),0);}finally{await new Promise(r=>server.close(r));}
 // Actual MiKTeX wrapper inventories the exact workspace bytes immediately before exec.
 const real=await fixture('compiler byte identity');reset();const before=await captureProjectSource(real.projectId,real.a);onFile=onProject=undefined;
 const transcript=path.join(sandbox,'compiler-input.json'),wrapper=path.join(sandbox,'compiler-wrapper.js');
 fs.writeFileSync(wrapper,`const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');const [exe,report,...args]=process.argv.slice(2);const rows=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else{const b=fs.readFileSync(p);rows.push({path:path.relative(process.cwd(),p).split(path.sep).join('/'),sha256:crypto.createHash('sha256').update(b).digest('hex'),byteLength:b.length});}}}walk(process.cwd());fs.writeFileSync(report,JSON.stringify({entry:args.at(-1),files:rows}));const r=spawnSync(exe,args,{cwd:process.cwd(),encoding:'utf8',windowsHide:true});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(r.status??1);`);
 const exe=process.env.CAPTURE_PDFLATEX||'C:/Users/kumma/AppData/Local/Programs/MiKTeX/miktex/bin/x64/pdflatex.exe';
 compiler.getCompilerCommand=()=>({command:process.execPath,prefixArgs:[wrapper,exe,transcript,'--disable-installer']});
 // Persist artifacts in this audit folder for review; compiler cleans only its own temp workspace.
 compiler.getStorageDir=()=>path.join(sandbox,'artifacts');
 compiler.checkCompilerAvailability=async()=>{await save(real.a,doc('AFTER CAPTURE'),0);return{available:true,compiler:'MiKTeX audit wrapper'}};
 const result=await compiler.compileLatexProject({projectId:real.projectId,entryFileId:real.a});assert.equal(result.status,'success',result.logs.stderr||result.logs.stdout);
 const recorded=await LatexCompilation.findById(result.compilationId),input=JSON.parse(fs.readFileSync(transcript,'utf8'));assert.equal(input.entry,'a.tex');assert.equal(input.files.length,result.sourceCapture.files.length);
 for(const f of result.sourceCapture.files){const actual=input.files.find(row=>row.path===f.path);assert.ok(actual);assert.equal(actual.sha256,f.sha256);assert.equal(actual.byteLength,f.byteLength);assert.equal(f.contentRevision,before.sourceCapture.files.find(row=>row.fileId===f.fileId).contentRevision);}
 assert.equal(recorded.sourceCapture.hash,result.sourceCapture.hash);assert.equal(result.sourceCapture.files.find(f=>f.fileId===real.a).contentRevision,0);assert.equal((await LatexFile.findById(real.a)).contentRevision,1);assert.equal((await LatexProject.findById(real.projectId)).entryFileId.toString(),real.a);
 const text=execFileSync(process.env.CAPTURE_PDFTOTEXT||'C:/Users/kumma/AppData/Local/Programs/MiKTeX/miktex/bin/x64/pdftotext.exe',[path.resolve(recorded.pdfPath),'-'],{encoding:'utf8',windowsHide:true});assert.match(text,/IDENTITY ALPHA 731/);assert.match(text,/SHARED BASE/);assert.doesNotMatch(text,/AFTER CAPTURE/);assert.equal((await compiler.getProjectCompilationState(real.projectId,real.a)).state,'stale');
 console.log(JSON.stringify({livePassed:true,database:dbName,majorityReads,manifestHash:result.sourceCapture.hash,compilationId:result.compilationId,compilerInput:input,artifact:recorded.pdfPath,churnAttempts:3,churnHttpStatus:409,auditFiles:sandbox}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;console.error('Audit records retained in '+dbName+'; audit files '+sandbox)}).finally(async()=>{LatexFile.find=original.fileFind;LatexProject.findById=original.projectFind;compiler.checkCompilerAvailability=original.availability;compiler.getCompilerCommand=original.command;compiler.getStorageDir=original.storage;await mongoose.disconnect()});
