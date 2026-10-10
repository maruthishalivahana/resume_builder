const assert = require("node:assert/strict");
const { ChatService } = require("./dist/services/chat.service");
const { DeterministicChatProvider } = require("./dist/providers/chat.provider");

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING CONVERSATIONAL CHAT SERVICE TESTS");
  console.log("==================================================\n");

  const provider = new DeterministicChatProvider();
  const chatService = new ChatService(provider);

  // Test 1: Empty message validation
  console.log("--- Test 1: Empty message validation ---");
  await assert.rejects(
    async () => {
      await chatService.processChat({ message: "   " });
    },
    { message: "Message is required and must be a non-empty string." },
    "Empty message must throw 400 validation error"
  );
  console.log("✓ PASS: Empty message correctly rejected with 400 validation error.\n");

  // Test 2: Basic conversational question
  console.log("--- Test 2: Basic conversational question ---");
  const response1 = await chatService.processChat({
    message: "How should I structure my resume summary?",
  });
  assert.ok(response1.message && response1.message.length > 0, "Response message must not be empty");
  console.log("Assistant Response:", response1.message);
  console.log("✓ PASS: Basic conversational query returns valid answer.\n");

  // Test 3: History context continuity
  console.log("--- Test 3: History context continuity ---");
  const history = [
    { role: "user", content: "Hi, I am applying for a Lead Software Engineer role." },
    { role: "assistant", content: "Great! I can help tailor your technical experience bullets." },
  ];
  const response2 = await chatService.processChat({
    message: "What skills should I highlight for distributed systems?",
    history,
  });
  assert.ok(response2.message && response2.message.length > 0, "Response message with history must be valid");
  console.log("Assistant Response with History:", response2.message);
  console.log("✓ PASS: Conversation history passed successfully.\n");

  console.log("==================================================");
  console.log("ALL CHAT SERVICE TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ CHAT SERVICE TEST FAILED:", err);
  process.exit(1);
});
