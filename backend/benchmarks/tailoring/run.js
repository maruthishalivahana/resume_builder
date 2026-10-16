/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS runner, matching backend test conventions. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
require('tsx/cjs');
const originalDataset = require('./dataset');
const dataset = process.argv.includes('--original') ? originalDataset : require('./expanded-dataset');
const base = '../../src/modules/job-tailoring/';
const service = name => require(`${base}services/${name}.service.ts`);
const { RequirementExtractorService } = service('requirement-extractor');
const { ResumeEvidenceParserService } = service('resume-evidence-parser');
const { EvidenceRankerService } = service('evidence-ranker');
const { EvidenceValidatorService } = service('evidence-validator');
const { MatchClassifierService } = service('match-classifier');
const { RetrievalService } = service('retrieval');
const { GroundedGenerationService } = service('grounded-generation');
const { ClaimValidatorService } = service('claim-validator');
const { applySourcePatchContent } = service('source-patch');
const { createEvidenceSourcePatch } = require(`${base}utils/source-range.util.ts`);
const { DeterministicLexicalSearchProvider, EmptyVectorSearchProvider } = require(`${base}providers/interfaces.ts`);

const args = process.argv.slice(2), caseIndex = args.indexOf('--case');
const selected = caseIndex >= 0 ? args[caseIndex + 1] : undefined;
if (caseIndex >= 0 && !selected) throw new Error('--case requires an exact dataset case ID');
if (selected && args.includes('--check-baseline')) throw new Error('Baseline checks require the complete dataset');
if (selected && args.includes('--gate')) throw new Error('Acceptance gates require the complete dataset');
if (args.includes('--original') && args.includes('--check-baseline')) throw new Error('The reproducibility check targets the consolidated dataset; use --original --gate to check preserved gold');
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--case') { index++; continue; }
  if (!['--gate','--check-baseline','--original'].includes(args[index])) throw new Error(`Unknown option: ${args[index]}`);
}
const groups = ['retrieval','claims','mapping','outcomes'];
const allIds = groups.flatMap(group => dataset[group].map(item => item.id));
assert.equal(new Set(allIds).size,allIds.length,'Case IDs must be unique');
if (selected && !allIds.includes(selected)) throw new Error(`Unknown case ID: ${selected}`);
const cases = group => dataset[group].filter(item => !selected || item.id === selected);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(hash(JSON.stringify(originalDataset)),JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json'),'utf8')).datasetSha256,'Original gold fixtures must remain unchanged');
const sourceRoot = path.resolve(__dirname, '../../src/modules/job-tailoring');
const sourceFiles = directory => fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? sourceFiles(path.join(directory,entry.name)) : [path.join(directory,entry.name)]).sort();
const implementationSha256 = hash(sourceFiles(sourceRoot).map(file => path.relative(sourceRoot,file).replaceAll('\\','/') + '\n' + fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).join('\n'));
const key = item => `${item.source.fileId}:${item.source.lineStart}:${item.source.lineEnd}`;
const sourceFile = file => ({id:file.id,name:file.name,content:file.lines.join(file.newline ?? '\n')});
const ratio = (numerator, denominator) => ({numerator,denominator,value:denominator ? numerator / denominator : null});
const extractor = new RequirementExtractorService(), parser = new ResumeEvidenceParserService(), ranker = new EvidenceRankerService();
const evidenceValidator = new EvidenceValidatorService(), classifier = new MatchClassifierService();
const retrieval = new RetrievalService(new DeterministicLexicalSearchProvider(),new EmptyVectorSearchProvider());
const report = {datasetVersion:dataset.version,datasetSha256:hash(JSON.stringify(dataset)),implementationSha256,scope:'synthetic; real deterministic services; scripted provider; no DB/browser/compiler',cases:{retrieval:[],claims:[],mapping:[],outcomes:[]},metrics:{},failures:[]};
const fail = (id,stage,expected,actual) => report.failures.push({id,stage,expected,actual});

// Enforce offline execution, including accidental Mongo/HTTP connections.
let networkAttempts = 0;
const deny = () => { networkAttempts++; throw new Error('Benchmark forbids network/database connections'); };
global.fetch = deny;
require('node:net').Socket.prototype.connect = deny;
const mongoose = require('mongoose');
mongoose.connect = deny; mongoose.createConnection = deny; mongoose.set('bufferCommands',false);

