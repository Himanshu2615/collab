import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { Link } from "react-router";
import { getStreamToken } from "../lib/api";
import useAuthUser from "../hooks/useAuthUser";
import Avatar from "../components/Avatar";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;
const StreamContext = createContext(null);

/* ── Message toast ─────────────────────────────── */
const MsgToast = ({ t, avatar, senderName, text, partnerId }) => (
  <Link
    to={`/chat/${partnerId}`}
    onClick={() => toast.dismiss(t.id)}
    className={`flex items-start gap-3 bg-base-100 border border-base-300 shadow-xl rounded-xl px-4 py-3 w-72 cursor-pointer transition-all ${
      t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    }`}
  >
    <Avatar
      src={avatar}
      name={senderName}
      size="w-9 h-9"
      rounded="rounded-full"
      className="flex-shrink-0 mt-0.5"
    />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold leading-tight">{senderName}</p>
      <p className="text-xs text-base-content/60 truncate mt-0.5">{text}</p>
      <p className="text-[10px] text-primary mt-1">Click to reply →</p>
    </div>
  </Link>
);

/* ── helpers ────────────────────────────────────── */
const extractPartnerId = (channelId, selfId) => {
  if (!channelId || !selfId) return null;
  // Channel IDs are `[id1, id2].sort().join("-")`. Both IDs are 24-char hex
  // with no internal dashes, so a single "-" separates them.
  const idx = channelId.indexOf("-");
  if (idx === -1) return null;
  const a = channelId.slice(0, idx);
  const b = channelId.slice(idx + 1);
  return a === selfId ? b : a;
};

const msgPreview = (message) => {
  if (!message) return "";
  if (message.text) return message.text;
  if (message.attachments && message.attachments.length) return "📎 Attachment";
  return "";
};

/* ════════════════════════════════════════════════ */
export const StreamProvider = ({ children }) => {
  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn:  getStreamToken,
    enabled:  !!authUser,
  });

  /* dmMeta: { [partnerUserId]: { unread, lastMsg, lastMsgAt, lastMsgSenderId, channelId } } */
  const [dmMeta, setDmMeta] = useState({});
  const cleanupRef = useRef(null);
  /* Keep a stable ref to authUser._id for use inside event callbacks */
  const selfIdRef = useRef(null);
  useEffect(() => { selfIdRef.current = authUser?._id ?? null; }, [authUser]);

  useEffect(() => {
    if (!tokenData?.token || !authUser) return;
    let isMounted = true;

    const setup = async () => {
      try {
        const client = StreamChat.getInstance(STREAM_API_KEY);

        /* Connect only once */
        if (client.userID !== authUser._id) {
          const img = authUser.profilePic?.startsWith("data:")
            ? "" : authUser.profilePic || "";
          await client.connectUser(
            { id: authUser._id, name: authUser.fullName, image: img },
            tokenData.token
          );
        }

        if (!isMounted) return;

        /* ── seed dmMeta from existing channels ──────── */
        try {
          const channels = await client.queryChannels(
            { type: "messaging", members: { $in: [authUser._id] } },
            [{ last_message_at: -1 }],
            { watch: true, state: true, limit: 30, message_limit: 1 }
          );

          if (isMounted) {
            const meta = {};
            for (const ch of channels) {
              const partnerId = extractPartnerId(ch.id, authUser._id);
              if (!partnerId) continue;
              /* ch.lastMessage() is the official SDK helper */
              const last = typeof ch.lastMessage === "function"
                ? ch.lastMessage()
                : ch.state.messages[ch.state.messages.length - 1];
              meta[partnerId] = {
                channelId:       ch.id,
                unread:          ch.countUnread() || 0,
                lastMsg:         msgPreview(last),
                lastMsgAt:       last?.created_at || ch.data?.last_message_at || null,
                lastMsgSenderId: last?.user?.id || null,
              };
            }
            setDmMeta(meta);
          }
        } catch (qErr) {
          console.warn("[StreamContext] queryChannels failed:", qErr);
        }

        /* ── shared handler ──────────────────────────── */
        const handleMsg = (channelId, sender, message, notif = false) => {
          const selfId    = selfIdRef.current;
          const partnerId = extractPartnerId(channelId, selfId);
          if (!partnerId) return;

          const isFromSelf   = sender?.id === selfId;
          const isActiveChat = window.location.pathname.includes(partnerId);

          /* Toast only for incoming messages when not on that chat */
          if (!isFromSelf && !isActiveChat) {
            const senderName = sender?.name || "Someone";
            const txt = msgPreview(message) || "New message";
            toast.custom(
              (t) => (
                <MsgToast
                  t={t}
                  avatar={sender?.image}
                  senderName={senderName}
                  text={txt}
                  partnerId={partnerId}
                />
              ),
              { duration: 4500, position: "bottom-right", id: `dm-${channelId}` }
            );
          }

          setDmMeta((prev) => ({
            ...prev,
            [partnerId]: {
              channelId,
              unread:
                isActiveChat || isFromSelf
                  ? (prev[partnerId]?.unread ?? 0)
                  : (prev[partnerId]?.unread ?? 0) + 1,
              lastMsg:         msgPreview(message),
              lastMsgAt:       message?.created_at || new Date().toISOString(),
              lastMsgSenderId: sender?.id || null,
            },
          }));
        };

        /* ── message.new  (watched channels) ─────────── */
        const onMessageNew = (event) => {
          if (event.channel_type !== "messaging") return;
          handleMsg(event.channel_id, event.user, event.message, false);
        };

        /* ── notification.message_new  (un-watched / brand-new channels) ── */
        const onNotificationMessageNew = (event) => {
          if (event.channel_type !== "messaging") return;
          /* event.message.user is the sender in notification events */
          const sender = event.message?.user || event.user;
          handleMsg(event.channel_id, sender, event.message, true);
        };

        /* ── read receipts → reset unread ────────────── */
        const onMarkRead = (event) => {
          if (event.channel_type !== "messaging") return;
          const partnerId = extractPartnerId(
            event.channel_id, selfIdRef.current
          );
          if (partnerId) {
            setDmMeta((prev) => ({
              ...prev,
              [partnerId]: { ...(prev[partnerId] || {}), unread: 0 },
            }));
          }
        };

        client.on("message.new",               onMessageNew);
        client.on("notification.message_new",  onNotificationMessageNew);
        client.on("message.read",              onMarkRead);
        client.on("notification.mark_read",    onMarkRead);

        cleanupRef.current = () => {
          client.off("message.new",               onMessageNew);
          client.off("notification.message_new",  onNotificationMessageNew);
          client.off("message.read",              onMarkRead);
          client.off("notification.mark_read",    onMarkRead);
        };
      } catch (err) {
        console.error("[StreamContext] setup error:", err);
      }
    };

    setup();

    return () => {
      isMounted = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [tokenData, authUser]);

  const markAsRead = useCallback((partnerId) => {
    setDmMeta((prev) => ({
      ...prev,
      [partnerId]: { ...(prev[partnerId] || {}), unread: 0 },
    }));
  }, []);

  return (
    <StreamContext.Provider value={{ dmMeta, markAsRead }}>
      {children}
    </StreamContext.Provider>
  );
};

export const useStreamContext = () =>
  useContext(StreamContext) ?? { dmMeta: {}, markAsRead: () => {} };

