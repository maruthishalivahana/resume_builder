/* eslint-disable @typescript-eslint/no-require-imports -- Versioned CommonJS fixture module. */
// Additions only: dataset.js and its original gold labels remain unchanged.
const original = require('./dataset');
const file = (id, section, lines) => ({id,name:`sections/${id}.tex`,lines:[`\\section{${section}}`,...lines]});
const single = (id,jd,section,text,classification,why,tags=[],relevant=true) => ({id,jd:`Required: ${jd}`,tags,
  files:[file(id,section,[text])],gold:[{text:jd,classification,relevant:relevant?[`${id}:2:2`]:[],why}]});
const additions = {
  retrieval:[
    single('expanded-cicd-list','Continuous integration and continuous delivery.','Technical Skills','\\textbf{Delivery:} CI/CD, Git.','STRONG','The categorized list explicitly mentions the equivalent paired concept.',['paraphrase']),
    single('expanded-maintenance-summary','Maintain CI/CD pipelines.','Summary','Engineer maintaining continuous integration and continuous delivery pipelines.','STRONG','Maintaining the named pipelines is explicit; no impact or deployment is inferred.',['paraphrase']),
    single('expanded-project-pair','Maintain continuous integration and continuous delivery workflows.','Projects','\\resumeItem{Maintained CI/CD pipelines for an academic compiler.}','STRONG','The paired concept and maintenance action are explicit, even though its macro remains opaque to editing.',['paraphrase']),
    single('expanded-ci-only','CI/CD.','Technical Skills','\\textbf{Automation:} Continuous integration.','MISSING','Integration alone does not establish delivery.',['distinction'],false),
    single('expanded-delivery-not-deployment','Continuous deployment.','Technical Skills','\\textbf{Automation:} CI/CD.','MISSING','CI/CD is not proof of the more specific continuous deployment claim.',['distinction'],false),
    single('expanded-related-cloud','AWS Lambda.','Projects','\\item Stored reports in AWS S3.','PARTIAL','The existing convention treats S3 as related AWS evidence, not Lambda usage.',['distinction']),
    single('expanded-missing-ml','TensorFlow.','Technical Skills','\\textbf{ML tools:} PyTorch, NumPy.','MISSING','Related ML libraries do not establish TensorFlow.',['distinction'],false),
    single('expanded-colon-none','Python.','Coursework','\\item Python experience: none.','CONFLICT','An explicit absence is contradictory evidence, not a positive skill.',['negation']),
    {id:'expanded-mixed-contradiction',jd:'Required: Python.',tags:['negation'],files:[file('mixed','Experience',['\\item No Python experience.','\\item Developed Python applications for a lab.'])],
      gold:[{text:'Python.',classification:'CONFLICT',relevant:['mixed:2:2','mixed:3:3'],forbiddenSupport:['mixed:2:2'],why:'Keep both records visible; never silently choose the positive record over a contradiction.'}]},
    {id:'expanded-unrelated-negation',jd:'Required: Java.',tags:['negation'],files:[file('scoped','Experience',['\\item No Python experience.','\\item Built Java applications.'])],
      gold:[{text:'Java.',classification:'STRONG',relevant:['scoped:3:3'],why:'Python denial does not contradict the independent Java record.'}]},
    single('expanded-certification','AWS certification.','Certifications','\\item AWS Certified Developer certification.','STRONG','The named qualification is explicitly stated.'),
    single('expanded-learning','Python.','Coursework','\\item Introductory Python exercises.','PARTIAL','Learning-level evidence is deliberately ambiguous about practical experience.',['ambiguous']),
    single('expanded-expertise','Expert Python skills.','Projects','\\item Built Python scripts for a lab.','PARTIAL','Actual usage does not establish expertise.',['ambiguous']),
    single('expanded-unknown-tech','TensorFlow.','Technical Skills','\\textbf{ML tools:} TensorFlow, NumPy.','STRONG','Explicit text mention is sufficient for a bare skill even outside the parser technology registry.'),
    single('expanded-csharp-list','C#.','Technical Skills','\\textbf{Languages:} C#, Go, Ruby.','STRONG','The exact language token is present.'),
    single('expanded-production-positive','Production Node.js experience.','Summary','Built Node.js REST APIs in production.','STRONG','Production experience is explicit in the evidence.'),
    single('expanded-sql-mysql','SQL.','Technical Skills','\\textbf{Storage:} MySQL.','MISSING','Do not infer a language skill from mentioning its related database.',['distinction'],false),
    single('expanded-missing-php','PHP.','Technical Skills','\\textbf{Web:} React, Node.js.','MISSING','The named stack does not mention PHP.',[],false),
    single('expanded-duration','3 years of Python experience.','Experience','\\item 6-month Python internship.','CONFLICT','The explicit duration is less than the required duration.'),
    {id:'expanded-multiline-rust',jd:'Required: Rust.',files:[{id:'rust',name:'projects/compiler.tex',newline:'\r\n',lines:['\\section{Projects}','\\item Built \\textbf{Rust} tooling','  for a coursework compiler.']}],
      gold:[{text:'Rust.',classification:'STRONG',relevant:['rust:2:3'],why:'The technology survives formatting and multiline CRLF parsing.'}]},
    single('expanded-soft-skill-ambiguity','Team communication.','Summary','Team communication and collaboration.','PARTIAL','A soft-skill mention does not demonstrate a responsibility or achievement.',['ambiguous']),
    single('expanded-svelte','Svelte.','Projects','\\item Developed a Svelte interface for a club.','STRONG','Explicit usage of a skill outside the technology registry.'),
    single('expanded-negated-pair','CI/CD.','Experience','\\item Never used continuous integration and continuous delivery.','CONFLICT','Equivalent concept remains denied after retrieval normalization.',['negation','paraphrase']),
    single('expanded-uppercase','REDIS.','Technical Skills','\\textbf{Caching:} Redis.','STRONG','Capitalization and punctuation do not change the named tool.'),
    single('expanded-action-overlap','Maintain CI/CD pipelines.','Experience','\\item Maintained staff schedules.','MISSING','An action word alone does not establish the required object.',['paraphrase','distinction'],false),
  ],
  claims:[
    {id:'expanded-missing-ids',after:'Built REST APIs using Node.js.',omitIds:true,valid:false},
    {id:'expanded-null-ids',after:'Built REST APIs using Node.js.',ids:null,valid:false},
    {id:'expanded-object-id',after:'Built REST APIs using Node.js.',ids:['e1',{}],valid:false},
    {id:'expanded-ambiguous-id',after:'Built REST APIs using Node.js.',duplicateEvidence:true,valid:false},
    {id:'expanded-target-outside-set',after:'Built REST APIs using Node.js.',targetId:'unrelated',valid:false},
    {id:'expanded-structured-mention',after:'TensorFlow',evidenceText:'ML tools',technologies:['TensorFlow'],valid:true},
    {id:'expanded-structured-not-production',after:'Used TensorFlow in production.',evidenceText:'ML tools',technologies:['TensorFlow'],valid:false},
    {id:'expanded-none-not-positive',after:'Python',evidenceText:'Python experience: none.',technologies:['Python'],valid:false},
    {id:'expanded-prerequisite-qualification',after:'Led a production migration.',evidenceText:'Assisted with a production migration.',valid:false},
    {id:'expanded-coursework-preserved',after:'Built Python tools for coursework.',evidenceText:'Built Python tools for coursework.',valid:true},
    {id:'expanded-coursework-dropped',after:'Built Python tools.',evidenceText:'Built Python tools for coursework.',valid:false},
  ],
  mapping:[
    {id:'expanded-math-surroundings',source:['\\section{Experience}','\\item Used $x+y$ to explain Redis caches.'],targetLine:2,span:'Redis',expected:['\\section{Experience}','\\item Used $x+y$ to explain \\textbf{Redis} caches.']},
    {id:'expanded-comment-preserved',source:['\\section{Projects}','\\item Built Redis caches. % Keep this note'],targetLine:2,span:'Redis',expected:['\\section{Projects}','\\item Built \\textbf{Redis} caches. % Keep this note']},
    {id:'expanded-mixed-newlines',source:['\\section{Experience}\r','\\item Used Redis caches.\r','  for a lab project.'],targetLine:2,targetEnd:3,span:'Redis',expected:['\\section{Experience}\r','\\item Used \\textbf{Redis} caches.\r','  for a lab project.']},
    {id:'expanded-math-not-editable',source:['\\section{Experience}','\\item Evaluated $Redis$ expressions.'],targetLine:2,span:'Redis',expected:null},
  ],
  outcomes:[],
};
module.exports = {version:2,...Object.fromEntries(['retrieval','claims','mapping','outcomes'].map(group=>[group,[...original[group],...additions[group]]]))};
