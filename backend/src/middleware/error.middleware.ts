import { Request, Response, NextFunction } from "express";
import multer from "multer";
import mongoose from "mongoose";

export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        success: false,
        message: "File size exceeds 2 MB limit",
      });
      return;
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({
        success: false,
        message: `Unexpected field: ${err.field}. Expected field name is 'file'`,
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
    return;
  }

  // Custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code, error: { code: err.code, message: err.message } } : {}),
    });
    return;
  }

  // Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      success: false,
      message: `Validation Error: ${messages.join(", ")}`,
    });
    return;
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: `Invalid ID format for field '${err.path}'`,
    });
    return;
  }

  // Standard Error instance
  if (err instanceof Error) {
    console.error(`[Server Error] ${err.name}: ${err.message}`);
    // Check if error message matches common client errors
    if (
      err.message.includes(".tex") ||
      err.message.includes("upload") ||
      err.message.includes("required")
    ) {
      res.status(400).json({
        success: false,
        message: err.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "An unexpected server error occurred",
    });
    return;
  }

  // Fallback for unknown exceptions
  console.error("[Server Error] Unknown error:", err);
  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred",
  });
}
