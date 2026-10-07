import express, { Application, Request, Response } from "express";
import cors from "cors";
import latexRoutes from "./routes/latex.routes";
import { errorMiddleware } from "./middleware/error.middleware";

export function createApp(): Application {
  const app = express();

  // CORS configuration
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  app.use(
    cors({
      origin: clientUrl,
      credentials: true,
    })
  );

  // Body parser for JSON
  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "RESUME.ENG backend is running",
    });
  });

  // LaTeX feature routes
  app.use("/api/latex", latexRoutes);

  // Centralized Error Handling Middleware (must be after all routes)
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();
