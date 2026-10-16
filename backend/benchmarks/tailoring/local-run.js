/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in CommonJS evaluation runner. */
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict'), {randomUUID,createHash}=require('node:crypto');
require('tsx/cjs');
const args=process.argv.slice(2),unseen=args.includes('--unseen'),scripted=args.includes('--scripted');
assert.ok(args.every(arg=>['--unseen','--scripted'].includes(arg)),'Unknown evaluation argument');
assert.ok(!scripted||unseen,'Scripted mode is limited to the separate unseen evaluation');
if(!scripted && process.env.JD_LOCAL_MODEL_EVAL !== '1') throw new Error('Set JD_LOCAL_MODEL_EVAL=1 for synthetic-only local inference.');
const dataset=require(unseen?'./unseen-dataset':'./expanded-dataset'), oracle=unseen?Object.fromEntries(dataset.retrieval.map(test=>[test.id,test.gold[0].spans])):require('./local-oracle'), {summarize}=require('./local-metrics');
const {summarizeUnseen}=require('./unseen-metrics');
const {highlightCandidates}=require('../../src/modules/job-tailoring/services/highlight-candidates.service.ts');
const root='../../src/modules/job-tailoring/';
const {OllamaHighlightProvider}=require(`${root}providers/ollama-highlight.provider.ts`);
const {GroundedGenerationService}=require(`${root}services/grounded-generation.service.ts`);
const {RequirementExtractorService}=require(`${root}services/requirement-extractor.service.ts`);
const {ResumeEvidenceParserService}=require(`${root}services/resume-evidence-parser.service.ts`);
const {EvidenceRankerService}=require(`${root}services/evidence-ranker.service.ts`);
const {EvidenceValidatorService}=require(`${root}services/evidence-validator.service.ts`);
const {MatchClassifierService}=require(`${root}services/match-classifier.service.ts`);
const {RetrievalService}=require(`${root}services/retrieval.service.ts`);
const {DeterministicLexicalSearchProvider,EmptyVectorSearchProvider}=require(`${root}providers/interfaces.ts`);
const {createEvidenceSourcePatch}=require(`${root}utils/source-range.util.ts`);
const {applySourcePatchContent}=require(`${root}services/source-patch.service.ts`);
const networkFetch=global.fetch;
let transportRequests=0;
let inferenceRequests=0;
global.fetch=(url,options)=>{
  assert.ok(!scripted,'Scripted evaluation forbids every network request');
  const parsed=new URL(url);
  assert.equal(parsed.origin,'http://127.0.0.1:11435','External inference is forbidden');
  assert.ok(['/api/version','/api/tags','/api/chat'].includes(parsed.pathname));
  transportRequests++;
  if(parsed.pathname==='/api/chat') inferenceRequests++;
  return networkFetch(url,{...options,redirect:'error'});
};
const key=(test,gold)=>test.gold.length===1?test.id:`${test.id}/${gold.text}`;
const keys=dataset.retrieval.flatMap(test=>test.gold.map(gold=>key(test,gold))).sort();
assert.deepEqual(Object.keys(oracle).sort(),keys,'Every requirement needs a predeclared usefulness label');
const runId=randomUUID(), output=path.resolve(__dirname,`../../../storage/benchmarks/local-model-${runId}.json`);
const hash=value=>createHash('sha256').update(value).digest('hex');
const report={runId,metricsVersion:3,syntheticOnly:true,cloudRequests:false,databaseUsed:false,retries:0,timeoutMs:30000,model:'qwen3:1.7b',datasetVersion:dataset.version,datasetSha256:hash(JSON.stringify(dataset)),oracleSha256:hash(JSON.stringify(oracle)),cases:[]};
report.mode=scripted?'scripted-first-candidate':'actual-local-model';
const save=()=>{report.metrics=summarize(report.cases);if(unseen)report.evidenceMetrics=summarizeUnseen(report.cases);report.transportRequests=transportRequests;fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));};
async function main() {
  if(!scripted) {
  const response=await fetch('http://127.0.0.1:11435/api/version',{signal:AbortSignal.timeout(5000)});
  assert.ok(response.ok);report.runtime=await response.json();
  const tags=await fetch('http://127.0.0.1:11435/api/tags',{signal:AbortSignal.timeout(5000)});assert.ok(tags.ok);
  report.modelMetadata=(await tags.json()).models?.find(item=>item.name===report.model);assert.ok(report.modelMetadata,'Cached model required; this runner never downloads a model');
  }
  const provider=scripted?{generate:async input=>highlightCandidates(input)[0]?.proposal??null}:new OllamaHighlightProvider({NODE_ENV:'test',OLLAMA_BASE_URL:'http://127.0.0.1:11435',OLLAMA_TIMEOUT_MS:'30000'});
  for(const test of dataset.retrieval) {
    const files=test.files.map(file=>({id:file.id,name:file.name,content:file.lines.join(file.newline??'\n')}));
    const evidence=new ResumeEvidenceParserService().parseFiles('synthetic-project','v1',files).evidence;
    const requirements=new RequirementExtractorService().extract(test.jd);
    for(const gold of test.gold) {
      const id=key(test,gold), requirement=requirements.find(item=>item.text===gold.text);
      if(!requirement && unseen){report.cases.push({id,extracted:false,expectedClassification:gold.classification,relevant:gold.relevant,retrievedAnchors:[],supportingAnchors:[],expectedSpans:oracle[id],providerCalled:false,generated:false,useful:false});save();continue;}
      assert.ok(requirement);
      const ranked=new EvidenceRankerService().rank(requirement,evidence);
      const retrieved=await new RetrievalService(new DeterministicLexicalSearchProvider(),new EmptyVectorSearchProvider()).retrieve(requirement,ranked);
      const verified=new EvidenceValidatorService().validate(requirement,retrieved).filter(item=>item.supports).map(item=>item.evidence);
      const match=new MatchClassifierService().classifyDetailed(requirement,ranked);
      const row={id,requirement:gold.text,classification:match.classification,expectedSpans:oracle[id],providerCalled:false,proposal:null,providerError:null,providerMs:0,generated:false,useful:false,sourceSafe:null,mappingExact:null};
      if(unseen)Object.assign(row,{extracted:true,expectedClassification:gold.classification,relevant:gold.relevant,
        retrievedAnchors:[...new Set(retrieved.map(item=>`${item.source.fileId}:${item.source.lineStart}:${item.source.lineEnd}`))],
        supportingAnchors:[...new Set(verified.map(item=>`${item.source.fileId}:${item.source.lineStart}:${item.source.lineEnd}`))]});
      const measured={generate:async input=>{
        row.providerCalled=true;const started=Date.now(), inferenceBefore=inferenceRequests;
        try { row.proposal=await provider.generate(input);return row.proposal; }
        catch(error) { row.providerError=error.message;row.responseErrorKind=/timed out/.test(error.message)?'timeout':/context limit/.test(error.message)?'context':/invalid|incomplete|only exact|overbroad|repetitive/i.test(error.message)?'invalid':'other';throw error; }
        finally {row.providerMs=Date.now()-started;row.inferenceRequests=inferenceRequests-inferenceBefore;}
      }};
      const service=new GroundedGenerationService(measured);
      const generated=await service.generate({requirement,match,evidence:verified});
      row.reason=service.getLastReasonCode()??null;
      if(generated) {
        row.generated=true;row.suggestion=generated.suggestion;
        if(unseen)row.referencesValid=generated.suggestion.evidenceIds.length>0&&generated.suggestion.evidenceIds.every(id=>verified.some(item=>item.id===id))&&verified.some(item=>item.id===generated.suggestion.targetEvidenceId);
        const target=evidence.find(item=>item.id===generated.suggestion.targetEvidenceId);
        const span=row.proposal.highlightText, raw=target.rawText, start=raw.indexOf(span);
        row.sourceSafe=generated.suggestion.before===raw && start>=0 && generated.suggestion.after===raw.slice(0,start)+`\\textbf{${span}}`+raw.slice(start+span.length);
        const file=files.find(item=>item.id===target.source.fileId);
        const patch=createEvidenceSourcePatch(file.content,target,generated.suggestion);
        const updated=applySourcePatchContent(file.content,patch).updatedContent;
        const offset=file.content.split('\n').slice(0,target.source.lineStart-1).reduce((sum,line)=>sum+line.length+1,0);
        row.mappingExact=file.content.slice(offset,offset+raw.length)===raw && updated===file.content.slice(0,offset)+generated.suggestion.after+file.content.slice(offset+raw.length) && patch.fileId===file.id;
        row.selectedSpan=span;
        row.useful=row.sourceSafe && row.mappingExact && row.expectedSpans.includes(span) && gold.relevant.includes(`${target.source.fileId}:${target.source.lineStart}:${target.source.lineEnd}`);
      }
      report.cases.push(row);save();
      console.log(JSON.stringify({id,called:row.providerCalled,ms:row.providerMs,span:row.selectedSpan,reason:row.reason,useful:row.useful}));
    }
  }
  report.completed=true;save();console.log(JSON.stringify({output,metrics:report.metrics,evidenceMetrics:report.evidenceMetrics},null,2));
  if(unseen) {
    report.acceptance={extraction:report.evidenceMetrics.extraction.value===1,classification:report.evidenceMetrics.classification.value>=0.95,
      noFalseStrong:report.evidenceMetrics.falseStrong.numerator===0,noFalseSupport:report.evidenceMetrics.falseSupportingRecords===0,
      retrievalRecall:report.evidenceMetrics.retrievalRecall.value>=0.95,useful:report.metrics.usefulSuggestions.value>=0.9,
      noUnnecessaryEdits:report.metrics.unnecessaryEdits.numerator===0,references:report.evidenceMetrics.invalidSuggestionReferences===0,
      exactSource:report.metrics.exactSourceMappings.value===1,noProviderErrors:!report.metrics.invalidResponses&&!report.metrics.timeouts&&!report.metrics.contextLimitFailures&&!report.metrics.otherProviderFailures};
    save();if(!Object.values(report.acceptance).every(Boolean))process.exitCode=1;
  }
  // Only factual/source safety is a hard failure. Usefulness is reported honestly,
  // without rerunning the model or changing production behavior to turn it green.
  if(report.cases.some(row=>row.generated && (!row.sourceSafe || !row.mappingExact))) process.exitCode=1;
}
main().catch(error=>{report.error=error.message;save();console.error(error.message,output);process.exitCode=1;}).finally(()=>{global.fetch=networkFetch;});
