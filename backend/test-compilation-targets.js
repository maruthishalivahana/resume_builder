const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
require("tsx/cjs");
const { LatexCompilerService } = require("./src/services/latexCompiler.service.ts");
const { LatexProject } = require("./src/models/LatexProject.ts");
const { LatexCompilation } = require("./src/models/LatexCompilation.ts");
const { getCompilationHistory } = require("./src/controllers/latex.controller.ts");
const ast = ts.createSourceFile("hook.tsx", fs.readFileSync(path.join(__dirname,"../hooks/use-resume.tsx"),"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function hook(name,deps){let body;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)body=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(body);const code=ts.transpileModule(`const fn=${body}`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;return new Function(...Object.keys(deps),code+";return fn")(...Object.values(deps));}
const P="aaaaaaaaaaaaaaaaaaaaaaaa", A="bbbbbbbbbbbbbbbbbbbbbbbb", B="cccccccccccccccccccccccc";
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
async function run(){
 const {readCompileTarget,writeCompileTarget}=require('../lib/compile-target-preference.ts');
 const oldWindow=global.window, storage=new Map();
 try { global.window={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  writeCompileTarget(P,B); assert.equal(readCompileTarget(P,[{id:B,path:'b.tex'}],A),B);
  assert.equal(readCompileTarget(P,[],A),A);assert.equal(readCompileTarget('other',[{id:B,path:'b.tex'}],A),A);
  global.window={get localStorage(){throw new Error('blocked')}};assert.equal(readCompileTarget(P,[],A),A);writeCompileTarget(P,B);
 }finally{global.window=oldWindow;}
 const api=require('../lib/api/latex.ts'),oldFetch=global.fetch;
 try {global.fetch=async url=>{assert.ok(url.includes('entryFileId='+B));return{ok:true,json:async()=>({success:true,data:{state:'valid',latest:{_id:'build-B',compiledEntryFileId:B,mainFile:'b.tex',status:'success',stdout:'B log',compileErrors:[],durationMs:12},successful:{_id:'build-B',compiledEntryFileId:B,mainFile:'b.tex'},pdf:{url:'pdf?compilationId=build-B'}}})}};
  const adapted=await api.fetchLatestCompilation(P,B);assert.equal(adapted.latest.compilationId,'build-B');assert.equal(adapted.latest.entryFileId,B);assert.equal(adapted.successful.entryFilePath,'b.tex');assert.equal(adapted.latest.logs.stdout,'B log');
 }finally{global.fetch=oldFetch;}
 const originalProject=LatexProject.findById, originalFind=LatexCompilation.findOne, originalHistory=LatexCompilation.find;
 const dir=fs.mkdtempSync(path.join(require('os').tmpdir(),'target-build-test-'));const pdf=path.join(dir,'a.pdf');fs.writeFileSync(pdf,'%PDF-test');
 const records=[{_id:'1',projectId:P,compiledEntryFileId:A,status:'success',sourceVersion:2,pdfPath:pdf,mainFile:'a.tex'},
 {_id:'2',projectId:P,compiledEntryFileId:B,status:'failed',sourceVersion:2,pdfPath:null,mainFile:'b.tex'}];
 try{
  LatexProject.findById=async()=>({entryFileId:A,sourceVersion:2});
  LatexCompilation.findOne=filter=>({sort:async()=>[...records].reverse().find(r=>Object.entries(filter).every(([k,v])=>k==='pdfPath'?r.pdfPath!==null:r[k]===v))??null});
  const a=await LatexCompilerService.getProjectCompilationState(P,A),b=await LatexCompilerService.getProjectCompilationState(P,B);
  assert.equal(a.state,'valid');assert.equal(a.successful._id,'1');assert.equal(a.latest._id,'1');
  assert.equal(b.latest._id,'2');assert.equal(b.successful,null);assert.equal(b.pdf,null);
  records.push({...records[0],_id:'3',status:'failed',pdfPath:null});
  assert.equal((await LatexCompilerService.getProjectCompilationState(P,A)).state,'failed-with-previous');
  let filter,skip,limit;
  LatexCompilation.find=f=>{filter=f;return{sort(){return this},skip(n){skip=n;return this},limit:async n=>{limit=n;return Array.from({length:21},(_,i)=>({...records[0],_id:String(i)}))}}};
  let response,error;
  await getCompilationHistory({params:{projectId:P},query:{entryFileId:A,page:'2'}},{json:r=>response=r},e=>error=e);
  assert.equal(error,undefined);assert.deepEqual(filter,{projectId:P,compiledEntryFileId:A});assert.equal(skip,20);assert.equal(limit,21);assert.equal(response.data.builds.length,20);assert.equal(response.data.hasMore,true);
  await getCompilationHistory({params:{projectId:P},query:{entryFileId:'bad'}},{json:()=>assert.fail()},e=>error=e);assert.equal(error.statusCode,400);
 }finally{LatexProject.findById=originalProject;LatexCompilation.findOne=originalFind;LatexCompilation.find=originalHistory;fs.rmSync(dir,{recursive:true,force:true});}
 const state={},set=k=>v=>state[k]=typeof v==='function'?v(state[k]):v,noop=()=>{};
 const deps={writeCompileTarget:()=>{},projectIdRef:{current:P},compileTargetRef:{current:null},targetRequestSeq:{current:0},files:[{id:A,path:'a.tex'},{id:B,path:'b.tex'}],
  setCompileTargetId:set('target'),setTargetLoadError:set('error'),setBuildHistory:set('history'),setPreviewBuild:set('build'),setPdfUrl:set('pdf'),setPdfState:set('pdfState'),setCompileStatus:set('status'),setCompileErrors:set('errors'),setCompileLog:set('log'),setIsPdfStale:noop,
  applyCompilationState:s=>{state.pdf=s?.pdf?.url??null},saveManagerRef:{current:{status:()=> 'saved'}},markPdfSourceChanged:noop};
 const pending=gate();deps.fetchLatestCompilation=async(p,t)=>t===A?pending.promise:{pdf:null};deps.fetchCompilationHistory=async(p,t)=>({builds:[],page:1,hasMore:false,target:t});
 const select=hook('selectCompileTarget',deps);const loadingA=select(A);await select(B);pending.resolve({pdf:{url:'A.pdf'}});await loadingA;
 assert.equal(state.target,B);assert.equal(state.pdf,null);assert.equal(state.history.target,B);
 deps.fetchLatestCompilation=async()=>{throw new Error('offline')};await hook('selectCompileTarget',deps)(B);assert.equal(state.pdf,null);assert.equal(state.error,'offline');
 const show=hook('showCompilationBuild',deps);show({_id:'A-build',projectId:P,compiledEntryFileId:A,status:'success',pdfPath:'a',mainFile:'a.tex'});assert.equal(state.pdf,null);
 deps.getLatexPdfUrl=p=>'/projects/'+p+'/pdf';
 const show2=hook('showCompilationBuild',deps);show2({_id:'B-build',projectId:P,compiledEntryFileId:B,status:'success',pdfPath:'b',mainFile:'b.tex'});assert.match(state.pdf,/compilationId=B-build$/);assert.deepEqual(state.build,{id:'B-build',path:'b.tex'});
 show2({_id:'B-failed',projectId:P,compiledEntryFileId:B,status:'failed',mainFile:'b.tex'});assert.equal(state.pdf,null);assert.equal(state.build,null);
 console.log('Target regressions passed: filtered latest/fallback, paginated history, stale A load after B, load errors, historical artifact identity and cross-target rejection (mocked persistence; actual service/hook callbacks).');
}
run().catch(e=>{console.error(e);process.exitCode=1});
