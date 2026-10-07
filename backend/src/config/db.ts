import mongoose from "mongoose";

/**
 * Connect to MongoDB Atlas / MongoDB instance.
 * Fails application startup if MONGODB_URI is missing or if connection fails.
 */
export async function connectDB(): Promise<typeof mongoose> {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error("FATAL: MONGODB_URI is not defined in environment variables.");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`[Database] Connected successfully to MongoDB host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("[Database] Failed to connect to MongoDB:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
