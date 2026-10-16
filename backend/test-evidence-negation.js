/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression suite. */
const assert = require('node:assert/strict');
require('tsx/cjs');
const { explicitlyNegatesRequirement } = require('./src/modules/job-tailoring/utils/evidence-negation.util.ts');
const { MatchClassifierService } = require('./src/modules/job-tailoring/services/match-classifier.service.ts');
const { ClaimValidatorService } = require('./src/modules/job-tailoring/services/claim-validator.service.ts');
const { EvidenceValidatorService } = require('./src/modules/job-tailoring/services/evidence-validator.service.ts');
const { GroundedGenerationService } = require('./src/modules/job-tailoring/services/grounded-generation.service.ts');
const { RequirementExtractorService } = require('./src/modules/job-tailoring/services/requirement-extractor.service.ts');
const { ResumeEvidenceParserService } = require('./src/modules/job-tailoring/services/resume-evidence-parser.service.ts');
const { EvidenceRankerService } = require('./src/modules/job-tailoring/services/evidence-ranker.service.ts');
const { RetrievalService } = require('./src/modules/job-tailoring/services/retrieval.service.ts');
const { DeterministicLexicalSearchProvider, EmptyVectorSearchProvider } = require('./src/modules/job-tailoring/providers/interfaces.ts');
const classifier = new MatchClassifierService(), validator = new EvidenceValidatorService(), extractor = new RequirementExtractorService();
const item = (id,text) => ({id,text,rawText:`\\item ${text}`,technologies:['Python'],normalizedTechnologies:['python'],metadata:{normalizedTechnologies:['python']},score:1,section:'experience',type:'bullet',source:{fileId:'f',fileName:'resume.tex',lineStart:1,lineEnd:1}});
const negatives = [
  ['Python.','No Python experience; built Java tools.'],
  ['Python.','I have no experience with Python.'],
  ['Python.','Python experience: none.'],
  ['Python.','Python experience: NIL.'],
  ['Python.','No experience with Python.'],
  ['Python.','No prior experience in Python.'],
  ['Python.','No prior Python experience.'],
  ['Python.','I have never used Python.'],
  ['Python.','I have not used Python.'],
  ['Python.',"I haven't used Python."],
  ['Python.','I haven’t used Python.'],
  ['Python.',"I didn't use Python."],
  ['Python.','Not experienced in Python.'],
  ['Python.','Without Python experience.'],
  ['Python.','Python was not used.'],
  ['Python.','Python has never been used.'],
  ['Python.','No experience with Python or Docker.'],
  ['Docker.','No Python and Docker experience.'],
  ['Java.','No Python experience and no Java experience.'],
  ['Node.js.','No NodeJS experience.'],
  ['REST APIs.','Never used RESTful APIs.'],
  ['C++.','No C++ experience.'],
  ['Production Python experience.','No production Python experience.'],
  ['Professional Python experience.','No professional experience with Python.'],
];
const controls = [
  ['Python.','Built Python tools.'],
  ['Python.','Developed applications using Python.'],
  ['Python.','Built Python tools with no downtime.'],
  ['Python.','Not only Python but also Java.'],
  ['Python.','Not just Python; also Java.'],
  ['Java.','No Python experience; built Java tools.'],
  ['Java.','Python experience: none. Built Java tools.'],
  ['Java.','No Python experience but built Java tools.'],
  ['Python.','Built Python tools; no Java experience.'],
  ['SQL.','No NoSQL experience.'],
  ['Java.','No JavaScript experience.'],
  ['Node.js.','No Next.js experience.'],
  ['Python.','No production Python experience; built Python coursework tools.'],
  ['Python.','No professional experience with Python.'],
  ['Python.','Python tools had no errors.'],
  ['Python.','No Python experience was required for the course.'],
  ['Python.','No Python experience needed.'],
  ['Python.','Not without Python experience.'],
  ['Node.js REST APIs.','No Python REST API experience.'],
];

