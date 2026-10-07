"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Resume, AISuggestion, ExperienceItem, PersonalInfo, ResumeSectionMeta } from "@/types/resume";
import { initialMasterResume, mockAISuggestions, sampleLatexCode, mockATSEvaluation } from "@/lib/mock-data";
import { LatexFileItem, LatexFolderItem, UploadStatus } from "@/types/latex";
import {
  uploadLatexFile,
  fetchLatestLatexFile,
  patchLatexFile,
  UploadLatexResponse,
  fetchProjectFiles,
  fetchLatexFile,
  createLatexFile,
  createLatexFolder,
  deleteLatexFile,
  deleteLatexFolder,
  renameLatexFile,
  renameLatexFolder,
  createLatexProject,
  compileLatexProject,
  getLatexPdfUrl,
  fetchLatestCompilation,
  CompilationState,
  PdfState,
  fetchLatexProject,
  setLatexProjectEntryFile,
  checkCompilerStatus,
  CompileErrorItem,
  CompilerStatusData,
} from "@/lib/api/latex";

interface ResumeContextType {
  resume: Resume;
  activeSectionId: string;
  selectedBulletId: string | null;
  activeSuggestion: AISuggestion | null;
  aiSuggestions: AISuggestion[];
  isCompiling: boolean;
  compileStatus: "idle" | "compiling" | "success" | "error";
  compileLog: string;
  compileErrors: CompileErrorItem[];
  compileDuration: number | null;
  lastCompiledAt: Date | null;
  isPdfStale: boolean;
  pdfState: PdfState;
  pdfUrl: string | null;
  activeErrorLine: number | null;
  compilerInfo: CompilerStatusData | null;
  saveStatus: "saved" | "saving";
  latexCode: string;
  pdfScale: number;
  pdfPage: number;
  totalPages: number;

  // Sidebar Shell State
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Shortcuts Modal State
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;

  // AI Assistant Drawer State
  isAIAssistantOpen: boolean;
  aiAssistantView: "contextual" | "ats_fixes" | "jd_match" | "tailor";
  setIsAIAssistantOpen: (open: boolean) => void;
  setAiAssistantView: (view: "contextual" | "ats_fixes" | "jd_match" | "tailor") => void;
  toggleAIAssistant: () => void;
  openAIAssistantForATS: () => void;
  openAIAssistantForJD: () => void;

  // ATS Progressive Disclosure State
  selectedATSIssueId: string | null;
  setSelectedATSIssueId: (id: string | null) => void;
  isFullDiagnosticsOpen: boolean;
  setIsFullDiagnosticsOpen: (open: boolean) => void;

  // Core Actions
  setActiveSectionId: (id: string) => void;
  setSelectedBulletId: (id: string | null) => void;
  setActiveSuggestion: (suggestion: AISuggestion | null) => void;
  updatePersonalInfo: (partial: Partial<PersonalInfo>) => void;
  updateExperience: (expId: string, partial: Partial<ExperienceItem>) => void;
  updateBullet: (expId: string, bulletId: string, text: string) => void;
  addBullet: (expId: string) => void;
  deleteBullet: (expId: string, bulletId: string) => void;
  addExperience: () => void;
  deleteExperience: (expId: string) => void;
  reorderSections: (newSections: ResumeSectionMeta[]) => void;
  acceptAISuggestion: (suggestionId: string) => void;
  rejectAISuggestion: (suggestionId: string) => void;
  triggerAIForBullet: (bulletId: string, originalText: string) => void;

  // Milestone 4: Multi-File Project State & CRUD
  projectId: string | null;
  projectName: string | null;
  entryFileId: string | null;
  files: LatexFileItem[];
  setFiles: React.Dispatch<React.SetStateAction<LatexFileItem[]>>;
  folders: LatexFolderItem[];
  setFolders: React.Dispatch<React.SetStateAction<LatexFolderItem[]>>;
  activeFileId: string;
  setActiveFileId: (id: string) => void;
  activeFile: LatexFileItem | undefined;
  expandedFolderIds: string[];
  toggleFolder: (folderId: string) => void;
  selectFile: (fileId: string) => Promise<void>;
  createFile: (name: string, folderId?: string | null) => Promise<void>;
  createFolder: (name: string, parentFolderId?: string | null) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  setEntryFile: (fileId: string) => Promise<void>;
  loadProject: (projId: string) => Promise<void>;

