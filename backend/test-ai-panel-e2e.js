// Using Node native fetch

const API_BASE = "http://localhost:5000/api";

async function runTest() {
  console.log("==================================================");
  console.log("TESTING RESUME AI PANEL ENDPOINTS & SESSIONS");
  console.log("==================================================");

  // 1. Health check
  const healthRes = await fetch("http://localhost:5000/api/health");
  const healthData = await healthRes.json();
  console.log("1. Health Check:", healthData);
  if (!healthData.success) throw new Error("Health check failed");

  // 2. Chat initial message
  console.log("\n2. Sending initial Chat message...");
  const chat1Res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "How can I improve my resume's technical impact?",
      history: [],
    }),
  });
  const chat1Data = await chat1Res.json();
  console.log("Chat 1 status:", chat1Res.status);
  console.log("Chat 1 full response:", chat1Data);
  if (!chat1Data.success || !chat1Data.data?.message) {
    throw new Error("Chat initial message failed");
  }

  // 3. Chat follow-up with history context
  console.log("\n3. Sending Chat follow-up message with conversation history...");
  const history = [
    { role: "user", content: "How can I improve my resume's technical impact?" },
    { role: "assistant", content: chat1Data.data.message },
  ];
  const chat2Res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Give me 2 concise bullet examples following the XYZ formula.",
      history,
    }),
  });
  const chat2Data = await chat2Res.json();
  console.log("Chat 2 status:", chat2Res.status);
  console.log("Chat 2 reply length:", chat2Data.data?.message?.length);
  console.log("Chat 2 reply preview:", chat2Data.data?.message?.slice(0, 100));
  if (!chat2Data.success || !chat2Data.data?.message) {
    throw new Error("Chat follow-up failed");
  }

  // 4. Job Tailoring: Create upload project first to have valid project and version
  console.log("\n4. Uploading LaTeX test resume to establish projectId & versionId...");
  const formData = new FormData();
  const fileBlob = new Blob([`
\\documentclass{article}
\\begin{document}
\\section*{Experience}
\\item Built high-throughput microservices using Node.js, TypeScript, and MongoDB.
\\item Implemented front-end user interfaces using React and Next.js.
\\end{document}
`], { type: "text/x-tex" });
  formData.append("file", fileBlob, "resume.tex");

  const uploadRes = await fetch(`${API_BASE}/latex/upload`, {
    method: "POST",
    body: formData,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.success) throw new Error("Resume upload failed");
  const projectId = uploadData.data.project.id;
  const versionId = "v1";
  console.log(`Uploaded test resume: projectId=${projectId}`);

  // Index resume
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
  console.log("Resume evidence indexed successfully.");

  // 5. Run JD Analysis #1 (React / Next.js role)
  console.log("\n5. Running Analysis #1 (React / Next.js Role)...");
  const jd1 = "Looking for a Senior Frontend Engineer proficient in React, Next.js, and TypeScript.";
  const analyze1Res = await fetch(`${API_BASE}/tailoring/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId, rawJobDescription: jd1 }),
  });
  const analyze1Data = await analyze1Res.json();
  const analysisId1 = analyze1Data.data?.analysisId;
  console.log(`Analysis #1 complete: analysisId=${analysisId1}`);
  if (!analysisId1) throw new Error("Analysis #1 failed to return analysisId");

  const suggestions1Res = await fetch(`${API_BASE}/tailoring/suggestions?projectId=${projectId}&versionId=${versionId}&analysisId=${analysisId1}`);
  const suggestions1Data = await suggestions1Res.json();
  console.log(`Analysis #1 returned ${suggestions1Data.data?.length ?? 0} scoped suggestions`);

  // 6. Run JD Analysis #2 (Node.js / MongoDB backend role)
  console.log("\n6. Running Analysis #2 (Node.js / MongoDB Backend Role)...");
  const jd2 = "Seeking a Backend Engineer with strong expertise in Node.js, MongoDB database modeling, and microservices architecture.";
  const analyze2Res = await fetch(`${API_BASE}/tailoring/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId, rawJobDescription: jd2 }),
  });
  const analyze2Data = await analyze2Res.json();
  const analysisId2 = analyze2Data.data?.analysisId;
  console.log(`Analysis #2 complete: analysisId=${analysisId2}`);
  if (!analysisId2) throw new Error("Analysis #2 failed to return analysisId");

  const suggestions2Res = await fetch(`${API_BASE}/tailoring/suggestions?projectId=${projectId}&versionId=${versionId}&analysisId=${analysisId2}`);
  const suggestions2Data = await suggestions2Res.json();
  console.log(`Analysis #2 returned ${suggestions2Data.data?.length ?? 0} scoped suggestions`);

  // 7. Verify session scoping: Analysis #1 suggestions are still intact and separate from Analysis #2
  console.log("\n7. Verifying Session Isolation...");
  console.log(`Analysis 1 ID: ${analysisId1} !== Analysis 2 ID: ${analysisId2}:`, analysisId1 !== analysisId2);
  if (analysisId1 === analysisId2) throw new Error("Analysis IDs should be distinct");

  const recheck1Res = await fetch(`${API_BASE}/tailoring/suggestions?projectId=${projectId}&versionId=${versionId}&analysisId=${analysisId1}`);
  const recheck1Data = await recheck1Res.json();
  console.log(`Analysis #1 suggestions re-fetched: ${recheck1Data.data?.length} suggestions intact.`);
  if (recheck1Data.data?.length !== suggestions1Data.data?.length) {
    throw new Error("Analysis #1 suggestions were corrupted or overwritten!");
  }

  console.log("\n==================================================");
  console.log("✓ ALL RESUME AI PANEL E2E BACKEND TESTS PASSED!");
  console.log("==================================================");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