async function evaluateRetrieval() {
  let extracted = 0, expectedRequirements = 0, extra = 0, relevant = 0, retrieved = 0, hits = 0, topHits = 0, verifiedHits = 0, verifiedCount = 0, rawCorrect = 0, strongRelevant = 0, strongVerified = 0, falseSupport = 0, nonSupporting = 0;
  const confusion = {}, positive = [], negative = [];
  for (const test of cases('retrieval')) {
    const files = test.files.map(sourceFile);
    // Gold anchors describe original files independently of parser output.
    for (const gold of test.gold) for (const anchor of gold.relevant) {
      const [id,start,end] = anchor.split(':');
      const file = test.files.find(item => item.id === id);
      assert.ok(file && +start > 0 && +end >= +start && +end <= file.lines.length,`Invalid gold anchor ${test.id}:${anchor}`);
    }
    const parsed = parser.parseFiles('benchmark-project','v1',files).evidence;
    const requirements = extractor.extract(test.jd);
    expectedRequirements += test.gold.length;
    extra += requirements.filter(item => !test.gold.some(gold => gold.text === item.text)).length;
    for (const gold of test.gold) {
      const requirement = requirements.find(item => item.text === gold.text);
      if (requirement) extracted++;
      const ranked = requirement ? ranker.rank(requirement,parsed) : [];
      const found = requirement ? await retrieval.retrieve(requirement,ranked) : [];
      const verified = requirement ? evidenceValidator.validate(requirement,found).filter(item => item.supports).map(item => item.evidence) : [];
      const match = requirement ? classifier.classifyDetailed(requirement,ranked) : {classification:'NOT_EXTRACTED',evidenceIds:[]};
      const desired = new Set(gold.relevant), actual = found.map(key), confirmed = verified.map(key);
      const tags = test.tags ?? (test.id === 'negated-skill' ? ['negation'] : test.id.startsWith('paraphrase-') ? ['paraphrase'] : []);
      const forbidden = gold.forbiddenSupport ?? (tags.includes('negation') && gold.classification === 'CONFLICT' ? gold.relevant : []);
      const unsupported = parsed.map(key).filter(id => !desired.has(id) || forbidden.includes(id));
      const falseSupports = confirmed.filter(id => unsupported.includes(id));
      nonSupporting += unsupported.length; falseSupport += falseSupports.length;
      const hitCount = actual.filter(id => desired.has(id)).length;
      relevant += desired.size; retrieved += actual.length; hits += hitCount;
      topHits += actual.slice(0,3).filter(id => desired.has(id)).length;
      verifiedHits += confirmed.filter(id => desired.has(id)).length; verifiedCount += confirmed.length;
      if (gold.classification === 'STRONG') {
        strongRelevant += desired.size;
        strongVerified += confirmed.filter(id => desired.has(id)).length;
      }
      const parsedAnchors = parsed.map(key);
      for (const anchor of desired) {
        const evidence = parsed.find(item => key(item) === anchor);
        const [id,start,end] = anchor.split(':');
        const file = test.files.find(item => item.id === id);
        if (evidence?.rawText === file.lines.slice(+start-1,+end).join(file.newline ?? '\n')) rawCorrect++;
      }
      const row = {id:test.id,tags,requirement:gold.text,expected:gold.classification,actual:match.classification,goldRelevant:[...desired],parsed:parsedAnchors,retrieved:actual,verified:confirmed,missed:[...desired].filter(id => !actual.includes(id)),verificationMisses:[...desired].filter(id => !confirmed.includes(id)),falseSupports};
      row.passed = row.actual === row.expected && !row.missed.length && (row.expected !== 'STRONG' || !row.verificationMisses.length) && !falseSupports.length;
      report.cases.retrieval.push(row);
      confusion[gold.classification] ??= {}; confusion[gold.classification][match.classification] = (confusion[gold.classification][match.classification] ?? 0) + 1;
      (gold.classification === 'STRONG' ? positive : negative).push(match.classification);
      if (row.missed.length) fail(test.id,'retrieval',gold.relevant,actual);
      if (row.verificationMisses.length && gold.classification === 'STRONG') fail(test.id,'verifiedSupportingEvidence',gold.relevant,confirmed);
      if (gold.classification !== match.classification) fail(test.id,'classification',gold.classification,match.classification);
      if (falseSupports.length) fail(test.id,'falsePositiveSupport',[],falseSupports);
    }
  }
  const rows = report.cases.retrieval;
  report.metrics.extraction = {goldRequirementsRecovered:ratio(extracted,expectedRequirements),extraRequirements:extra};
  report.metrics.retrieval = {microPrecision:ratio(hits,retrieved),microRecall:ratio(hits,relevant),recallAt3:ratio(topHits,relevant),missedRelevant:relevant-hits,verifiedRelevantCoverage:ratio(verifiedHits,relevant),verifiedStrongRecall:ratio(strongVerified,strongRelevant),verifiedRelevantPrecision:ratio(verifiedHits,verifiedCount),rawSourcePreservation:ratio(rawCorrect,relevant),falsePositiveSupport:ratio(falseSupport,nonSupporting)};
  report.metrics.slices = Object.fromEntries(['negation','paraphrase','distinction','ambiguous'].map(tag=>{
    const slice=rows.filter(row=>row.tags.includes(tag));
    return [tag,{classificationExact:ratio(slice.filter(row=>row.actual===row.expected).length,slice.length),missedEvidence:slice.reduce((sum,row)=>sum+row.missed.length,0),falseSupports:slice.reduce((sum,row)=>sum+row.falseSupports.length,0)}];
  }));
  const conflicts = rows.filter(row => row.expected === 'CONFLICT');
  report.metrics.classification = {exact:ratio(rows.filter(row => row.expected === row.actual).length,rows.length),falsePositiveStrong:ratio(negative.filter(value => value === 'STRONG').length,negative.length),falseNegativeStrong:ratio(positive.filter(value => value !== 'STRONG').length,positive.length),contradictionsMissed:ratio(conflicts.filter(row => row.actual !== 'CONFLICT').length,conflicts.length),confusion};
}

