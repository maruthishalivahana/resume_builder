// Opt-in, synthetic-only evaluation of the real local pipeline. No DB or cloud.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
require('tsx/cjs');
if(process.env.JD_LOCAL_QUALITY !== '1') throw new Error('Set JD_LOCAL_QUALITY=1 to run against the cached local model.');
const { OllamaHighlightProvider } = require('./src/modules/job-tailoring/providers/ollama-highlight.provider.ts');
const { GroundedGenerationService } = require('./src/modules/job-tailoring/services/grounded-generation.service.ts');
const { RequirementExtractorService } = require('./src/modules/job-tailoring/services/requirement-extractor.service.ts');
const { ResumeEvidenceParserService } = require('./src/modules/job-tailoring/services/resume-evidence-parser.service.ts');
const { EvidenceRankerService } = require('./src/modules/job-tailoring/services/evidence-ranker.service.ts');
const { EvidenceValidatorService } = require('./src/modules/job-tailoring/services/evidence-validator.service.ts');
const { MatchClassifierService } = require('./src/modules/job-tailoring/services/match-classifier.service.ts');
const { createEvidenceSourcePatch } = require('./src/modules/job-tailoring/utils/source-range.util.ts');
const { applySourcePatchContent } = require('./src/modules/job-tailoring/services/source-patch.service.ts');
const cases = [
  ['sqlite', 'Experience with SQLite.', 'Built Python REST APIs with SQLite for a coursework project.', 'SQLite'],
  ['redis', 'Experience with Redis.', 'Used Redis for a cache in a coursework project.', 'Redis'],
  ['rust', 'Experience with Rust.', 'Built Rust command line tools for a personal project.', 'Rust'],
  ['docker-multiple', 'Experience with Docker.', ['Built Python scripts for coursework.', 'Used Docker to package a coursework application.'], 'Docker'],
  ['unsupported-tensorflow', 'TensorFlow.', 'Built Node.js REST APIs for coursework.', null],
  ['unsupported-production', 'Production Node.js experience.', 'Built Node.js REST APIs for coursework.', null],
  ['already-bold', 'Docker.', 'Used \\textbf{Docker} for coursework.', null],
  ['repeated', 'Docker.', 'Docker Docker', null],
];
async function main() {
  const report = {syntheticOnly:true,databaseUsed:false,cloudRequests:false,model:'qwen3:1.7b',cases:[]};
  const reportPath = path.join(__dirname, 'jd-local-quality-results.json');
  const provider = new OllamaHighlightProvider({NODE_ENV:'test',OLLAMA_BASE_URL:'http://127.0.0.1:11435',OLLAMA_TIMEOUT_MS:'30000'});
  for(const [name,jd,sentences,expectedSpan] of cases) {
    const source = ['\\section{Experience}','\\begin{itemize}',...[sentences].flat().map(sentence => `\\item ${sentence}`),'\\end{itemize}'].join('\n');
    const evidence = new ResumeEvidenceParserService().parseFiles('quality-project','v1',[{id:'quality-file',name:'resume.tex',content:source}]).evidence;
    const requirement = new RequirementExtractorService().extract(`Required: ${jd}`)[0];
    const ranked = new EvidenceRankerService().rank(requirement,evidence);
    const match = new MatchClassifierService().classifyDetailed(requirement,ranked);
    const verified = new EvidenceValidatorService().validate(requirement,ranked).filter(item => item.supports).map(item => item.evidence);
    const service = new GroundedGenerationService(provider);
    const started = Date.now();
    const generated = await service.generate({requirement,match,evidence:verified});
    const record = {name,classification:match.classification,verifiedCount:verified.length,elapsedMs:Date.now()-started,expectedSpan,reason:service.getLastReasonCode(),suggestion:generated?.suggestion ?? null,metExpectation:!generated && expectedSpan === null};
    if(generated) {
      const target = evidence.find(item => item.id === generated.suggestion.targetEvidenceId);
      const patch = createEvidenceSourcePatch(source,target,generated.suggestion);
      const output = applySourcePatchContent(source,patch).updatedContent;
      assert.equal(output.replace(/\\textbf\{([^{}]*)\}/g,'$1'),source.replace(/\\textbf\{([^{}]*)\}/g,'$1'),'Highlight must preserve every existing character');
      record.metExpectation = expectedSpan !== null && output.includes(`\\textbf{${expectedSpan}}`);
    }
    report.cases.push(record);
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
    console.log(JSON.stringify({name,classification:record.classification,reason:record.reason,metExpectation:record.metExpectation,elapsedMs:record.elapsedMs}));
  }
  report.metrics = {cases:report.cases.length,metExpectation:report.cases.filter(item => item.metExpectation).length,
    useful:report.cases.filter(item => item.expectedSpan !== null && item.metExpectation).length,
    supported:report.cases.filter(item => item.expectedSpan !== null).length,
    unexpectedSuggestions:report.cases.filter(item => item.expectedSpan === null && item.suggestion).length,
    providerFailures:report.cases.filter(item => item.reason === 'PROVIDER_ERROR').length};
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.metrics));
  // Evaluation failures are visible, never silently labelled a pass.
  if(report.metrics.metExpectation !== report.metrics.cases) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
