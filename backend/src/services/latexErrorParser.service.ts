import { ICompileError } from "../models/LatexCompilation";

/**
 * Service to parse pdflatex stdout/stderr logs generated with `-file-line-error`.
 */
export class LatexErrorParserService {
  /**
   * Parses LaTeX output into structured error objects.
   */
  public static parse(log: string): ICompileError[] {
    const errors: ICompileError[] = [];
    if (!log || typeof log !== "string") {
      return errors;
    }

    const lines = log.split(/\r?\n/);
    // Regex matching -file-line-error format:
    // e.g. "./sections/experience.tex:27: Undefined control sequence."
    // e.g. "main.tex:15: Missing } inserted."
    // e.g. "C:\path\file.tex:10: error message"
    const fileLineErrorRegex = /^(?:(?:\.\/|\.\\)?([a-zA-Z0-9_\-\.\/\\ ]+\.tex)):(\d+):\s*(.*)$/i;

    const seenKeys = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const match = fileLineErrorRegex.exec(line);
      if (match) {
        let rawFile = match[1].replace(/^[.\\/]+/, "").replace(/\\/g, "/");
        const lineNum = parseInt(match[2], 10);
        let message = match[3].trim();

        // If message is "! LaTeX Error: ...", clean it up
        if (message.startsWith("!")) {
          message = message.replace(/^!\s*/, "");
        }

        const key = `${rawFile}:${lineNum}:${message}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          errors.push({
            severity: "error",
            file: rawFile,
            line: isNaN(lineNum) ? null : lineNum,
            message: message || "LaTeX compilation error",
          });
        }
        continue;
      }

      // Check for standalone LaTeX errors (e.g. "! LaTeX Error: ...", "! Emergency stop.")
      if (line.startsWith("!") && !line.includes("Emergency stop")) {
        const message = line.replace(/^!\s*/, "").trim();
        // Check if next lines provide a line hint like "l.15 ..."
        let hintedLine: number | null = null;
        for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
          const nextLine = lines[j].trim();
          const lineHintMatch = /^l\.(\d+)\s*(.*)/.exec(nextLine);
          if (lineHintMatch) {
            hintedLine = parseInt(lineHintMatch[1], 10);
            break;
          }
        }

        const key = `null:${hintedLine}:${message}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          errors.push({
            severity: "error",
            file: null,
            line: hintedLine,
            message: message,
          });
        }
      }
    }

    return errors;
  }
}
