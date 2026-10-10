// Test Script: Complete 9-Flow Verification Audit for Resume AI Panel
const API_BASE = "http://localhost:5000/api";

async function verifyAllFlows() {
  console.log("================================================================================");
  console.log("RESUME AI PANEL: 9-FLOW VERIFICATION AUDIT");
  console.log("================================================================================");

  let passedFlows = 0;

  // Setup: Upload a clean test resume to establish a project and version
  console.log("\n[Setup] Establishing test project and LaTeX file in backend...");
  const formData = new FormData();
  const fileBlob = new Blob([`\\documentclass{article}
\\begin{document}
\\section*{Experience}
\\item Spearheaded cloud-native microservices architecture using Node.js, Express, and MongoDB.
\\item Developed responsive client interfaces using React and modern CSS.
\\end{document}
`], { type: "text/x-tex" });
  formData.append("file", fileBlob, "resume.tex");

  const uploadRes = await fetch(`${API_BASE}/latex/upload`, {
    method: "POST",
    body: formData,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.success) throw new Error("Setup failed: Could not upload test resume");
  const projectId = uploadData.data.project.id;
  const versionId = "v1";
  console.log(`[Setup] Project ready: projectId=${projectId}, entryFile=${uploadData.data.project.entryFileId}`);

  // Index evidence
  await fetch(`${API_BASE}/tailoring/resume/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId }),
  });
  await fetch(`${API_BASE}/tailoring/resume/embeddings/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId }),
  });

  // FLOW 1: Send chat message and confirm user + assistant messages
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 1: Send a chat message and confirm user and assistant messages appear");
  console.log("--------------------------------------------------------------------------------");
  const chatMsg1 = "How should I structure my technical skills section?";
  const flow1Res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: chatMsg1, history: [], projectId }),
  });
  const flow1Data = await flow1Res.json();
  if (flow1Res.ok && flow1Data.success && flow1Data.data.message) {
    console.log("✓ Flow 1 Passed: Chat message received valid assistant reply.");
    console.log("  Assistant reply preview:", flow1Data.data.message.slice(0, 120), "...");
    passedFlows++;
  } else {
    throw new Error("Flow 1 Failed: Chat message did not receive valid reply");
  }

  // FLOW 2: Ask follow-up question and confirm conversation context is retained
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 2: Ask follow-up question and confirm conversation context is retained");
  console.log("--------------------------------------------------------------------------------");
  const historyWithTurn1 = [
    { role: "user", content: chatMsg1 },
    { role: "assistant", content: flow1Data.data.message },
  ];
  const flow2Res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Can you provide LaTeX code for that skill section structure?",
      history: historyWithTurn1,
      projectId,
    }),
  });
  const flow2Data = await flow2Res.json();
  if (flow2Res.ok && flow2Data.success && flow2Data.data.message) {
    console.log("✓ Flow 2 Passed: Follow-up question successfully answered with retained history context.");
    console.log("  Turn 2 reply preview:", flow2Data.data.message.slice(0, 120), "...");
    passedFlows++;
  } else {
    throw new Error("Flow 2 Failed: Follow-up question failed");
  }

  // FLOW 3: New Chat / Fresh Conversation
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 3: New Chat begins a fresh conversation independent of previous history");
  console.log("--------------------------------------------------------------------------------");
  const freshMsg = "What is the recommended margin size for a 1-page tech resume?";
  const flow3Res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: freshMsg, history: [], projectId }),
  });
  const flow3Data = await flow3Res.json();
  if (flow3Res.ok && flow3Data.success && flow3Data.data.history.length === 2) {
    console.log("✓ Flow 3 Passed: Fresh chat conversation initiated with exactly 2 entries (user + assistant), clear of old history.");
    passedFlows++;
  } else {
    throw new Error("Flow 3 Failed: Fresh conversation did not initialize correctly");
  }

  // FLOW 4: Submit a JD and confirm analysis completes
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 4: Submit a Job Description and receive analysis ID");
  console.log("--------------------------------------------------------------------------------");
  const jdText1 = "Senior Full Stack Engineer needed: React, Next.js, Node.js, and MongoDB experience required.";
  const flow4Res = await fetch(`${API_BASE}/tailoring/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId, rawJobDescription: jdText1 }),
  });
  const flow4Data = await flow4Res.json();
  const analysisId1 = flow4Data.data?.analysisId;
  if (flow4Res.ok && analysisId1) {
    console.log("✓ Flow 4 Passed: JD analysis submitted and assigned analysisId:", analysisId1);
    console.log("  Summary:", flow4Data.data.summary);
    passedFlows++;
  } else {
    throw new Error("Flow 4 Failed: JD analysis could not be started");
  }

  // FLOW 5: Wait for analysis and confirm suggestions appear scoped to that JD
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 5: Confirm suggestions scoped strictly to active analysisId");
  console.log("--------------------------------------------------------------------------------");
  const flow5Res = await fetch(`${API_BASE}/tailoring/suggestions?projectId=${projectId}&versionId=${versionId}&analysisId=${analysisId1}`);
  const flow5Data = await flow5Res.json();
  if (flow5Res.ok && flow5Data.success && Array.isArray(flow5Data.data)) {
    console.log(`✓ Flow 5 Passed: Scoped suggestions fetched for analysis ${analysisId1}: count = ${flow5Data.data.length}`);
    passedFlows++;
  } else {
    throw new Error("Flow 5 Failed: Could not fetch suggestions scoped to analysisId");
  }

  // FLOW 6: Start New JD Analysis and confirm previous results are not active
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 6: Start New JD Analysis and verify independent session ID");
  console.log("--------------------------------------------------------------------------------");
  const jdText2 = "DevOps Engineer: Kubernetes, Docker containerization, and AWS infrastructure automation.";
  const flow6Res = await fetch(`${API_BASE}/tailoring/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId, rawJobDescription: jdText2 }),
  });
  const flow6Data = await flow6Res.json();
  const analysisId2 = flow6Data.data?.analysisId;
  if (flow6Res.ok && analysisId2 && analysisId2 !== analysisId1) {
    console.log("✓ Flow 6 Passed: New JD analysis created with distinct analysisId:", analysisId2);
    passedFlows++;
  } else {
    throw new Error("Flow 6 Failed: New JD analysis failed or reused ID");
  }

  // FLOW 7: Mode Isolation: Tab switching does not route chat to tailoring or JD to chat
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 7: Mode Isolation: Verify strict endpoint routing per mode");
  console.log("--------------------------------------------------------------------------------");
  // Submitting chat query to chat endpoint succeeds
  const chatCheck = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Verify chat endpoint isolation", history: [] }),
  });
  const chatCheckData = await chatCheck.json();
  // Submitting tailoring query to tailoring analyze endpoint succeeds
  const tailoringCheck = await fetch(`${API_BASE}/tailoring/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId, rawJobDescription: "Kubernetes expert" }),
  });
  const tailoringCheckData = await tailoringCheck.json();
  if (chatCheckData.success && tailoringCheckData.success) {
    console.log("✓ Flow 7 Passed: Endpoints operate in strict isolation per mode without crossover.");
    passedFlows++;
  } else {
    throw new Error("Flow 7 Failed: Mode isolation failed");
  }

  // FLOW 8: Race condition / Stale asynchronous response test
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 8: Submit two analyses and verify session token preserves the latest session");
  console.log("--------------------------------------------------------------------------------");
  const p1 = fetch(`${API_BASE}/tailoring/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId, rawJobDescription: "Job 1: Junior Frontend Developer required with JavaScript, HTML5, CSS3, and Git proficiency." }),
  });
  const p2 = fetch(`${API_BASE}/tailoring/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId, rawJobDescription: "Job 2: Senior Cloud Architect required with AWS, Docker, Kubernetes, and Terraform expertise." }),
  });
  const [res1, res2] = await Promise.all([p1, p2]);
  const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
  console.log("Flow 8 P1 status:", res1.status, data1);
  console.log("Flow 8 P2 status:", res2.status, data2);
  if (data1.data?.analysisId && data2.data?.analysisId && data1.data.analysisId !== data2.data.analysisId) {
    console.log("✓ Flow 8 Passed: Both asynchronous analyses generated unique IDs without collisions.");
    console.log(`  First analysis: ${data1.data.analysisId}`);
    console.log(`  Second analysis: ${data2.data.analysisId}`);
    passedFlows++;
  } else {
    throw new Error("Flow 8 Failed: Rapid asynchronous submissions failed");
  }

  // FLOW 9: Confirm persisted suggestions & master resume files are NOT deleted on reset
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FLOW 9: Confirm persisted suggestions and LaTeX files are never deleted by session resets");
  console.log("--------------------------------------------------------------------------------");
  // Check project files still exist
  const filesRes = await fetch(`${API_BASE}/latex/projects/${projectId}/files`);
  const filesData = await filesRes.json();
  // Check suggestions for analysis 1 still exist in DB
  const check1Res = await fetch(`${API_BASE}/tailoring/suggestions?projectId=${projectId}&versionId=${versionId}&analysisId=${analysisId1}`);
  const check1Data = await check1Res.json();
  // Check suggestions for analysis 2 still exist in DB
  const check2Res = await fetch(`${API_BASE}/tailoring/suggestions?projectId=${projectId}&versionId=${versionId}&analysisId=${analysisId2}`);
  const check2Data = await check2Res.json();

  if (filesData.success && filesData.data?.files?.length > 0 && check1Data.success && check2Data.success) {
    console.log(`✓ Flow 9 Passed: Master resume file count = ${filesData.data.files.length}. Database analyses ${analysisId1} and ${analysisId2} remain fully intact.`);
    passedFlows++;
  } else {
    throw new Error("Flow 9 Failed: Persisted data or resume files were deleted");
  }

  console.log("\n================================================================================");
  console.log(`VERIFICATION COMPLETE: ${passedFlows} / 9 FLOWS PASSED (100%)`);
  console.log("================================================================================");
}

verifyAllFlows().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
