/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression suite. */
const assert = require('node:assert/strict');
require('tsx/cjs');
const {RequirementExtractorService} = require('./src/modules/job-tailoring/services/requirement-extractor.service.ts');
const {ResumeEvidenceParserService} = require('./src/modules/job-tailoring/services/resume-evidence-parser.service.ts');
const {EvidenceRankerService} = require('./src/modules/job-tailoring/services/evidence-ranker.service.ts');
const {EvidenceValidatorService} = require('./src/modules/job-tailoring/services/evidence-validator.service.ts');
const {MatchClassifierService} = require('./src/modules/job-tailoring/services/match-classifier.service.ts');
const {RetrievalService} = require('./src/modules/job-tailoring/services/retrieval.service.ts');
const {DeterministicLexicalSearchProvider,EmptyVectorSearchProvider} = require('./src/modules/job-tailoring/providers/interfaces.ts');
const {Bm25LexicalSearchProvider} = require('./src/modules/job-tailoring/providers/bm25-lexical-search.provider.ts');
const {ClaimValidatorService} = require('./src/modules/job-tailoring/services/claim-validator.service.ts');
const rows = [
  ['Maintain CI/CD pipelines.','Kept continuous integration and continuous delivery workflows running.','STRONG',true],
  ['Maintain continuous integration and continuous delivery workflows.','Maintained CI/CD pipelines.','STRONG',true],
  ['CI/CD.','Configured continuous integration & continuous delivery.','STRONG',true],
  ['Continuous integration and continuous delivery.','Configured CI/CD.','STRONG',true],
  ['Maintain CI/CD pipelines.','Maintained CI/CD pipelines.','STRONG',true],
  ['Lead a team.','Led a software team.','STRONG',true],
  ['SQL.','Designed NoSQL collections.','MISSING',false],
  ['Java.','Built JavaScript applications.','MISSING',false],
  ['CI/CD.','Maintained continuous integration builds.',null,false],
  ['Continuous deployment.','Maintained CI/CD pipelines.',null,false],
  ['CI/CD.','Used GitHub Actions.',null,false],
  ['Maintain CI/CD pipelines.','Maintained staff schedules.','MISSING',false],
  // Viewing a dashboard does not establish maintaining its pipelines.
  ['Maintain CI/CD pipelines.','Viewed CI/CD dashboards.',null,false],
  ['Python.','No Python experience.','CONFLICT',false],
  ['CI/CD.','No continuous integration and continuous delivery experience.','CONFLICT',false],
  ['Continuous integration and continuous delivery.','CI/CD experience: none.','CONFLICT',false],
  ['Node.js.','Built Node.js APIs.','STRONG',true],
];
async function main() {
  const extractor=new RequirementExtractorService(), parser=new ResumeEvidenceParserService(), ranker=new EvidenceRankerService(), validator=new EvidenceValidatorService(), classifier=new MatchClassifierService();
  const retrieval=new RetrievalService(new DeterministicLexicalSearchProvider(),new EmptyVectorSearchProvider());
  for(const [text,sentence,expected,supports] of rows) {
    const requirement=extractor.extract(`Required: ${text}`)[0];
    const content=`\\section{Experience}\n\\item ${sentence}`;
    const evidence=parser.parseFiles('p','v',[{id:'f',name:'resume.tex',content}]).evidence;
    const ranked=ranker.rank(requirement,evidence), found=await retrieval.retrieve(requirement,ranked);
    const verified=validator.validate(requirement,found).filter(item=>item.supports);
    const match=classifier.classifyDetailed(requirement,ranked);
    if(expected) assert.equal(match.classification,expected,`${text}: ${sentence}`);
    else assert.notEqual(match.classification,'STRONG',`${text}: ${sentence}`);
    assert.equal(verified.length>0,supports,`${text}: support for ${sentence}`);
    assert.equal(evidence[0].rawText,`\\item ${sentence}`,'Concept aliases must never rewrite source');
  }
  const documents=[{evidenceId:'relevant',text:'Kept continuous integration and continuous delivery workflows running.',source:{fileId:'f',fileName:'r.tex',lineStart:1,lineEnd:1},section:'experience',type:'bullet'},
    {evidenceId:'noise',text:'Maintained staff schedules.',source:{fileId:'f',fileName:'r.tex',lineStart:2,lineEnd:2},section:'experience',type:'bullet'}];
  assert.equal(new Bm25LexicalSearchProvider().rank('Maintain CI/CD pipelines.',documents)[0].evidenceId,'relevant');
  const original={id:'e',text:'Kept continuous integration and continuous delivery workflows running.',source:documents[0].source,score:1};
  const claim={type:'rewrite',targetEvidenceId:'e',evidenceIds:['e'],after:'Maintained CI/CD pipelines.',reason:'Paraphrase probe',confidence:0.5};
  assert.equal(new ClaimValidatorService().validateDetailed(claim,[original]).valid,false,'Retrieval equivalence must not authorize semantic rewrites');
  console.log(`Paraphrase retrieval passed: ${rows.length} cases, both directions, scoped distinctions, negation, BM25 ranking and strict paraphrase rejection. No network/DB.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
