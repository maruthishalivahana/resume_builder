import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawn, execFile, execSync } from "child_process";
import { LatexProject } from "../models/LatexProject";
import {
  LatexCompilation,
  ILatexCompilation,
  ICompileError, SourceCapture,
} from "../models/LatexCompilation";
import { LatexErrorParserService } from "./latexErrorParser.service";
import { AppError } from "../middleware/error.middleware";
import { captureProjectSource } from "./latexSourceCapture.service";

export interface CompileOptions {
  projectId: string;
  entryFileId?: string;
}

export interface CompileResult {
  compilationId: string;
  projectId: string;
  status: "success" | "failed" | "timeout";
  entryFileId: string;
  entryFilePath: string;
  sourceCapture: SourceCapture;
  durationMs: number;
  pdf?: {
    fileName: string;
    url: string;
  };
  errors: ICompileError[];
  logs: {
    stdout: string;
    stderr: string;
  };
  error?: {
    code: string;
    message: string;
  };
  pdfState?: "none" | "valid" | "stale" | "failed-with-previous";
}

export class LatexCompilerService {
  private static activeCompilations = new Set<string>();

  /**
   * Retrieves configured compiler binary name or path.
   */
  public static getCompilerExecutable(): string {
    return process.env.LATEX_COMPILER || "pdflatex";
  }

  /**
   * Resolves compiler executable and any prefix arguments (for .js runner scripts).
   */
  public static getCompilerCommand(): { command: string; prefixArgs: string[] } {
    const compiler = this.getCompilerExecutable();
    if (compiler.endsWith(".js")) {
      const scriptPath = path.isAbsolute(compiler)
        ? compiler
        : path.resolve(process.cwd(), compiler);
      return {
        command: process.execPath,
        prefixArgs: [scriptPath],
      };
    }
    return {
      command: compiler,
      prefixArgs: [],
    };
  }