function evidence(text = 'Built REST APIs using Node.js.') {
  return {id:'e1',text,rawText:`\\item ${text}`,technologies:['Node.js','REST APIs'],normalizedTechnologies:['nodejs','rest_api'],section:'experience',type:'bullet',source:{fileId:'f1',fileName:'resume.tex',lineStart:1,lineEnd:1},score:0.9};
}
function proposal(item, after = item.rawText) {
  return {type:'rewrite',targetEvidenceId:item.id,before:item.rawText,after,evidenceIds:[item.id],reason:'Scripted benchmark proposal',confidence:0.5};
}
function input(item) {
  return {requirement:extractor.extract('Required: Node.js.')[0],evidence:[item],match:{classification:'STRONG',confidence:0.9,evidenceIds:[item.id],evidenceScores:[],reason:'Scripted scope for generation boundary testing'}};
}
async function evaluateClaims() {
  const validator = new ClaimValidatorService();
  for (const test of cases('claims')) {
    const item = evidence(test.evidenceText), suggestion = proposal(item,test.after);
    if (test.technologies) item.technologies=test.technologies;
    if ('ids' in test) suggestion.evidenceIds = test.ids;
    if (test.omitIds) delete suggestion.evidenceIds;
    if (test.targetId) suggestion.targetEvidenceId=test.targetId;
    const result = validator.validateDetailed(suggestion,test.duplicateEvidence ? [item,{...item,text:'Different record sharing an ID'}] : [item]);
    assert.deepEqual(Object.keys(result).sort(),['evidenceIds','unsupportedClaims','valid','warnings']);
    report.cases.claims.push({id:test.id,category:test.valid ? 'supported' : ('ids' in test || test.omitIds || test.duplicateEvidence || test.targetId) ? 'invalidReference' : test.note ? 'conservativePolicy' : 'unsupportedClaim',expectedValid:test.valid,actualValid:result.valid,reasons:result.unsupportedClaims.map(item => item.reason),passed:result.valid === test.valid});
    if (result.valid !== test.valid) fail(test.id,'claimValidation',test.valid,result.valid);
  }
  const rows = report.cases.claims, bad = rows.filter(row => !row.expectedValid), good = rows.filter(row => row.expectedValid);
  const refs = rows.filter(row => row.category === 'invalidReference'), unsupported = rows.filter(row => row.category === 'unsupportedClaim'), policy = rows.filter(row => row.category === 'conservativePolicy');
  report.metrics.claims = {unsafeProposalsAccepted:ratio(bad.filter(row => row.actualValid).length,bad.length),unsupportedClaimsAccepted:ratio(unsupported.filter(row => row.actualValid).length,unsupported.length),conservativePolicyAccepted:ratio(policy.filter(row => row.actualValid).length,policy.length),supportedRejected:ratio(good.filter(row => !row.actualValid).length,good.length),invalidReferencesAccepted:ratio(refs.filter(row => row.actualValid).length,refs.length)};
}

