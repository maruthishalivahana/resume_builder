// Real standalone/replica-set MongoDB verification in a NEW isolated database.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
require('tsx/cjs');
if(process.env.JD_LOCAL_QUALITY_DB !== '1') throw new Error('Set JD_LOCAL_QUALITY_DB=1 for isolated synthetic verification.');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname,'.env')));
const { OllamaHighlightProvider } = require('./src/modules/job-tailoring/providers/ollama-highlight.provider.ts');
const { TailoringOrchestratorService } = require('./src/modules/job-tailoring/services/tailoring-orchestrator.service.ts');
const { SourcePatchService } = require('./src/modules/job-tailoring/services/source-patch.service.ts');
const { LatexProject } = require('./src/models/LatexProject.ts');
const { LatexFile } = require('./src/models/LatexFile.ts');
const Suggestion = require('./src/modules/job-tailoring/models/TailoringSuggestion.ts').default;
const Match = require('./src/modules/job-tailoring/models/ResumeMatch.ts').default;
async function main() {
  const dbName = `resume_eng_local_quality_${randomUUID().replaceAll('-','')}`;
  await mongoose.connect(env.MONGODB_URI,{dbName,autoCreate:false,autoIndex:false,monitorCommands:true,serverSelectionTimeoutMS:5000});
  assert.equal(mongoose.connection.db.databaseName,dbName);
  mongoose.connection.getClient().on('commandStarted',event => {
    if(['insert','update','delete','findAndModify'].includes(event.commandName)) assert.equal(event.databaseName,dbName);
  });
  const hello = await mongoose.connection.db.admin().command({hello:1});
  const fixture = async (name,text) => {
    const project = await LatexProject.create({name});
    const content = `\\documentclass{article}\n\\begin{document}\n\\section{Experience}\n\\begin{itemize}\n\\item ${text}\n\\end{itemize}\n\\end{document}`;
    const file = await LatexFile.create({projectId:project._id,name:'resume.tex',path:'resume.tex',content,contentRevision:0});
    await LatexProject.updateOne({_id:project._id},{$set:{entryFileId:file._id}});
    return {projectId:project._id.toString(),fileId:file._id.toString(),content};
  };
  const a = await fixture('SYNTHETIC SQLITE A','Built Python REST APIs with SQLite for a coursework project.');
  const b = await fixture('SYNTHETIC JAVA B','Built Java tools for a personal project.');
  const orchestrator = new TailoringOrchestratorService(new OllamaHighlightProvider({NODE_ENV:'test',OLLAMA_TIMEOUT_MS:'30000'}));
  const results = await Promise.all([a,b].map(item => orchestrator.analyze({resumeId:item.projectId,versionId:'v1',rawJobDescription:'Required: Experience with SQLite.'})));
  assert.equal(results[0].summary.strong,1); assert.equal(results[1].summary.missing,1);
  assert.equal(results[0].summary.safeSuggestions,1); assert.equal(results[1].summary.safeSuggestions,0);
  for(let index=0;index<2;index++) {
    const matches = await Match.find({analysisId:results[index].analysisId}).lean();
    assert.equal(matches.length,1);
    assert.equal(matches[0].projectId,[a,b][index].projectId);
  }
  const suggestion = await Suggestion.findOne({analysisId:results[0].analysisId}).lean();
  assert.equal(suggestion.after,a.content.split('\n')[4].replace('SQLite','\\textbf{SQLite}'));
  const service = new SourcePatchService();
  await assert.rejects(service.apply({suggestionId:suggestion.suggestionId,projectId:b.projectId,versionId:'v1'}),error => error.code === 'PROJECT_MISMATCH');
  const accepted = await service.apply({suggestionId:suggestion.suggestionId,projectId:a.projectId,versionId:'v1'});
  assert.equal(accepted.contentRevision,1); assert.equal(accepted.recoveryPending,false);
  assert.equal(accepted.updatedContent,a.content.replace('SQLite','\\textbf{SQLite}'));
  const files = await LatexFile.find({_id:{$in:[a.fileId,b.fileId]}}).lean();
  assert.equal(files.find(item => item._id.toString() === b.fileId).content,b.content);
  assert.equal(files.find(item => item._id.toString() === b.fileId).contentRevision,0);
  assert.equal((await Suggestion.findOne({suggestionId:suggestion.suggestionId}).lean()).status,'accepted');
  const retry = await service.apply({suggestionId:suggestion.suggestionId,projectId:a.projectId,versionId:'v1'});
  assert.equal(retry.contentRevision,1); assert.equal(retry.updatedContent,accepted.updatedContent);
  const report = {database:dbName,topology:hello.setName?'replica-set':'standalone',syntheticOnly:true,cloudRequests:false,a,b,results,accepted,files,verified:['concurrent project isolation','SQLite match persisted','exact highlight persisted','cross-project accept rejected','revision increment and recovery finalization','accept retry does not double apply']};
  fs.writeFileSync(path.join(__dirname,'jd-local-quality-db-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({database:dbName,topology:report.topology,verified:report.verified}));
}
main().catch(error => { console.error(error.name,error.message); process.exitCode=1; }).finally(() => mongoose.disconnect());
