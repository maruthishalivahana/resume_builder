import { Resume, AISuggestion, JobDescriptionMatch } from "@/types/resume";

export const initialMasterResume: Resume = {
  id: "resume_master",
  name: "Master Engineering Resume",
  targetRole: "Senior Systems & Backend Engineer",
  updatedAt: "2026-10-05T19:42:00Z",
  template: "modern-engineer",
  personal: {
    fullName: "Maruthi Kummaragunta",
    headline: "Senior Software Engineer · Distributed Systems & Cloud Platforms",
    email: "maruthi.dev@example.com",
    phone: "+1 (555) 382-9012",
    location: "San Francisco, CA (Open to Remote)",
    portfolioUrl: "https://maruthi.engineering",
    githubUrl: "https://github.com/maruthi-dev",
    linkedinUrl: "https://linkedin.com/in/maruthi-dev",
    summary:
      "Backend and distributed systems engineer with 5+ years of experience architecting high-throughput microservices, sub-second query pipelines, and developer platforms. Proven track record leading core infrastructure migrations serving 10M+ daily requests.",
  },
  sections: [
    { id: "sec_personal", type: "personal", title: "Personal Details", visible: true, order: 0 },
    { id: "sec_experience", type: "experience", title: "Professional Experience", visible: true, order: 1 },
    { id: "sec_projects", type: "projects", title: "Technical Projects", visible: true, order: 2 },
    { id: "sec_skills", type: "skills", title: "Technical Skills", visible: true, order: 3 },
    { id: "sec_education", type: "education", title: "Education", visible: true, order: 4 },
    { id: "sec_certifications", type: "certifications", title: "Certifications", visible: true, order: 5 },
  ],
  experience: [
    {
      id: "exp_001",
      role: "Senior Software Engineer",
      company: "Apex Distributed Labs",
      location: "San Francisco, CA",
      startDate: "2024-03",
      endDate: "Present",
      isCurrent: true,
      bullets: [
        {
          id: "bullet_001",
          text: "Architected distributed caching and event streaming layer using Apache Kafka and Redis cluster, reducing p99 API latency from 320ms to 42ms under 85,000 peak RPS.",
          highlightedKeywords: ["Apache Kafka", "Redis cluster", "distributed caching", "p99 API latency"],
        },
        {
          id: "bullet_002",
          text: "Engineered high-concurrency microservices in Go and Node.js with gRPC protocols, decoupling monolithic ingestion pipeline and achieving 99.99% system availability.",
          highlightedKeywords: ["Go", "Node.js", "gRPC", "microservices"],
        },
        {
          id: "bullet_003",
          text: "Spearheaded automated canary deployment pipelines across Kubernetes clusters on AWS EKS, dropping rollback durations from 28 minutes to under 90 seconds.",
          highlightedKeywords: ["Kubernetes", "AWS EKS", "canary deployment"],
        },
      ],
    },
    {
      id: "exp_002",
      role: "Backend Software Engineer",
      company: "Stratos Cloud Systems",
      location: "Austin, TX",
      startDate: "2022-01",
      endDate: "2024-02",
      isCurrent: false,
      bullets: [
        {
          id: "bullet_004",
          text: "Developed resilient RESTful and GraphQL backend APIs utilizing Node.js, TypeScript, and PostgreSQL for over 1.2M active enterprise dashboard users.",
          highlightedKeywords: ["Node.js", "TypeScript", "PostgreSQL", "GraphQL"],
        },
        {
          id: "bullet_005",
          text: "Refactored unindexed multi-tenant database queries and implemented connection pooling with PgBouncer, cutting average query execution times by 68%.",
          highlightedKeywords: ["PostgreSQL", "PgBouncer", "query execution"],
        },
        {
          id: "bullet_006",
          text: "Authored end-to-end integration test suites with Jest and k6 load testing rigs, increasing test coverage from 54% to 92% across critical payment workflows.",
          highlightedKeywords: ["Jest", "k6", "load testing"],
        },
      ],
    },
    {
      id: "exp_003",
      role: "Software Engineering Intern",
      company: "Nova Technologies",
      location: "San Jose, CA",
      startDate: "2021-05",
      endDate: "2021-12",
      isCurrent: false,
      bullets: [
        {
          id: "bullet_007",
          text: "Built real-time telemetry dashboard in React, Next.js, and Tailwind CSS, interfacing with internal Prometheus metrics to monitor 400+ background worker jobs.",
          highlightedKeywords: ["React", "Next.js", "Tailwind CSS", "Prometheus"],
        },
        {
          id: "bullet_008",
          text: "Automated daily infrastructure vulnerability scans using GitHub Actions and Trivy, alerting security teams on zero-day container CVEs.",
          highlightedKeywords: ["GitHub Actions", "Docker", "CI/CD"],
        },
      ],
    },
  ],
  projects: [
    {
      id: "proj_001",
      title: "Real-time Campus Transit & Bus Tracking Engine",
      subtitle: "Low-latency geospatial ingestion service",
      link: "https://transit.maruthi.engineering",
      githubUrl: "https://github.com/maruthi-dev/campus-transit-engine",
      techStack: ["Go", "WebSockets", "Redis Pub/Sub", "PostGIS", "Docker"],
      bullets: [
        {
          id: "bullet_proj_001",
          text: "Built fault-tolerant geospatial ingestion service processing GPS telemetry from 60+ transit vehicles at 1-second intervals with sub-50ms browser broadcast via WebSockets.",
        },
        {
          id: "bullet_proj_002",
          text: "Leveraged PostGIS spatial indexes and Kalman filtering algorithms to compute predictive arrival estimates, improving ETA accuracy by 34% over native GTFS feeds.",
        },
      ],
    },
    {
      id: "proj_002",
      title: "Career Roadmap & Skill Gap Vector Analyzer",
      subtitle: "Distributed vector search pipeline",
      link: "https://roadmap.ai",
      githubUrl: "https://github.com/maruthi-dev/career-roadmap-ai",
      techStack: ["Python", "FastAPI", "Qdrant", "Sentence-Transformers", "TypeScript"],
      bullets: [
        {
          id: "bullet_proj_003",
          text: "Constructed semantic career vector search engine indexing 500,000+ job descriptions and tech skill taxonomies using dense vector embeddings.",
        },
        {
          id: "bullet_proj_004",
          text: "Implemented custom cosine similarity ranking engine that generates prioritized, actionable skill transition graphs for engineers within 120ms.",
        },
      ],
    },
  ],
  skills: [
    {
      id: "skill_cat_001",
      categoryName: "Languages & Runtimes",
      skills: ["TypeScript", "JavaScript (ES6+)", "Go", "Python", "Node.js", "SQL", "LaTeX"],
    },
    {
      id: "skill_cat_002",
      categoryName: "Frameworks & Libraries",
      skills: ["React 19", "Next.js (App Router)", "Express.js", "FastAPI", "gRPC", "Tailwind CSS"],
    },
    {
      id: "skill_cat_003",
      categoryName: "Databases & Storage",
      skills: ["PostgreSQL", "Redis", "MongoDB", "PostGIS", "Qdrant Vector DB", "PgBouncer"],
    },
    {
      id: "skill_cat_004",
      categoryName: "Cloud & Infrastructure",
      skills: ["AWS (EKS, S3, RDS, Lambda)", "Kubernetes", "Docker", "Apache Kafka", "GitHub Actions", "Terraform"],
    },
  ],
  education: [
    {
      id: "edu_001",
      institution: "University of California, Berkeley",
      degree: "Bachelor of Science",
      fieldOfStudy: "Computer Science & Engineering",
      location: "Berkeley, CA",
      startDate: "2018-08",
      endDate: "2022-05",
      gpa: "3.88 / 4.00",
      honors: ["Dean's Honors List (6 consecutive semesters)", "Upsilon Pi Epsilon CS Honor Society"],
    },
  ],
  certifications: [
    {
      id: "cert_001",
      title: "AWS Certified Solutions Architect – Associate",
      issuer: "Amazon Web Services",
      date: "2023-11",
      url: "https://aws.amazon.com/verification",
    },
    {
      id: "cert_002",
      title: "Certified Kubernetes Administrator (CKA)",
      issuer: "Cloud Native Computing Foundation",
      date: "2024-05",
      url: "https://cncf.io/certification",
    },
  ],
  versions: [
    {
      id: "ver_master",
      versionName: "Master Resume (Core)",
      createdAt: "2026-10-05T19:42:00Z",
      changesSummary: "Updated Kafka cluster metrics and Berkeley GPA.",
    },
    {
      id: "ver_backend_acme",
      versionName: "Backend Systems — Stripe / Acme",
      targetRole: "Distributed Systems Engineer",
      targetCompany: "Stripe",
      createdAt: "2026-10-04T14:15:00Z",
      matchScore: 94,
      changesSummary: "Emphasized idempotent APIs, payment workflows, and k6 load tests.",
    },
    {
      id: "ver_ai_platform",
      versionName: "AI Infrastructure — Anthropic / Scale",
      targetRole: "AI Platform Engineer",
      targetCompany: "Scale AI",
      createdAt: "2026-09-29T10:00:00Z",
      matchScore: 89,
      changesSummary: "Promoted vector search Qdrant project and GPU inference pipeline bullets.",
    },
  ],
};

