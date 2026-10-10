import { LatexFile } from "../../../models/LatexFile";
import { LatexProject } from "../../../models/LatexProject";
import { AppError } from "../../../middleware/error.middleware";
import ResumeEvidence from "../models/ResumeEvidence";
import { ResumeEvidenceData } from "../types";
import {
  ResumeEvidenceParserService,
  ParsedEvidenceResult,
  SourceLatexFile,
} from "./resume-evidence-parser.service";

export interface IndexResumeInput {
  projectId: string;
  versionId: string;
}

export interface ResumeIndexStats {
  projectId: string;
  versionId: string;
  filesProcessed: number;
  filesIndexed: number;
  sectionsDetected: number;
  evidenceCount: number;
  evidenceCreated: number;
  evidenceUpdated: number;
  evidenceSkipped: number;
  parseWarnings: string[];
  durationMs: number;
}

export class ResumeIntelligenceService {
  private readonly parser = new ResumeEvidenceParserService();

  async buildEvidence(projectId: string, versionId: string): Promise<ResumeEvidenceData[]> {
    const parsed = await this.parseProject(projectId, versionId);
    return parsed.evidence;
  }

  async indexResume(input: IndexResumeInput): Promise<ResumeIndexStats> {
    const startedAt = Date.now();
    const parsed = await this.parseProject(input.projectId, input.versionId);
    const existing = await ResumeEvidence.find({
      projectId: input.projectId,
      versionId: input.versionId,
    })
      .select({ evidenceId: 1 })
      .lean();
    const existingIds = new Set(existing.map((item) => item.evidenceId));

    for (const item of parsed.evidence) {
      await ResumeEvidence.updateOne(
        { projectId: input.projectId, versionId: input.versionId, evidenceId: item.id },
        {
          $set: {
            ...item,
            evidenceId: item.id,
            projectId: input.projectId,
            resumeId: input.projectId,
          },
        },
        { upsert: true }
      );
    }

    const currentIds = parsed.evidence.map((item) => item.id);
    await ResumeEvidence.deleteMany({
      projectId: input.projectId,
      versionId: input.versionId,
      ...(currentIds.length > 0 ? { evidenceId: { $nin: currentIds } } : {}),
    });

    const created = parsed.evidence.filter((item) => !existingIds.has(item.id)).length;
    return {
      projectId: input.projectId,
      versionId: input.versionId,
      filesProcessed: parsed.filesProcessed,
      filesIndexed: parsed.filesProcessed,
      sectionsDetected: parsed.sections.size,
      evidenceCount: parsed.evidence.length,
      evidenceCreated: created,
      evidenceUpdated: parsed.evidence.length - created,
      evidenceSkipped: 0,
      parseWarnings: parsed.warnings,
      durationMs: Date.now() - startedAt,
    };
  }

  private async parseProject(projectId: string, versionId: string): Promise<ParsedEvidenceResult & { filesProcessed: number }> {
    const project = await LatexProject.findById(projectId).select({ _id: 1 }).lean();
    if (!project) throw new AppError("Resume project not found", 404, "PROJECT_NOT_FOUND");

    const files = await LatexFile.find({
      projectId,
      $or: [{ language: "latex" }, { name: /\.tex$/i }],
    })
      .sort({ path: 1, name: 1 })
      .lean();
    const sourceFiles: SourceLatexFile[] = files.map((file) => ({
      id: file._id.toString(),
      name: file.name,
      content: file.content,
    }));
    return {
      ...this.parser.parseFiles(projectId, versionId, sourceFiles),
      filesProcessed: sourceFiles.length,
    };
  }
}
