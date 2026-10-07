const fs = require('fs');
const path = require('path');

const sampleTexContent = `\\documentclass{article}

\\begin{document}

Hello RESUME.ENG

\\section*{Experience}

Software Engineer

\\end{document}
`;

async function runTests() {
  console.log('==================================================');
  console.log('STARTING BACKEND TEST SUITE');
  console.log('==================================================\n');

  // Test 1: Health check
  console.log('--- Test 1: GET /api/health ---');
  const healthRes = await fetch('http://localhost:5000/api/health');
  const healthData = await healthRes.json();
  console.log('Status:', healthRes.status);
  console.log('Response:', healthData);
  if (healthRes.status !== 200 || !healthData.success) {
    throw new Error('Health check failed');
  }
  console.log('✓ PASS: Health check endpoint working.\n');

  // Test 2: Valid .tex file upload
  console.log('--- Test 2: POST /api/latex/upload (Valid resume.tex) ---');
  const formData1 = new FormData();
  const fileBlob1 = new Blob([sampleTexContent], { type: 'text/plain' });
  formData1.append('file', fileBlob1, 'resume.tex');

  const uploadRes = await fetch('http://localhost:5000/api/latex/upload', {
    method: 'POST',
    body: formData1,
  });
  const uploadData = await uploadRes.json();
  console.log('Status:', uploadRes.status);
  console.log('Response:', JSON.stringify(uploadData, null, 2));

  if (uploadRes.status !== 201 || !uploadData.success) {
    throw new Error('Valid upload failed');
  }
  if (!uploadData.data.project.id || !uploadData.data.file.id) {
    throw new Error('Project ID or File ID missing');
  }
  if (uploadData.data.project.name !== 'resume') {
    throw new Error(`Expected project name 'resume', got: ${uploadData.data.project.name}`);
  }
  if (uploadData.data.file.content !== sampleTexContent) {
    throw new Error('File content does not match uploaded content');
  }
  console.log('✓ PASS: Valid .tex upload created project and file with matching content.\n');

  // Test 3: Invalid .txt upload
  console.log('--- Test 3: POST /api/latex/upload (Invalid file extension .txt) ---');
  const formData2 = new FormData();
  const fileBlob2 = new Blob(['Not a latex file'], { type: 'text/plain' });
  formData2.append('file', fileBlob2, 'document.txt');

  const invalidExtRes = await fetch('http://localhost:5000/api/latex/upload', {
    method: 'POST',
    body: formData2,
  });
  const invalidExtData = await invalidExtRes.json();
  console.log('Status:', invalidExtRes.status);
  console.log('Response:', invalidExtData);

  if (invalidExtRes.status !== 400 || invalidExtData.success !== false) {
    throw new Error('Invalid extension did not return 400 error');
  }
  console.log('✓ PASS: Invalid extension rejected with HTTP 400.\n');

  // Test 4: Missing file field
  console.log('--- Test 4: POST /api/latex/upload (Missing file) ---');
  const formData3 = new FormData();
  formData3.append('unrelated', 'nothing');

  const missingFileRes = await fetch('http://localhost:5000/api/latex/upload', {
    method: 'POST',
    body: formData3,
  });
  const missingFileData = await missingFileRes.json();
  console.log('Status:', missingFileRes.status);
  console.log('Response:', missingFileData);

  if (missingFileRes.status !== 400 || missingFileData.success !== false) {
    throw new Error('Missing file did not return 400 error');
  }
  console.log('✓ PASS: Missing file rejected with HTTP 400.\n');

  // Test 5: File exceeding 2 MB
  console.log('--- Test 5: POST /api/latex/upload (File > 2 MB) ---');
  const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024, 'A'); // 2.5 MB
  const formData4 = new FormData();
  const fileBlob4 = new Blob([largeBuffer], { type: 'text/plain' });
  formData4.append('file', fileBlob4, 'huge_file.tex');

  const largeFileRes = await fetch('http://localhost:5000/api/latex/upload', {
    method: 'POST',
    body: formData4,
  });
  const largeFileData = await largeFileRes.json();
  console.log('Status:', largeFileRes.status);
  console.log('Response:', largeFileData);

  if (largeFileRes.status !== 400 || largeFileData.success !== false) {
    throw new Error('File > 2 MB did not return 400 error');
  }
  console.log('✓ PASS: File > 2 MB rejected with HTTP 400.\n');

  // Test 6: Verify MongoDB Persistence directly via Mongoose
  console.log('--- Test 6: Verify MongoDB Documents in Database ---');
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27017/resume_eng');

  const projectDoc = await mongoose.connection.collection('latexprojects').findOne({
    _id: new mongoose.Types.ObjectId(uploadData.data.project.id)
  });
  console.log('Persisted Project Doc in MongoDB:', projectDoc);

  const fileDoc = await mongoose.connection.collection('latexfiles').findOne({
    _id: new mongoose.Types.ObjectId(uploadData.data.file.id)
  });
  console.log('Persisted File Doc in MongoDB:');
  console.log('  name:', fileDoc.name);
  console.log('  path:', fileDoc.path);
  console.log('  language:', fileDoc.language);
  console.log('  projectId:', fileDoc.projectId.toString());
  console.log('  contentLength:', fileDoc.content.length);
  console.log('  content exact match?:', fileDoc.content === sampleTexContent);

  if (!projectDoc || !fileDoc || fileDoc.content !== sampleTexContent) {
    throw new Error('MongoDB verification failed');
  }
  await mongoose.disconnect();
  console.log('✓ PASS: MongoDB persistence fully verified.\n');

  // Test 7: Verify server remains stable
  console.log('--- Test 7: Server Stability Check after failed requests ---');
  const finalHealth = await fetch('http://localhost:5000/api/health');
  const finalHealthData = await finalHealth.json();
  if (finalHealth.status !== 200 || !finalHealthData.success) {
    throw new Error('Server not healthy after failures');
  }
  console.log('✓ PASS: Server remains fully responsive and stable.\n');

  console.log('==================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (7/7)');
  console.log('==================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
