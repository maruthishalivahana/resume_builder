const assert=require('node:assert/strict'),{createHash}=require('node:crypto');require('tsx/cjs');
const {captureProjectSource}=require('./src/services/latexSourceCapture.service.ts');
const {LatexProject}=require('./src/models/LatexProject.ts'),{LatexFile}=require('./src/models/LatexFile.ts'),{LatexFolder}=require('./src/models/LatexFolder.ts');
const P='aaaaaaaaaaaaaaaaaaaaaaaa',A='bbbbbbbbbbbbbbbbbbbbbbbb',B='cccccccccccccccccccccccc';
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
async function run(){
 const originals=[LatexProject.findById,LatexFile.find,LatexFolder.find];
 let project,files,folders,reads;
 const reset=()=>{project={_id:P,entryFileId:A,sourceVersion:4,treeVersion:2};files=[{_id:A,projectId:P,folderId:null,name:'a.tex',path:'a.tex',content:'A saved',contentRevision:3},{_id:B,projectId:P,folderId:null,name:'b.tex',path:'b.tex',content:'B saved',contentRevision:7}];folders=[];reads=0;
  LatexProject.findById=async()=>({...project});LatexFile.find=async()=>{reads++;return files.map(f=>({...f}))};LatexFolder.find=async()=>folders.map(f=>({...f}));};
 try{
  reset();const captured=await captureProjectSource(P,A);assert.equal(reads,2);assert.equal(captured.sourceCapture.files[0].contentRevision,3);assert.equal(captured.sourceCapture.files[0].sha256,hash('A saved'));
  const {LatexCompilation}=require('./src/models/LatexCompilation.ts');
  const record=new LatexCompilation({projectId:P,status:'success',mainFile:'a.tex',sourceCapture:captured.sourceCapture});
  assert.equal(record.validateSync(),undefined);assert.equal(record.toObject().sourceCapture.files[0].contentRevision,3);
  const legacy=new LatexCompilation({projectId:P,status:'success',mainFile:'a.tex'});assert.equal(legacy.toObject().sourceCapture,undefined);
  files[0].content='server newer';files[0].contentRevision=4;project.sourceVersion++;
  assert.equal(captured.files[0].content,'A saved');assert.equal(captured.sourceCapture.sourceVersion,4);assert.ok(Object.isFrozen(captured.files[0]));
  reset();LatexFile.find=async()=>{reads++;if(reads===1)return[{...files[0]}, {...files[1],content:'B new',contentRevision:8}];return files.map(f=>({...f,content:f._id===A?'A new':'B new',contentRevision:f.contentRevision+1}))};
  const consistent=await captureProjectSource(P,A);assert.equal(reads,4);assert.deepEqual(consistent.files.map(f=>f.content),['A new','B new']);assert.deepEqual(consistent.sourceCapture.files.map(f=>f.contentRevision),[4,8]);
  reset();LatexFile.find=async()=>{reads++;return files.map(f=>({...f,contentRevision:f.contentRevision+reads}))};
  await assert.rejects(captureProjectSource(P,A),e=>e.code==='SOURCE_CAPTURE_CHANGED'||e.message.includes('kept changing'));assert.equal(reads,6);
  reset();let metadataReads=0;LatexProject.findById=async()=>({...project,sourceVersion:metadataReads++===0?3:4});
  assert.equal((await captureProjectSource(P,A)).sourceCapture.sourceVersion,4);assert.equal(reads,4);
  for(const marker of ['pendingWrite','pendingDelete']){reset();files[1][marker]=true;await assert.rejects(captureProjectSource(P,A),/recovery/);}
  reset();project.treeOperation={id:'rename'};await assert.rejects(captureProjectSource(P,A),/tree recovery/);
  reset();let treeReads=0;LatexProject.findById=async()=>({...project,treeVersion:++treeReads===1?2:3});await assert.rejects(captureProjectSource(P,A),/tree changed/);
  reset();files[1].folderId='missing';await assert.rejects(captureProjectSource(P,A),/Parent folder/);
  reset();files[0].content='';delete files[0].contentRevision;files[1].content='Unicode résumé λ';
  const empty=await captureProjectSource(P,B);assert.equal(empty.sourceCapture.files[0].contentRevision,0);assert.equal(empty.sourceCapture.files[0].byteLength,0);assert.equal(empty.sourceCapture.files[1].sha256,hash(files[1].content));assert.equal(empty.sourceCapture.files[1].byteLength,Buffer.byteLength(files[1].content,'utf8'));
  reset();const first=await captureProjectSource(P,A);LatexFile.find=async()=>[...files].reverse().map(f=>({...f}));const reordered=await captureProjectSource(P,A);assert.equal(first.sourceCapture.hash,reordered.sourceCapture.hash);
  assert.equal((await captureProjectSource(P.toUpperCase(),A.toUpperCase())).sourceCapture.hash,first.sourceCapture.hash);
  reset();let primaryReads=0,majorityReads=0;
  const query=value=>({read(preference){assert.equal(preference,'primary');primaryReads++;return this},readConcern(level){assert.equal(level,'majority');majorityReads++;return this},then(resolve,reject){return Promise.resolve(value()).then(resolve,reject)}});
  LatexProject.findById=()=>query(()=>({...project}));LatexFile.find=()=>query(()=>files.map(f=>({...f})));LatexFolder.find=()=>query(()=>[]);
  await captureProjectSource(P,A);assert.equal(primaryReads,8);assert.equal(majorityReads,8);
  console.log('Source capture regressions passed: matching complete inventories, mixed-pass retry, bounded revision churn, metadata race, immutable saved bytes, pending recovery/tree changes, invalid parents, empty/legacy zero, Unicode hashes, deterministic manifest ordering (mocked MongoDB).');
 }finally{[LatexProject.findById,LatexFile.find,LatexFolder.find]=originals;}
}
run().catch(e=>{console.error(e);process.exitCode=1});
