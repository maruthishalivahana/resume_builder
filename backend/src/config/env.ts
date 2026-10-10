import dotenv from "dotenv";
import path from "path";

// Explicitly resolve .env from backend root directory
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });
// Fallback to default search path if needed
dotenv.config();

export const isEnvLoaded = true;