async function evaluateMapping() {
  let staleRejected = 0, staleTotal = 0;
  for (const test of cases('mapping')) {
    const newline = test.newline ?? '\n', content = test.source.join(newline);
    const files = [{id:'target',name:'sections/work.tex',content},...(test.otherFile ? [{id:'other',name:'another.tex',content}] : [])];
    const parsed = parser.parseFiles('benchmark-project','v1',files).evidence;
    const target = parsed.find(item => item.source.fileId === 'target' && item.source.lineStart === test.targetLine && item.source.lineEnd === (test.targetEnd ?? test.targetLine));
    let generated = null, actual = null, exact = false, patchFile = null;
    if (target) {
      const service = new GroundedGenerationService({generate:async () => ({type:'highlight',targetEvidenceId:target.id,highlightText:test.span,evidenceIds:[target.id],reason:'Scripted highlight',confidence:0.5})});
      generated = await service.generate(input({...target,score:0.9}));
      if (generated) {
        const patch = createEvidenceSourcePatch(content,target,generated.suggestion);
        patchFile = patch.fileId;
        const outputs = files.map(file => file.id === patch.fileId ? applySourcePatchContent(file.content,patch).updatedContent : file.content);
        actual = outputs[0];
        exact = test.expected !== null && patchFile === 'target' && actual === test.expected.join(newline) && (!test.otherFile || outputs[1] === content);
        staleTotal++;
        let rejected = false;
        try { applySourcePatchContent(content.replace(test.span,'CHANGED_SOURCE'),patch); }
        catch (error) { if(error.code === 'SOURCE_CHANGED') { staleRejected++; rejected = true; } }
        if (!rejected) fail(test.id,'staleSource','SOURCE_CHANGED','not rejected with expected code');
      }
    }
    const passed = Boolean(target) && (test.expected === null ? generated === null : exact);
    report.cases.mapping.push({id:test.id,expected:'expected' in test && test.expected === null ? 'reject' : 'exact-patch',parsedTarget:Boolean(target),generated:Boolean(generated),patchFile,exact,passed,actual});
    if (!passed) fail(test.id,'sourceMapping',test.expected,actual);
  }
  const rows = report.cases.mapping, valid = rows.filter(row => row.expected === 'exact-patch'), invalid = rows.filter(row => row.expected === 'reject');
  report.metrics.mapping = {expectedEditsProducedExactly:ratio(valid.filter(row => row.exact).length,valid.length),wrongAcceptedPatches:rows.filter(row => row.generated && !row.exact).length,unsafeSpansAccepted:ratio(invalid.filter(row => row.generated).length,invalid.length),staleSourceRejected:ratio(staleRejected,staleTotal)};
}

async function evaluateOutcomes() {
  for (const test of cases('outcomes')) {
    let primaryCalls = 0, fallbackCalls = 0;
    const item = evidence();
    const service = new GroundedGenerationService({generate:async () => {
      primaryCalls++;
      if(test.mode === 'error') throw new Error('Scripted timeout');
      if(test.mode === 'null') return null;
      if(test.mode === 'malformed') return {unexpected:true};
      if(test.mode === 'unsupported') return proposal(item,'Led TensorFlow production deployments.');
      return {type:'highlight',targetEvidenceId:'e1',highlightText:'Node.js',evidenceIds:['e1'],reason:'Scripted highlight',confidence:0.5};
    }},{generate:async () => { fallbackCalls++; return proposal(item,'Fabricated fallback'); }});
    const result = await service.generate(input(item)), reason = service.getLastReasonCode() ?? null;
    const passed = reason === test.reason && Boolean(result) === (test.mode === 'valid') && primaryCalls === 1 && fallbackCalls === 0;
    report.cases.outcomes.push({id:test.id,expected:test.reason,actual:reason,primaryCalls,fallbackCalls,passed});
    if(!passed) fail(test.id,'outcome',test.reason,reason);
  }
  const rows = report.cases.outcomes;
  report.metrics.outcomes = {correct:ratio(rows.filter(row => row.passed).length,rows.length),fallbackCalls:rows.reduce((sum,row) => sum + row.fallbackCalls,0)};
}

