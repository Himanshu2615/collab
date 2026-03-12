import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { addTranscriptEntries, getTranscript } from "../controllers/transcript.controller.js";

const router = express.Router();

router.get("/:callId", protectRoute, getTranscript);
router.post("/:callId/entries", protectRoute, addTranscriptEntries);

export default router;
