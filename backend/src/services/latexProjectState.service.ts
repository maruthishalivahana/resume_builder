import { Types } from "mongoose";
import { LatexProject } from "../models/LatexProject";

export async function bumpProjectSourceVersion(
  projectId: Types.ObjectId | string
): Promise<void> {
  await LatexProject.findByIdAndUpdate(projectId, { $inc: { sourceVersion: 1 } });
}
