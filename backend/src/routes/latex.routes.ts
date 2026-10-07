import { Router } from "express";
import { uploadTex } from "../middleware/upload.middleware";
import {
  uploadTexFile,
  getLatestLatexFile,
  createProject,
  getProject,
  getProjectFiles,
  setProjectEntryFile,
  createFile,
  createFolder,
  getLatexFile,
  updateLatexFile,
  deleteFile,
  deleteFolder,
  renameFile,
  renameFolder,
  checkCompilerStatus,
  compileProject,
  getProjectPdf,
  getLatestCompilation,
} from "../controllers/latex.controller";

const router = Router();

// Compiler status check
router.get("/compiler/status", checkCompilerStatus);

// Project routes
router.post("/projects", createProject);
router.get("/projects/:projectId", getProject);
router.get("/projects/:projectId/files", getProjectFiles);
router.patch("/projects/:projectId/entry-file", setProjectEntryFile);
router.post("/projects/:projectId/files", createFile);
router.post("/projects/:projectId/folders", createFolder);

// Compilation & PDF routes
router.post("/projects/:projectId/compile", compileProject);
router.get("/projects/:projectId/pdf", getProjectPdf);
router.get("/projects/:projectId/compilation/latest", getLatestCompilation);

// File routes
router.get("/files/:fileId", getLatexFile);
router.patch("/files/:fileId", updateLatexFile);
router.delete("/files/:fileId", deleteFile);
router.patch("/files/:fileId/name", renameFile);

// Folder routes
router.delete("/folders/:folderId", deleteFolder);
router.patch("/folders/:folderId/name", renameFolder);

// Upload & latest routes (backward compatible)
router.get("/latest", getLatestLatexFile);
router.post("/upload", uploadTex.single("file"), uploadTexFile);

export default router;