export const mockAISuggestions: AISuggestion[] = [
  {
    id: "sug_001",
    targetId: "bullet_004",
    type: "jd_alignment",
    originalText:
      "Developed resilient RESTful and GraphQL backend APIs utilizing Node.js, TypeScript, and PostgreSQL for over 1.2M active enterprise dashboard users.",
    suggestedText:
      "Engineered resilient, high-throughput RESTful and GraphQL APIs in TypeScript and Node.js on PostgreSQL, maintaining sub-80ms response times for 1.2M+ active enterprise clients.",
    rationale:
      "Quantifies performance characteristics and reinforces TypeScript architectural ownership matching Tier-1 job requirements.",
    evidence: [
      "Verified in Git log: Implemented caching layer and DataLoader query batches",
      "Matches target requirement: 'Production TypeScript & Node.js service design'",
      "Adds measurable outcome: sub-80ms SLA benchmark",
    ],
    status: "pending",
  },
  {
    id: "sug_002",
    targetId: "bullet_002",
    type: "quantify_impact",
    originalText:
      "Engineered high-concurrency microservices in Go and Node.js with gRPC protocols, decoupling monolithic ingestion pipeline and achieving 99.99% system availability.",
    suggestedText:
      "Spearheaded decomposition of core monolithic ingestion into distributed Go microservices via gRPC, processing 18M daily events with 99.99% measured uptime.",
    rationale:
      "Replaces generic phrasing with concrete daily event scale and emphasizes architectural leadership.",
    evidence: [
      "Matches system telemetry metrics in Kafka consumer groups",
      "Aligns with Staff/Senior role expectations on decoupled architectures",
    ],
    status: "pending",
  },
];

