import { StreamChat } from "stream-chat";
import "dotenv/config";

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error("Stream API key or Secret is missing");
}

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

export const upsertStreamUser = async (userData) => {
  try {
    // Stream expects 'teams' array for multi-tenancy
    const userToUpsert = {
      ...userData,
      ...(userData.teams ? { teams: userData.teams } : {}),
    };
    await streamClient.upsertUsers([userToUpsert]);
    return userToUpsert;
  } catch (error) {
    console.error("Error upserting Stream user:", error);
    throw error;
  }
};


export const generateStreamToken = (userId) => {
  try {
    // ensure userId is a string
    const userIdStr = userId.toString();
    return streamClient.createToken(userIdStr);
  } catch (error) {
    console.error("Error generating Stream token:", error);
    throw error;
  }
};

/**
 * Ensure a Stream team channel exists and the given user is a member.
 * Uses the server-side admin client so no client-side permission issues.
 */
export const ensureStreamChannel = async ({ channelId, channelName, orgSlug, userId }) => {
  const channel = streamClient.channel("team", channelId, {
    name: `#${channelName}`,
    team: orgSlug,
    created_by_id: userId,
  });
  await channel.create();
  await channel.addMembers([userId]);
  return channel;
};