async function main() {
  for (const [text,source] of negatives) {
    const requirement = extractor.extract(`Required: ${text}`)[0], evidence = item('negative',source);
    assert.equal(explicitlyNegatesRequirement(text,source),true,source);
    const match = classifier.classifyDetailed(requirement,[evidence]);
    assert.equal(match.classification,'CONFLICT',source);
    assert.equal(match.reasonCode,'CONFLICTING_EVIDENCE');
    assert.deepEqual(match.evidenceIds,['negative']);
    const verified = validator.validate(requirement,[evidence]);
    assert.equal(verified[0].supports,false,'Technology metadata/high score must not override negation');
    assert.match(verified[0].reason,/negates/);
    if (text === 'Python.') {
      const claim = {type:'keyword',targetEvidenceId:'negative',after:'Python',evidenceIds:['negative'],reason:'Structured skill mention',confidence:0.5};
      assert.equal(new ClaimValidatorService().validateDetailed(claim,[evidence]).valid,false,'Structured fields must not override explicit denied experience');
    }
    // Legacy saved PARTIAL/STRONG matches must not bypass the new safety check.
    for (const classification of ['PARTIAL','STRONG']) {
      let calls = 0, fallbacks = 0;
      const generator = new GroundedGenerationService({generate:async () => { calls++; return null; }},{generate:async () => { fallbacks++; return null; }});
      assert.equal(await generator.generate({requirement,evidence:[evidence],match:{...match,classification}}),null);
      assert.equal(calls,0); assert.equal(fallbacks,0);
      assert.equal(generator.getLastReasonCode(),'SUGGESTION_SCOPE_MISMATCH');
    }
  }
  for (const [requirement,source] of controls) {
    assert.equal(explicitlyNegatesRequirement(requirement,source),false,`${requirement}: ${source}`);
    assert.notEqual(classifier.classifyDetailed(extractor.extract(`Required: ${requirement}`)[0],[item('control',source)]).classification,'CONFLICT',source);
  }
  const requirement = extractor.extract('Required: Python.')[0];
  const negative = item('negative','No Python experience.'), positive = item('positive','Built Python tools for coursework.');
  const mixed = classifier.classifyDetailed(requirement,[positive,negative]);
  assert.equal(mixed.classification,'CONFLICT','Contradictory records require review rather than silently choosing positive evidence');
  assert.deepEqual(mixed.evidenceIds,['negative']);
  assert.deepEqual(validator.validate(requirement,[negative,positive]).filter(row => row.supports).map(row => row.evidence.id),['positive']);
  let supplied;
  const generator = new GroundedGenerationService({generate:async input => { supplied=input.evidence; return {type:'highlight',targetEvidenceId:'positive',highlightText:'Python',evidenceIds:['positive'],reason:'Existing coursework skill',confidence:0.5}; }});
  const snapshot = JSON.stringify([negative,positive]);
  const result = await generator.generate({requirement,evidence:[negative,positive],match:{...mixed,classification:'PARTIAL',evidenceIds:['negative','positive']}});
  assert.deepEqual(supplied.map(row => row.id),['positive']);
  assert.equal(result.suggestion.after,'\\item Built \\textbf{Python} tools for coursework.');
  assert.equal(JSON.stringify([negative,positive]),snapshot,'Source buffers must remain unchanged');

  for(const newline of ['\n','\r\n']) {
    const content = ['\\section{Experience}','\\begin{itemize}','\\item No \\textbf{Python}',' experience; built Java tools.','\\end{itemize}'].join(newline);
    const evidence = new ResumeEvidenceParserService().parseFiles('p','v',[{id:'f',name:'resume.tex',content}]).evidence;
    const ranked = new EvidenceRankerService().rank(requirement,evidence);
    const retrieved = await new RetrievalService(new DeterministicLexicalSearchProvider(),new EmptyVectorSearchProvider()).retrieve(requirement,ranked);
    assert.equal(retrieved.length,1,'Keep negative evidence available for explanations');
    assert.equal(classifier.classifyDetailed(requirement,ranked).classification,'CONFLICT');
    assert.equal(validator.validate(requirement,retrieved).filter(row => row.supports).length,0);
    assert.equal(evidence[0].rawText,['\\item No \\textbf{Python}',' experience; built Java tools.'].join(newline));
  }
  console.log(`Negation regressions passed: ${negatives.length} denials, ${controls.length} scoped controls, legacy-match generation guards, mixed evidence, LF/CRLF source preservation. No network or DB.`);
}
main().catch(error => { console.error(error); process.exitCode=1; });
