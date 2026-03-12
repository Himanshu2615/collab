import Transcript from "../models/Transcript.js";

/**
 * POST /api/transcripts/:callId/entries
 * Each participant pushes their own speech segments.
 * Entries are deduplicated by entryId.
 */
export const addTranscriptEntries = async (req, res) => {
  try {
    const { callId } = req.params;
    const { entries } = req.body;
    const speakerId = req.user._id;

    if (!callId || typeof callId !== "string" || callId.length > 200) {
      return res.status(400).json({ message: "Invalid callId" });
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: "No entries provided" });
    }

    // Sanitise and validate entries
    const sanitised = entries.filter(
      (e) =>
        e?.entryId &&
        typeof e.entryId === "string" &&
        typeof e.text === "string" &&
        e.text.trim().length > 0 &&
        e.timestamp
    ).map((e) => ({
      entryId: e.entryId.slice(0, 100),
      speakerId,
      speakerName: typeof e.speakerName === "string" ? e.speakerName.slice(0, 120) : "Unknown",
      text: e.text.trim().slice(0, 2000),
      timestamp: new Date(e.timestamp),
    }));

    if (sanitised.length === 0) {
      return res.status(400).json({ message: "No valid entries provided" });
    }

    const existing = await Transcript.findOne({ callId });

    if (existing) {
      const existingIds = new Set(existing.entries.map((e) => e.entryId));
      const newEntries = sanitised.filter((e) => !existingIds.has(e.entryId));

      await Transcript.updateOne(
        { callId },
        {
          ...(newEntries.length > 0 ? { $push: { entries: { $each: newEntries } } } : {}),
          $addToSet: { participants: speakerId },
        }
      );
    } else {
      await Transcript.create({
        callId,
        participants: [speakerId],
        entries: sanitised,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving transcript entries:", error);
    res.status(500).json({ message: "Failed to save transcript" });
  }
};

/**
 * GET /api/transcripts/:callId
 * Returns the transcript for a call, sorted chronologically.
 */
export const getTranscript = async (req, res) => {
  try {
    const { callId } = req.params;

    if (!callId || typeof callId !== "string" || callId.length > 200) {
      return res.status(400).json({ message: "Invalid callId" });
    }

    const transcript = await Transcript.findOne({ callId }).lean();

    if (!transcript) {
      return res.status(404).json({ message: "Transcript not found" });
    }

    // Sort entries chronologically
    transcript.entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(transcript);
  } catch (error) {
    console.error("Error fetching transcript:", error);
    res.status(500).json({ message: "Failed to fetch transcript" });
  }
};
