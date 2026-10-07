const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

// Handle version flag
if (args.includes("--version") || args.includes("-version")) {
  console.log("pdfTeX 3.141592653-2.6-1.40.25 (TeX Live 2026/W32TeX)");
  process.exit(0);
}

// Find target file
const targetFile = args.find((a) => !a.startsWith("-")) || "main.tex";
const cwd = process.cwd();
const targetPath = path.join(cwd, targetFile);

if (!fs.existsSync(targetPath)) {
  console.error(`! I can't find file \`${targetFile}'.`);
  process.exit(1);
}

const content = fs.readFileSync(targetPath, "utf-8");

// Syntax error simulation
if (content.includes("\\textbf{Hello") && !content.includes("\\textbf{Hello}")) {
  console.log(`.${path.sep}${targetFile}:15: Missing } inserted.`);
  console.log("! LaTeX Error: Something went wrong.");
  console.log("l.15 \\textbf{Hello");
  process.exit(1);
}

// Check \input files
const inputMatch = /\\input\{([^}]+)\}/.exec(content);
if (inputMatch) {
  let subPath = inputMatch[1];
  if (!subPath.endsWith(".tex")) subPath += ".tex";
  const subFullPath = path.join(cwd, subPath);
  if (!fs.existsSync(subFullPath)) {
    console.error(`! LaTeX Error: File \`${subPath}' not found.`);
    process.exit(1);
  }
  const subContent = fs.readFileSync(subFullPath, "utf-8");
  if (subContent.includes("\\errorhere")) {
    console.log(`.${path.sep}${subPath}:27: Undefined control sequence.`);
    console.log("! LaTeX Error: Undefined control sequence.");
    console.log("l.27 \\errorhere");
    process.exit(1);
  }
}

// Minimal valid PDF binary
const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 24 Tf 100 700 Td (Hello RESUME.ENG) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000338 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
417
%%EOF
`;

const baseName = path.basename(targetFile, ".tex");
const pdfOut = path.join(cwd, `${baseName}.pdf`);
fs.writeFileSync(pdfOut, minimalPdf, "utf-8");

console.log(`Output written on ${baseName}.pdf (1 page, 512 bytes).`);
console.log(`Transcript written on ${baseName}.log.`);
process.exit(0);
