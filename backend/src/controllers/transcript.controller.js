import Transcript from "../models/Transcript.js";
import cloudinary from "../lib/cloudinary.js";

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

      const updateDoc = {
        $addToSet: { participants: speakerId },
      };
      if (newEntries.length > 0) {
        updateDoc.$push = { entries: { $each: newEntries } };
        updateDoc.$unset = { cloudinaryUrl: "" };
      }

      await Transcript.updateOne({ callId }, updateDoc);
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

    if (transcript.cloudinaryUrl) {
      const url = transcript.cloudinaryUrl.includes('fl_attachment') 
        ? transcript.cloudinaryUrl 
        : transcript.cloudinaryUrl.replace('/upload/', '/upload/fl_attachment/');
      return res.json({ cloudinaryUrl: url });
    }

    if (!transcript.entries || transcript.entries.length === 0) {
      return res.status(404).json({ message: "No transcript entries found" });
    }

    // Generate .txt file on the fly and upload to Cloudinary
    transcript.entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const lines = transcript.entries.map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `[${time}] ${entry.speakerName}: ${entry.text}`;
    });

    const header = `Transcript for Call: ${callId}\n\n`;
    const textContent = header + lines.join("\n");

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: "raw", folder: "transcripts", format: "txt", public_id: `transcript_${callId}` },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(Buffer.from(textContent));
    });

    const finalUrl = uploadResult.secure_url.includes('fl_attachment')
      ? uploadResult.secure_url
      : uploadResult.secure_url.replace('/upload/', '/upload/fl_attachment/');

    await Transcript.updateOne({ _id: transcript._id }, { cloudinaryUrl: finalUrl });

    res.json({ cloudinaryUrl: finalUrl });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    res.status(500).json({ message: "Failed to fetch transcript" });
  }
};