export const mockJobMatches: JobDescriptionMatch[] = [
  {
    id: "job_001",
    title: "Staff Distributed Systems Engineer",
    company: "Stripe",
    location: "San Francisco, CA / Remote",
    matchScore: 92,
    updatedAt: "2026-10-05T18:10:00Z",
    rawText: `About the Role:
We are looking for an experienced Distributed Systems Engineer to scale our global core transaction infrastructure. You will design, build, and operate fault-tolerant event streams, high-availability ledger services, and zero-downtime deployment pipelines.

Requirements:
- 5+ years building and scaling production services with Go, Node.js, or Java.
- Proven experience with distributed event streaming architectures (Kafka, RabbitMQ, or AWS Kinesis).
- Deep expertise in relational databases (PostgreSQL) and caching strategies (Redis).
- Hands-on expertise with container orchestration (Kubernetes, AWS EKS) and CI/CD pipelines.
- Demonstrated experience optimizing API p99 latency and designing for 99.99% availability.
- Strong grounding in distributed transactions, idempotency, and load testing (k6, Locust).`,
    requirements: [
      {
        id: "req_001",
        name: "Apache Kafka / Distributed Streaming",
        category: "systems",
        status: "found",
        confidence: 98,
        evidenceSnippet:
          "Architected distributed caching and event streaming layer using Apache Kafka and Redis cluster...",
        matchedResumeTargetId: "bullet_001",
        guidanceNote: "Direct 1:1 match with measured latency reductions.",
      },
      {
        id: "req_002",
        name: "Go & Node.js Microservices",
        category: "languages",
        status: "found",
        confidence: 96,
        evidenceSnippet:
          "Engineered high-concurrency microservices in Go and Node.js with gRPC protocols...",
        matchedResumeTargetId: "bullet_002",
        guidanceNote: "Matches required programming languages and gRPC protocol proficiency.",
      },
      {
        id: "req_003",
        name: "Kubernetes & AWS EKS Orchestration",
        category: "systems",
        status: "found",
        confidence: 94,
        evidenceSnippet:
          "Spearheaded automated canary deployment pipelines across Kubernetes clusters on AWS EKS...",
        matchedResumeTargetId: "bullet_003",
        guidanceNote: "Matches container orchestration and automated canary delivery.",
      },
      {
        id: "req_004",
        name: "PostgreSQL & Query Optimization",
        category: "systems",
        status: "found",
        confidence: 91,
        evidenceSnippet:
          "Refactored unindexed multi-tenant database queries and implemented connection pooling with PgBouncer...",
        matchedResumeTargetId: "bullet_005",
        guidanceNote: "Evidence shows PgBouncer tuning and 68% execution time speedup.",
      },
      {
        id: "req_005",
        name: "Distributed Idempotency & Financial Ledgers",
        category: "architecture",
        status: "partial",
        confidence: 68,
        evidenceSnippet:
          "Authored end-to-end integration test suites with Jest and k6 load testing rigs across critical payment workflows...",
        matchedResumeTargetId: "bullet_006",
        guidanceNote:
          "Payment workflows are referenced, but explicitly mentioning 'idempotency keys' or 'reconciliation checks' will boost score.",
      },
      {
        id: "req_006",
        name: "Terraform Infrastructure as Code",
        category: "architecture",
        status: "found",
        confidence: 85,
        evidenceSnippet: "Listed in Technical Skills > Cloud & Infrastructure: Terraform",
        matchedResumeTargetId: "skill_cat_004",
        guidanceNote: "Add a specific bullet detailing Terraform module management to strengthen evidence.",
      },
      {
        id: "req_007",
        name: "AWS Aurora Serverless / DynamoDB",
        category: "systems",
        status: "missing",
        confidence: 25,
        evidenceSnippet: undefined,
        guidanceNote: "Job notes DynamoDB / Aurora experience. Highlight any key-value or serverless usage.",
      },
    ],
    strengthsSummary: [
      "Exceptional alignment on high-throughput Kafka streaming, Redis, and Go/Node microservices.",
      "Clear metrics proving p99 latency reduction and 99.99% SLA adherence.",
      "Hands-on Kubernetes/AWS EKS deployment experience with canary rollbacks.",
    ],
    gapsSummary: [
      "Explicitly mention idempotency mechanisms in payment/API bullets.",
      "Detail multi-region replication or disaster recovery failover scenarios if applicable.",
    ],
  },
  {
    id: "job_002",
    title: "Lead AI Platform Engineer",
    company: "Scale AI",
    location: "New York, NY / Hybrid",
    matchScore: 86,
    updatedAt: "2026-10-03T11:20:00Z",
    rawText: `Scale is seeking a Lead AI Platform Engineer to build scalable infrastructure supporting fine-tuning workloads, vector retrieval pipelines, and real-time inference routing.`,
    requirements: [
      {
        id: "req_201",
        name: "Vector Databases & Dense Retrieval (Qdrant / Milvus)",
        category: "systems",
        status: "found",
        confidence: 95,
        evidenceSnippet: "Constructed semantic career vector search engine indexing 500,000+ job descriptions with Qdrant...",
        matchedResumeTargetId: "bullet_proj_003",
      },
      {
        id: "req_202",
        name: "FastAPI & Python Microservices",
        category: "languages",
        status: "found",
        confidence: 90,
        evidenceSnippet: "FastAPI, Python listed in projects and technical skills.",
        matchedResumeTargetId: "proj_002",
      },
      {
        id: "req_203",
        name: "vLLM / TensorRT Inference Optimization",
        category: "systems",
        status: "missing",
        confidence: 20,
        guidanceNote: "Consider highlighting any LLM token streaming or model deployment experience.",
      },
    ],
    strengthsSummary: [
      "Strong vector retrieval and semantic indexing foundation.",
      "Deep experience with low-latency backend architectures.",
    ],
    gapsSummary: [
      "Need direct references to model serving engines (Triton, vLLM).",
    ],
  },
];