async function main() {
  // Keep deterministic diagnostics out of the report; no provider response is invented as a model result.
  const log = console.log, warn = console.warn;
  try { console.log = () => {}; console.warn = () => {}; await evaluateRetrieval(); await evaluateClaims(); await evaluateMapping(); await evaluateOutcomes(); }
  finally { console.log = log; console.warn = warn; }
  report.networkAttempts = networkAttempts;
  const m = report.metrics;
  report.acceptance = {
    goldFixtures: report.failures.length === 0,
    noFalseSupportingEvidence: m.retrieval.falsePositiveSupport.numerator === 0,
    extraction: m.extraction.goldRequirementsRecovered.value === 1 && m.extraction.extraRequirements === 0,
    retrievalRecall: m.retrieval.microRecall.value >= 0.95,
    verifiedStrongRecall: m.retrieval.verifiedStrongRecall.value >= 0.95,
    top3Recall: m.retrieval.recallAt3.value >= 0.95,
    retrievalPrecision: m.retrieval.microPrecision.value >= 0.90,
    classificationExact: m.classification.exact.value >= 0.90,
    noFalseStrong: m.classification.falsePositiveStrong.numerator === 0,
    noMissedContradictions: m.classification.contradictionsMissed.numerator === 0,
    falseNegativeStrong: m.classification.falseNegativeStrong.value <= 0.05,
    claimSafety: m.claims.unsafeProposalsAccepted.numerator === 0 && m.claims.supportedRejected.numerator === 0,
    rawSource: m.retrieval.rawSourcePreservation.value === 1,
    mapping: m.mapping.expectedEditsProducedExactly.value === 1 && m.mapping.wrongAcceptedPatches === 0 && m.mapping.staleSourceRejected.value === 1 && report.cases.mapping.every(row => row.passed),
    outcomes: m.outcomes.correct.value === 1 && m.outcomes.fallbackCalls === 0,
  };
  const originalIds=new Set(groups.flatMap(group=>originalDataset[group].map(item=>item.id)));
  const observations=groups.flatMap(group=>report.cases[group]);
  const activeIds=groups.flatMap(group=>cases(group).map(item=>item.id));
  report.counts={caseIds:activeIds.length,existingCaseIds:activeIds.filter(id=>originalIds.has(id)).length,newCaseIds:activeIds.filter(id=>!originalIds.has(id)).length,observations:observations.length,passed:observations.filter(row=>row.passed).length,failed:observations.filter(row=>!row.passed).length};
  const output = path.resolve(__dirname,'../../../storage/benchmarks',selected ? `tailoring-${selected}.json` : 'tailoring-latest.json');
  fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({metrics:report.metrics,failures:report.failures,acceptance:report.acceptance,output},null,2));
  if(args.includes('--check-baseline')) {
    assert.deepEqual(report,JSON.parse(fs.readFileSync(path.join(__dirname,'consolidated-baseline.json'),'utf8')),'Benchmark differs from reviewed consolidated baseline; inspect per-case results, do not automatically bless changes');
    console.log('Reviewed baseline reproduced exactly (including known failures).');
  }
  const unsafe = networkAttempts || m.claims.unsafeProposalsAccepted.numerator || m.mapping.wrongAcceptedPatches || m.outcomes.fallbackCalls || m.mapping.staleSourceRejected.numerator !== m.mapping.staleSourceRejected.denominator || m.outcomes.correct.numerator !== m.outcomes.correct.denominator;
  if(unsafe || (args.includes('--gate') && !Object.values(report.acceptance).every(Boolean))) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
