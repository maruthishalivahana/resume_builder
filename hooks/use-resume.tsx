"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { Resume, AISuggestion, ExperienceItem, PersonalInfo, ResumeSectionMeta } from "@/types/resume";
import { initialMasterResume, mockAISuggestions, sampleLatexCode, mockATSEvaluation } from "@/lib/mock-data";
import { LatexFileItem, LatexFolderItem, UploadStatus } from "@/types/latex";
import {
  uploadLatexFile,
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
  fetchCompilationHistory, CompilationHistory, CompilationBuild,
  CompilationState,
  PdfState,
  fetchLatexProject,
  setLatexProjectEntryFile,
  checkCompilerStatus,
  acceptTailoringSuggestion,
  CompileErrorItem,
  CompilerStatusData,
} from "@/lib/api/latex";
import {
  analyzeTailoring,
  extractTailoringRequirements,
  fetchTailoringSuggestions,
  indexTailoringResume,
  rejectTailoringSuggestion,
  TailoringSuggestionView,
  TailoringAnalysisView,
  fetchTailoringAnalysis,
} from "@/lib/api/tailoring";
import { sendChatMessageApi } from "@/lib/api/chat";
import { FileSaveManager, afterSaved, SaveConflict, Draft } from "@/lib/file-save-manager";
import { readDrafts, writeDrafts } from "@/lib/save-drafts";
import { readCompileTarget, writeCompileTarget } from "@/lib/compile-target-preference";
import { ProjectViewStateStore, reconcileProjectViewState } from "@/lib/project-view-state";

export interface ChatMessageEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface ActiveJdSession {
  diagnosticReasons?: Record<string, number>;
  analysisId: string | null;
  jobDescription: string | null;
  submittedAt: string;
  status: "idle" | "indexing" | "extracting" | "analyzing" | "completed" | "failed";
  progressStep: string;
  summary: Record<string, number> | null;
  requirements: Array<{ requirementId: string; text: string; classification?: string; reason?: string }>;
  suggestions: TailoringSuggestionView[];
  error: string | null;
}

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
  editorHighlightRange: { startLine: number; endLine: number } | null;
  suggestionFeedback: { type: "success" | "error"; message: string } | null;
  applyAcceptedSuggestion: (result: Awaited<ReturnType<typeof acceptTailoringSuggestion>>) => void;
  compilerInfo: CompilerStatusData | null;
  saveStatus: "saved" | "saving" | "unsaved" | "error";
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
  requestedProjectId: string | undefined;
  resumeBasePath: string;
  isProjectLoading: boolean;
  projectLoadError: string | null;
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
  deleteFile: (fileId: string, choice?: "save" | "discard") => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  setEntryFile: (fileId: string) => Promise<void>;
  loadProject: (projId: string) => Promise<void>;

  // Milestone 5A: Compilation methods
  compileLatex: () => Promise<void>;
  compileTargetId: string | null;
  selectCompileTarget: (fileId: string) => Promise<void>;
  buildHistory: CompilationHistory | null;
  loadBuildHistory: (page: number) => Promise<void>;
  previewBuild: { id: string; path: string } | null;
  showCompilationBuild: (build: CompilationBuild) => void;
  targetLoadError: string | null;
  compileTargetChoice: { openPath: string; entryPath: string } | null;
  resolveCompileTarget: (choice: "configured" | "open" | "cancel") => void;
  jumpToError: (error: CompileErrorItem) => Promise<void>;

  // Persistent editor & autosave state
  editorContent: string;
  setEditorContent: (content: string) => void;
  onEditorChange: (content: string) => void;
  fileSaveStatus: "saved" | "saving" | "unsaved" | "error";
  flushSave: () => Promise<void>;
  fileSaveError: string | null;
  saveConflicts: SaveConflict[];
  recoveryDrafts: Draft[];
  draftRecoveryError: string | null;
  fileOperationBusy: string | null;
  refreshSaveConflict: (id: string) => Promise<void>;
  resolveSaveConflict: (id: string, revision: number, content: string) => Promise<void>;
  editSaveConflict: (id: string, content: string) => void;
  discardRecoveryDraft: (id: string) => void;
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
  tailoringSuggestions: TailoringSuggestionView[];
  tailoringSuggestionsLoading: boolean;
  tailoringSuggestionsError: string | null;
  refreshTailoringSuggestions: () => Promise<void>;
  acceptTailoringSuggestionById: (suggestionId: string) => Promise<void>;
  rejectTailoringSuggestionById: (suggestionId: string) => Promise<void>;
  generateTailoringSuggestions: (jobDescription: string) => Promise<void>;
  activeJdSession: ActiveJdSession | null;
  startNewJdAnalysis: () => void;
  currentVersionId: string | null;
  tailoringAnalysisSummary: Record<string, number> | null;
  tailoringAnalysisStatus: "idle" | "completed" | "failed";
  tailoringAnalysisRequirements: Array<{ requirementId: string; text: string; classification?: string; reason?: string }>;
  chatMessages: ChatMessageEntry[];
  isChatLoading: boolean;
  chatError: string | null;
  sendChatMessage: (message: string) => Promise<void>;
  startNewChat: () => void;
  clearChatMessages: () => void;
}

const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

