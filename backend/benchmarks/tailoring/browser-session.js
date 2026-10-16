/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser verification harness. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const mongoose=require('mongoose');require('tsx/cjs');
if(process.env.JD_BROWSER_VERIFY!=='1') throw new Error('Explicit synthetic verification opt-in required');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../.env')));
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(env.MONGODB_URI).hostname));
const resume=process.env.JD_BROWSER_RESUME ? JSON.parse(fs.readFileSync(process.env.JD_BROWSER_RESUME,'utf8')) : null;
if(resume) assert.match(resume.database,/^resume_eng_browser_[a-f0-9]{32}$/);
const id=resume?.id??randomUUID(),database=resume?.database??`resume_eng_browser_${id.replaceAll('-','')}`;
const dir=path.resolve(__dirname,`../../../storage/benchmarks/browser-${id}`);fs.mkdirSync(dir,{recursive:true});
Object.assign(process.env,{NODE_ENV:'test',CLIENT_URL:'http://localhost:3001',TAILORING_LLM_PROVIDER:'ollama',LLM_PROVIDER:'deterministic',OLLAMA_BASE_URL:'http://127.0.0.1:11435',OLLAMA_MODEL:'qwen3:1.7b',OLLAMA_TIMEOUT_MS:'30000'});
const transport=global.fetch;
global.fetch=(url,options)=>{assert.equal(new URL(url).origin,'http://127.0.0.1:11435');return transport(url,{...options,redirect:'error'});};
let server;
(async()=>{
  await mongoose.connect(env.MONGODB_URI,{dbName:database,autoIndex:false,monitorCommands:true});
  assert.equal(mongoose.connection.db.databaseName,database);
  mongoose.connection.getClient().on('commandStarted',event=>{if(['insert','update','delete','findAndModify'].includes(event.commandName))assert.equal(event.databaseName,database);});
  const {LatexProject}=require('../../src/models/LatexProject.ts'),{LatexFile}=require('../../src/models/LatexFile.ts');
  const project=resume ? await LatexProject.findById(resume.projectId) : await LatexProject.create({name:'SYNTHETIC CANDIDATE BROWSER CHECK'});
  const content=['\\documentclass{article}','\\begin{document}','\\section{Experience}','\\begin{itemize}','\\item Built Python REST APIs with SQLite for a coursework project.','\\item Used Docker for a coursework project.','\\end{itemize}','\\noindent BROWSERCANDIDATE731','\\end{document}'].join('\n');
  const file=resume ? await LatexFile.findOne({_id:resume.fileId,projectId:project._id}) : await LatexFile.create({projectId:project._id,name:'browser-check.tex',path:'browser-check.tex',content,contentRevision:0});
  await LatexProject.updateOne({_id:project._id},{$set:{entryFileId:file._id}});
  const express=require('express'),app=express();
  app.use((req,res,next)=>{res.on('finish',()=>fs.appendFileSync(path.join(dir,'requests.jsonl'),JSON.stringify({at:new Date().toISOString(),method:req.method,url:req.originalUrl,status:res.statusCode,type:res.getHeader('content-type')})+'\n'));next();});
  app.use(require('../../src/app.ts').app);
  server=app.listen(5001,'127.0.0.1',()=>{
    const report={id,database,dir,projectId:String(project._id),fileId:String(file._id),initialContent:content,url:`http://localhost:3001/resume/${project._id}/latex`};
    fs.writeFileSync(path.join(dir,'session.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  });
})().catch(error=>{console.error(error);process.exitCode=1;mongoose.disconnect();});
async function stop(){if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
