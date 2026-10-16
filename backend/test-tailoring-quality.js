const assert = require('node:assert/strict');
require('tsx/cjs');
process.env.TAILORING_LLM_PROVIDER = 'deterministic';
const { RequirementExtractorService } = require('./src/modules/job-tailoring/services/requirement-extractor.service.ts');
const { ResumeEvidenceParserService } = require('./src/modules/job-tailoring/services/resume-evidence-parser.service.ts');
const { EvidenceRankerService } = require('./src/modules/job-tailoring/services/evidence-ranker.service.ts');
const { EvidenceValidatorService } = require('./src/modules/job-tailoring/services/evidence-validator.service.ts');
const { MatchClassifierService } = require('./src/modules/job-tailoring/services/match-classifier.service.ts');
const { RetrievalService } = require('./src/modules/job-tailoring/services/retrieval.service.ts');
const { DeterministicLexicalSearchProvider, EmptyVectorSearchProvider } = require('./src/modules/job-tailoring/providers/interfaces.ts');
const { GroundedGenerationService } = require('./src/modules/job-tailoring/services/grounded-generation.service.ts');
const { applySourcePatchContent } = require('./src/modules/job-tailoring/services/source-patch.service.ts');
const { createEvidenceSourcePatch } = require('./src/modules/job-tailoring/utils/source-range.util.ts');
const extractor = new RequirementExtractorService(), parser = new ResumeEvidenceParserService();
const ranker = new EvidenceRankerService(), validator = new EvidenceValidatorService(), classifier = new MatchClassifierService();
const retrieval = new RetrievalService(new DeterministicLexicalSearchProvider(), new EmptyVectorSearchProvider());

const cases = [
  ['sqlite-period', 'Experience with SQLite.', 'Built Python REST APIs with SQLite for a coursework project.', true],
  ['sqlite-middle', 'Experience with SQLite.', 'Used SQLite for persistent storage.', true],
  ['sqlite-no-period', 'SQLite', 'Used SQLite for persistent storage.', true],
  ['redis', 'Experience with Redis.', 'Built a cache using Redis for a demo.', true],
  ['rust', 'Experience with Rust.', 'Built Rust tools for a personal project.', true],
  ['node-alias', 'Experience with Node.js.', 'Built NodeJS REST APIs for a project.', true],
  ['rest-plural', 'RESTful APIs.', 'Built REST APIs for a project.', true],
  ['cpp', 'Experience with C++.', 'Built C++ tools for coursework.', true],
  ['csharp', 'Experience with C#.', 'Built C# tools for coursework.', true],
  ['java-javascript', 'Java.', 'Built JavaScript applications.', false],
  ['sql-nosql', 'SQL.', 'Designed NoSQL collections.', false],
  ['sqlite-sql', 'SQLite.', 'Designed SQL queries.', false],
  ['rust-substring', 'Rust.', 'Developed robust backend tools.', false],
  ['tensorflow', 'TensorFlow.', 'Built Node.js REST APIs.', false],
  ['production', 'Production Node.js experience.', 'Built Node.js REST APIs for coursework.', false],
  ['professional', 'Professional experience with Python.', 'Python coursework and personal projects.', false],
  ['proficiency', 'Expert Python skills.', 'Built Python tools for coursework.', false],
  ['negation', 'Python.', 'No Python experience; built Java tools.', false],
];