export function ResumeProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const requestedProjectId = typeof params.id === "string"
    ? (/^[a-f\d]{24}$/i.test(params.id) ? params.id.toLowerCase() : params.id) : undefined;
  const [resume, setResume] = useState<Resume>(initialMasterResume);
  const [activeSectionId, setActiveSectionId] = useState<string>("sec_experience");
  const [selectedBulletId, setSelectedBulletId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>(mockAISuggestions);
  const [activeSuggestion, setActiveSuggestion] = useState<AISuggestion | null>(null);
  const [tailoringSuggestions, setTailoringSuggestions] = useState<TailoringSuggestionView[]>([]);
  const [tailoringSuggestionsLoading, setTailoringSuggestionsLoading] = useState(false);
  const [tailoringSuggestionsError, setTailoringSuggestionsError] = useState<string | null>(null);
  const [tailoringAnalysisSummary, setTailoringAnalysisSummary] = useState<Record<string, number> | null>(null);
  const [tailoringAnalysisStatus, setTailoringAnalysisStatus] = useState<"idle" | "completed" | "failed">("idle");
  const [tailoringAnalysisId, setTailoringAnalysisId] = useState<string | null>(null);
  const [tailoringAnalysisRequirements, setTailoringAnalysisRequirements] = useState<Array<{ requirementId: string; text: string; classification?: string; reason?: string }>>([]);
  const currentVersionId = resume.versions[0]?.id ?? null;

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
  const [editorHighlightRange, setEditorHighlightRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [suggestionFeedback, setSuggestionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [compilerInfo, setCompilerInfo] = useState<CompilerStatusData | null>(null);

  const [latexCode, setLatexCode] = useState<string>(sampleLatexCode);
  const [pdfScale, setPdfScale] = useState<number>(1.0);
  const [pdfPage, setPdfPage] = useState<number>(1);
  const totalPages = 1;

  // Project, Files & Folders State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  // Demo is an in-memory alias; landing-page demo links remain supported.
  const resumeBasePath = `/resume/${encodeURIComponent(requestedProjectId && requestedProjectId !== "demo" ? requestedProjectId : projectId ?? "demo")}`;
  const [projectName, setProjectName] = useState<string | null>(null);
  const [entryFileId, setEntryFileId] = useState<string | null>(null);
  const [compileTargetId, setCompileTargetId] = useState<string | null>(null);
  const compileTargetRef = useRef<string | null>(null);
  const targetRequestSeq = useRef(0);
  const [buildHistory, setBuildHistory] = useState<CompilationHistory | null>(null);
  const [previewBuild, setPreviewBuild] = useState<{ id: string; path: string } | null>(null);
  const [targetLoadError, setTargetLoadError] = useState<string | null>(null);
  const [files, setFiles] = useState<LatexFileItem[]>([]);
  const [folders, setFolders] = useState<LatexFolderItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>("");
  const [compileTargetChoice, setCompileTargetChoice] = useState<{ openPath: string; entryPath: string } | null>(null);
  const compileSubmissionRef = useRef(false);
  const compileChoiceResolver = useRef<((choice: "configured" | "open" | "cancel") => void) | null>(null);
  const resolveCompileTarget = useCallback((choice: "configured" | "open" | "cancel") => {
    const resolve = compileChoiceResolver.current;
    compileChoiceResolver.current = null;
    setCompileTargetChoice(null);
    resolve?.(choice);
  }, []);
  const requestCompileTarget = useCallback((openPath: string, entryPath: string) =>
    new Promise<"configured" | "open" | "cancel">(resolve => {
      compileChoiceResolver.current = resolve;
      setCompileTargetChoice({ openPath, entryPath });
    }), []);
  useEffect(() => () => { resolveCompileTarget("cancel"); }, [projectId, resolveCompileTarget]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [atsScore, setAtsScore] = useState<number>(mockATSEvaluation.readinessScore || 87);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessageEntry[]>([
    {
      id: "initial-assistant-msg",
      role: "assistant",
      content: "Hello! I am your RESUME.ENG AI Copilot. How can I help you refine your resume or formatting today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatRequestSeqRef = useRef<number>(0);

  const sendChatMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || isChatLoading) return;

      const seq = ++chatRequestSeqRef.current;
      setChatError(null);
      setIsChatLoading(true);

      const userMsg: ChatMessageEntry = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, userMsg]);

      try {
        const historySnapshot = [...chatMessages, userMsg].slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await sendChatMessageApi(trimmed, historySnapshot, projectId || undefined);
        if (seq !== chatRequestSeqRef.current) return;

        const assistantMsg: ChatMessageEntry = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: "assistant",
          content: res.message,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        if (seq !== chatRequestSeqRef.current) return;
        setChatError(err instanceof Error ? err.message : "Failed to send chat message.");
      } finally {
        if (seq === chatRequestSeqRef.current) {
          setIsChatLoading(false);
        }
      }
    },
    [isChatLoading, chatMessages, projectId]
  );

  const startNewChat = useCallback(() => {
    chatRequestSeqRef.current += 1;
    setIsChatLoading(false);
    setChatError(null);
    setChatMessages([
      {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "Hello! I am your RESUME.ENG AI Copilot. How can I help you refine your resume or formatting today?",
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const clearChatMessages = useCallback(() => {
    chatRequestSeqRef.current += 1;
    setIsChatLoading(false);
    setChatError(null);
    setChatMessages([]);
  }, []);

  // Persistent editing state
  const [fileSaveStatus, setFileSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [fileSaveError, setFileSaveError] = useState<string | null>(null);
  const [saveConflicts, setSaveConflicts] = useState<SaveConflict[]>([]);
  const [recoveryDrafts, setRecoveryDrafts] = useState<Draft[]>([]);
  const [draftRecoveryError, setDraftRecoveryError] = useState<string | null>(null);
  const draftStorageBlocked = useRef(false);
  const [fileOperationBusy, setFileOperationBusy] = useState<string | null>(null);
  const projectLoadSeq = useRef(0);
  const cancelProjectLoad = useCallback(() => { ++projectLoadSeq.current; }, []);
  const projectIdRef = useRef(projectId);
  const currentVersionIdRef = useRef(currentVersionId);
  const entrySelectionPendingRef = useRef(false);
  const projectViewStoreRef = useRef(new ProjectViewStateStore());
  // Tag the rendered tree independently of the requested project during asynchronous loading.
  const viewProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || projectIdRef.current !== projectId || viewProjectIdRef.current !== projectId ||
        isProjectLoading || projectLoadError) return;
    projectViewStoreRef.current.save(projectId, reconcileProjectViewState(
      { activeFileId: activeFileId || null, expandedFolderIds }, files, folders,
    ));
  }, [projectId, activeFileId, expandedFolderIds, files, folders, isProjectLoading, projectLoadError]);
  const saveManagerRef = useRef<FileSaveManager | null>(null);
  useEffect(() => {
    if (!saveManagerRef.current) {
    saveManagerRef.current = new FileSaveManager(patchLatexFile, () => {
      const manager = saveManagerRef.current!;
      setFiles(previous => previous.map(file => {
        const merged = manager.view(file);
        return { ...merged, lineCount: merged.content.split(/\r?\n/).length };
      }));
      setFileSaveStatus(manager.status(projectIdRef.current || ""));
      setFileSaveError(manager.error(projectIdRef.current || ""));
      setSaveConflicts(manager.conflicts(projectIdRef.current || ""));
      setRecoveryDrafts(manager.unopenedDrafts(projectIdRef.current || ""));
      try { if (!draftStorageBlocked.current) { writeDrafts(sessionStorage, manager.drafts()); setDraftRecoveryError(null); } }
      catch (error) { setDraftRecoveryError(error instanceof Error ? error.message : "Draft recovery is unavailable. Copy edits before leaving."); }
    }, 1000, async id => {
      const file = await fetchLatexFile(id);
      if (!file) throw new Error("Could not reload authoritative file content. Local edits are retained.");
      return { content: file.content, contentRevision: file.contentRevision ?? 0, recoveryPending: file.recoveryPending };
    });
    try { saveManagerRef.current.restore(readDrafts(sessionStorage)); }
    catch (error) { draftStorageBlocked.current = true; queueMicrotask(() => setDraftRecoveryError(error instanceof Error ? error.message : "Draft recovery unavailable")); }
    }
    saveManagerRef.current.activate();
    const warn = (event: BeforeUnloadEvent) => {
      if (saveManagerRef.current!.hasPending()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); saveManagerRef.current?.deactivate(); };
  }, []);
  useEffect(() => { saveManagerRef.current?.publish(); }, [projectId]);
  const refreshSaveConflict = useCallback(async (id: string) => { await saveManagerRef.current!.refresh(id); }, []);
  const resolveSaveConflict = useCallback(async (id: string, revision: number, content: string) => {
    await saveManagerRef.current!.resolve(id, revision, content);
  }, []);
  const discardRecoveryDraft = useCallback((id: string) => saveManagerRef.current!.discardDraft(id), []);
  const editSaveConflict = useCallback((id: string, content: string) => { saveManagerRef.current!.edit(id, content); }, []);
  const mergeProjectFiles = useCallback((incoming: LatexFileItem[], id: string) => {
    const merged = incoming.map(file => saveManagerRef.current!.merge(file, id));
    setFiles(previous => [
      ...merged,
      ...previous.filter(file => !incoming.some(next => next.id === file.id) && saveManagerRef.current!.isDirty(file.id, id)),
    ]);
    saveManagerRef.current!.publish();
  }, []);
  const flushSave = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    await saveManagerRef.current!.flush(projectId);
  }, [projectId]);

  // Active file derived directly from files model
  const activeFile = useMemo(() => {
    return (
      files.find((f) => f.id === activeFileId || f.path === activeFileId || f.name === activeFileId) ||
      files[0]
    );
  }, [files, activeFileId]);

  const editorContent = activeFile?.content ?? "";

  const applyCompilationState = useCallback((state: CompilationState | null, sourceProjectId?: string) => {
    const stateProjectId = sourceProjectId ?? projectIdRef.current;
    if (sourceProjectId && sourceProjectId !== projectIdRef.current) return;
    const nextState = state?.state ?? "none";
    setPreviewBuild(state?.successful ? { id: state.successful.compilationId, path: state.successful.entryFilePath } : null);
    setCompileLog(state?.latest?.logs?.stderr || state?.latest?.logs?.stdout || "Ready to compile.");
    setCompileDuration(state?.latest?.durationMs ?? null);
    setCompileErrors(state?.latest?.errors ?? []);
    setCompileStatus(state?.latest ? state.latest.status === "success" ? "success" : "error" : "idle");
    setPdfState(nextState);
    setIsPdfStale(nextState === "stale" || nextState === "failed-with-previous");
    const compilationId = state?.pdf?.url.split("compilationId=")[1];
    setPdfUrl(
      state?.pdf
        ? `${getLatexPdfUrl(stateProjectId || "")}?compilationId=${compilationId || Date.now()}`
        : null
    );
    if (state?.latest?.status === "failed" || state?.latest?.status === "timeout") {
      setCompileStatus("error");
      setCompileErrors(state.latest.errors || []);
    } else if (state?.latest?.status === "success") {
      setCompileStatus("success");
      setCompileErrors([]);
    }
  }, []);

  const markPdfSourceChanged = useCallback(() => {
    setPdfState((current) => {
      if (current !== "none") setIsPdfStale(true);
      return current === "none" ? "none" : "stale";
    });
  }, []);

  const selectCompileTarget = useCallback(async (fileId: string) => {
    const id = projectIdRef.current;
    const file = files.find(file => file.id === fileId);
    if (!id || !file || !file.path.toLowerCase().endsWith(".tex")) throw new Error("Select an existing .tex compilation target.");
    const sequence = ++targetRequestSeq.current;
    compileTargetRef.current = fileId; setCompileTargetId(fileId);
    writeCompileTarget(id, fileId);
    setTargetLoadError(null); setBuildHistory(null); setPreviewBuild(null);
    setIsPdfStale(false);
    setPdfUrl(null); setPdfState("none"); setCompileStatus("idle"); setCompileErrors([]); setCompileLog("Loading target builds…");
    try {
      const [state, history] = await Promise.all([fetchLatestCompilation(id, fileId), fetchCompilationHistory(id, fileId)]);
      if (projectIdRef.current !== id || targetRequestSeq.current !== sequence) return;
      applyCompilationState(state, id); setBuildHistory(history);
      if (saveManagerRef.current!.status(id) !== "saved") markPdfSourceChanged();
    } catch (error) {
      if (projectIdRef.current === id && targetRequestSeq.current === sequence) setTargetLoadError(error instanceof Error ? error.message : "Could not load target builds");
    }
  }, [files, applyCompilationState, markPdfSourceChanged]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  }, []);

  const loadBuildHistory = useCallback(async (page: number) => {
    const id = projectIdRef.current, target = compileTargetRef.current, sequence = ++targetRequestSeq.current;
    if (!id || !target) return;
    try {
      const history = await fetchCompilationHistory(id, target, page);
      if (projectIdRef.current === id && targetRequestSeq.current === sequence) { setBuildHistory(history); setTargetLoadError(null); }
    } catch (error) {
      if (projectIdRef.current === id && targetRequestSeq.current === sequence) setTargetLoadError(error instanceof Error ? error.message : "Could not load history");
    }
  }, []);
  const showCompilationBuild = useCallback((build: CompilationBuild) => {
    if (build.projectId !== projectIdRef.current || build.compiledEntryFileId !== compileTargetRef.current) return;
    ++targetRequestSeq.current;
    setCompileErrors(build.compileErrors ?? []); setCompileLog(build.stderr || build.stdout || "No log recorded.");
    setCompileStatus(build.status === "success" ? "success" : "error");
    if (build.status === "success" && build.pdfPath) {
      setPreviewBuild({ id: build._id, path: build.mainFile });
      setPdfUrl(`${getLatexPdfUrl(build.projectId)}?compilationId=${build._id}`);
      setPdfState("stale"); setIsPdfStale(true);
    } else { setPreviewBuild(null); setPdfUrl(null); setPdfState("none"); }
  }, []);

  /**
   * Loads all files and folders for a project from MongoDB.
   */
  const loadProject = useCallback(async (projId: string) => {
    resolveCompileTarget("cancel");
    if (/^[a-f\d]{24}$/i.test(projId)) projId = projId.toLowerCase();
    const sequence = ++projectLoadSeq.current;
    const targetSequence = ++targetRequestSeq.current;
    compileTargetRef.current = null; setCompileTargetId(null); setBuildHistory(null); setPreviewBuild(null); setTargetLoadError(null);
    const switching = projectIdRef.current !== projId;
    viewProjectIdRef.current = null;
    // Change identity before the first await so old CRUD responses cannot reactivate their project.
    projectIdRef.current = /^[a-f\d]{24}$/i.test(projId) ? projId : null;
    setProjectId(projectIdRef.current);
    setIsProjectLoading(true); setProjectLoadError(null);
    if (switching || !projectIdRef.current) {
      setFiles([]); setFolders([]); setProjectName(null); setEntryFileId(null);
      setActiveFileId(""); setExpandedFolderIds([]); setLatexCode("");
      setPdfUrl(null); setPdfState("none"); setCompileStatus("idle"); setCompileErrors([]);
      setCompileLog("Ready to compile."); setCompileDuration(null); setLastCompiledAt(null); setIsPdfStale(false);
    }
    try {
      if (!projectIdRef.current) throw new Error("A valid project ID is required. No other project was loaded.");
      const project = await fetchLatexProject(projId);
      if (sequence !== projectLoadSeq.current || projectIdRef.current !== projId) return;
      if (project.id !== projId) throw new Error("Server returned a different project. Workspace restoration was stopped.");
      const data = await fetchProjectFiles(projId);
      if (sequence !== projectLoadSeq.current || projectIdRef.current !== projId) return;
      setProjectId(projId); setProjectName(project.name);
      setEntryFileId(project.entryFileId ?? null);
      const restoredTargetId = readCompileTarget(projId, data.files, project.entryFileId ?? null);
      compileTargetRef.current = restoredTargetId; setCompileTargetId(restoredTargetId);
      mergeProjectFiles(data.files, projId);
      setFolders(data.folders);
      const view = reconcileProjectViewState(projectViewStoreRef.current.read(projId), data.files, data.folders);
      setExpandedFolderIds(view.expandedFolderIds);
      viewProjectIdRef.current = projId;

      if (data.files.length > 0) {
        const targetFileId = view.activeFileId!;
        setActiveFileId(targetFileId);

        const targetFile = data.files.find((f) => f.id === targetFileId);
        if (targetFile && !saveManagerRef.current!.merge(targetFile, projId).contentLoaded) {
          const fullDoc = await fetchLatexFile(targetFile.id);
          if (sequence !== projectLoadSeq.current || projectIdRef.current !== projId) return;
          if (!fullDoc || fullDoc.id !== targetFile.id) throw new Error("Could not load the selected file. Local buffers and recovery drafts are retained.");
          const merged = saveManagerRef.current!.merge({ ...targetFile, ...fullDoc, contentLoaded: true }, projId);
          setFiles((prev) => prev.map((f) => (f.id === targetFile.id ? { ...f, ...merged } : f)));
          saveManagerRef.current!.publish();
          setLatexCode(merged.content);
        } else if (targetFile) {
          setLatexCode(saveManagerRef.current!.view(targetFile).content);
        }
      } else {
        setActiveFileId("");
        setLatexCode("");
      }

      // Check for any existing compiled PDF for this project
      let latestComp: CompilationState | null = null;
      try { latestComp = restoredTargetId ? await fetchLatestCompilation(projId, restoredTargetId) : null; }
      catch (error) {
        if (sequence === projectLoadSeq.current && targetSequence === targetRequestSeq.current) setTargetLoadError(error instanceof Error ? error.message : "Could not load target builds");
      }
      if (sequence !== projectLoadSeq.current || projectIdRef.current !== projId) return;
      if (targetSequence !== targetRequestSeq.current) return;
      applyCompilationState(latestComp, projId);
      if (restoredTargetId) {
        try {
          const history = await fetchCompilationHistory(projId, restoredTargetId);
          if (sequence === projectLoadSeq.current && targetSequence === targetRequestSeq.current) setBuildHistory(history);
        } catch (error) {
          if (sequence === projectLoadSeq.current && targetSequence === targetRequestSeq.current) setTargetLoadError(error instanceof Error ? error.message : "Could not load history");
        }
      }
      if (saveManagerRef.current!.status(projId) !== "saved") markPdfSourceChanged();
    } catch (err) {
      if (sequence !== projectLoadSeq.current) return;
      // An unsuccessful restoration is not an active project. Buffers stay in the manager.
      viewProjectIdRef.current = null;
      projectIdRef.current = null; setProjectId(null); setProjectName(null); setEntryFileId(null);
      setFiles([]); setFolders([]); setActiveFileId(""); setLatexCode("");
      setPdfUrl(null); setPdfState("none");
      setProjectLoadError(err instanceof Error ? err.message : "Unable to restore this project.");
      throw err;
    } finally {
      if (sequence === projectLoadSeq.current) setIsProjectLoading(false);
    }
  }, [applyCompilationState, mergeProjectFiles, markPdfSourceChanged, resolveCompileTarget]);

  const setEntryFile = useCallback(async (fileId: string) => {
    if (!projectId) return;
    if (entrySelectionPendingRef.current) throw new Error("Entry selection is still saving. Wait before selecting another entry.");
    entrySelectionPendingRef.current = true;
    try {
      const configuredEntryFileId = await setLatexProjectEntryFile(projectId, fileId);
      if (projectIdRef.current !== projectId) return;
      setEntryFileId(configuredEntryFileId);
      await selectCompileTarget(configuredEntryFileId);
      if (projectIdRef.current !== projectId) return;
      markPdfSourceChanged();
    } finally { entrySelectionPendingRef.current = false; }
  }, [projectId, markPdfSourceChanged, selectCompileTarget]);

  /**
   * Selects a file and ensures its content is loaded into state and editor.
   */
  const selectFile = useCallback(async (fileId: string) => {
    setActiveFileId(fileId);
    setActiveErrorLine(null);
    const existing = files.find((f) => f.id === fileId);
    if (!existing || !existing.contentLoaded) {
      try {
        const full = await fetchLatexFile(fileId);
        if (full) {
          const merged = saveManagerRef.current!.merge({ ...full, contentLoaded: true }, projectId || "");
          if (projectIdRef.current !== projectId) return;
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, ...merged } : f))
          );
          saveManagerRef.current!.publish();
          setLatexCode(merged.content);
          return;
        }
      } catch (err) {
        console.error("Error fetching file content:", err);
      }
    }
    if (existing) {
      setLatexCode(existing.content);
    }
  }, [files, projectId]);

  /**
   * Creates a new .tex file in the current project.
   */
  const createFile = useCallback(async (name: string, folderId?: string | null) => {
    let currentProjId = projectId;
    const sequence = currentProjId ? projectLoadSeq.current : ++projectLoadSeq.current;
    if (!currentProjId) {
      const proj = await createLatexProject("Resume Project");
      currentProjId = proj.id;
      if (sequence !== projectLoadSeq.current || projectIdRef.current) return;
      projectIdRef.current = proj.id;
      viewProjectIdRef.current = proj.id;
      setProjectId(proj.id);
      setProjectName(proj.name);
    }

    const newFile = await createLatexFile(currentProjId, name, folderId);
    if (sequence !== projectLoadSeq.current || projectIdRef.current !== currentProjId) return;
    markPdfSourceChanged();
    setFiles((prev) => [...prev, saveManagerRef.current!.merge(newFile, currentProjId)]);
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
    const sequence = currentProjId ? projectLoadSeq.current : ++projectLoadSeq.current;
    if (!currentProjId) {
      const proj = await createLatexProject("Resume Project");
      currentProjId = proj.id;
      if (sequence !== projectLoadSeq.current || projectIdRef.current) return;
      projectIdRef.current = proj.id;
      viewProjectIdRef.current = proj.id;
      setProjectId(proj.id);
      setProjectName(proj.name);
    }

    const newFolder = await createLatexFolder(currentProjId, name, parentFolderId);
    if (sequence !== projectLoadSeq.current || projectIdRef.current !== currentProjId) return;
    markPdfSourceChanged();
    setFolders((prev) => [...prev, newFolder]);
    setExpandedFolderIds((prev) => [...prev, newFolder.id]);
  }, [projectId, markPdfSourceChanged]);

  /**
   * Deletes a file and selects another available file.
   */
  const deleteFile = useCallback(async (fileId: string, choice?: "save" | "discard") => {
    const requestProjectId = projectIdRef.current;
    const requestEntryFileId = entryFileId;
    setFileOperationBusy(fileId);
    try { await saveManagerRef.current!.delete(fileId, choice, revision => deleteLatexFile(fileId, revision)); }
    finally { setFileOperationBusy(null); }
    if (projectIdRef.current !== requestProjectId) return;
    markPdfSourceChanged();
    if (fileId === requestEntryFileId) {
      setEntryFileId(current => current === fileId ? null : current);
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
    const requestProjectId = projectIdRef.current;
    if (!requestProjectId) throw new Error("No active project");
    const updated = await saveManagerRef.current!.serverOperation(requestProjectId, () => renameLatexFile(fileId, newName));
    if (projectIdRef.current !== requestProjectId) return;
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
    const requestProjectId = projectIdRef.current;
    if (!requestProjectId) throw new Error("No active project");
    await saveManagerRef.current!.serverOperation(requestProjectId, () => renameLatexFolder(folderId, newName));
    if (projectIdRef.current !== requestProjectId) return;
    markPdfSourceChanged();
    await loadProject(requestProjectId);
  }, [loadProject, markPdfSourceChanged]);

  const updateFileContent = useCallback((fileIdOrName: string, content: string) => {
    const file = files.find(f => f.id === fileIdOrName || f.path === fileIdOrName || f.name === fileIdOrName);
    if (!file) return;
    saveManagerRef.current!.edit(file.id, content);
    if (activeFileId === fileIdOrName || activeFile?.path === fileIdOrName || activeFile?.name === fileIdOrName) {
      setLatexCode(content);
    }
    markPdfSourceChanged();
  }, [files, activeFileId, activeFile, markPdfSourceChanged]);

  const applyAcceptedSuggestion = useCallback((result: Awaited<ReturnType<typeof acceptTailoringSuggestion>>) => {
    const merged = saveManagerRef.current!.merge({ id: result.fileId, content: result.updatedContent,
      contentRevision: result.contentRevision, recoveryPending: result.recoveryPending, contentLoaded: true }, projectId || "");
    setFiles((prev) => prev.map((file) =>
      file.id === result.fileId
        ? { ...file, ...merged, lineCount: merged.content.split(/\r?\n/).length }
        : file
    ));
    setActiveFileId(result.fileId);
    setLatexCode(merged.content);
    setFileSaveStatus(saveManagerRef.current!.status(projectId || ""));
    saveManagerRef.current!.publish();
    setIsPdfStale(result.pdfStale);
    setPdfState(result.pdfStale ? "stale" : pdfState);
    setEditorHighlightRange({
      startLine: result.changedLineStart,
      endLine: result.changedLineEnd,
    });
    setSuggestionFeedback({
      type: "success",
      message: `Suggestion applied to ${result.fileName} · line ${result.changedLineStart}`,
    });
  }, [pdfState, projectId]);

  const [activeJdSession, setActiveJdSession] = useState<ActiveJdSession | null>(null);
  const jdRequestSeqRef = useRef<number>(0);
  const tailoringRefreshSeqRef = useRef(0);

  const refreshTailoringSuggestions = useCallback(async (requestedAnalysisId?: string) => {
    if (!projectId || !currentVersionId || projectIdRef.current !== projectId || currentVersionIdRef.current !== currentVersionId) return;
    const requestProjectId = projectId;
    const requestVersionId = currentVersionId;
    const loadSequence = projectLoadSeq.current;
    const analysisSequence = jdRequestSeqRef.current;
    const refreshSequence = ++tailoringRefreshSeqRef.current;
    const isCurrent = () => projectIdRef.current === requestProjectId && currentVersionIdRef.current === requestVersionId &&
      projectLoadSeq.current === loadSequence && jdRequestSeqRef.current === analysisSequence && tailoringRefreshSeqRef.current === refreshSequence;
    setTailoringSuggestionsLoading(true);
    setTailoringSuggestionsError(null);
    try {
      const suggestions = await fetchTailoringSuggestions(requestProjectId, requestVersionId, requestedAnalysisId ?? tailoringAnalysisId ?? undefined);
      if (isCurrent()) setTailoringSuggestions(suggestions);
    } catch (error) {
      if (isCurrent()) setTailoringSuggestionsError(error instanceof Error ? error.message : "Unable to load suggestions");
    } finally {
      if (isCurrent()) setTailoringSuggestionsLoading(false);
    }
  }, [projectId, currentVersionId, tailoringAnalysisId]);

  const startNewJdAnalysis = useCallback(() => {
    jdRequestSeqRef.current += 1;
    setActiveJdSession(null);
    setTailoringSuggestions([]);
    setTailoringSuggestionsLoading(false);
    setTailoringSuggestionsError(null);
    setTailoringAnalysisSummary(null);
    setTailoringAnalysisRequirements([]);
    setTailoringAnalysisStatus("idle");
    setTailoringAnalysisId(null);
  }, []);

  const acceptTailoringSuggestionById = useCallback(async (suggestionId: string) => {
    if (!projectId || !currentVersionId) throw new Error("Resume version is not available yet.");
    const requestProjectId = projectId;
    const requestVersionId = currentVersionId;
    try { await saveManagerRef.current!.serverOperation(requestProjectId, async () => {
      const result = await acceptTailoringSuggestion(suggestionId, requestProjectId, requestVersionId);
      if (projectIdRef.current === requestProjectId) applyAcceptedSuggestion(result);
      else saveManagerRef.current!.merge({ id: result.fileId, content: result.updatedContent, contentRevision: result.contentRevision,
        recoveryPending: result.recoveryPending, contentLoaded: true }, requestProjectId);
      await saveManagerRef.current!.refresh(result.fileId);
      return result;
    }); }
    catch (error) {
      await Promise.allSettled(files.map(file => saveManagerRef.current!.refresh(file.id)));
      throw error;
    }
    if (projectIdRef.current !== requestProjectId) return;
    setTailoringSuggestions((previous) => previous.map((item) =>
      item.suggestionId === suggestionId ? { ...item, status: "accepted" } : item
    ));
    setActiveJdSession((prev) => prev ? {
      ...prev,
      suggestions: prev.suggestions.map((item) =>
        item.suggestionId === suggestionId ? { ...item, status: "accepted" } : item
      ),
    } : null);
  }, [projectId, currentVersionId, applyAcceptedSuggestion, files]);

  const rejectTailoringSuggestionById = useCallback(async (suggestionId: string) => {
    if (!projectId || !currentVersionId) throw new Error("Resume version is not available yet.");
    await rejectTailoringSuggestion(suggestionId, projectId, currentVersionId);
    setTailoringSuggestions((previous) => previous.map((item) =>
      item.suggestionId === suggestionId ? { ...item, status: "rejected" } : item
    ));
    setActiveJdSession((prev) => prev ? {
      ...prev,
      suggestions: prev.suggestions.map((item) =>
        item.suggestionId === suggestionId ? { ...item, status: "rejected" } : item
      ),
    } : null);
  }, [projectId, currentVersionId]);

  const generateTailoringSuggestions = useCallback(async (jobDescription: string) => {
    if (!projectId || !currentVersionId) throw new Error("Resume project and version are not available yet.");
    if (isProjectLoading || projectLoadError || projectIdRef.current !== projectId || currentVersionIdRef.current !== currentVersionId) {
      throw new Error("Wait for the requested resume project to finish loading before analyzing a job description.");
    }
    const trimmedJd = jobDescription.trim();
    if (!trimmedJd) throw new Error("Job description cannot be empty.");

    const requestProjectId = projectId;
    const requestVersionId = currentVersionId;
    const loadSequence = projectLoadSeq.current;
    const seq = ++jdRequestSeqRef.current;
    tailoringRefreshSeqRef.current += 1;
    const isCurrent = () => seq === jdRequestSeqRef.current && projectIdRef.current === requestProjectId &&
      currentVersionIdRef.current === requestVersionId && projectLoadSeq.current === loadSequence;

    setActiveJdSession({
      analysisId: null,
      jobDescription: trimmedJd,
      submittedAt: new Date().toISOString(),
      status: "indexing",
      progressStep: "Saving pending resume edits...",
      summary: null,
      requirements: [],
      suggestions: [],
      error: null,
    });
    setTailoringSuggestionsLoading(true);
    setTailoringSuggestionsError(null);
    setTailoringAnalysisStatus("idle");

    try {
      try {
        await saveManagerRef.current!.flush(requestProjectId);
      } catch (error) {
        throw new Error(`Unable to start JD analysis until resume edits are saved: ${error instanceof Error ? error.message : "Save failed. Local edits are retained."}`);
      }
      if (!isCurrent()) return;
      // The existing tree endpoint rejects unresolved rename recovery. Do not
      // merge this check into the editor or replace any dirty buffers.
      await fetchProjectFiles(requestProjectId);
      if (!isCurrent()) return;
      setActiveJdSession((prev) => prev ? { ...prev, progressStep: "Indexing resume evidence..." } : prev);
      await indexTailoringResume(requestProjectId, requestVersionId);
      if (!isCurrent()) return;

      setActiveJdSession((prev) => prev ? { ...prev, status: "extracting", progressStep: "Extracting job requirements..." } : prev);
      const requirements = await extractTailoringRequirements(trimmedJd);
      if (!isCurrent()) return;
      if (requirements.length === 0) throw new Error("No job requirements were extracted.");

      setActiveJdSession((prev) => prev ? { ...prev, status: "analyzing", progressStep: "Analyzing matches & generating grounded suggestions..." } : prev);
      // Edits made while extracting requirements must also be confirmed before
      // the backend reparses source for analysis.
      await saveManagerRef.current!.flush(requestProjectId);
      if (!isCurrent()) return;
      const analysis = await analyzeTailoring(requestProjectId, requestVersionId, trimmedJd);
      if (!isCurrent()) return;

      setActiveJdSession((prev) => prev ? { ...prev, progressStep: "Loading verified suggestions..." } : prev);
      const [persistedAnalysis, suggestions] = await Promise.all([
        fetchTailoringAnalysis(analysis.analysisId),
        fetchTailoringSuggestions(requestProjectId, requestVersionId, analysis.analysisId),
      ]);
      if (!isCurrent()) return;

      const mappedRequirements = persistedAnalysis.requirements.map((item: TailoringAnalysisView["requirements"][number]) => ({
        requirementId: item.requirementId,
        text: item.cleanText ?? item.text,
        classification: item.match?.classification,
        reason: item.match?.reason,
      }));

      tailoringRefreshSeqRef.current += 1;
      setActiveJdSession({
        analysisId: analysis.analysisId,
        diagnosticReasons: persistedAnalysis.diagnosticReasons,
        jobDescription: trimmedJd,
        submittedAt: new Date().toISOString(),
        status: "completed",
        progressStep: "Analysis complete",
        summary: analysis.summary,
        requirements: mappedRequirements,
        suggestions,
        error: null,
      });

      setTailoringAnalysisId(analysis.analysisId);
      setTailoringAnalysisSummary(analysis.summary);
      setTailoringAnalysisStatus("completed");
      setTailoringAnalysisRequirements(mappedRequirements);
      setTailoringSuggestions(suggestions);
    } catch (error) {
      if (!isCurrent()) return;
      const errMsg = error instanceof Error ? error.message : "Unable to generate grounded suggestions.";
      setActiveJdSession((prev) => prev ? { ...prev, status: "failed", error: errMsg, progressStep: "Analysis failed" } : null);
      setTailoringAnalysisStatus("failed");
      setTailoringSuggestionsError(errMsg);
      throw error;
    } finally {
      if (isCurrent()) {
        setTailoringSuggestionsLoading(false);
      }
    }
  }, [projectId, currentVersionId, isProjectLoading, projectLoadError]);

  const setEditorContent = useCallback((content: string) => {
    if (activeFile?.id) {
      updateFileContent(activeFile.id, content);
    }
  }, [activeFile, updateFileContent]);

  const onEditorChange = useCallback((content: string) => {
    if (!activeFile?.id || !activeFile.contentLoaded) return;
    saveManagerRef.current!.edit(activeFile.id, content);
    setLatexCode(content);
    markPdfSourceChanged();
    if (lastCompiledAt !== null) setIsPdfStale(true);
  }, [activeFile, lastCompiledAt, markPdfSourceChanged]);

  /**
   * Real LaTeX Compilation pipeline.
   * Flushes saves, calls compile API, updates status and PDF URL.
   */
  const compileLatex = useCallback(async () => {
    if (isCompiling || compileSubmissionRef.current) return;
    if (!projectId) {
      setCompileStatus("error");
      setCompileLog("No active project to compile.");
      return;
    }


    compileSubmissionRef.current = true;
    const loadSequence = projectLoadSeq.current;
    let targetSequence = ++targetRequestSeq.current;
    setIsCompiling(true);
    setCompileStatus("compiling");
    setCompileLog("Compiling document with pdflatex...");

    try {
      if (entrySelectionPendingRef.current) throw new Error("Entry selection is still saving. Wait before compiling.");
      let targetEntryId = compileTargetRef.current ?? entryFileId;
      if (!targetEntryId) throw new Error("Select a .tex file as the project's compilation entry before compiling.");
      if (!compileTargetRef.current) { compileTargetRef.current = targetEntryId; setCompileTargetId(targetEntryId); }
      const openFile = files.find(file => file.id === activeFileId);
      if (openFile && openFile.path.toLowerCase().endsWith(".tex") && openFile.id !== targetEntryId) {
        const choice = await requestCompileTarget(openFile.path, files.find(file => file.id === targetEntryId)?.path ?? "selected target");
        if (choice === "cancel") {
          if (projectIdRef.current === projectId && projectLoadSeq.current === loadSequence && targetRequestSeq.current === targetSequence) setCompileStatus("idle");
          return;
        }
        if (projectIdRef.current !== projectId || projectLoadSeq.current !== loadSequence) return;
        if (entrySelectionPendingRef.current) throw new Error("Entry selection is still saving. Wait before compiling.");
        if (choice === "open") {
          targetEntryId = openFile.id;
          compileTargetRef.current = targetEntryId; setCompileTargetId(targetEntryId);
          writeCompileTarget(projectId, targetEntryId);
          targetSequence = ++targetRequestSeq.current;
          setPdfUrl(null); setPdfState("none"); setPreviewBuild(null); setBuildHistory(null);
        }
      }
      const result = await afterSaved(saveManagerRef.current!, projectId, () => {
        if (entrySelectionPendingRef.current) throw new Error("Entry selection is still saving. Wait before compiling.");
        if (projectIdRef.current !== projectId || projectLoadSeq.current !== loadSequence || targetRequestSeq.current !== targetSequence) throw new Error("Project or target changed before compilation. Compile the current target again.");
        return compileLatexProject(projectId, targetEntryId);
      });
      if (projectIdRef.current !== projectId || projectLoadSeq.current !== loadSequence || targetRequestSeq.current !== targetSequence) return;

      setCompileDuration(result.durationMs);

      if (result.status === "success") {
        setCompileStatus("success");
        setCompileErrors([]);
        setPdfState("valid");
        setIsPdfStale(false);
        setLastCompiledAt(new Date());
        setPdfUrl(getLatexPdfUrl(projectId) + `?compilationId=${result.compilationId}`);
        setPreviewBuild({ id: result.compilationId, path: result.entryFilePath });
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
      let persistedState: CompilationState | null;
      try {
        const [state, history] = await Promise.all([fetchLatestCompilation(projectId, targetEntryId), fetchCompilationHistory(projectId, targetEntryId)]);
        if (projectIdRef.current !== projectId || projectLoadSeq.current !== loadSequence || targetRequestSeq.current !== targetSequence) return;
        persistedState = state; setBuildHistory(history); setTargetLoadError(null);
      } catch (error) {
        if (projectIdRef.current === projectId && targetRequestSeq.current === targetSequence) setTargetLoadError(error instanceof Error ? error.message : "Could not refresh build history");
        return;
      }
      // Keep a successful response's preview pinned to that build, even if another
      // browser has completed a newer compilation before the metadata refresh.
      if (result.status !== "success" || persistedState?.pdf?.url.includes(`compilationId=${result.compilationId}`)) {
        applyCompilationState(persistedState, projectId);
      } else { markPdfSourceChanged(); }
      if (saveManagerRef.current!.status(projectId) !== "saved") markPdfSourceChanged();
    } catch (err) {
      if (projectIdRef.current !== projectId || projectLoadSeq.current !== loadSequence || targetRequestSeq.current !== targetSequence) return;
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
      compileSubmissionRef.current = false;
      setIsCompiling(false);
    }
  }, [isCompiling, projectId, entryFileId, activeFileId, files, requestCompileTarget, applyCompilationState, markPdfSourceChanged]);

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
    const sequence = projectLoadSeq.current;
    const requestProjectId = projectIdRef.current;
    setUploadStatus("uploading");
    setUploadMessage(`Uploading ${file.name}...`);
    try {
      const res = await uploadLatexFile(file, projectId || undefined);
      const { project, file: uploadedDoc } = res.data;
      if (sequence !== projectLoadSeq.current || projectIdRef.current !== requestProjectId) {
        setUploadStatus("success"); setUploadMessage(`${uploadedDoc.name} uploaded to its original project.`); return res;
      }

      await loadProject(project.id);
      if (projectIdRef.current !== project.id) return res;

      setFiles(previous => previous.map(item => item.id === uploadedDoc.id
        ? saveManagerRef.current!.merge({ ...item, ...uploadedDoc, contentLoaded: true }, project.id)
        : item));
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
    const current = Object.fromEntries(files.map(file => [file.path, file.content]));
    const next = typeof action === "function" ? action(current) : action;
    if (Object.keys(next).length !== files.length || files.some(file => !Object.hasOwn(next, file.path) || !file.contentLoaded)) {
      throw new Error("Use explicit create/delete operations; load files before editing their content.");
    }
    for (const file of files) if (next[file.path] !== file.content) saveManagerRef.current!.edit(file.id, next[file.path]);
    markPdfSourceChanged();
  }, [files, markPdfSourceChanged]);

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
    currentVersionIdRef.current = currentVersionId;
    startNewJdAnalysis();
    return () => { jdRequestSeqRef.current += 1; };
  }, [projectId, currentVersionId, startNewJdAnalysis]);

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
        void flushSave().catch(() => { /* error is shown in the save status */ });
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

  // Compiler discovery is independent of project restoration.
  useEffect(() => {
    let mounted = true;
    checkCompilerStatus().then(status => { if (mounted) setCompilerInfo(status); });
    return () => { mounted = false; };
  }, []);

  // The route chooses the project. Demo never falls back to a global latest file.
  useEffect(() => {
    if (!requestedProjectId || requestedProjectId === "demo") {
      setIsProjectLoading(false);
      setProjectLoadError(null);
      return;
    }
    void loadProject(requestedProjectId).catch(() => { /* The workspace displays projectLoadError. */ });
    return cancelProjectLoad;
  }, [requestedProjectId, loadProject, cancelProjectLoad]);

  // Sync LaTeX code when active file changes
  useEffect(() => {
    if (activeFile?.contentLoaded) {
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

  const acceptAISuggestion = useCallback(async (suggestionId: string) => {
    const suggestion = aiSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    let recoveredAcceptance = false;
    if (projectId && !suggestionId.startsWith("sug_")) {
      try {
        await saveManagerRef.current!.serverOperation(projectId, async () => {
          try {
            const result = await acceptTailoringSuggestion(suggestionId, projectId, currentVersionId || "");
            if (projectIdRef.current === projectId) applyAcceptedSuggestion(result);
            else saveManagerRef.current!.merge({ id: result.fileId, content: result.updatedContent, contentRevision: result.contentRevision,
              recoveryPending: result.recoveryPending, contentLoaded: true }, projectId);
            await saveManagerRef.current!.refresh(result.fileId);
          } catch (error) {
            // Read committed state; never replay a patch after an ambiguous acknowledgment.
            const refreshed = await Promise.allSettled(files.map(file => saveManagerRef.current!.refresh(file.id)));
            const confirmed = await fetchTailoringSuggestions(projectId, currentVersionId || "").catch(() => null);
            if (refreshed.some(result => result.status === "rejected") ||
                !confirmed?.some(item => item.suggestionId === suggestionId && item.status === "accepted")) throw error;
            recoveredAcceptance = true;
          }
        });
      } catch (error) {
        console.error("Failed to apply AI suggestion:", error);
        if (projectIdRef.current !== projectId) return;
        setSuggestionFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to apply suggestion.",
        });
        return;
      }
      if (projectIdRef.current !== projectId) return;
      if (recoveredAcceptance) {
        markPdfSourceChanged();
        setSuggestionFeedback({ type: "success", message: "Suggestion acceptance confirmed from the server after a lost acknowledgment." });
      }
    }

    if (!recoveredAcceptance) setResume((prev) => {
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
  }, [aiSuggestions, projectId, currentVersionId, applyAcceptedSuggestion, files, markPdfSourceChanged]);

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
        editorHighlightRange,
        suggestionFeedback,
        applyAcceptedSuggestion,
        tailoringSuggestions,
        tailoringSuggestionsLoading,
        tailoringSuggestionsError,
        tailoringAnalysisSummary,
        tailoringAnalysisStatus,
        tailoringAnalysisRequirements,
        refreshTailoringSuggestions,
        acceptTailoringSuggestionById,
        rejectTailoringSuggestionById,
        generateTailoringSuggestions,
        currentVersionId,
        compilerInfo,
        saveStatus: fileSaveStatus,
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
        requestedProjectId,
        resumeBasePath,
        isProjectLoading,
        projectLoadError,
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
        compileTargetId,
        selectCompileTarget,
        buildHistory,
        loadBuildHistory,
        previewBuild,
        showCompilationBuild,
        targetLoadError,
        compileTargetChoice,
        resolveCompileTarget,
        jumpToError,
        editorContent,
        setEditorContent,
        onEditorChange,
        fileSaveStatus,
        fileSaveError,
        saveConflicts,
        recoveryDrafts,
        draftRecoveryError,
        fileOperationBusy,
        refreshSaveConflict,
        resolveSaveConflict,
        editSaveConflict,
        discardRecoveryDraft,
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
        chatMessages,
        isChatLoading,
        chatError,
        sendChatMessage,
        startNewChat,
        clearChatMessages,
        activeJdSession,
        startNewJdAnalysis,
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
