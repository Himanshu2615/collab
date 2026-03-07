import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, ensureOrgChannel } from "../lib/api";
import Avatar from "../components/Avatar";
import { setUserImageCache, getUserImage } from "../lib/userImageCache";
import { useStreamContext } from "../context/StreamContext";

import {
  Channel,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
  TypingIndicator,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import ChannelMembersPanel from "../components/ChannelMembersPanel";
import ChannelInfoPanel from "../components/ChannelInfoPanel";
import EmptyChannelState from "../components/EmptyChannelState";
import MessageSearch from "../components/MessageSearch";
import ConnectionStatus from "../components/ConnectionStatus";
import VideoCallModal from "../components/VideoCallModal";
import CallLogsPanel from "../components/CallLogsPanel";
import IncomingCallNotification from "../components/IncomingCallNotification";
import {
  VideoIcon,
  HashIcon,
  SearchIcon,
  XIcon,
  UsersIcon,
  MoreVerticalIcon,
} from "lucide-react";

import SlackMessage from "../components/SlackMessage";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const FullScreenChatPage = () => {
  const { id: channelOrUserId } = useParams();
  const navigate = useNavigate();

  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isChannel, setIsChannel] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callId, setCallId] = useState(null);
  const [showCallLogs, setShowCallLogs] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  const { authUser } = useAuthUser();
  const { markAsRead } = useStreamContext();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    let cancelled = false;

    // Immediately show loader and clear stale channel whenever the target changes
    setLoading(true);
    setChannel(null);

    const initChat = async () => {
      if (!tokenData?.token || !authUser) return;

      try {
        const client = StreamChat.getInstance(STREAM_API_KEY);

        // Only (re)connect if not already connected as this user
        if (client.userID !== authUser._id) {
          const streamImage = authUser.profilePic?.startsWith("data:") ? "" : authUser.profilePic || "";
          await client.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: streamImage,
            },
            tokenData.token
          );
          setUserImageCache(authUser._id, authUser.profilePic);
        }

        let currChannel;
        const predefinedChannels = ["general", "marketing", "development"];
        const isOrgChannel = channelOrUserId.startsWith("org-");

        if (isOrgChannel || predefinedChannels.includes(channelOrUserId)) {
          if (!cancelled) setIsChannel(true);

          if (isOrgChannel) {
            // Let the backend (admin Stream client) create the channel and add
            // this user as a member — avoids the client-side team-scope
            // ReadChannel/CreateChannel permission error.
            await ensureOrgChannel(channelOrUserId);
            currChannel = client.channel("team", channelOrUserId);
          } else {
            // Legacy hard-coded channel names (no org prefix)
            currChannel = client.channel("team", channelOrUserId, {
              name: `#${channelOrUserId}`,
              created_by_id: authUser._id,
            });
            await currChannel.create();
            await currChannel.addMembers([authUser._id]);
          }
        } else {
          if (!cancelled) setIsChannel(false);
          const channelId = [authUser._id, channelOrUserId].sort().join("-");
          currChannel = client.channel("messaging", channelId, {
            members: [authUser._id, channelOrUserId],
          });
        }

        await currChannel.watch();

        if (!cancelled) {
          setChatClient(client);
          setChannel(currChannel);
          /* Clear unread badge in sidebar instantly for DM chats */
          if (!isOrgChannel && !predefinedChannels.includes(channelOrUserId)) {
            markAsRead(channelOrUserId);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error initializing chat:", error);
          toast.error("Could not connect to chat. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initChat();

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
      // NOTE: do NOT disconnect here — disconnecting on every channel switch
      // tears down the Stream WS connection and causes a blank screen race.
      // Disconnection is handled by the unmount-only effect below.
    };
  }, [tokenData, authUser, channelOrUserId]);

  // Call timer
  useEffect(() => {
    let interval;
    if (isCallActive) {
      interval = setInterval(() => setCallDuration((p) => p + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive]);

  if (loading || !chatClient || !channel) return <ChatLoader />;

  // ── Derived values ──────────────────────────────
  const memberCount = Object.keys(channel.state.members || {}).length;
  const memberList = Object.values(channel.state.members || {});
  const dmPartner = !isChannel
    ? memberList.find((m) => m.user_id !== authUser._id)?.user
    : null;

  const rawChannelName = channel.data?.name || channelOrUserId;
  const displayName = isChannel
    ? rawChannelName.replace(/^#/, "")
    : dmPartner?.name || "Direct Message";

  const headerMembers = memberList.slice(0, 3);
  const extraCount = Math.max(0, memberCount - 3);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-white">
      <ConnectionStatus chatClient={chatClient} />

      <Chat client={chatClient} theme="str-chat__theme-light">
        <Channel
          channel={channel}
          EmptyStateIndicator={() => (
            <EmptyChannelState
              isChannel={isChannel}
              channelName={channelOrUserId}
              userName={dmPartner?.name}
            />
          )}
        >
          <div className="flex flex-col h-full w-full">

            {/* ════════════════════════════════
                SLACK-STYLE HEADER
            ════════════════════════════════ */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-5"
              style={{ height: 56, borderBottom: "1px solid #E8E8E8", background: "#FFFFFF" }}
            >
              {/* Left: Channel name + subtitle */}
              <button
                className="flex flex-col items-start hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors min-w-0"
                onClick={() => setShowInfo(true)}
              >
                <div className="flex items-center gap-1.5">
                  {isChannel && (
                    <HashIcon className="size-5 text-gray-700 flex-shrink-0" strokeWidth={2.5} />
                  )}
                  <span className="font-bold text-[16px] text-gray-900 leading-tight truncate">
                    {displayName}
                  </span>
                </div>
                {isChannel && (
                  <span className="text-[12px] text-gray-500 leading-tight">
                    {memberCount} members
                  </span>
                )}
                {!isChannel && dmPartner && (
                  <span className="text-[12px] font-medium leading-tight" style={{ color: "#007A5A" }}>
                    ● online
                  </span>
                )}
              </button>

              {/* Right: stacked avatars + action icons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">

                {/* Stacked member avatars (channel only) */}
                {isChannel && headerMembers.length > 0 && (
                  <button
                    onClick={() => setShowMembers(true)}
                    className="flex items-center hover:opacity-80 transition-opacity mr-1"
                    title="View members"
                  >
                    <div className="flex -space-x-2">
                      {headerMembers.map((m, i) => (
                        <Avatar
                          key={m.user_id || i}
                          src={getUserImage(m.user_id) || m.user?.image}
                          name={m.user?.name}
                          size="w-7 h-7"
                          className="border-2 border-white"
                          style={{ zIndex: headerMembers.length - i }}
                        />
                      ))}
                    </div>
                    {extraCount > 0 && (
                      <span className="text-[12px] font-semibold ml-1.5" style={{ color: "#1264A3" }}>
                        +{extraCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Active call pill */}
                {isCallActive ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold bg-red-50 text-red-600 border border-red-200">
                    <span className="tabular-nums">
                      {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}
                    </span>
                    <button onClick={() => { setIsCallActive(false); setCallDuration(0); }}>
                      <XIcon className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    title="Start video call"
                    onClick={() => {
                      setCallId(`call-${channelOrUserId}-${Date.now()}`);
                      setShowVideoCall(true);
                      setIsCallActive(true);
                    }}
                    className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
                    style={{ color: "#616061" }}
                  >
                    <VideoIcon className="size-[18px]" />
                  </button>
                )}

                {/* Search */}
                <button
                  title="Search (Ctrl+F)"
                  onClick={() => setShowSearch((v) => !v)}
                  className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
                  style={{ color: "#616061" }}
                >
                  <SearchIcon className="size-[18px]" />
                </button>

                {/* Members (channel) */}
                {isChannel && (
                  <button
                    title="Members"
                    onClick={() => setShowMembers(true)}
                    className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
                    style={{ color: "#616061" }}
                  >
                    <UsersIcon className="size-[18px]" />
                  </button>
                )}

                {/* More */}
                <button
                  title="More options"
                  onClick={() => setShowInfo(true)}
                  className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
                  style={{ color: "#616061" }}
                >
                  <MoreVerticalIcon className="size-[18px]" />
                </button>
              </div>
            </div>

            {/* ════════════════════════════════
                SEARCH BAR (below header)
            ════════════════════════════════ */}
            {showSearch && (
              <div style={{ borderBottom: "1px solid #E8E8E8" }}>
                <MessageSearch
                  channel={channel}
                  onClose={() => setShowSearch(false)}
                  onMessageSelect={(msg) => {
                    const el = document.querySelector(`[data-message-id="${msg.id}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("highlight-message");
                      setTimeout(() => el.classList.remove("highlight-message"), 2000);
                    }
                  }}
                />
              </div>
            )}

            {/* ════════════════════════════════
                MESSAGES + INPUT
            ════════════════════════════════ */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Window>
                  <MessageList
                    Message={SlackMessage}
                    messageActions={["edit", "delete", "reply", "react", "quote"]}
                    messageLimit={50}
                    hideDeletedMessages
                    disableDateSeparator={false}
                  />


                  <div style={{ padding: "0 20px 2px" }}>
                    <TypingIndicator />
                  </div>

                  <MessageInput
                    focus
                    grow
                    maxRows={6}
                    additionalTextareaProps={{
                      placeholder: isChannel
                        ? `Message #${displayName}…`
                        : `Message ${displayName}…`,
                    }}
                  />
                </Window>
              </div>

              {/* Thread panel — uses SlackMessage for visual consistency */}
              <Thread Message={SlackMessage} autoFocus />
            </div>

          </div>
        </Channel>
      </Chat>

      {/* ── Modals & Panels ── */}
      <ChannelMembersPanel channel={channel} isOpen={showMembers} onClose={() => setShowMembers(false)} />
      <ChannelInfoPanel channel={channel} isChannel={isChannel} isOpen={showInfo} onClose={() => setShowInfo(false)} />
      <VideoCallModal
        isOpen={showVideoCall}
        onClose={() => { setShowVideoCall(false); setIsCallActive(false); setCallDuration(0); }}
        callId={callId}
        token={tokenData?.token}
        user={authUser}
        isInitiator={true}
      />
      <CallLogsPanel
        isOpen={showCallLogs}
        onClose={() => setShowCallLogs(false)}
        onCallBack={() => {
          setCallId(`call-${channelOrUserId}-${Date.now()}`);
          setShowVideoCall(true);
          setIsCallActive(true);
        }}
      />
      {incomingCall && (
        <IncomingCallNotification
          isOpen={!!incomingCall}
          onAccept={() => {
            setCallId(incomingCall.callId);
            setShowVideoCall(true);
            setIsCallActive(true);
            setIncomingCall(null);
          }}
          onDecline={() => {
            const logs = JSON.parse(localStorage.getItem("callLogs") || "[]");
            logs.unshift({
              callId: incomingCall.callId,
              type: incomingCall.type,
              startTime: new Date().toISOString(),
              participants: [incomingCall.callerName],
              status: "missed",
            });
            localStorage.setItem("callLogs", JSON.stringify(logs));
            setIncomingCall(null);
            toast.error("Call declined");
          }}
          callerName={incomingCall.callerName}
          callerImage={incomingCall.callerImage}
          callType={incomingCall.type}
        />
      )}
    </div>
  );
};

export default FullScreenChatPage;
