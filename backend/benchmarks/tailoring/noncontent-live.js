/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in isolated live verification. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mongoose=require('mongoose');require('tsx/cjs');
if(process.env.JD_NONCONTENT_LIVE!=='1')throw new Error('Explicit synthetic verification opt-in required');
const [sessionPath,mode]=process.argv.slice(2),session=JSON.parse(fs.readFileSync(sessionPath,'utf8'));
assert.match(session.database,/^resume_eng_browser_[a-f0-9]{32}$/);
assert.ok(['prepare','negative','reindex','positive'].includes(mode));
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../.env')));
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(env.MONGODB_URI).hostname));
const reportPath=path.join(path.dirname(sessionPath),'noncontent-live.json');
const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):{database:session.database,projectId:session.projectId,fileId:session.fileId,checks:[]};
if(report.error){report.previousHarnessErrors??=[];report.previousHarnessErrors.push(report.error);delete report.error;}
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
async function request(route,body,method){
  const r=await fetch('http://localhost:5001/api/'+route,{method:method??(body?'POST':'GET'),headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000),redirect:'error'});
  const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data.data;
}
(async()=>{
  await mongoose.connect(env.MONGODB_URI,{dbName:session.database,autoIndex:false,monitorCommands:true});
  assert.equal(mongoose.connection.db.databaseName,session.database);
  mongoose.connection.getClient().on('commandStarted',event=>{if(['insert','update','delete','findAndModify'].includes(event.commandName))assert.equal(event.databaseName,session.database);});
  const Evidence=require('../../src/modules/job-tailoring/models/ResumeEvidence.ts').default;
  if(mode==='prepare'){
    assert.ok(!report.prepared,'Do not reset a previously prepared test');
    const f=(await request(`latex/files/${session.fileId}`)).file;
    const content=['\\documentclass{article}','\\begin{document}','\\section{Projects}','\\begin{itemize}','\\item \\label{Python} Wrote Perl tools.','\\end{itemize}','\\end{document}'].join('\n');
    report.negativeFile=(await request(`latex/files/${session.fileId}`,{expectedRevision:f.contentRevision,content},'PATCH')).file;
    const {LatexProject}=require('../../src/models/LatexProject.ts');
    const control=await LatexProject.create({name:'SYNTHETIC REINDEX SCOPE CONTROL'});
    report.controlProjectId=String(control._id);
    const legacy={evidenceId:'synthetic-legacy-python-key',projectId:session.projectId,resumeId:session.projectId,versionId:'ver_master',section:'projects',type:'bullet',text:'Python Wrote Perl tools.',rawText:'\\item \\label{Python} Wrote Perl tools.',source:{fileId:session.fileId,fileName:'browser-check.tex',lineStart:5,lineEnd:5},technologies:['Python'],normalizedTechnologies:['python']};
    await Evidence.create([legacy,{...legacy,evidenceId:'synthetic-other-version',versionId:'other-test-version'},
      {...legacy,evidenceId:'synthetic-other-project',projectId:report.controlProjectId,resumeId:report.controlProjectId}]);
    report.prepared=true;report.checks.push('Synthetic label-only source saved; legacy contamination and two scope controls seeded');
  }else if(mode==='reindex'){
    // The browser Analyze action already reindexes. Seed a new stale record to
    // exercise the explicit endpoint independently instead of assuming caching.
    assert.ok(!await Evidence.exists({projectId:session.projectId,versionId:'ver_master',evidenceId:'synthetic-legacy-python-key'}));
    await Evidence.create({evidenceId:'synthetic-legacy-python-key',projectId:session.projectId,resumeId:session.projectId,versionId:'ver_master',section:'projects',type:'bullet',text:'Python Wrote Perl tools.',rawText:'\\item \\label{Python} Wrote Perl tools.',source:{fileId:session.fileId,fileName:'browser-check.tex',lineStart:5,lineEnd:5},technologies:['Python']});
    const before=await Evidence.findOne({projectId:session.projectId,versionId:'ver_master',evidenceId:'synthetic-legacy-python-key'}).lean();
    assert.ok(before,'Must demonstrate a stale record exists before reindex');
    const fileBefore=(await request(`latex/files/${session.fileId}`)).file;
    report.reindex=await request('tailoring/resume/index',{projectId:session.projectId,versionId:'ver_master'});
    const current=await Evidence.find({projectId:session.projectId,versionId:'ver_master'}).lean();
    assert.ok(current.length);assert.ok(current.every(row=>row.evidenceId!=='synthetic-legacy-python-key'&&!/Python/.test(row.text)&&!row.technologies.includes('Python')));
    assert.ok(current.some(row=>row.text==='Wrote Perl tools.'&&row.rawText==='\\item \\label{Python} Wrote Perl tools.'&&row.source.lineStart===5));
    assert.ok(await Evidence.exists({projectId:session.projectId,versionId:'other-test-version',evidenceId:'synthetic-other-version'}));
    assert.ok(await Evidence.exists({projectId:report.controlProjectId,evidenceId:'synthetic-other-project'}));
    const fileAfter=(await request(`latex/files/${session.fileId}`)).file;
    assert.equal(fileAfter.content,fileBefore.content);assert.equal(fileAfter.contentRevision,fileBefore.contentRevision);
    report.reindexedEvidence=current;report.checks.push('Live reindex removes stale Python evidence, preserves raw source/revision, and leaves other project/version controls intact');
  }else{
    const records=await request(`tailoring/suggestions?projectId=${session.projectId}&versionId=ver_master`);
    // Read the latest analysis created through the browser, never synthesize it.
    const Analysis=require('../../src/modules/job-tailoring/models/TailoringAnalysis.ts').default;
    const analysis=await Analysis.findOne({resumeId:session.projectId}).sort({createdAt:-1}).lean();assert.ok(analysis);
    const matches=await request(`tailoring/${analysis.analysisId}/matches`),suggestions=await request(`tailoring/${analysis.analysisId}/suggestions`);
    assert.equal(matches.length,1);assert.equal(matches[0].classification,mode==='negative'?'MISSING':'STRONG');
    assert.equal(suggestions.length,mode==='negative'?0:1);
    if(mode==='positive'){
      assert.equal(suggestions[0].before,'\\item \\label{work} Wrote Python tools.');
      assert.equal(suggestions[0].after,'\\item \\label{work} Wrote \\textbf{Python} tools.');
      assert.equal(suggestions[0].status,'pending');
    }
    report[mode]={analysisId:analysis.analysisId,matches,suggestions,file:(await request(`latex/files/${session.fileId}`)).file,scopedSuggestionsRead:Boolean(records)};
    if(mode==='positive'){
      assert.equal(report.positive.file.content,report.negativeFile.content.replace('\\label{Python} Wrote Perl','\\label{work} Wrote Python'));
      assert.ok(!report.positive.file.content.includes('\\textbf{Python}'),'Pending proposal must not modify source');
    }
    if(mode==='negative'){assert.equal(report.negative.file.content,report.negativeFile.content);assert.equal(report.negative.file.contentRevision,report.negativeFile.contentRevision);assert.ok(!await Evidence.exists({evidenceId:'synthetic-legacy-python-key',projectId:session.projectId,versionId:'ver_master'}));}
    report.checks.push(`${mode} browser analysis persisted expected classification and suggestion count`);
  }
  save();console.log(JSON.stringify({mode,reportPath,checks:report.checks},null,2));
})().catch(error=>{report.error=error.message;save();console.error(error);process.exitCode=1;}).finally(()=>mongoose.disconnect());
