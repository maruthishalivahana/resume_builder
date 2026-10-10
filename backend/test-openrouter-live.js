const assert = require("node:assert/strict");
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const { OpenRouterLLMProvider } = require("./dist/modules/job-tailoring/providers/openrouter-llm.provider");
const { ClaimValidatorService } = require("./dist/modules/job-tailoring/services/claim-validator.service");

const evidence = [{
  id: "live-evidence-1",
  resumeId: "live-test-resume",
  versionId: "live-test-version",
  section: "Experience",
  type: "bullet",
  text: "Built REST APIs using Node.js.",
  source: {
    fileId: "live-test-file",
    fileName: "synthetic-resume.tex",
    lineStart: 1,
    lineEnd: 1,
  },
  technologies: ["Node.js", "REST APIs"],
  entities: [],
  normalizedTechnologies: ["nodejs", "rest_api"],
  score: 1,
  lexicalScore: 1,
  semanticScore: 1,
  sectionScore: 1,
  qualityScore: 1,
}];

const requirement = {
  id: "live-requirement-1",
  text: "Present existing Node.js REST API experience more clearly.",
  category: "responsibility",
  importance: "preferred",
  extractedTerms: ["Node.js", "REST APIs"],
  normalizedTerms: ["nodejs", "rest_api"],
};

function safeError(error) {
  const message = error instanceof Error ? error.message : "unknown error";
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/OPENROUTER_API_KEY[^;\s]*/gi, "OPENROUTER_API_KEY=[redacted]")
    .slice(0, 300);
}

function runUnsupportedClaimCheck(validator) {
  const invalid = {
    type: "rewrite",
    targetEvidenceId: evidence[0].id,
    before: evidence[0].text,
    after: "Built REST APIs using Node.js handling 10,000 requests per day.",
    reason: "Adds an unsupported metric.",
    evidenceIds: [evidence[0].id],
    confidence: 0.5,
  };
  const result = validator.validateDetailed(invalid, evidence);
  return {
    passed: !result.valid,
    unsupportedClaimCount: result.unsupportedClaims.length,
  };
}

async function main() {
  const providerName = process.env.LLM_PROVIDER?.trim().toLowerCase();
  const missing = ["OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_BASE_URL"]
    .filter((name) => !process.env[name]?.trim());
  if (providerName !== "openrouter") missing.unshift("LLM_PROVIDER=openrouter");
  if (missing.length > 0) {
    console.log(JSON.stringify({
      configuration: "FAIL",
      missing,
      liveRequest: "NOT_RUN",
      mongoModified: false,
    }));
    process.exitCode = 1;
    return;
  }

  const validator = new ClaimValidatorService();
  const unsupportedClaim = runUnsupportedClaimCheck(validator);
  let provider;
  try {
    provider = new OpenRouterLLMProvider();
  } catch (error) {
    console.log(JSON.stringify({
      configuration: "FAIL",
      error: safeError(error),
      unsupportedClaimRejection: unsupportedClaim,
      mongoModified: false,
    }));
    process.exitCode = 1;
    return;
  }

  try {
    const suggestion = await provider.generate({
      requirement,
      evidence,
      constraints: {
        mayInventFacts: false,
        mayChangeMeaning: false,
        mustReferenceEvidence: true,
      },
    });
    if (!suggestion) {
      console.log(JSON.stringify({
        configuration: "PASS",
        liveRequest: "PASS",
        responseParsing: "PASS",
        suggestion: "NULL",
        validClaimValidation: "NOT_RUN",
        unsupportedClaimRejection: unsupportedClaim,
        mongoModified: false,
      }));
      process.exitCode = 1;
      return;
    }
    assert.equal(suggestion.targetEvidenceId, evidence[0].id);
    const validation = validator.validateDetailed(suggestion, evidence);
    const result = {
      configuration: "PASS",
      liveRequest: "PASS",
      responseParsing: "PASS",
      suggestion: "RECEIVED",
      referencesExpectedEvidence: "PASS",
      validClaimValidation: validation.valid ? "PASS" : "FAIL",
      unsupportedClaimRejection: unsupportedClaim,
      mongoModified: false,
    };
    console.log(JSON.stringify(result));
    if (!validation.valid || !unsupportedClaim.passed) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({
      configuration: "PASS",
      liveRequest: "FAIL",
      responseParsing: "NOT_RUN",
      validClaimValidation: "NOT_RUN",
      unsupportedClaimRejection: unsupportedClaim,
      mongoModified: false,
      error: safeError(error),
    }));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.log(JSON.stringify({
    configuration: "PASS",
    liveRequest: "FAIL",
    mongoModified: false,
    error: safeError(error),
  }));
  process.exitCode = 1;
});