  // Milestone 5A: Compilation methods
  compileLatex: () => Promise<void>;
  jumpToError: (error: CompileErrorItem) => Promise<void>;

  // Persistent editor & autosave state
  editorContent: string;
  setEditorContent: (content: string) => void;
  onEditorChange: (content: string) => void;
  fileSaveStatus: "saved" | "saving" | "unsaved" | "error";
  flushSave: () => void;
  updateFileContent: (fileIdOrName: string, content: string) => void;
  uploadStatus: UploadStatus;
  uploadMessage: string | null;
  uploadFile: (file: File) => Promise<UploadLatexResponse>;

  // Compatibility aliases
  projectFiles: Record<string, string>;
  setProjectFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setActiveFile: (fileName: string) => void;
  atsScore: number;
  setAtsScore: (score: number) => void;

  setLatexCode: (code: string) => void;
  setPdfScale: (scale: number | ((prev: number) => number)) => void;
  setPdfPage: (page: number) => void;
  resetToMaster: () => void;
}

const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

export function ResumeProvider({ children }: { children: React.ReactNode }) {
  const [resume, setResume] = useState<Resume>(initialMasterResume);
  const [activeSectionId, setActiveSectionId] = useState<string>("sec_experience");
  const [selectedBulletId, setSelectedBulletId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>(mockAISuggestions);
  const [activeSuggestion, setActiveSuggestion] = useState<AISuggestion | null>(null);

  // Compilation state
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileStatus, setCompileStatus] = useState<"idle" | "compiling" | "success" | "error">("idle");
  const [compileLog, setCompileLog] = useState<string>("Ready to compile.");
  const [compileErrors, setCompileErrors] = useState<CompileErrorItem[]>([]);
  const [compileDuration, setCompileDuration] = useState<number | null>(null);
  const [lastCompiledAt, setLastCompiledAt] = useState<Date | null>(null);
  const [isPdfStale, setIsPdfStale] = useState<boolean>(false);
  const [pdfState, setPdfState] = useState<PdfState>("none");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [activeErrorLine, setActiveErrorLine] = useState<number | null>(null);
  const [compilerInfo, setCompilerInfo] = useState<CompilerStatusData | null>(null);

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [latexCode, setLatexCode] = useState<string>(sampleLatexCode);
  const [pdfScale, setPdfScale] = useState<number>(1.0);
  const [pdfPage, setPdfPage] = useState<number>(1);
  const totalPages = 1;

  // Project, Files & Folders State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [entryFileId, setEntryFileId] = useState<string | null>(null);
  const [files, setFiles] = useState<LatexFileItem[]>([]);
  const [folders, setFolders] = useState<LatexFolderItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>("");
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [atsScore, setAtsScore] = useState<number>(mockATSEvaluation.readinessScore || 87);

  // Persistent editing state
  const [fileSaveStatus, setFileSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ fileId: string; content: string } | null>(null);

  // Active file derived directly from files model
  const activeFile = useMemo(() => {
    return (
      files.find((f) => f.id === activeFileId || f.path === activeFileId || f.name === activeFileId) ||
      files[0]
    );
  }, [files, activeFileId]);

  const editorContent = activeFile?.content ?? "";

  const applyCompilationState = useCallback((state: CompilationState | null) => {
    const nextState = state?.state ?? "none";
    setPdfState(nextState);
    setIsPdfStale(nextState === "stale" || nextState === "failed-with-previous");
    const compilationId = state?.pdf?.url.split("compilationId=")[1];
    setPdfUrl(
      state?.pdf
        ? `${getLatexPdfUrl(projectId || "")}?compilationId=${compilationId || Date.now()}`
        : null
    );
    if (state?.latest?.status === "failed" || state?.latest?.status === "timeout") {
      setCompileStatus("error");
      setCompileErrors(state.latest.errors || []);
    } else if (state?.latest?.status === "success") {
      setCompileStatus("success");
      setCompileErrors([]);
    }
  }, [projectId]);

  const markPdfSourceChanged = useCallback(() => {
    setPdfState((current) => {
      if (current !== "none") setIsPdfStale(true);
      return current === "none" ? "none" : "stale";
    });
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  }, []);

  /**
   * Loads all files and folders for a project from MongoDB.
   */
  const loadProject = useCallback(async (projId: string) => {
    try {
      const project = await fetchLatexProject(projId);
      setEntryFileId(project.entryFileId ?? null);
      const data = await fetchProjectFiles(projId);
      setFiles(data.files);
      setFolders(data.folders);
      setExpandedFolderIds(data.folders.map((f) => f.id));

      if (data.files.length > 0) {
        const currentStillExists = data.files.some((f) => f.id === activeFileId);
        const targetFileId = currentStillExists ? activeFileId : data.files[0].id;
        setActiveFileId(targetFileId);

        const targetFile = data.files.find((f) => f.id === targetFileId);
        if (targetFile && (!targetFile.content || targetFile.content.length === 0)) {
          const fullDoc = await fetchLatexFile(targetFile.id);
          if (fullDoc) {
            setFiles((prev) =>
              prev.map((f) => (f.id === targetFile.id ? { ...f, content: fullDoc.content } : f))
            );
            setLatexCode(fullDoc.content);
          }
        } else if (targetFile) {
          setLatexCode(targetFile.content);
        }
      } else {
        setActiveFileId("");
        setLatexCode("");
      }

      // Check for any existing compiled PDF for this project
      const latestComp = await fetchLatestCompilation(projId);
      applyCompilationState(latestComp);
    } catch (err) {
      console.error("Failed to load project files:", err);
    }
  }, [activeFileId, applyCompilationState]);

  const setEntryFile = useCallback(async (fileId: string) => {
    if (!projectId) return;
    const configuredEntryFileId = await setLatexProjectEntryFile(projectId, fileId);
    setEntryFileId(configuredEntryFileId);
    markPdfSourceChanged();
  }, [projectId, markPdfSourceChanged]);

  /**
   * Selects a file and ensures its content is loaded into state and editor.
   */
  const selectFile = useCallback(async (fileId: string) => {
    setActiveFileId(fileId);
    setActiveErrorLine(null);
    const existing = files.find((f) => f.id === fileId);
    if (!existing || existing.content === undefined || existing.content === "") {
      try {
        const full = await fetchLatexFile(fileId);
        if (full) {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, content: full.content } : f))
          );
          setLatexCode(full.content);
          return;
        }
      } catch (err) {
        console.error("Error fetching file content:", err);
      }
    }
    if (existing) {
      setLatexCode(existing.content);
    }
  }, [files]);

  /**
   * Creates a new .tex file in the current project.
   */
  const createFile = useCallback(async (name: string, folderId?: string | null) => {
    let currentProjId = projectId;
    if (!currentProjId) {
      const proj = await createLatexProject("Resume Project");
      currentProjId = proj.id;
      setProjectId(proj.id);
      setProjectName(proj.name);
    }

    const newFile = await createLatexFile(currentProjId, name, folderId);
    markPdfSourceChanged();
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setLatexCode(newFile.content);

    if (folderId) {
      setExpandedFolderIds((prev) => (prev.includes(folderId) ? prev : [...prev, folderId]));
    }
  }, [projectId, markPdfSourceChanged]);

  /**
   * Creates a new folder in the current project.
   */
  const createFolder = useCallback(async (name: string, parentFolderId?: string | null) => {
    let currentProjId = projectId;
    if (!currentProjId) {
      const proj = await createLatexProject("Resume Project");
      currentProjId = proj.id;
      setProjectId(proj.id);
      setProjectName(proj.name);
    }

    const newFolder = await createLatexFolder(currentProjId, name, parentFolderId);
    markPdfSourceChanged();
    setFolders((prev) => [...prev, newFolder]);
    setExpandedFolderIds((prev) => [...prev, newFolder.id]);
  }, [projectId, markPdfSourceChanged]);

  /**
   * Deletes a file and selects another available file.
   */
  const deleteFile = useCallback(async (fileId: string) => {
    await deleteLatexFile(fileId);
    markPdfSourceChanged();
    if (fileId === entryFileId) {
      setEntryFileId(null);
    }
    setFiles((prev) => {
      const remaining = prev.filter((f) => f.id !== fileId);
      if (activeFileId === fileId) {
        if (remaining.length > 0) {
          const nextFile =
            remaining.find((f) => f.id === entryFileId && f.id !== fileId) || remaining[0];
          setActiveFileId(nextFile.id);
          setLatexCode(nextFile.content);
        } else {
          setActiveFileId("");
          setLatexCode("");
        }
      }
      return remaining;
    });
  }, [activeFileId, entryFileId, markPdfSourceChanged]);

  /**
   * Deletes a folder (throws 409 if non-empty).
   */
  const deleteFolder = useCallback(async (folderId: string) => {
    await deleteLatexFolder(folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setExpandedFolderIds((prev) => prev.filter((id) => id !== folderId));
  }, []);

  /**
   * Renames a file, updating its name and path.
   */
  const renameFile = useCallback(async (fileId: string, newName: string) => {
    const updated = await renameLatexFile(fileId, newName);
    markPdfSourceChanged();
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, name: updated.name, path: updated.path } : f
      )
    );
  }, [markPdfSourceChanged]);

  /**
   * Renames a folder, cascading updates across all descendant paths.
   */
  const renameFolder = useCallback(async (folderId: string, newName: string) => {
    await renameLatexFolder(folderId, newName);
    markPdfSourceChanged();
    if (projectId) {
      await loadProject(projectId);
    }
  }, [projectId, loadProject, markPdfSourceChanged]);

  const updateFileContent = useCallback((fileIdOrName: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileIdOrName || f.path === fileIdOrName || f.name === fileIdOrName) {
          return { ...f, content };
        }
        return f;
      })
    );
    if (activeFileId === fileIdOrName || activeFile?.path === fileIdOrName || activeFile?.name === fileIdOrName) {
      setLatexCode(content);
    }
    setSaveStatus("saving");
    setTimeout(() => {
      setSaveStatus("saved");
    }, 400);
  }, [activeFileId, activeFile]);

  const setEditorContent = useCallback((content: string) => {
    if (activeFile?.id) {
      updateFileContent(activeFile.id, content);
    }
  }, [activeFile, updateFileContent]);

  /**
   * Immediately persists the given content snapshot for the given fileId to MongoDB.
   */
  const saveFileToBackend = useCallback(async (fileId: string, content: string): Promise<void> => {
    try {
      setFileSaveStatus("saving");
      await patchLatexFile(fileId, content);
      if (pendingSaveRef.current?.fileId === fileId && pendingSaveRef.current?.content === content) {
        setFileSaveStatus("saved");
        pendingSaveRef.current = null;
      }
    } catch (err) {
      console.error("Failed to save file:", err);
      setFileSaveStatus("error");
    }
  }, []);

  /**
   * Keystroke handler for CodeMirror editor with 1000ms debounce.
   * Marks PDF as stale if edited after last compile.
   */
  const onEditorChange = useCallback((content: string) => {
    if (!activeFile?.id) return;

    const fileId = activeFile.id;

    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content, lineCount: content.split("\n").length } : f))
    );
    setLatexCode(content);
    setFileSaveStatus("unsaved");
    markPdfSourceChanged();

    // Mark PDF as stale if we have compiled before
    if (lastCompiledAt !== null) {
      setIsPdfStale(true);
    }

    pendingSaveRef.current = { fileId, content };

    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      saveFileToBackend(fileId, content);
    }, 1000);
  }, [activeFile, lastCompiledAt, saveFileToBackend, markPdfSourceChanged]);

  /**
   * Immediate save on Ctrl+S / Cmd+S.
   */
  const flushSave = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (pendingSaveRef.current) {
      const { fileId, content } = pendingSaveRef.current;
      saveFileToBackend(fileId, content);
    }
  }, [saveFileToBackend]);

  /**
   * Real LaTeX Compilation pipeline.
   * Flushes saves, calls compile API, updates status and PDF URL.
   */
  const compileLatex = useCallback(async () => {
    if (isCompiling) return;
    if (!projectId) {
      setCompileStatus("error");
      setCompileLog("No active project to compile.");
      return;
    }

    // 1. Ensure latest editor changes are saved first
    flushSave();

    setIsCompiling(true);
    setCompileStatus("compiling");
    setCompileLog("Compiling document with pdflatex...");

    try {
      const result = await compileLatexProject(projectId, entryFileId ?? undefined);

      setCompileDuration(result.durationMs);

      if (result.status === "success") {
        setCompileStatus("success");
        setCompileErrors([]);
        setPdfState("valid");
        setIsPdfStale(false);
        setLastCompiledAt(new Date());
        setPdfUrl(getLatexPdfUrl(projectId) + `?compilationId=${result.compilationId}`);
        setCompileLog(
          result.logs.stdout || `✓ Compilation succeeded in ${(result.durationMs / 1000).toFixed(2)}s.`
        );
      } else {
        setCompileStatus("error");
        setPdfState((current) => current === "none" ? "none" : "failed-with-previous");
        setIsPdfStale(true);
        setCompileErrors(result.errors || []);
        const errLog =
          result.logs.stderr ||
          result.logs.stdout ||
          result.error?.message ||
          "Compilation failed with errors.";
        setCompileLog(errLog);
      }
      const persistedState = await fetchLatestCompilation(projectId);
      applyCompilationState(persistedState);
    } catch (err) {
      setCompileStatus("error");
      setPdfState((current) => current === "none" ? "none" : "failed-with-previous");
      setIsPdfStale(true);
      const msg = err instanceof Error ? err.message : "Failed to compile project";
      setCompileLog(msg);
      setCompileErrors([
        {
          severity: "error",
          file: null,
          line: null,
          message: msg,
        },
      ]);
    } finally {
      setIsCompiling(false);
    }
  }, [isCompiling, projectId, entryFileId, flushSave]);

  /**
   * Jumps to an error file and line in CodeMirror.
   */
  const jumpToError = useCallback(
    async (error: CompileErrorItem) => {
      if (error.file) {
        const normFile = error.file.replace(/^[.\\/]+/, "");
        const target = files.find(
          (f) =>
            f.path === normFile ||
            f.name === normFile ||
            f.path.endsWith("/" + normFile) ||
            normFile.endsWith("/" + f.name)
        );
        if (target && target.id !== activeFileId) {
          await selectFile(target.id);
        }
      }
      if (error.line !== null) {
        setActiveErrorLine(error.line);
      }
    },
    [files, activeFileId, selectFile]
  );

  const setActiveFile = useCallback((fileName: string) => {
    const match = files.find((f) => f.path === fileName || f.name === fileName || f.id === fileName);
    if (match) {
      selectFile(match.id);
    } else {
      setActiveFileId(fileName);
    }
  }, [files, selectFile]);

  const uploadFile = useCallback(async (file: File): Promise<UploadLatexResponse> => {
    setUploadStatus("uploading");
    setUploadMessage(`Uploading ${file.name}...`);
    try {
      const res = await uploadLatexFile(file, projectId || undefined);
      const { project, file: uploadedDoc } = res.data;

      setProjectId(project.id);
      setProjectName(project.name);

      await loadProject(project.id);

      setActiveFileId(uploadedDoc.id);
      setLatexCode(uploadedDoc.content);

      setUploadStatus("success");
      setUploadMessage(`${uploadedDoc.name} uploaded successfully`);

      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage(null);
      }, 4000);

      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload LaTeX file";
      setUploadStatus("error");
      setUploadMessage(msg);
      throw err;
    }
  }, [projectId, loadProject]);

  // Backward compatibility mapping for projectFiles record
  const projectFiles = useMemo(() => {
    return files.reduce<Record<string, string>>((acc, f) => {
      acc[f.path] = f.content;
      return acc;
    }, {});
  }, [files]);

  const setProjectFiles = useCallback((action: React.SetStateAction<Record<string, string>>) => {
    setFiles((prev) => {
      const currRecord = prev.reduce<Record<string, string>>((acc, f) => {
        acc[f.path] = f.content;
        return acc;
      }, {});
      const nextRecord = typeof action === "function" ? action(currRecord) : action;
      return Object.entries(nextRecord).map(([path, content]) => {
        const existing = prev.find((f) => f.path === path);
        return {
          id: existing?.id || path,
          name: existing?.name || path.split("/").pop() || path,
          path,
          content,
          isUploaded: existing?.isUploaded,
        };
      });
    });
  }, []);

  // Workspace Shell Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Global Contextual AI Assistant
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState<boolean>(false);
  const [aiAssistantView, setAiAssistantView] = useState<"contextual" | "ats_fixes" | "jd_match" | "tailor">("contextual");

  // ATS Progressive Disclosure State
  const [selectedATSIssueId, setSelectedATSIssueId] = useState<string | null>(null);
  const [isFullDiagnosticsOpen, setIsFullDiagnosticsOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("resume_eng_sidebar_collapsed");
      if (stored !== null) {
        setIsSidebarCollapsed(stored === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("resume_eng_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Global Keyboard Shortcuts (⌘B / Ctrl+B for Sidebar, ⌘S / Ctrl+S for Save, ⌘Enter / Ctrl+Enter for Compile)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        compileLatex();
      }
      if (e.key === "Escape") {
        if (selectedATSIssueId) setSelectedATSIssueId(null);
        if (isFullDiagnosticsOpen) setIsFullDiagnosticsOpen(false);
        if (isShortcutsOpen) setIsShortcutsOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [toggleSidebar, flushSave, compileLatex, selectedATSIssueId, isFullDiagnosticsOpen, isShortcutsOpen]);

  const toggleAIAssistant = useCallback(() => {
    setIsAIAssistantOpen((prev) => !prev);
  }, []);

  const openAIAssistantForATS = useCallback(() => {
    setAiAssistantView("ats_fixes");
    setIsAIAssistantOpen(true);
  }, []);

  const openAIAssistantForJD = useCallback(() => {
    setAiAssistantView("jd_match");
    setIsAIAssistantOpen(true);
  }, []);

  // Initial Startup: Check compiler status & load latest project from MongoDB
  useEffect(() => {
    let isMounted = true;

    // Check compiler status
    checkCompilerStatus().then((status) => {
      if (isMounted) setCompilerInfo(status);
    });

    fetchLatestLatexFile()
      .then(async (data) => {
        if (!isMounted) return;
        if (data) {
          const { project, file } = data;
          setProjectId(project.id);
          setProjectName(project.name);
          setEntryFileId(project.entryFileId ?? null);

          const treeData = await fetchProjectFiles(project.id);
          if (!isMounted) return;

          setFolders(treeData.folders);
          setExpandedFolderIds(treeData.folders.map((f) => f.id));

          const initialFileId = file.id || (treeData.files[0]?.id ?? "");
          setActiveFileId(initialFileId);

          const updatedFiles = await Promise.all(
            treeData.files.map(async (f) => {
              if (f.id === initialFileId && (!f.content || f.content === "")) {
                const full = await fetchLatexFile(f.id);
                return full ? { ...f, content: full.content } : f;
              }
              return f;
            })
          );

          if (!isMounted) return;
          setFiles(updatedFiles);

          const currentDoc = updatedFiles.find((f) => f.id === initialFileId);
          if (currentDoc) {
            setLatexCode(currentDoc.content);
          }

          // Check if previously compiled PDF exists
          const comp = await fetchLatestCompilation(project.id);
          if (isMounted) {
            applyCompilationState(comp);
            if (comp?.successful?.durationMs) {
              setLastCompiledAt(new Date(comp.successful.durationMs));
            }
          }
        } else {
          setFiles([]);
          setFolders([]);
          setActiveFileId("");
          setLatexCode("");
        }
      })
      .catch((err) => {
        console.error("Failed to load project on startup:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [applyCompilationState]);

  // Sync LaTeX code when active file changes
  useEffect(() => {
    if (activeFile?.content) {
      setLatexCode(activeFile.content);
    }
  }, [activeFile]);

  const updatePersonalInfo = useCallback((partial: Partial<PersonalInfo>) => {
    setResume((prev) => ({
      ...prev,
      personal: { ...prev.personal, ...partial },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateExperience = useCallback((expId: string, partial: Partial<ExperienceItem>) => {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.map((item) =>
        item.id === expId ? { ...item, ...partial } : item
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateBullet = useCallback((expId: string, bulletId: string, text: string) => {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.map((item) => {
        if (item.id !== expId) return item;
        return {
          ...item,
          bullets: item.bullets.map((b) => (b.id === bulletId ? { ...b, text } : b)),
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const addBullet = useCallback((expId: string) => {
    const newBulletId = `bullet_${Date.now()}`;
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.map((item) => {
        if (item.id !== expId) return item;
        return {
          ...item,
          bullets: [
            ...item.bullets,
            {
              id: newBulletId,
              text: "Architected high-throughput service handling critical business operations with sub-second SLA.",
            },
          ],
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedBulletId(newBulletId);
  }, []);

  const deleteBullet = useCallback((expId: string, bulletId: string) => {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.map((item) => {
        if (item.id !== expId) return item;
        return {
          ...item,
          bullets: item.bullets.filter((b) => b.id !== bulletId),
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
    if (selectedBulletId === bulletId) {
      setSelectedBulletId(null);
    }
    if (activeSuggestion?.targetId === bulletId) {
      setActiveSuggestion(null);
    }
  }, [selectedBulletId, activeSuggestion]);

  const addExperience = useCallback(() => {
    const newExpId = `exp_${Date.now()}`;
    const newExp: ExperienceItem = {
      id: newExpId,
      role: "Distributed Systems Lead",
      company: "Acme Cloud Infrastructure",
      location: "San Francisco, CA",
      startDate: "2024-06",
      endDate: "Present",
      isCurrent: true,
      bullets: [
        {
          id: `bullet_${Date.now()}_1`,
          text: "Built event streaming pipeline in Go and Kafka serving 50M daily events with 99.99% reliability.",
        },
      ],
    };
    setResume((prev) => ({
      ...prev,
      experience: [newExp, ...prev.experience],
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const deleteExperience = useCallback((expId: string) => {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.filter((exp) => exp.id !== expId),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const reorderSections = useCallback((newSections: ResumeSectionMeta[]) => {
    setResume((prev) => ({
      ...prev,
      sections: newSections,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const triggerAIForBullet = useCallback((bulletId: string, originalText: string) => {
    setSelectedBulletId(bulletId);
    const existing = aiSuggestions.find((s) => s.targetId === bulletId);
    if (existing) {
      setActiveSuggestion(existing);
      setAiAssistantView("contextual");
      setIsAIAssistantOpen(true);
      return;
    }

    const dynamicSuggestion: AISuggestion = {
      id: `sug_${Date.now()}`,
      targetId: bulletId,
      type: "quantify_impact",
      originalText: originalText,
      suggestedText: originalText.includes("REST")
        ? "Engineered resilient, high-concurrency RESTful APIs in Node.js & TypeScript, sustaining 1.2M+ MAU with 99.99% uptime."
        : "Spearheaded low-latency data ingestion pipeline delivering 3.4x throughput increase and reducing p99 latency by 45%.",
      rationale:
        "Elevates technical vocabulary, highlights measurable performance metrics, and establishes leadership ownership.",
      evidence: [
        "Consistent with distributed systems profile",
        "Meets Staff/Senior tier bullet evaluation standard",
        "Includes strong action verbs and quantified impact",
      ],
      status: "pending",
    };
    setAiSuggestions((prev) => [dynamicSuggestion, ...prev]);
    setActiveSuggestion(dynamicSuggestion);
    setAiAssistantView("contextual");
    setIsAIAssistantOpen(true);
  }, [aiSuggestions]);

  const acceptAISuggestion = useCallback((suggestionId: string) => {
    const suggestion = aiSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    setResume((prev) => {
      const updatedExperience = prev.experience.map((exp) => ({
        ...exp,
        bullets: exp.bullets.map((b) =>
          b.id === suggestion.targetId ? { ...b, text: suggestion.suggestedText } : b
        ),
      }));
      return {
        ...prev,
        experience: updatedExperience,
        updatedAt: new Date().toISOString(),
      };
    });

    setAiSuggestions((prev) =>
      prev.map((s) => (s.id === suggestionId ? { ...s, status: "accepted" } : s))
    );
    setActiveSuggestion(null);
  }, [aiSuggestions]);

  const rejectAISuggestion = useCallback((suggestionId: string) => {
    setAiSuggestions((prev) =>
      prev.map((s) => (s.id === suggestionId ? { ...s, status: "rejected" } : s))
    );
    setActiveSuggestion(null);
  }, []);

  const resetToMaster = useCallback(() => {
    setResume(initialMasterResume);
    setActiveSuggestion(null);
    setSelectedBulletId(null);
  }, []);

  return (
    <ResumeContext.Provider
      value={{
        resume,
        activeSectionId,
        selectedBulletId,
        activeSuggestion,
        aiSuggestions,
        isCompiling,
        compileStatus,
        compileLog,
        compileErrors,
        compileDuration,
        lastCompiledAt,
        isPdfStale,
        pdfState,
        pdfUrl,
        activeErrorLine,
        compilerInfo,
        saveStatus,
        latexCode,
        pdfScale,
        pdfPage,
        totalPages,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
        isShortcutsOpen,
        setIsShortcutsOpen,
        isAIAssistantOpen,
        aiAssistantView,
        setIsAIAssistantOpen,
        setAiAssistantView,
        toggleAIAssistant,
        openAIAssistantForATS,
        openAIAssistantForJD,
        selectedATSIssueId,
        setSelectedATSIssueId,
        isFullDiagnosticsOpen,
        setIsFullDiagnosticsOpen,
        setActiveSectionId,
        setSelectedBulletId,
        setActiveSuggestion,
        updatePersonalInfo,
        updateExperience,
        updateBullet,
        addBullet,
        deleteBullet,
        addExperience,
        deleteExperience,
        reorderSections,
        acceptAISuggestion,
        rejectAISuggestion,
        triggerAIForBullet,
        projectId,
        projectName,
        entryFileId,
        files,
        setFiles,
        folders,
        setFolders,
        activeFileId,
        setActiveFileId,
        activeFile,
        expandedFolderIds,
        toggleFolder,
        selectFile,
        createFile,
        createFolder,
        deleteFile,
        deleteFolder,
        renameFile,
        renameFolder,
        setEntryFile,
        loadProject,
        compileLatex,
        jumpToError,
        editorContent,
        setEditorContent,
        onEditorChange,
        fileSaveStatus,
        flushSave,
        updateFileContent,
        uploadStatus,
        uploadMessage,
        uploadFile,
        projectFiles,
        setProjectFiles,
        setActiveFile,
        atsScore,
        setAtsScore,
        setLatexCode,
        setPdfScale,
        setPdfPage,
        resetToMaster,
      }}
    >
      {children}
    </ResumeContext.Provider>
  );
}

export function useResume() {
  const context = useContext(ResumeContext);
  if (!context) {
    throw new Error("useResume must be used within a ResumeProvider");
  }
  return context;
}