async function main() {
  let positives = 0, falseStrong = 0;
  for (const [name, jd, sentence, supported] of cases) {
    const requirement = extractor.extract(`Required: ${jd}`)[0];
    const source = `\\section{Experience}\n\\begin{itemize}\n\\item ${sentence}\n\\end{itemize}`;
    const evidence = parser.parseFiles('synthetic-project', 'v1', [{id:'f1',name:'resume.tex',content:source}]).evidence;
    const ranked = ranker.rank(requirement, evidence);
    const verified = validator.validate(requirement, await retrieval.retrieve(requirement, ranked)).filter(item => item.supports).map(item => item.evidence);
    const match = classifier.classifyDetailed(requirement, ranked);
    if (supported) {
      assert.equal(match.classification, 'STRONG', name);
      assert.ok(verified.some(item => match.evidenceIds.includes(item.id)), `${name}: evidence survives every stage`);
      positives++;
    } else {
      if (match.classification === 'STRONG') falseStrong++;
      assert.notEqual(match.classification, 'STRONG', name);
    }
  }
  // Two exact evidence records must both survive ranking, validation and classification.
  const requirement = extractor.extract('Required: SQLite.')[0];
  const source = '\\section{Experience}\n\\begin{itemize}\n\\item Built SQLite storage.\n\\item Tested SQLite queries.\n\\end{itemize}';
  const evidence = parser.parseFiles('p', 'v', [{id:'f',name:'resume.tex',content:source}]).evidence;
  const ranked = ranker.rank(requirement, evidence);
  const verified = validator.validate(requirement, await retrieval.retrieve(requirement, ranked)).filter(item => item.supports).map(item => item.evidence);
  const match = classifier.classifyDetailed(requirement, ranked);
  assert.equal(verified.length, 2);
  assert.deepEqual(new Set(match.evidenceIds), new Set(evidence.map(item => item.id)));
  const generator = new GroundedGenerationService({generate: async input => {
    assert.equal(input.evidence.length, 2);
    const selected = input.evidence.find(item => item.text.includes('Tested SQLite'));
    return {type:'highlight',targetEvidenceId:selected.id,highlightText:'SQLite',evidenceIds:[selected.id],reason:'Emphasize an existing skill.',confidence:0.5};
  }});
  const generated = await generator.generate({requirement, match, evidence:verified});
  assert.ok(generated);
  const target = evidence.find(item => item.id === generated.suggestion.targetEvidenceId);
  const patch = createEvidenceSourcePatch(source, target, generated.suggestion);
  assert.equal(applySourcePatchContent(source, patch).updatedContent, source.replace('Tested SQLite', 'Tested \\textbf{SQLite}'));
  console.log(`Quality corpus: ${cases.length}/${cases.length} classifications; positive retrieval ${positives}/9; false STRONG ${falseStrong}/9; multi-evidence exact patch passed`);
  await concurrentAnalyses();
}

async function concurrentAnalyses() {
  const { TailoringOrchestratorService } = require('./src/modules/job-tailoring/services/tailoring-orchestrator.service.ts');
  const { ResumeIntelligenceService } = require('./src/modules/job-tailoring/services/resume-intelligence.service.ts');
  const model = name => require(`./src/modules/job-tailoring/models/${name}.ts`).default;
  const restores = [];
  const stub = (object, key, replacement) => { const original = object[key]; restores.push(() => object[key] = original); object[key] = replacement; };
  const summaries = {};
  try {
    stub(model('JobTarget'), 'create', async input => ({_id:input.resumeId}));
    stub(model('TailoringAnalysis'), 'create', async input => ({...input, save: async function() { if(this.summary) summaries[this.resumeId] = this.summary; }}));
    stub(model('JobRequirement'), 'insertMany', async () => []);
    stub(model('ResumeEvidence'), 'bulkWrite', async () => ({}));
    stub(model('ResumeMatch'), 'updateOne', async () => ({}));
    stub(model('ResumeMatch'), 'find', () => ({lean:async () => [{classification:'STRONG'}]}));
    stub(ResumeIntelligenceService.prototype, 'buildEvidence', async project => parser.parseFiles(project, 'v', [{id:project,name:'resume.tex',content:'\\section{Experience}\n\\item Built SQLite storage.'}]).evidence);
    // Hold both calls after their own status is assigned, reproducing overlapping completions.
    const originalGenerate = GroundedGenerationService.prototype.generate;
    let completed = 0, release;
    const barrier = new Promise(resolve => release = resolve);
    stub(GroundedGenerationService.prototype, 'generate', async function(input) {
      const result = await originalGenerate.call(this, input);
      if (++completed === 2) release();
      await barrier;
      return result;
    });
    const orchestrator = new TailoringOrchestratorService({generate:async input => {
      if(input.evidence[0].projectId === 'project-failure') throw new Error('synthetic provider timeout');
      return null;
    }});
    await Promise.all(['project-failure','project-abstain'].map(resumeId => orchestrator.analyze({resumeId,versionId:'v',rawJobDescription:'Required: SQLite.'})));
    assert.deepEqual(summaries['project-failure'].diagnosticReasons, {PROVIDER_ERROR:1});
    assert.deepEqual(summaries['project-abstain'].diagnosticReasons, {NO_EDIT_NEEDED:1});
    console.log('Concurrent mocked analyses retain separate failure/abstention diagnostics; no database used');
  } finally { restores.reverse().forEach(restore => restore()); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
