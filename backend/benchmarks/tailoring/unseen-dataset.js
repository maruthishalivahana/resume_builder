/* eslint-disable @typescript-eslint/no-require-imports -- Frozen synthetic evaluation fixtures. */
// New after candidate selection; freeze labels before executing. Do not tune
// production code or revise these labels in response to this evaluation.
const single=(id,requirement,section,lines,classification,spans,why,tags=[])=>({id,jd:`Required: ${requirement}`,tags,
  files:[{id:'resume',name:`sections/${id}.tex`,lines:[`\\section{${section}}`,...lines]}],
  gold:[{text:requirement,classification,spans,why,relevant:classification==='MISSING'?[]:[`resume:2:${lines.length+1}`]}]});
const retrieval=[
  single('unseen-elixir-project','Elixir.','Projects',['\\item Implemented Elixir workers for a student timetable.'],'STRONG',['Elixir'],'Explicit named language in a project.'),
  single('unseen-postgres-category','PostgreSQL.','Technical Skills',['\\textbf{Databases:} PostgreSQL; Neo4j.'],'STRONG',['PostgreSQL'],'Exact database mention outside a formatting argument.'),
  single('unseen-redis-summary','Redis.','Summary',['Built Redis caches for a campus notice board.'],'STRONG',['Redis'],'Summary states the exact tool.'),
  single('unseen-bash-coursework','Bash.','Coursework',['\\item Wrote Bash scripts to archive laboratory reports.'],'STRONG',['Bash'],'Explicit scripting use; no professional qualification requested.'),
  single('unseen-kotlin-not-java','Java.','Projects',['\\item Wrote Kotlin utilities for an Android club.'],'MISSING',[],'Kotlin does not establish Java.',['distinction']),
  single('unseen-nosql-language','SQL.','Technical Skills',['\\textbf{Storage:} NoSQL document collections.'],'MISSING',[],'NoSQL does not establish SQL.',['distinction']),
  single('unseen-k8s-missing','Kubernetes.','Experience',['\\item Containerized a class assignment using Podman.'],'MISSING',[],'Related container tooling does not establish Kubernetes.'),
  single('unseen-denial-ruby','Ruby.','Experience',['\\item I have never used Ruby; maintained Perl scripts.'],'CONFLICT',[],'Explicit denial is not supporting Ruby evidence.',['negation']),
  single('unseen-denial-go','Go.','Technical Skills',['\\item No experience with Go.'],'CONFLICT',[],'Experience denial scopes to Go.',['negation']),
  single('unseen-learning-python','Python.','Coursework',['\\item Introductory Python notebook exercises.'],'PARTIAL',['Python'],'Learning context supports a bare mention, not proficiency.',['ambiguous']),
  single('unseen-production-rust','Production Rust experience.','Projects',['\\item Built Rust utilities for coursework.'],'PARTIAL',[],'Coursework does not establish production experience.',['qualification']),
  single('unseen-proficiency-js','Expert JavaScript skills.','Projects',['\\item Wrote JavaScript validation for a club form.'],'PARTIAL',[],'Usage does not establish expertise.',['qualification']),
  single('unseen-cicd-summary','CI/CD.','Summary',['Supported continuous integration and continuous delivery for a seminar demo.'],'STRONG',['continuous integration and continuous delivery'],'Explicit paired concept, without inferring deployment.',['paraphrase']),
  single('unseen-deployment-not-delivery','Continuous deployment.','Technical Skills',['\\textbf{Automation:} CI/CD.'],'MISSING',[],'Delivery does not establish continuous deployment.',['distinction']),
  single('unseen-opaque-environment','Terraform.','Projects',['\\resumeItem{Used Terraform to describe a laboratory sandbox.}'],'STRONG',[],'Tool mention is valid; custom macro arguments remain uneditable.',['source']),
  single('unseen-existing-emphasis','GraphQL.','Experience',['\\item Built \\emph{GraphQL} endpoints for a demo.'],'STRONG',[],'Existing command argument is ineligible for another highlight.',['source']),
  single('unseen-crlf-continuation','Svelte.','Projects',['\\item Built a Svelte dashboard','  for café volunteers.'],'STRONG',['Svelte'],'One raw multiline bullet; Unicode context must remain intact.',['source']),
  single('unseen-label-only','Python.','Projects',['\\item \\label{Python} Wrote Perl tools.'],'MISSING',[],'A LaTeX label is not a resume fact.',['source','distinction']),
  single('unseen-qualification-denial','Docker.','Projects',['\\item No professional Docker experience; used Docker in a lab.'],'PARTIAL',[],'A qualified denial does not deny bare usage, but the repeated literal span is uneditable.',['ambiguous']),
  {id:'unseen-multiple-files',jd:'Required: DuckDB.',tags:['multi-file'],files:[
    {id:'noise',name:'summary.tex',lines:['\\section{Summary}','Built a Vue dashboard.']},
    {id:'target',name:'projects/data.tex',lines:['\\section{Projects}','\\item Queried DuckDB datasets for a reading group.']},
    {id:'other',name:'skills/tools.tex',lines:['\\section{Technical Skills}','\\textbf{Tools:} Git, Make.']}],
    gold:[{text:'DuckDB.',classification:'STRONG',spans:['DuckDB'],relevant:['target:2:2'],why:'Relevant evidence is in a nested file, not the first file.'}]},
];
retrieval.find(item=>item.id==='unseen-crlf-continuation').files[0].newline='\r\n';
module.exports={version:'unseen-1',retrieval};
