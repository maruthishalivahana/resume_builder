import "./config/env";

import { connectDB } from "./config/db";
import { app } from "./app";

const PORT = process.env.PORT || 5000;

async function bootstrap(): Promise<void> {
  // 2. Connect to database
  await connectDB();

  // 3. Start Express HTTP server
  app.listen(PORT, () => {
    console.log(`[Server] Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[Server] Fatal bootstrap error:", err);
  process.exit(1);
});
