"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SquareTerminal,
  LayoutGrid,
  Scan,
  TrendingUp,
  Briefcase,
  History,
  FilePlus,
  FolderPlus,
  Upload,
  Loader2,
  ChevronDown,
  ChevronRight,
  Folder,
  SlidersHorizontal,
  PanelLeft,
  CheckCircle2,
  RotateCw,
  AlertCircle,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { LatexFileItem, LatexFolderItem } from "@/types/latex";
import { CompileErrorItem, CompilerStatusData } from "@/lib/api/latex";

// ── TeX File Icon matching Sidebar.png ────────────────────────────────────────
export function TexFileIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <rect
        x="2.5"
        y="1.5"
        width="11"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5 5.5h6M5 8.5h6M5 11.5h3.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── 1. Sidebar Section Component ──────────────────────────────────────────────
interface SidebarSectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SidebarSection({
  title,
  action,
  children,
  className = "",
}: SidebarSectionProps) {
  return (
    <div className={`space-y-0.5 ${className}`}>
      <div className="flex items-center justify-between px-2 pt-2.5 pb-1 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-[#636674] uppercase">
          {title}
        </span>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ── 2. Sidebar Nav Item Component ─────────────────────────────────────────────
interface SidebarNavItemProps {
  title: string;
  href?: string;
  icon: React.ReactNode;
  active?: boolean;
  isIdeActiveStyle?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
}

export function SidebarNavItem({
  title,
  href,
  icon,
  active = false,
  isIdeActiveStyle = false,
  badge,
  onClick,
}: SidebarNavItemProps) {
  const content = (
    <div
      className={`h-9 px-2.5 rounded-lg flex items-center justify-between text-[13px] transition-colors select-none ${
        active && isIdeActiveStyle
          ? "bg-[#251f15] border border-[#3e301d] text-[#deb36c] font-medium"
          : active
          ? "bg-white/[0.08] text-white font-medium border border-white/[0.08]"
          : "text-[#a1a1aa] hover:text-[#EDEDED] hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`shrink-0 ${
            active && isIdeActiveStyle
              ? "text-[#deb36c]"
              : active
              ? "text-white"
              : "text-[#9ca3af]"
          }`}
        >
          {icon}
        </span>
        <span className="truncate">{title}</span>
      </div>

      {badge && <div className="shrink-0 ml-2">{badge}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className="block focus:outline-none">
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left focus:outline-none cursor-pointer"
    >
      {content}
    </button>
  );
}

// ── 3. Modals & Dialogs for CRUD Operations ──────────────────────────────────
interface ModalWrapperProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalWrapper({ title, onClose, children }: ModalWrapperProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#141519] border border-[#23242b] rounded-xl w-full max-w-sm p-4 text-xs text-neutral-300 shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
          <span className="font-semibold text-white text-[13px]">{title}</span>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── 4. Project File Item Component ────────────────────────────────────────────
interface ProjectFileItemProps {
  name: string;
  lines: number;
  isActive: boolean;
  depth?: number;
  onClick?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onSetEntryFile?: () => void;
  isEntryFile?: boolean;
}

export function ProjectFileItem({
  name,
  lines,
  isActive,
  depth = 0,
  onClick,
  onRename,
  onDelete,
  onSetEntryFile,
  isEntryFile = false,
}: ProjectFileItemProps) {
  const isRoot = depth === 0;

  return (
    <div
      onClick={onClick}
      className={`group relative w-full flex items-center justify-between text-xs transition-colors rounded-md cursor-pointer select-none ${
        isRoot ? "h-8 px-2.5 my-0.5" : "h-7 pl-6 pr-2.5 my-0.5"
      } ${
        isActive
          ? "bg-[#1c1d22] text-white border border-white/[0.06]"
          : isRoot
          ? "text-[#d4d4d8] hover:text-white hover:bg-white/[0.03]"
          : "text-[#a1a1aa] hover:text-white hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <TexFileIcon
          className={`w-3.5 h-3.5 shrink-0 ${
            isActive ? "text-[#e59b3c]" : "text-[#71717a]"
          }`}
        />
        <span className="font-mono text-[12px] truncate">{name}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Line count (hidden when hovering for actions) */}
        <span className="font-mono text-[11px] text-[#71717a] group-hover:hidden">
          {lines}L
        </span>
        {isEntryFile && (
          <span className="text-[9px] font-semibold tracking-wide text-amber-300/80 group-hover:hidden">
            ENTRY
          </span>
        )}

        {/* Hover Action buttons */}
        <div
          className="hidden group-hover:flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {isEntryFile ? (
            <span className="px-1 text-[9px] font-semibold tracking-wide text-amber-300/80">ENTRY</span>
          ) : onSetEntryFile ? (
            <button
              onClick={onSetEntryFile}
              title="Set as entry file"
              className="px-1 text-[9px] font-semibold tracking-wide text-neutral-400 hover:text-amber-300"
            >
              ENTRY
            </button>
          ) : null}
          {onRename && (
            <button
              onClick={onRename}
              title="Rename file"
              className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete file"
              className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-white/10 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 5. Project Folder Item Component ──────────────────────────────────────────
interface ProjectFolderItemProps {
  name: string;
  isOpen: boolean;
  onToggle: () => void;
  onAddFile?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  children?: React.ReactNode;
}

export function ProjectFolderItem({
  name,
  isOpen,
  onToggle,
  onAddFile,
  onRename,
  onDelete,
  children,
}: ProjectFolderItemProps) {
  return (
    <div className="space-y-0.5">
      <div
        onClick={onToggle}
        className="group relative w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-[#d4d4d8] hover:text-white hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
          )}
          <Folder className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
          <span className="font-sans text-[12px] truncate font-medium">{name}</span>
        </div>

        {/* Folder hover actions */}
        <div
          className="hidden group-hover:flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {onAddFile && (
            <button
              onClick={onAddFile}
              title="New file in this folder"
              className="p-1 text-neutral-400 hover:text-amber-400 hover:bg-white/10 rounded transition-colors"
            >
              <FilePlus className="w-3 h-3" />
            </button>
          )}
          {onRename && (
            <button
              onClick={onRename}
              title="Rename folder"
              className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete folder"
              className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-white/10 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isOpen && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

// ── 6. Project File Tree Component ────────────────────────────────────────────
interface ProjectFileTreeProps {
  files: LatexFileItem[];
  folders: LatexFolderItem[];
  activeFileId: string;
  expandedFolderIds: string[];
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (fileId: string) => void;
  onAddFileToFolder: (folderId: string) => void;
  onRenameFile: (file: LatexFileItem) => void;
  onDeleteFile: (file: LatexFileItem) => void;
  onSetEntryFile: (file: LatexFileItem) => void;
  entryFileId: string | null;
  onRenameFolder: (folder: LatexFolderItem) => void;
  onDeleteFolder: (folder: LatexFolderItem) => void;
  onNewFileClick: () => void;
}

export function ProjectFileTree({
  files,
  folders,
  activeFileId,
  expandedFolderIds,
  onToggleFolder,
  onSelectFile,
  onAddFileToFolder,
  onRenameFile,
  onDeleteFile,
  onSetEntryFile,
  entryFileId,
  onRenameFolder,
  onDeleteFolder,
  onNewFileClick,
}: ProjectFileTreeProps) {
  // Empty project state
  if (files.length === 0 && folders.length === 0) {
    return (
      <div className="py-6 px-3 text-center space-y-2">
        <p className="text-xs text-neutral-500">No files yet</p>
        <button
          onClick={onNewFileClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-300 border border-amber-400/20 text-xs hover:bg-amber-400/20 transition-colors cursor-pointer"
        >
          <FilePlus className="w-3.5 h-3.5" />
          <span>+ New file</span>
        </button>
      </div>
    );
  }

  // Root files: files with no folderId and no slash in path
  const rootFiles = files.filter(
    (f) => !f.folderId && !f.path.includes("/")
  );

  return (
    <div className="space-y-0.5">
      {/* Root-level files (e.g. main.tex) */}
      {rootFiles.map((file) => {
        const lineCount = file.lineCount ?? (file.content ? file.content.split("\n").length : 0);
        const isSelected = activeFileId === file.id;

        return (
          <ProjectFileItem
            key={file.id}
            name={file.name}
            lines={lineCount}
            isActive={isSelected}
            depth={0}
            onClick={() => onSelectFile(file.id)}
            onRename={() => onRenameFile(file)}
            onDelete={() => onDeleteFile(file)}
            onSetEntryFile={() => onSetEntryFile(file)}
            isEntryFile={entryFileId === file.id}
          />
        );
      })}

      {/* Folders */}
      {folders.map((folder) => {
        const isOpen = expandedFolderIds.includes(folder.id);
        const childFiles = files.filter(
          (f) =>
            f.folderId === folder.id ||
            f.path.startsWith(`${folder.path}/`)
        );

        return (
          <ProjectFolderItem
            key={folder.id}
            name={folder.name}
            isOpen={isOpen}
            onToggle={() => onToggleFolder(folder.id)}
            onAddFile={() => onAddFileToFolder(folder.id)}
            onRename={() => onRenameFolder(folder)}
            onDelete={() => onDeleteFolder(folder)}
          >
            {childFiles.map((file) => {
              const lineCount =
                file.lineCount ?? (file.content ? file.content.split("\n").length : 0);
              const isSelected = activeFileId === file.id;

              return (
                <ProjectFileItem
                  key={file.id}
                  name={file.name}
                  lines={lineCount}
                  isActive={isSelected}
                  depth={1}
                  onClick={() => onSelectFile(file.id)}
                  onRename={() => onRenameFile(file)}
                  onDelete={() => onDeleteFile(file)}
                />
              );
            })}
          </ProjectFolderItem>
        );
      })}
    </div>
  );
}

// ── 7. Compiler Status Component ──────────────────────────────────────────────
interface CompilerStatusProps {
  compileStatus: "idle" | "compiling" | "success" | "error";
  compileLog?: string;
  compilerInfo?: CompilerStatusData | null;
  compileErrors?: CompileErrorItem[];
}

export function CompilerStatus({
  compileStatus,
  compileLog,
  compilerInfo,
  compileErrors,
}: CompilerStatusProps) {
  let icon = <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />;
  let title = "Ready to compile";
  let subtitle = compilerInfo?.available
    ? `pdfLaTeX · ${compilerInfo.version || "TeX Live"}`
    : compilerInfo === null
    ? "Checking compiler..."
    : "Compiler unavailable";
  let titleColor = "text-white";

  if (compilerInfo && !compilerInfo.available) {
    icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    title = "Compiler not found";
    subtitle = "pdflatex not installed";
    titleColor = "text-amber-300";
  } else if (compileStatus === "compiling") {
    icon = <RotateCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />;
    title = "Compiling...";
    subtitle = "pdfLaTeX engine";
    titleColor = "text-amber-300";
  } else if (compileStatus === "error") {
    icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
    title = "Compilation failed";
    if (compilerInfo && !compilerInfo.available) {
      subtitle = "pdflatex not installed";
    } else if (compileErrors && compileErrors.length > 0) {
      const firstErr = compileErrors[0];
      subtitle = `${firstErr.file || "main.tex"}:${firstErr.line || 1}`;
    } else if (compileLog?.includes(":")) {
      subtitle = compileLog.slice(0, 24);
    } else {
      subtitle = "Errors in source";
    }
    titleColor = "text-rose-400";
  } else if (compileStatus === "success") {
    icon = <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />;
    title = "Compiled successfully";
    subtitle = compilerInfo?.version ? `pdfLaTeX · ${compilerInfo.version}` : "PDF up to date";
    titleColor = "text-white";
  }

  return (
    <div className="rounded-xl bg-[#141519] border border-[#23242b] p-3 select-none">
      <div className="flex items-center gap-2.5">
        {icon}
        <span className={`text-[13px] font-medium leading-none ${titleColor}`}>
          {title}
        </span>
      </div>
      <div className="text-[11px] text-[#71717a] font-mono mt-1.5 pl-6.5 leading-none">
        {subtitle}
      </div>
    </div>
  );
}

// ── 8. Sidebar Footer Component ───────────────────────────────────────────────
interface SidebarFooterProps {
  isSettingsActive: boolean;
  onToggleCollapse: () => void;
}

export function SidebarFooter({
  isSettingsActive,
  onToggleCollapse,
}: SidebarFooterProps) {
  return (
    <div className="flex items-center justify-between px-1.5 pt-1 text-xs select-none">
      <Link
        href="/settings"
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors ${
          isSettingsActive
            ? "text-white font-medium bg-white/[0.06]"
            : "text-[#a1a1aa] hover:text-white hover:bg-white/[0.04]"
        }`}
      >
        <SlidersHorizontal className="w-4 h-4 text-[#9ca3af]" />
        <span>Settings</span>
      </Link>

      <button
        onClick={onToggleCollapse}
        className="p-1.5 text-[#71717a] hover:text-white hover:bg-white/[0.05] rounded-md transition-colors cursor-pointer"
        title="Toggle sidebar"
      >
        <PanelLeft className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main ResumeSidebar Component ──────────────────────────────────────────────
export function ResumeSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const {
    atsScore,
    files,
    folders,
    activeFileId,
    expandedFolderIds,
    toggleFolder,
    selectFile,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameFile,
    renameFolder,
    entryFileId,
    setEntryFile,
    uploadStatus,
    uploadMessage,
    uploadFile,
    compileStatus,
    compileLog,
    compileErrors,
    compilerInfo,
    isSidebarCollapsed,
    toggleSidebar,
  } = useResume();

  // Dialog state
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [selectedFolderForFile, setSelectedFolderForFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  // Rename dialog state
  const [renamingItem, setRenamingItem] = useState<{
    type: "file" | "folder";
    id: string;
    currentName: string;
  } | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // Delete dialog state
  const [deletingItem, setDeletingItem] = useState<{
    type: "file" | "folder";
    id: string;
    name: string;
  } | null>(null);

  // Active route styling
  const isLatexActive =
    pathname.includes("/latex") ||
    pathname === "/" ||
    (!pathname.includes("/overview") &&
      !pathname.includes("/ats") &&
      !pathname.includes("/jobs") &&
      !pathname.includes("/versions") &&
      !pathname.includes("/settings") &&
      !pathname.includes("/editor") &&
      !pathname.includes("/preview") &&
      !pathname.includes("/dashboard"));

  const isOverviewActive =
    pathname === "/dashboard" ||
    pathname.includes("/overview") ||
    pathname === "/resume/demo";

  const isATSActive = pathname.includes("/ats");
  const isJobsActive = pathname.includes("/jobs");
  const isVersionsActive = pathname.includes("/versions");
  const isSettingsActive = pathname === "/settings";

  const handleSelectFile = async (fileId: string) => {
    await selectFile(fileId);
    if (!pathname.includes("/latex")) {
      router.push("/resume/demo/latex");
    }
  };

  const handleUploadClick = () => {
    setClientError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".tex")) {
      setClientError("Only .tex files can be uploaded.");
      setTimeout(() => setClientError(null), 4000);
      e.target.value = "";
      return;
    }

    setClientError(null);
    try {
      await uploadFile(file);
      if (!pathname.includes("/latex")) {
        router.push("/resume/demo/latex");
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      e.target.value = "";
    }
  };

  // Create file submission
  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    let name = newFileName.trim();
    if (!name) {
      setModalError("File name is required.");
      return;
    }
    if (!name.endsWith(".tex")) {
      name += ".tex";
    }

    try {
      await createFile(name, selectedFolderForFile);
      setIsFileModalOpen(false);
      setNewFileName("");
      setSelectedFolderForFile(null);
      if (!pathname.includes("/latex")) {
        router.push("/resume/demo/latex");
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to create file");
    }
  };

  // Create folder submission
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const name = newFolderName.trim();
    if (!name) {
      setModalError("Folder name is required.");
      return;
    }

    try {
      await createFolder(name);
      setIsFolderModalOpen(false);
      setNewFolderName("");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to create folder");
    }
  };

  // Rename submission
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem) return;
    setModalError(null);
    let name = renameInput.trim();
    if (!name) {
      setModalError("Name cannot be empty.");
      return;
    }

    try {
      if (renamingItem.type === "file") {
        if (!name.endsWith(".tex")) {
          name += ".tex";
        }
        await renameFile(renamingItem.id, name);
      } else {
        await renameFolder(renamingItem.id, name);
      }
      setRenamingItem(null);
      setRenameInput("");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Rename failed");
    }
  };

  // Delete submission
  const handleDeleteSubmit = async () => {
    if (!deletingItem) return;
    setModalError(null);

    try {
      if (deletingItem.type === "file") {
        await deleteFile(deletingItem.id);
      } else {
        await deleteFolder(deletingItem.id);
      }
      setDeletingItem(null);
    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : "Delete failed. If this is a folder, please delete its contents first."
      );
    }
  };

  return (
    <>
      {/* Mobile/Tablet Backdrop Overlay */}
      {!isSidebarCollapsed && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Frame */}
      <aside
        className={`w-[272px] shrink-0 border-r border-[#1f2026] bg-[#111215] flex flex-col justify-between h-screen select-none transition-all duration-200 z-50 ${
          isSidebarCollapsed
            ? "-translate-x-full lg:w-0 lg:overflow-hidden lg:translate-x-0 lg:border-r-0 lg:p-0"
            : "fixed inset-y-0 left-0 lg:relative lg:translate-x-0"
        }`}
      >
        {/* Scrollable Upper Area */}
        <div className="flex-1 overflow-y-auto px-3.5 pt-4 pb-2 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">
          {/* WORKSPACE */}
          <SidebarSection title="WORKSPACE">
            <SidebarNavItem
              title="LaTeX IDE"
              href="/resume/demo/latex"
              icon={<SquareTerminal className="w-[18px] h-[18px]" />}
              active={isLatexActive}
              isIdeActiveStyle={true}
            />
            <SidebarNavItem
              title="Resume overview"
              href="/resume/demo/overview"
              icon={<LayoutGrid className="w-[18px] h-[18px]" />}
              active={isOverviewActive}
            />
          </SidebarSection>

          {/* ANALYSIS */}
          <SidebarSection title="ANALYSIS">
            <SidebarNavItem
              title="ATS score"
              href="/resume/demo/ats"
              icon={<Scan className="w-[18px] h-[18px]" />}
              active={isATSActive}
              badge={
                <span className="bg-[#122e1e] text-[#4ade80] text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border border-[#1b432c]/60">
                  {atsScore}
                </span>
              }
            />
            <SidebarNavItem
              title="Resume insights"
              href="/resume/demo/ats"
              icon={<TrendingUp className="w-[18px] h-[18px]" />}
              active={false}
            />
          </SidebarSection>

          {/* WORK */}
          <SidebarSection title="WORK">
            <SidebarNavItem
              title="Job applications"
              href="/resume/demo/jobs"
              icon={<Briefcase className="w-[18px] h-[18px]" />}
              active={isJobsActive}
            />
            <SidebarNavItem
              title="Version history"
              href="/resume/demo/versions"
              icon={<History className="w-[18px] h-[18px]" />}
              active={isVersionsActive}
            />
          </SidebarSection>

          {/* Thin Divider */}
          <div className="my-3 mx-1 h-px bg-white/[0.07]" />

          {/* PROJECT FILES */}
          <SidebarSection
            title="PROJECT FILES"
            action={
              <div className="flex items-center gap-1">
                {/* Add File button */}
                <button
                  onClick={() => {
                    setSelectedFolderForFile(null);
                    setNewFileName("");
                    setModalError(null);
                    setIsFileModalOpen(true);
                  }}
                  title="New .tex file"
                  className="p-1 text-[#71717a] hover:text-amber-400 hover:bg-white/[0.04] rounded transition-colors cursor-pointer"
                >
                  <FilePlus className="w-3.5 h-3.5" />
                </button>

                {/* Add Folder button */}
                <button
                  onClick={() => {
                    setNewFolderName("");
                    setModalError(null);
                    setIsFolderModalOpen(true);
                  }}
                  title="New folder"
                  className="p-1 text-[#71717a] hover:text-amber-400 hover:bg-white/[0.04] rounded transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>

                {/* Upload File trigger */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".tex"
                  className="hidden"
                  disabled={uploadStatus === "uploading"}
                  onChange={handleFileChange}
                />
                <button
                  title={uploadStatus === "uploading" ? "Uploading..." : "Upload .tex file"}
                  onClick={handleUploadClick}
                  disabled={uploadStatus === "uploading"}
                  className="p-1 text-[#71717a] hover:text-white hover:bg-white/[0.04] rounded transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploadStatus === "uploading" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            }
          >
            {/* Upload status indicator banner */}
            {uploadStatus === "uploading" && (
              <div className="mx-1 my-1 px-2.5 py-1.5 rounded-md bg-amber-400/10 border border-amber-400/20 flex items-center gap-2 text-[11px] text-amber-300">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                <span className="truncate">{uploadMessage || "Uploading..."}</span>
              </div>
            )}
            {uploadStatus === "success" && uploadMessage && (
              <div className="mx-1 my-1 px-2.5 py-1.5 rounded-md bg-emerald-400/10 border border-emerald-400/20 flex items-center gap-2 text-[11px] text-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">{uploadMessage}</span>
              </div>
            )}
            {(uploadStatus === "error" || clientError) && (
              <div className="mx-1 my-1 px-2.5 py-1.5 rounded-md bg-rose-400/10 border border-rose-400/20 flex items-center gap-2 text-[11px] text-rose-300">
                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="truncate">{clientError || uploadMessage || "Upload failed"}</span>
              </div>
            )}

            {/* Real Project File Tree */}
            <ProjectFileTree
              files={files}
              folders={folders}
              activeFileId={activeFileId}
              expandedFolderIds={expandedFolderIds}
              onToggleFolder={toggleFolder}
              onSelectFile={handleSelectFile}
              onAddFileToFolder={(folderId) => {
                setSelectedFolderForFile(folderId);
                setNewFileName("");
                setModalError(null);
                setIsFileModalOpen(true);
              }}
              onRenameFile={(file) => {
                setRenamingItem({ type: "file", id: file.id, currentName: file.name });
                setRenameInput(file.name);
                setModalError(null);
              }}
              onDeleteFile={(file) => {
                setDeletingItem({ type: "file", id: file.id, name: file.name });
                setModalError(null);
              }}
              onSetEntryFile={(file) => {
                void setEntryFile(file.id).catch((err) => {
                  setClientError(err instanceof Error ? err.message : "Failed to set entry file");
                });
              }}
              entryFileId={entryFileId}
              onRenameFolder={(folder) => {
                setRenamingItem({ type: "folder", id: folder.id, currentName: folder.name });
                setRenameInput(folder.name);
                setModalError(null);
              }}
              onDeleteFolder={(folder) => {
                setDeletingItem({ type: "folder", id: folder.id, name: folder.name });
                setModalError(null);
              }}
              onNewFileClick={() => {
                setSelectedFolderForFile(null);
                setNewFileName("");
                setModalError(null);
                setIsFileModalOpen(true);
              }}
            />
          </SidebarSection>
        </div>

        {/* Fixed Bottom Section: System Status + Settings */}
        <div className="p-3 pt-2 bg-[#111215] border-t border-white/[0.04] space-y-2 shrink-0">
          <CompilerStatus
            compileStatus={compileStatus}
            compileLog={compileLog}
            compilerInfo={compilerInfo}
            compileErrors={compileErrors}
          />
          <SidebarFooter
            isSettingsActive={isSettingsActive}
            onToggleCollapse={toggleSidebar}
          />
        </div>
      </aside>

      {/* ── Modal: New File ── */}
      {isFileModalOpen && (
        <ModalWrapper
          title="Create New File"
          onClose={() => setIsFileModalOpen(false)}
        >
          <form onSubmit={handleCreateFileSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                File Name
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. experience.tex"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0B0E] border border-white/[0.08] text-white text-xs outline-none focus:border-amber-400/50"
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Must end with .tex
              </span>
            </div>

            {folders.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Folder (optional)
                </label>
                <select
                  value={selectedFolderForFile ?? ""}
                  onChange={(e) => setSelectedFolderForFile(e.target.value || null)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0B0E] border border-white/[0.08] text-white text-xs outline-none focus:border-amber-400/50"
                >
                  <option value="">Root directory</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modalError && (
              <p className="text-rose-400 text-[11px]">{modalError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsFileModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 hover:bg-amber-400/30 transition-colors font-medium"
              >
                Create File
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ── Modal: New Folder ── */}
      {isFolderModalOpen && (
        <ModalWrapper
          title="Create New Folder"
          onClose={() => setIsFolderModalOpen(false)}
        >
          <form onSubmit={handleCreateFolderSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                Folder Name
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. sections"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0B0E] border border-white/[0.08] text-white text-xs outline-none focus:border-amber-400/50"
              />
            </div>

            {modalError && (
              <p className="text-rose-400 text-[11px]">{modalError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 hover:bg-amber-400/30 transition-colors font-medium"
              >
                Create Folder
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ── Modal: Rename ── */}
      {renamingItem && (
        <ModalWrapper
          title={`Rename ${renamingItem.type === "file" ? "File" : "Folder"}`}
          onClose={() => {
            setRenamingItem(null);
            setModalError(null);
          }}
        >
          <form onSubmit={handleRenameSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                New Name
              </label>
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0B0E] border border-white/[0.08] text-white text-xs outline-none focus:border-amber-400/50"
              />
            </div>

            {modalError && (
              <p className="text-rose-400 text-[11px]">{modalError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setRenamingItem(null);
                  setModalError(null);
                }}
                className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 hover:bg-amber-400/30 transition-colors font-medium"
              >
                Rename
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ── Modal: Delete Confirmation ── */}
      {deletingItem && (
        <ModalWrapper
          title={`Delete ${deletingItem.type === "file" ? "File" : "Folder"}`}
          onClose={() => {
            setDeletingItem(null);
            setModalError(null);
          }}
        >
          <div className="space-y-3">
            <p className="text-xs text-neutral-300">
              Are you sure you want to delete{" "}
              <strong className="text-white font-mono">{deletingItem.name}</strong>?
              This action cannot be undone.
            </p>

            {modalError && (
              <p className="text-rose-400 text-[11px] bg-rose-500/10 p-2 rounded border border-rose-500/20">
                {modalError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDeletingItem(null);
                  setModalError(null);
                }}
                className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </>
  );
}

// Default export and alias for backward compatibility
export default ResumeSidebar;
export { ResumeSidebar as AppSidebar };
