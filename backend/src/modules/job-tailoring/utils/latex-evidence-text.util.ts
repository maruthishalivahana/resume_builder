// Mask known non-content arguments for evidence extraction only. Newlines and
// UTF-16 offsets stay intact; callers must retain the original source for edits.
// Unknown macros keep their existing handling. This is not a TeX interpreter.
const NON_CONTENT = new Set([
  "label", "ref", "pageref", "eqref", "autoref", "nameref", "vref", "cref", "Cref",
  "cite", "citep", "citet", "citeauthor", "citeyear", "nocite", "bibentry",
  "bibliography", "bibliographystyle", "includegraphics", "url",
]);

export function maskLatexEvidenceMetadata(source: string): { text: string; warnings: string[] } {
  const output = source.split("");
  const warnings: string[] = [];
  const mask = (start: number, end: number): void => {
    for (let index = start; index < end; index++) if (!/[\r\n]/.test(source[index])) output[index] = " ";
  };
  const skipComment = (index: number): number => {
    while (index < source.length && !/[\r\n]/.test(source[index])) index++;
    return index;
  };
  const skipSpace = (index: number): number => {
    while (index < source.length) {
      if (/\s/.test(source[index])) index++;
      else if (source[index] === "%") index = skipComment(index);
      else break;
    }
    return index;
  };
  const groupEnd = (start: number, open: string, close: string): number => {
    let depth = 1;
    for (let index = start + 1; index < source.length; index++) {
      if (source[index] === "\\") { index++; continue; }
      if (source[index] === "%") { index = skipComment(index) - 1; continue; }
      if (source[index] === open) depth++;
      if (source[index] === close) { depth--; if (depth === 0) return index + 1; }
    }
    return -1;
  };
  for (let index = 0; index < source.length;) {
    if (source[index] === "%") { index = skipComment(index); continue; }
    if (source[index] !== "\\") { index++; continue; }
    const command = source.slice(index).match(/^\\([a-zA-Z]+)(\*)?/);
    if (!command) { index += 2; continue; } // Escaped symbols, including \\.
    const start = index;
    index += command[0].length;
    if (!NON_CONTENT.has(command[1]) && command[1] !== "href" && command[1] !== "hyperlink") continue;
    let cursor = skipSpace(index);
    while (source[cursor] === "[") {
      const end = groupEnd(cursor, "[", "]");
      if (end < 0) { mask(start, source.length); warnings.push("Unclosed non-content LaTeX option; remaining text excluded from evidence."); return { text: output.join(""), warnings }; }
      cursor = skipSpace(end);
    }
    if (source[cursor] !== "{") {
      // TeX permits unbraced token arguments. Do not turn an unsupported form
      // into positive evidence; exclude the remainder of that source line.
      const end = skipComment(cursor);
      mask(start, end); index = end;
      warnings.push("Unbraced non-content LaTeX argument excluded from evidence.");
      continue;
    }
    const end = groupEnd(cursor, "{", "}");
    if (end < 0) { mask(start, source.length); warnings.push("Unclosed non-content LaTeX argument; remaining text excluded from evidence."); return { text: output.join(""), warnings }; }
    mask(start, end);
    index = end; // For links, the following display-text argument stays visible.
  }
  return { text: output.join(""), warnings };
}