  /**
   * Builds an enhanced environment with user & system TeX paths loaded on Windows dynamically.
   */
  public static getEnhancedEnvironment(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    if (process.platform === "win32") {
      const pathsToAdd: string[] = [];

      // 1. Query HKCU\Environment Path from Windows registry (where MiKTeX user installer registers)
      try {
        const regOut = execSync('reg query "HKCU\\Environment" /v Path', {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        const match = regOut.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/i);
        if (match && match[1]) {
          const userPaths = match[1].split(";").map((p) => p.trim()).filter(Boolean);
          pathsToAdd.push(...userPaths);
        }
      } catch {
        // Registry query fallback
      }

      // 2. Check standard Windows LaTeX distribution directories dynamically via env vars
      const standardCandidates = [
        process.env.LOCALAPPDATA &&
          path.join(process.env.LOCALAPPDATA, "Programs", "MiKTeX", "miktex", "bin", "x64"),
        process.env.LOCALAPPDATA &&
          path.join(process.env.LOCALAPPDATA, "Programs", "MiKTeX", "miktex", "bin"),
        process.env.ProgramFiles &&
          path.join(process.env.ProgramFiles, "MiKTeX", "miktex", "bin", "x64"),
        process.env.ProgramFiles &&
          path.join(process.env.ProgramFiles, "MiKTeX", "miktex", "bin"),
        process.env["ProgramFiles(x86)"] &&
          path.join(process.env["ProgramFiles(x86)"], "MiKTeX", "miktex", "bin"),
        "C:\\texlive\\2026\\bin\\windows",
        "C:\\texlive\\2025\\bin\\windows",
        "C:\\texlive\\2024\\bin\\windows",
        "C:\\texlive\\2023\\bin\\windows",
      ].filter(Boolean) as string[];

      pathsToAdd.push(...standardCandidates);

      const currentPaths = (env.PATH || env.Path || "").split(";");
      const uniqueNewPaths = pathsToAdd.filter(
        (p) => fs.existsSync(p) && !currentPaths.includes(p)
      );

      if (uniqueNewPaths.length > 0) {
        const newPathStr = [...uniqueNewPaths, ...currentPaths].join(";");
        env.PATH = newPathStr;
        env.Path = newPathStr;
      }
    }
    return env;
  }

  /**
   * Retrieves compilation timeout in milliseconds.
   */
  public static getTimeoutMs(): number {
    const envTimeout = process.env.LATEX_COMPILE_TIMEOUT_MS;
    return envTimeout ? parseInt(envTimeout, 10) : 30000;
  }

  /**
   * Retrieves base storage directory for generated PDF artifacts.
   */
  public static getStorageDir(): string {
    return (
      process.env.LATEX_OUTPUT_DIR ||
      path.join(process.cwd(), "storage", "latex")
    );
  }

  /**
   * Checks whether the configured LaTeX compiler executable is installed and available.
   */
  public static async checkCompilerAvailability(): Promise<{
    available: boolean;
    compiler: string;
    version?: string;
    error?: string;
  }> {
    const compiler = this.getCompilerExecutable();
    const { command, prefixArgs } = this.getCompilerCommand();
    const env = this.getEnhancedEnvironment();

    return new Promise((resolve) => {
      execFile(
        command,
        [...prefixArgs, "--version"],
        { env, timeout: 5000 },
        (err, stdout) => {
          if (err) {
            // Retry with -version (for MiKTeX or older pdflatex)
            execFile(
              command,
              [...prefixArgs, "-version"],
              { env, timeout: 5000 },
              (err2, stdout2) => {
                if (err2) {
                  resolve({
                    available: false,
                    compiler,
                    error: `${compiler} is not installed in the current environment.`,
                  });
                } else {
                  const firstLine = stdout2.split(/\r?\n/)[0] || "";
                  resolve({
                    available: true,
                    compiler,
                    version: firstLine.trim(),
                  });
                }
              }
            );
          } else {
            const firstLine = stdout.split(/\r?\n/)[0] || "";
            resolve({
              available: true,
              compiler,
              version: firstLine.trim(),
            });
          }
        }
      );
    });
  }

  /**
   * Reconstructs project files from MongoDB and compiles them using pdflatex.
   */
  public static async compileLatexProject(
    options: CompileOptions
  ): Promise<CompileResult> {
    const { projectId } = options;
    const startTime = Date.now();

    // 1. Concurrent compile protection
    if (this.activeCompilations.has(projectId)) {
      throw new AppError(
        "Compilation already in progress for this project.",
        409
      );
    }

    this.activeCompilations.add(projectId);

    // 2–3. Capture one stable saved project state before workspace assembly.
    let capture: Awaited<ReturnType<typeof captureProjectSource>>;
    try { capture = await captureProjectSource(projectId, options.entryFileId); }
    catch (error) { this.activeCompilations.delete(projectId); throw error; }
    const { project, files, folders, entry: entryFile, sourceCapture } = capture;
    const entryFilePath = entryFile.path;
    const sourceVersion = sourceCapture.sourceVersion;
    const compiledEntryFileUpdatedAt = entryFile.updatedAt;

    // 4. Check compiler availability
    let compilerCheck: Awaited<ReturnType<typeof LatexCompilerService.checkCompilerAvailability>>;
    try { compilerCheck = await this.checkCompilerAvailability(); }
    catch (error) { this.activeCompilations.delete(projectId); throw error; }
    if (!compilerCheck.available) {
      this.activeCompilations.delete(projectId);
      const msg = `${compilerCheck.compiler} is not installed in the current environment.`;
      const durationMs = Date.now() - startTime;

      // Save failed record in MongoDB
      const compilation = await LatexCompilation.create({
        projectId: project._id,
        status: "failed",
        mainFile: entryFilePath,
        compiledEntryFileId: entryFile._id,
        compiledEntryFileUpdatedAt,
        sourceVersion,
        sourceCapture,
        stdout: "",
        stderr: msg,
        compileErrors: [
          {
            severity: "error",
            file: null,
            line: null,
            message: msg,
          },
        ],
        durationMs,
      });

      return {
        compilationId: compilation._id.toString(),
        projectId,
        entryFileId: entryFile._id.toString(),
        entryFilePath,
        sourceCapture,
        status: "failed",
        durationMs,
        errors: compilation.compileErrors,
        logs: { stdout: "", stderr: msg },
        error: {
          code: "COMPILER_UNAVAILABLE",
          message: msg,
        },
        pdfState: "none",
      };
    }

    // 5. Create temporary compilation directory
    const compileId = crypto.randomUUID();
    const tempDir = path.join(os.tmpdir(), "resume-eng", compileId);

    try {
      await fs.promises.mkdir(tempDir, { recursive: true });

      const filesReconstructed: string[] = [];
      const foldersReconstructed: string[] = [];

      // Create folder directories
      for (const folder of folders) {
        const folderDir = path.join(tempDir, folder.path);
        await fs.promises.mkdir(folderDir, { recursive: true });
        foldersReconstructed.push(folder.path);
      }

      // Write files
      for (const file of files) {
        const targetFilePath = path.join(tempDir, file.path);
        const parentDir = path.dirname(targetFilePath);
        await fs.promises.mkdir(parentDir, { recursive: true });
        await fs.promises.writeFile(targetFilePath, file.content ?? "", "utf-8");
        filesReconstructed.push(file.path);
      }

      // 6. Spawn compiler process with safe non-interactive arguments
      const { command, prefixArgs } = this.getCompilerCommand();
      const timeoutMs = this.getTimeoutMs();
      const compilerArgs = [
        ...prefixArgs,
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        "-recorder",
        `-output-directory=${tempDir}`,
        entryFilePath,
      ];

      console.info("[LaTeX Compile Invocation]", {
        compilerExecutable: command,
        compilerArguments: compilerArgs,
        cwd: tempDir,
        entryFilename: entryFilePath,
        temporaryWorkspacePath: tempDir,
        filesReconstructed,
        foldersReconstructed,
      });

      const maxOutputBytes = 1024 * 512; // 512 KB log limit
      let stdout = "";
      let stderr = "";
      let isTimeout = false;
      let compilerPid: number | undefined = undefined;

      const runCompiler = (): Promise<{ exitCode: number | null }> => {
        return new Promise((resolve) => {
          let settled = false;
          const env = this.getEnhancedEnvironment();

          const child = spawn(command, compilerArgs, {
            cwd: tempDir,
            windowsHide: true,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
            env,
          });

          compilerPid = child.pid;

          const timer = setTimeout(() => {
            if (settled) return;
            isTimeout = true;
            console.warn("[LaTeX Compile Timeout]", {
              compilerPid,
              command,
              compilerArgs,
              cwd: tempDir,
              stdoutSoFar: stdout.slice(0, 500),
              stderrSoFar: stderr.slice(0, 500),
            });

            if (child.pid) {
              if (process.platform === "win32") {
                try {
                  execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
                } catch {
                  child.kill("SIGKILL");
                }
              } else {
                child.kill("SIGKILL");
              }
            }

            settled = true;
            resolve({ exitCode: -1 });
          }, timeoutMs);

          child.stdout?.on("data", (chunk: Buffer) => {
            if (stdout.length < maxOutputBytes) {
              stdout += chunk.toString("utf-8");
            }
          });

          child.stderr?.on("data", (chunk: Buffer) => {
            if (stderr.length < maxOutputBytes) {
              stderr += chunk.toString("utf-8");
            }
          });

          child.on("close", (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ exitCode: code });
          });

          child.on("error", (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            stderr += `\nProcess error: ${err.message}`;
            resolve({ exitCode: -1 });
          });
        });
      };

      const { exitCode } = await runCompiler();
      const durationMs = Date.now() - startTime;
      console.info("[LaTeX Compile Finished] exitCode=%s durationMs=%d", exitCode, durationMs);

      // 7. Parse compilation errors
      const combinedLogs = stdout + "\n" + stderr;
      const parsedErrors = LatexErrorParserService.parse(combinedLogs);

      // Check if generated PDF exists
      const mainBaseName = path.basename(entryFilePath, path.extname(entryFilePath));
      const possiblePdfPaths = [
        path.join(tempDir, `${mainBaseName}.pdf`),
        path.join(tempDir, path.dirname(entryFilePath), `${mainBaseName}.pdf`),
      ];
      let generatedPdfPath: string | null = null;
      for (const p of possiblePdfPaths) {
        if (fs.existsSync(p) && fs.statSync(p).size > 0) {
          generatedPdfPath = p;
          break;
        }
      }
      const pdfExists = !!generatedPdfPath;

      let status: "success" | "failed" | "timeout" = "failed";
      let savedPdfRelativePath: string | undefined = undefined;

      if (isTimeout) {
        status = "timeout";
        parsedErrors.unshift({
          severity: "error",
          file: entryFilePath,
          line: null,
          message: `Compilation timed out after ${timeoutMs / 1000} seconds.`,
        });
      } else if (exitCode === 0 && pdfExists) {
        status = "success";
      } else {
        status = "failed";
      }

      // If PDF generated, persist it to application storage
      const pdfFileName = `${mainBaseName}.pdf`;
      if (status === "success" && generatedPdfPath) {
        const storageDir = path.join(
          this.getStorageDir(),
          projectId,
          compileId
        );
        await fs.promises.mkdir(storageDir, { recursive: true });
        const finalPdfPath = path.join(storageDir, pdfFileName);
        await fs.promises.copyFile(generatedPdfPath, finalPdfPath);
        savedPdfRelativePath = path.relative(process.cwd(), finalPdfPath);
      }

      // 8. Save compilation document in MongoDB
      const compilation = await LatexCompilation.create({
        projectId: project._id,
        status,
        mainFile: entryFilePath,
        compiledEntryFileId: entryFile._id,
        compiledEntryFileUpdatedAt,
        sourceVersion,
        sourceCapture,
        pdfPath: savedPdfRelativePath || null,
        pdfFileName,
        stdout: stdout.slice(0, maxOutputBytes),
        stderr: stderr.slice(0, maxOutputBytes),
        compileErrors: parsedErrors,
        durationMs,
      });

      return {
        compilationId: compilation._id.toString(),
        projectId,
        entryFileId: entryFile._id.toString(),
        entryFilePath,
        sourceCapture,
        status,
        durationMs,
        pdf: status === "success" && pdfExists
          ? {
              fileName: pdfFileName,
              url: `/api/latex/projects/${projectId}/pdf?compilationId=${compilation._id.toString()}`,
            }
          : undefined,
        errors: parsedErrors,
        logs: {
          stdout,
          stderr,
        },
        pdfState: status === "success" ? "valid" : undefined,
      };
    } finally {
      // 9. Always clean up temporary workspace
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("Failed to clean up temporary compilation directory:", cleanupErr);
      }

