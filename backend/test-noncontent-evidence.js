/* eslint-disable @typescript-eslint/no-require-imports -- Standalone deterministic parser regression. */
const assert=require('node:assert/strict');
require('tsx/cjs');
const {maskLatexEvidenceMetadata}=require('./src/modules/job-tailoring/utils/latex-evidence-text.util.ts');
const {ResumeEvidenceParserService}=require('./src/modules/job-tailoring/services/resume-evidence-parser.service.ts');
const {RequirementExtractorService}=require('./src/modules/job-tailoring/services/requirement-extractor.service.ts');
const {EvidenceRankerService}=require('./src/modules/job-tailoring/services/evidence-ranker.service.ts');
const {MatchClassifierService}=require('./src/modules/job-tailoring/services/match-classifier.service.ts');
const {EvidenceValidatorService}=require('./src/modules/job-tailoring/services/evidence-validator.service.ts');
const {createEvidenceSourcePatch}=require('./src/modules/job-tailoring/utils/source-range.util.ts');
const {applySourcePatchContent}=require('./src/modules/job-tailoring/services/source-patch.service.ts');
const parser=new ResumeEvidenceParserService();
const parse=content=>parser.parseFiles('p','v',[{id:'f',name:'sections/work.tex',content}]);
const metadata=[String.raw`\label{Python}`,String.raw`\ref*{Python}`,String.raw`\pageref{Python}`,String.raw`\eqref{Python}`,
  String.raw`\autoref{Python}`,String.raw`\nameref{Python}`,String.raw`\cref{Python}`,String.raw`\Cref{Python}`,
  String.raw`\cite[Python][page 2]{Python}`,String.raw`\citep{Python}`,String.raw`\citet{Python}`,String.raw`\nocite{Python}`,
  String.raw`\bibliography{Python}`,String.raw`\bibliographystyle{Python}`,String.raw`\includegraphics[alt=Python]{Python.png}`,
  String.raw`\url{https://example.invalid/Python}`,String.raw`\label{meta:{Python}}`,String.raw`\label{meta:\{Python\}}`];
for(const command of metadata){
  const raw=`\\item ${command} Wrote Perl tools.`;
  const item=parse('\\section{Projects}\n'+raw).evidence[0];
  assert.equal(item.text,'Wrote Perl tools.',command);assert.equal(item.rawText,raw);
  assert.ok(!JSON.stringify([item.technologies,item.normalizedTechnologies,item.entities,item.metadata]).includes('Python'));
  const req=new RequirementExtractorService().extract('Required: Python.')[0];
  const ranked=new EvidenceRankerService().rank(req,[item]);
  assert.equal(new MatchClassifierService().classifyDetailed(req,ranked).classification,'MISSING');
  assert.ok(new EvidenceValidatorService().validate(req,ranked).every(row=>!row.supports));
}
for(const newline of ['\n','\r\n']){
  const block=['\\item Wrote Perl tools \\label{','  Python % } is a comment, not a group terminator','} for coursework.'].join(newline);
  const source='\\section{Projects}'+newline+block+newline+'\\end{itemize}';
  const item=parse(source).evidence[0];
  assert.equal(item.text,'Wrote Perl tools for coursework.');assert.equal(item.rawText,block);
  assert.deepEqual(item.source,{fileId:'f',fileName:'sections/work.tex',lineStart:2,lineEnd:4});
  const masked=maskLatexEvidenceMetadata(source).text;
  assert.equal(masked.length,source.length);assert.deepEqual(masked.match(/\r\n|\n/g),source.match(/\r\n|\n/g));
  const after=block.replace('Perl','\\textbf{Perl}');
  const patch=createEvidenceSourcePatch(source,item,{before:block,after});
  assert.equal(applySourcePatchContent(source,patch).updatedContent,source.replace(block,()=>after));
}
for(const link of [String.raw`\href{https://example.invalid/Python}{Built Perl tools.}`,
  String.raw`\href[title=Python]{https://example.invalid/{Python}}{Built \textbf{Perl} tools.}`,
  '\\href{https://example.invalid/\nPython}{Built Perl tools.}',String.raw`\hyperlink{Python}{Built Perl tools.}`]){
  const item=parse('\\section{Projects}\n\\item '+link).evidence[0];
  assert.equal(item.text,'Built Perl tools.');assert.ok(!item.technologies.includes('Python'));
}
const visible=parse(String.raw`\section{Projects}`+'\n'+String.raw`\item \href{https://example.invalid/Perl}{Built Python tools.}`).evidence[0];
assert.equal(visible.text,'Built Python tools.');assert.ok(visible.technologies.includes('Python'),'Visible anchor text remains evidence');
for(const raw of [String.raw`\item Built Perl tools. \label{Python`,String.raw`\item Built Perl tools. \cite[Python`,String.raw`\item Built Perl tools. \ref Python`]){
  const result=parse('\\section{Projects}\n'+raw);assert.ok(result.warnings.length);
  assert.ok(result.evidence.every(item=>!item.text.includes('Python')),'Malformed metadata fails closed');
}
const controls=[String.raw`\item Built \textbf{Python} tools.`,String.raw`\resumeItem{Built Python tools.}`,String.raw`\item Wrote Python code. % \label{unclosed`];
for(const raw of controls){const result=parse('\\section{Projects}\n'+raw);assert.equal(result.warnings.length,0);assert.ok(result.evidence[0].technologies.includes('Python'));assert.equal(result.evidence[0].rawText,raw);}
const tokenBoundary=parse('\\section{Projects}\n'+String.raw`\item \labelled{Python} tools.`).evidence[0];
assert.ok(tokenBoundary.text.includes('Python'),'Do not treat a longer unknown macro name as label');
console.log('Non-content evidence: 18 command cases, balanced multiline LF/CRLF mapping, link destinations versus display text, malformed input, comments and positive controls passed.');
