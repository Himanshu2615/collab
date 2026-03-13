import schedule from "node-schedule";
import Meeting from "../models/Meeting.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import { sendMeetingEmail } from "./email.js";

// Keep track of active jobs so we can cancel them if needed (like on meeting deletion)
const activeJobs = new Map();

/**
 * Schedules a new email job for a meeting
 */
export const scheduleMeetingEmail = async (meeting, hostId) => {
  try {
    const meetingTime = new Date(meeting.startTime);

    // Don't schedule if it's already in the past
    if (meetingTime <= new Date()) {
      return;
    }

    // Cancel existing job if one exists for this meeting
    if (activeJobs.has(meeting._id.toString())) {
      activeJobs.get(meeting._id.toString()).cancel();
      activeJobs.delete(meeting._id.toString());
    }

    const job = schedule.scheduleJob(meetingTime, async () => {
      try {
        console.log(`Running scheduled meeting email for: ${meeting.title}`);
        
        // Refetch meeting to ensure it wasn't deleted or updated and we have latest participants
        const latestMeeting = await Meeting.findById(meeting._id);
        if (!latestMeeting) return;

        const host = await User.findById(hostId).select("fullName email");
        if (!host) return;

        // Get channel members if possible
        let allTargetIds = [...latestMeeting.participants];
        
        if (latestMeeting.channel && latestMeeting.organization) {
          const org = await Organization.findById(latestMeeting.organization);
          if (org) {
            const channelNameStr = latestMeeting.channel.replace(/^#/, "").toLowerCase();
            const ch = org.channels.find(c => c.name.toLowerCase() === channelNameStr);
            if (ch && ch.members) {
              allTargetIds = [...allTargetIds, ...ch.members];
            }
          }
        }

        // Fetch emails of all participants (using distinct to avoid duplicates if someone is both explicitly invited and in channel)
        const participants = await User.find({
          _id: { $in: allTargetIds }
        }).select("email");

        const emails = participants.map((p) => p.email).filter(Boolean);

        // Need the link - we can use the one saved in the DB, or construct it here if missing
        const meetingDetails = {
          ...latestMeeting.toObject(),
          meetingLink: latestMeeting.meetingLink || `${process.env.FRONTEND_URL}/call/${latestMeeting._id}`
        };

        await sendMeetingEmail({ emails, meetingDetails, host });
      } catch (error) {
        console.error("Error executing scheduled email job:", error);
      } finally {
        // Clean up from active jobs list once executed
        activeJobs.delete(meeting._id.toString());
      }
    });

    if (job) {
      activeJobs.set(meeting._id.toString(), job);
      console.log(`Successfully scheduled email for meeting: ${meeting.title} at ${meetingTime}`);
    }

  } catch (error) {
    console.error("Failed to schedule meeting email:", error);
  }
};

/**
 * Cancels a scheduled meeting email (e.g. when meeting is deleted)
 */
export const cancelMeetingEmail = (meetingId) => {
  const idStr = meetingId.toString();
  if (activeJobs.has(idStr)) {
    activeJobs.get(idStr).cancel();
    activeJobs.delete(idStr);
    console.log(`Cancelled scheduled email for meeting: ${idStr}`);
  }
};

/**
 * Initialize all future meetings into the scheduler on server restart
 */
export const initScheduler = async () => {
  try {
    const now = new Date();
    // Find all meetings starting in the future
    const upcomingMeetings = await Meeting.find({ startTime: { $gt: now } });
    
    console.log(`Initializing scheduler with ${upcomingMeetings.length} upcoming meetings...`);
    
    for (const meeting of upcomingMeetings) {
      // Find host implicitly (could be the first participant for simplicity if no host on model, or pass it explicitly)
      // Since createMeeting sets participants[0] as req.user._id, we can safely use participants[0]
      if (meeting.participants && meeting.participants.length > 0) {
        scheduleMeetingEmail(meeting, meeting.participants[0]);
      }
    }
  } catch (error) {
    console.error("Failed to initialize scheduler:", error);
  }
};