      this.activeCompilations.delete(projectId);
    }
  }

  /**
   * Retrieves the latest successfully generated PDF file for a project.
   */
  public static async getLatestSuccessfulPdf(
    projectId: string,
    compilationId?: string
  ): Promise<{ absolutePath: string; fileName: string } | null> {
    const latestSuccess = await LatexCompilation.findOne({
      projectId,
      status: "success",
      pdfPath: { $ne: null },
      ...(compilationId ? { _id: compilationId } : {}),
    }).sort({ createdAt: -1 });

    if (!latestSuccess || !latestSuccess.pdfPath) {
      return null;
    }

    const absolutePath = path.resolve(process.cwd(), latestSuccess.pdfPath);
    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    return {
      absolutePath,
      fileName: latestSuccess.pdfFileName || `${path.basename(latestSuccess.mainFile, ".tex")}.pdf`,
    };
  }

  /**
   * Retrieves the latest compilation metadata for a project.
   */
  public static async getLatestCompilation(
    projectId: string
  ): Promise<ILatexCompilation | null> {
    return LatexCompilation.findOne({ projectId }).sort({ createdAt: -1 });
  }

  public static async getProjectCompilationState(projectId: string, entryFileId?: string): Promise<{
    state: "none" | "valid" | "stale" | "failed-with-previous";
    latest: ILatexCompilation | null;
    successful: ILatexCompilation | null;
    pdf: { fileName: string; url: string } | null;
  }> {
    const targetFilter = entryFileId ? { compiledEntryFileId: entryFileId } : {};
    const [project, latest, successful] = await Promise.all([
      LatexProject.findById(projectId),
      LatexCompilation.findOne({ projectId, ...targetFilter }).sort({ createdAt: -1 }),
      LatexCompilation.findOne({
        projectId,
        ...targetFilter,
        status: "success",
        pdfPath: { $ne: null },
      }).sort({ createdAt: -1 }),
    ]);

    if (!project || !successful || !successful.pdfPath) {
      return {
        state: latest?.status === "failed" || latest?.status === "timeout" ? "none" : "none",
        latest,
        successful: null,
        pdf: null,
      };
    }

    const artifactPath = path.resolve(process.cwd(), successful.pdfPath);
    if (!fs.existsSync(artifactPath)) {
      return { state: "none", latest, successful, pdf: null };
    }

    const targetId = entryFileId?.toLowerCase() ?? project.entryFileId?.toString();
    const successfulEntryMatches = !!targetId && successful.compiledEntryFileId?.toString() === targetId;
    const successfulSourceMatches =
      successful.sourceVersion === (project.sourceVersion ?? 0);
    const failedCompilationIsCurrent =
      !!latest &&
      latest._id.toString() !== successful._id.toString() &&
      (latest.status === "failed" || latest.status === "timeout") &&
      !!targetId &&
      latest.compiledEntryFileId?.toString() === targetId &&
      latest.sourceVersion === (project.sourceVersion ?? 0);
    const state = failedCompilationIsCurrent
      ? "failed-with-previous"
      : successfulEntryMatches && successfulSourceMatches
      ? "valid"
      : "stale";

    return {
      state,
      latest,
      successful,
      pdf: {
        fileName: successful.pdfFileName || `${path.basename(successful.mainFile, ".tex")}.pdf`,
        url: `/api/latex/projects/${projectId}/pdf?compilationId=${successful._id.toString()}`,
      },
    };
  }
}
