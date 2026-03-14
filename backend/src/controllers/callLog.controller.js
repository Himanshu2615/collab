import CallLog from "../models/CallLog.js";

// @route   POST /api/call-logs
// @desc    Upserts (creates or updates) a call log
export const saveCallLog = async (req, res) => {
  try {
    const {
      callId,
      conversationId,
      type,
      status,
      isChannel,
      hostId,
      participantIds,
      participants,
      participantProfiles,
      startTime,
      endTime,
    } = req.body;

    if (!callId || !conversationId) {
      return res.status(400).json({ message: "callId and conversationId are required" });
    }

    const log = await CallLog.findOneAndUpdate(
      { callId },
      {
        $set: {
          conversationId,
          type,
          status,
          isChannel,
          hostId,
          // Update arrays only if provided, else keep existing
          ...(participantIds ? { participantIds } : {}),
          ...(participants ? { participants } : {}),
          ...(participantProfiles ? { participantProfiles } : {}),
          // Set start/end times if provided
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Call log saved successfully", log });
  } catch (error) {
    console.error("Error in saveCallLog controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// @route   GET /api/call-logs
// @desc    Gets call logs relevant to the logged-in user
export const getCallLogs = async (req, res) => {
  try {
    const userId = req.user._id;

    // We fetch calls where:
    // 1. User is host
    // 2. User is in participantIds
    // 3. Or it's a channel call (we fetch all channel calls for simplicity assuming basic org access, 
    //    but ideally we filter by channels the user is actually a part of).
    // For now, mirroring frontend logic: fetch where user is host, participant, OR isChannel is true.

    const callLogs = await CallLog.find({
      $or: [
        { hostId: userId },
        { participantIds: userId },
        { isChannel: true }
      ]
    })
      .sort({ createdAt: -1, startTime: -1, updatedAt: -1 })
      .limit(100);

    res.status(200).json(callLogs);
  } catch (error) {
    console.error("Error in getCallLogs controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