export const sampleLatexCode = `%-------------------------
% Resume in LaTeX
% Template: Jake Gutierrez / Modern Clean
% License : MIT
%------------------------

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

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\begin{document}

%----------HEADING----------
\\begin{center}
    \\textbf{\\Huge \\scshape Maruthi Kummaragunta} \\\\ \\vspace{2pt}
    \\small +1 (555) 382-9012 $|$ \\href{mailto:maruthi.dev@example.com}{\\underline{maruthi.dev@example.com}} $|$ 
    \\href{https://linkedin.com/in/maruthi-dev}{\\underline{linkedin.com/in/maruthi-dev}} $|$
    \\href{https://github.com/maruthi-dev}{\\underline{github.com/maruthi-dev}}
\\end{center}

%-----------EXPERIENCE-----------
\\section{Experience}
  \\textbf{Apex Distributed Labs} $|$ \\emph{Senior Software Engineer} \\hfill Mar 2024 -- Present \\\\
  \\emph{San Francisco, CA}
  \\begin{itemize}[leftmargin=0.15in, label={$\\bullet$}]
    \\item Architected distributed caching and event streaming layer using \\textbf{Apache Kafka} and \\textbf{Redis cluster}, reducing p99 API latency from 320ms to 42ms under 85,000 peak RPS.
    \\item Engineered high-concurrency microservices in \\textbf{Go} and \\textbf{Node.js} with \\textbf{gRPC} protocols, decoupling monolithic ingestion pipeline and achieving 99.99\\% system availability.
    \\item Spearheaded automated canary deployment pipelines across \\textbf{Kubernetes} clusters on \\textbf{AWS EKS}, dropping rollback durations from 28 minutes to under 90 seconds.
  \\end{itemize}

  \\vspace{4pt}
  \\textbf{Stratos Cloud Systems} $|$ \\emph{Backend Software Engineer} \\hfill Jan 2022 -- Feb 2024 \\\\
  \\emph{Austin, TX}
  \\begin{itemize}[leftmargin=0.15in, label={$\\bullet$}]
    \\item Developed resilient RESTful and GraphQL backend APIs utilizing \\textbf{Node.js}, \\textbf{TypeScript}, and \\textbf{PostgreSQL} for over 1.2M active enterprise dashboard users.
    \\item Refactored unindexed multi-tenant database queries and implemented connection pooling with \\textbf{PgBouncer}, cutting average query execution times by 68\\%.
    \\item Authored end-to-end integration test suites with \\textbf{Jest} and \\textbf{k6} load testing rigs, increasing test coverage from 54\\% to 92\\% across critical workflows.
  \\end{itemize}

%-----------PROJECTS-----------
\\section{Projects}
  \\textbf{Real-time Campus Transit Engine} $|$ \\emph{Go, WebSockets, Redis Pub/Sub, PostGIS, Docker} \\hfill 2024 \\\\
  \\begin{itemize}[leftmargin=0.15in, label={$\\bullet$}]
    \\item Built fault-tolerant geospatial ingestion service processing GPS telemetry from 60+ transit vehicles at 1-second intervals with sub-50ms browser broadcast via WebSockets.
    \\item Leveraged PostGIS spatial indexes and Kalman filtering algorithms to compute predictive arrival estimates, improving ETA accuracy by 34\\%.
  \\end{itemize}

%-----------SKILLS-----------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     \\textbf{Languages}: TypeScript, JavaScript, Go, Python, Node.js, SQL, LaTeX \\\\
     \\textbf{Frameworks}: React 19, Next.js, Express.js, FastAPI, gRPC, Tailwind CSS \\\\
     \\textbf{Infrastructure \\& DB}: PostgreSQL, Redis, Apache Kafka, Kubernetes, AWS (EKS, RDS, S3), Docker
    }}
 \\end{itemize}

%-----------EDUCATION-----------
\\section{Education}
  \\textbf{University of California, Berkeley} \\hfill Berkeley, CA \\\\
  \\emph{Bachelor of Science in Computer Science \\& Engineering} \\hfill Aug 2018 -- May 2022 \\\\
  \\small{GPA: 3.88 / 4.00 $\\cdot$ Dean's Honors List $\\cdot$ Upsilon Pi Epsilon Honor Society}

\\end{document}
`;

