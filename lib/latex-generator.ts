import { Resume } from "@/types/resume";

function escapeLatex(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export function generateLatexFromResume(resume: Resume): string {
  const p = resume.personal;

  const header = `%-------------------------
% Auto-generated LaTeX Document
% Resume Engineering Platform
% Target: ${escapeLatex(resume.targetRole || "Software Engineer")}
% Updated: ${resume.updatedAt}
%-------------------------

\\documentclass[letterpaper,10.8pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}

\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Margin configurations
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1.0in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Section title formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\begin{document}

%----------HEADING----------
\\begin{center}
    \\textbf{\\Huge \\scshape ${escapeLatex(p.fullName)}} \\\\ \\vspace{2pt}
    \\small ${escapeLatex(p.phone)} $|$ \\href{mailto:${escapeLatex(p.email)}}{\\underline{${escapeLatex(p.email)}}} $|$ 
    ${p.location ? `${escapeLatex(p.location)} $|$ ` : ""}${p.linkedinUrl ? `\\href{${escapeLatex(p.linkedinUrl)}}{\\underline{LinkedIn}} $|$ ` : ""}${p.githubUrl ? `\\href{${escapeLatex(p.githubUrl)}}{\\underline{GitHub}}` : ""}
\\end{center}
`;

  let body = "";

  // Sort sections by order
  const sortedSections = [...resume.sections].sort((a, b) => a.order - b.order);

  for (const sec of sortedSections) {
    if (!sec.visible) continue;

    if (sec.type === "experience" && resume.experience.length > 0) {
      body += `\n%-----------EXPERIENCE-----------\n\\section{Experience}\n`;
      for (const exp of resume.experience) {
        body += `  \\textbf{${escapeLatex(exp.company)}} $|$ \\emph{${escapeLatex(exp.role)}} \\hfill ${escapeLatex(exp.startDate)} -- ${exp.isCurrent ? "Present" : escapeLatex(exp.endDate)} \\\\\n`;
        body += `  \\emph{${escapeLatex(exp.location)}}\n`;
        body += `  \\begin{itemize}[leftmargin=0.15in, label={$\\bullet$}]\n`;
        for (const bullet of exp.bullets) {
          body += `    \\item ${escapeLatex(bullet.text)}\n`;
        }
        body += `  \\end{itemize}\n  \\vspace{3pt}\n`;
      }
    } else if (sec.type === "projects" && resume.projects.length > 0) {
      body += `\n%-----------PROJECTS-----------\n\\section{Technical Projects}\n`;
      for (const proj of resume.projects) {
        const stack = proj.techStack.join(", ");
        body += `  \\textbf{${escapeLatex(proj.title)}}${stack ? ` $|$ \\emph{${escapeLatex(stack)}}` : ""} \\\\\n`;
        body += `  \\begin{itemize}[leftmargin=0.15in, label={$\\bullet$}]\n`;
        for (const bullet of proj.bullets) {
          body += `    \\item ${escapeLatex(bullet.text)}\n`;
        }
        body += `  \\end{itemize}\n  \\vspace{3pt}\n`;
      }
    } else if (sec.type === "skills" && resume.skills.length > 0) {
      body += `\n%-----------SKILLS-----------\n\\section{Technical Skills}\n`;
      body += ` \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n`;
      for (const cat of resume.skills) {
        body += `     \\textbf{${escapeLatex(cat.categoryName)}}: ${escapeLatex(cat.skills.join(", "))} \\\\\n`;
      }
      body += `    }}\n \\end{itemize}\n`;
    } else if (sec.type === "education" && resume.education.length > 0) {
      body += `\n%-----------EDUCATION-----------\n\\section{Education}\n`;
      for (const edu of resume.education) {
        body += `  \\textbf{${escapeLatex(edu.institution)}} \\hfill ${escapeLatex(edu.location)} \\\\\n`;
        body += `  \\emph{${escapeLatex(edu.degree)} in ${escapeLatex(edu.fieldOfStudy)}} \\hfill ${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)} \\\\\n`;
        if (edu.gpa) {
          body += `  \\small{GPA: ${escapeLatex(edu.gpa)}${edu.honors && edu.honors.length > 0 ? ` $\\cdot$ ${escapeLatex(edu.honors.join(" $\\cdot$ "))}` : ""}}\n`;
        }
        body += `  \\vspace{2pt}\n`;
      }
    } else if (sec.type === "certifications" && resume.certifications.length > 0) {
      body += `\n%-----------CERTIFICATIONS-----------\n\\section{Certifications}\n`;
      body += ` \\begin{itemize}[leftmargin=0.15in, label={$\\bullet$}]\n`;
      for (const cert of resume.certifications) {
        body += `    \\item \\textbf{${escapeLatex(cert.title)}} -- ${escapeLatex(cert.issuer)} \\hfill ${escapeLatex(cert.date)}\n`;
      }
      body += ` \\end{itemize}\n`;
    }
  }

  const footer = `\n\\end{document}\n`;

  return header + body + footer;
}
