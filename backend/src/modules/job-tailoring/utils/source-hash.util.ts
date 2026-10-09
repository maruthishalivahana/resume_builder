import { createHash } from "crypto";

export function hashSourceText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