export const mockATSEvaluation = {
  readinessScore: 87,
  readinessLabel: "Excellent" as const,
  lastAnalyzed: "2 minutes ago",
  jdKeywordAlignment: 92,
  targetJobTitle: "Staff Distributed Systems Engineer",
  targetCompany: "Stripe",
  breakdown: {
    parsing: 100,
    keywords: 91,
    structure: 94,
    formatting: 78,
    sections: 95,
    readability: 90,
  },
  issues: [
    {
      id: "ats_iss_001",
      severity: "critical" as const,
      problem: "Two-column layout may reduce parsing reliability",
      explanation:
        "Multi-column tables and floating text blocks often cause ATS parsers to interleave left and right columns horizontally, breaking bullet context.",
      suggestedFix: "Switch to single-column linear hierarchy (Modern Engineer / Minimalist TeX).",
      actionableAIRecommendation:
        "This template uses a two-column structure. For maximum ATS compatibility, I recommend switching to the Minimal single-column template.",
    },
    {
      id: "ats_iss_002",
      severity: "warning" as const,
      problem: "Non-standard section heading detected",
      explanation:
        "Certain legacy parsers fail to classify sections titled 'Career Journey' or 'Work History Highlights' into standard Work Experience.",
      suggestedFix: "Standardize title to 'Experience'.",
      actionableAIRecommendation:
        "Your 'Career Journey' heading may be less reliably interpreted than 'Experience'.",
    },
    {
      id: "ats_iss_003",
      severity: "warning" as const,
      problem: "Some symbols may not parse consistently",
      explanation:
        "Unicode star and arrow glyphs (★, ➔) in bullet prefixes may be replaced by garbled characters or question marks in legacy OCR filters.",
      suggestedFix: "Use standard LaTeX circular bullets (\\bullet) or plain hyphens.",
      actionableAIRecommendation:
        "Replace decorative glyph symbols with standard \\bullet formatting across 2 bullets.",
    },
    {
      id: "ats_iss_004",
      severity: "good" as const,
      problem: "Contact information detected",
      explanation:
        "Full name, phone, email, location, and verified GitHub/LinkedIn URLs were recognized with 100% regex confidence.",
      suggestedFix: undefined,
    },
    {
      id: "ats_iss_005",
      severity: "good" as const,
      problem: "Standard Experience section hierarchy",
      explanation:
        "Company names, job roles, locations, and reverse-chronological date ranges parse with zero delimiter collision.",
      suggestedFix: undefined,
    },
    {
      id: "ats_iss_006",
      severity: "good" as const,
      problem: "Education section detected",
      explanation:
        "University of California, Berkeley and B.S. degree nomenclature verified against standard higher education registries.",
      suggestedFix: undefined,
    },
    {
      id: "ats_iss_007",
      severity: "good" as const,
      problem: "Skills section taxonomy verified",
      explanation:
        "Structured category labels (Languages, Frameworks, Infrastructure) parsed directly into standardized candidate skill tags.",
      suggestedFix: undefined,
    },
  ],
  keywords: [
    {
      name: "Node.js",
      status: "found" as const,
      category: "Technical Skills",
      evidence: "Found in Experience: Stratos Cloud Systems & Apex Distributed Labs",
    },
    {
      name: "React",
      status: "found" as const,
      category: "Technical Skills",
      evidence: "Found in Experience: Nova Technologies & Technical Skills",
    },
    {
      name: "TypeScript",
      status: "found" as const,
      category: "Technical Skills",
      evidence: "Found in Experience: Stratos Cloud Systems & Technical Skills",
    },
    {
      name: "PostgreSQL",
      status: "partial" as const,
      category: "Databases",
      evidence: "Found in Skills, but query tuning and PgBouncer mentioned without indexing metrics",
      note: "Explicit mention of indexing and connection pooling partially satisfies senior criteria.",
    },
    {
      name: "AWS (EKS, RDS, S3)",
      status: "missing" as const,
      category: "Cloud Infrastructure",
      evidence: undefined,
      note: "Not found in resume body. Do not fabricate unless backed by actual project experience.",
    },
  ],
};

