import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { AppError } from "./error.middleware";

// In-memory storage: uploaded files are kept as Buffers in memory
const storage = multer.memoryStorage();

// File filter: only allow files ending with .tex
function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void {
  const originalName = file.originalname.trim();

  if (!originalName.toLowerCase().endsWith(".tex")) {
    cb(new AppError("Invalid file type. Only .tex files are allowed", 400));
    return;
  }

  cb(null, true);
}

// 2 MB maximum file limit
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export const uploadTex = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});
