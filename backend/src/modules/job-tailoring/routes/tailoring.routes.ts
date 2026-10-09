import { Router } from "express";
import {
  acceptSuggestion,
  analyze,
  editSuggestion,
  extractRequirements,
  getAnalysis,
  getMatches,
  getRequirements,
  getSuggestions,
  getScopedSuggestions,
  getResumeEvidence,
  hybridSearch,
  analyzeMatches,
  indexResume,
  indexResumeEmbeddings,
  semanticSearch,
  rejectSuggestion,
  generateSuggestion,
} from "../controllers/tailoring.controller";

const router = Router();

router.post("/analyze", analyze);
router.post("/requirements", extractRequirements);
router.post("/resume/index", indexResume);
router.post("/resume/embeddings/index", indexResumeEmbeddings);
router.post("/resume/semantic-search", semanticSearch);
router.post("/resume/hybrid-search", hybridSearch);
router.post("/matches/analyze", analyzeMatches);
router.post("/suggestions/generate", generateSuggestion);
router.get("/suggestions", getScopedSuggestions);
router.get("/resume/:projectId/evidence", getResumeEvidence);
router.get("/:analysisId", getAnalysis);
router.get("/:analysisId/matches", getMatches);
router.get("/:analysisId/requirements", getRequirements);
router.get("/:analysisId/suggestions", getSuggestions);
router.post("/suggestions/:suggestionId/accept", acceptSuggestion);
router.post("/suggestions/:suggestionId/reject", rejectSuggestion);
router.patch("/suggestions/:suggestionId", editSuggestion);

export default router;
