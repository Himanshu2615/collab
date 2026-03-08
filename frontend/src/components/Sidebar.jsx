import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import useLogout from "../hooks/useLogout";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getMyOrganization, getUserFriends } from "../lib/api";
import { useStreamContext } from "../context/StreamContext";
import {
  BellIcon,
  BellOffIcon,
  FileTextIcon,
  HashIcon,
  LayoutDashboardIcon,
  LockIcon,
  LogOutIcon,
  PinIcon,
  PlusIcon,
  SettingsIcon,
  ShipWheelIcon,
  VideoIcon,
  UsersIcon,
} from "lucide-react";
import Avatar from "./Avatar";
import ContactCard from "./ContactCard";

/* ── tiny helpers ── */
const SectionLabel = ({ label, action }) => (
  <div className="flex items-center justify-between px-3 pt-4 pb-1">
    <span className="text-[11px] font-bold uppercase tracking-widest text-base-content/40 select-none">
      {label}
    </span>
    {action}
  </div>
);

const ChannelItem = ({ to, name, isPrivate, currentPath }) => {
  const active = currentPath === to || currentPath.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 mx-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? "bg-primary text-primary-content font-semibold"
          : "text-base-content/65 hover:bg-base-content/8 hover:text-base-content"
      }`}
    >
      {isPrivate
        ? <LockIcon className={`size-3.5 flex-shrink-0 ${active ? "opacity-80" : "text-base-content/40"}`} />
        : <HashIcon  className={`size-3.5 flex-shrink-0 ${active ? "opacity-80" : "text-base-content/40"}`} />
      }
      <span className="truncate">{name}</span>
    </Link>
  );
};

/* ── Context menu (portal) ── */
const DmContextMenu = ({ x, y, pinned, muted, onPin, onToggleMute, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown",   esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown",   esc);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="bg-base-100 border border-base-300 rounded-lg shadow-xl py-1 min-w-44 text-sm"
    >
      <button
        onClick={onPin}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-base-200 transition-colors text-left"
      >
        <PinIcon className="size-3.5 text-base-content/50" />
        {pinned ? "Unpin Chat" : "Pin to Top"}
      </button>
      <button
        onClick={onToggleMute}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-base-200 transition-colors text-left"
      >
        {muted
          ? <><BellIcon className="size-3.5 text-success" /> Unmute Notifications</>
          : <><BellOffIcon className="size-3.5 text-base-content/50" /> Mute Notifications</>}
      </button>
    </div>,
    document.body
  );
};

const DmItem = ({ to, user, currentPath, onAvatarClick, unread, lastMsg, pinned, muted, onTogglePin, onToggleMute }) => {
  const active = currentPath === to || currentPath.startsWith(to + "/");
  const [menu, setMenu] = useState(null); // { x, y } or null

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        className={`group flex items-center gap-2 mx-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          active
            ? "bg-primary text-primary-content font-semibold"
            : "text-base-content/65 hover:bg-base-content/8 hover:text-base-content"
        }`}
      >
        {/* Avatar — opens contact card */}
        <button
          onClick={(e) => { e.preventDefault(); onAvatarClick(user); }}
          className="relative flex-shrink-0 focus:outline-none group/av"
          title="View profile"
        >
          <Avatar
            src={user.profilePic}
            name={user.fullName}
            size="w-5 h-5"
            rounded="rounded-full"
            className="group-hover/av:ring-2 group-hover/av:ring-primary transition"
          />
          <span className="absolute -bottom-px -right-px w-2 h-2 bg-success border border-base-100 rounded-full" />
        </button>

        {/* Name + meta — navigates to DM */}
        <Link to={to} className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate flex-1">{user.fullName}</span>
            {pinned && (
              <PinIcon className={`size-3 flex-shrink-0 ${active ? "opacity-60" : "text-base-content/30"}`} />
            )}
            {muted && (
              <BellOffIcon className={`size-3 flex-shrink-0 ${active ? "opacity-60" : "text-base-content/30"}`} />
            )}
            {unread > 0 && (
              <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-primary text-primary-content rounded-full text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          {lastMsg && (
            <p className={`text-[10px] truncate mt-0.5 ${
              active ? "text-primary-content/70" : "text-base-content/40"
            } ${unread > 0 ? "font-semibold" : ""}`}>
              {lastMsg}
            </p>
          )}
        </Link>

        {/* Hover pin button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(); }}
          title={pinned ? "Unpin" : "Pin to top"}
          className={`flex-shrink-0 p-0.5 rounded transition-all ${
            pinned
              ? `${active ? "opacity-60" : "opacity-40 text-primary"}`
              : "opacity-0 group-hover:opacity-40 hover:!opacity-80"
          } hover:bg-base-content/10`}
        >
          <PinIcon className="size-3" />
        </button>
      </div>

      {menu && (
        <DmContextMenu
          x={menu.x}
          y={menu.y}
          pinned={pinned}
          muted={muted}
          onPin={() => { onTogglePin(); setMenu(null); }}
          onToggleMute={() => { onToggleMute(); setMenu(null); }}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
};

const AppItem = ({ to, icon: Icon, label, currentPath }) => {
  const active = currentPath === to || currentPath.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 mx-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? "bg-primary text-primary-content font-semibold"
          : "text-base-content/65 hover:bg-base-content/8 hover:text-base-content"
      }`}
    >
      <Icon className={`size-4 flex-shrink-0 ${active ? "opacity-80" : "text-base-content/40"}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
};

/* ════════════════════════════════════════════ */
const Sidebar = () => {
  const { authUser }    = useAuthUser();
  const { logoutMutation } = useLogout();
  const { pathname }    = useLocation();
  const [contactCardUser, setContactCardUser] = useState(null);

  /* Stream DM metadata */
  const { dmMeta, notifPermission, requestNotifPermission, isMessageMuted, toggleNotificationMute } = useStreamContext();

  /* Pinned DM user IDs — persisted in localStorage */
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("collab_pinned_dms") || "[]"); }
    catch { return []; }
  });

  const togglePin = (userId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [userId, ...prev];
      localStorage.setItem("collab_pinned_dms", JSON.stringify(next));
      return next;
    });
  };

  const { data: orgData } = useQuery({
    queryKey:  ["myOrganization"],
    queryFn:   getMyOrganization,
    enabled:   !!authUser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: friends = [] } = useQuery({
    queryKey:  ["friends"],
    queryFn:   getUserFriends,
    enabled:   !!authUser,
    staleTime: 60_000,
  });

  const org      = orgData?.organization;
  const channels = org?.channels || [];
  const isAdmin  = ["admin", "owner"].includes(authUser?.role);

  /* Build unified DM contacts list: friends + non-friend message partners */
  const friendIds = new Set(friends.map(f => f._id));
  
  /* Create virtual user objects for non-friend DM partners */
  const nonFriendDmPartners = Object.entries(dmMeta)
    .filter(([partnerId]) => !friendIds.has(partnerId))
    .map(([partnerId, meta]) => ({
      _id: partnerId,
      fullName: meta.partnerName || "Unknown",
      profilePic: meta.partnerImage || "",
      _isFromStream: true, // Flag to identify virtual users
    }));
  
  /* Combine friends with non-friend DM partners */
  const allDmContacts = [...friends, ...nonFriendDmPartners];

  /* Sort: pinned first, then by lastMsgAt desc (most recent at top) */
  const sortedContacts = [...allDmContacts].sort((a, b) => {
    const aPinned = pinnedIds.includes(a._id);
    const bPinned = pinnedIds.includes(b._id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    const aTime = dmMeta[a._id]?.lastMsgAt ? new Date(dmMeta[a._id].lastMsgAt).getTime() : 0;
    const bTime = dmMeta[b._id]?.lastMsgAt ? new Date(dmMeta[b._id].lastMsgAt).getTime() : 0;
    return bTime - aTime;
  });

  /* Total unread across all DMs */
  const totalUnread = Object.values(dmMeta).reduce((sum, m) => sum + (m.unread || 0), 0);

  return (
    <aside className="w-52 bg-base-100 border-r border-base-300 hidden lg:flex flex-col h-screen sticky top-0 overflow-hidden">

      {/* ── WORKSPACE HEADER ──────────────────── */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-base-300 flex-shrink-0">
        {/* app icon */}
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
          <ShipWheelIcon className="size-4 text-primary-content" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm leading-tight truncate">
            {org?.name || "Collab"}
          </p>
          {org?.slug && (
            <p className="text-[10px] text-base-content/40 truncate">@{org.slug}</p>
          )}
        </div>
        {/* logout button */}
        <button
          onClick={() => logoutMutation()}
          title="Sign out"
          className="flex-shrink-0 p-1 rounded-md text-base-content/30 hover:text-error hover:bg-error/10 transition-colors"
        >
          <LogOutIcon className="size-3.5" />
        </button>
      </div>

      {/* ── SCROLLABLE BODY ───────────────────── */}
      <div className="flex-1 overflow-y-auto pb-4">

        {/* DASHBOARD */}
        <div className="pt-3 pb-1">
          <AppItem to="/" icon={LayoutDashboardIcon} label="Dashboard" currentPath={pathname} />
        </div>

        {/* CHANNELS */}
        <SectionLabel
          label="Channels"
          action={
            isAdmin && (
              <Link
                to="/admin"
                title="Add channel"
                className="p-0.5 rounded text-base-content/30 hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <PlusIcon className="size-3.5" />
              </Link>
            )
          }
        />
        {channels.length > 0 ? (
          channels.map((ch) => {
            const chPath = `/chat/${org?.slug ? `org-${org.slug}-${ch.name}` : ch.name}`;
            return (
              <ChannelItem
                key={ch._id || ch.name}
                to={chPath}
                name={ch.name}
                isPrivate={ch.isPrivate}
                currentPath={pathname}
              />
            );
          })
        ) : (
          <p className="px-5 py-1 text-xs text-base-content/30 italic">No channels</p>
        )}

        {/* DIRECT MESSAGES */}
        <SectionLabel
          label="Direct Messages"
          action={
            <div className="flex items-center gap-1.5">
              {totalUnread > 0 && (
                <span className="min-w-[18px] h-[18px] bg-primary text-primary-content rounded-full text-[10px] font-bold flex items-center justify-center px-1 leading-none animate-pulse">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
              {/* Browser notification toggle button */}
              {notifPermission !== "unsupported" && (
                notifPermission === "granted" ? (
                  <button
                    title="Browser notifications enabled — click for info"
                    className="p-0.5 rounded text-success hover:bg-success/10 transition-colors"
                    onClick={() =>
                      toast.success(
                        "Browser notifications are on. To disable, click the lock icon in your browser's address bar.",
                        { duration: 5000 }
                      )
                    }
                  >
                    <BellIcon className="size-3.5" />
                  </button>
                ) : notifPermission === "denied" ? (
                  <button
                    title="Notifications blocked — click for help"
                    className="p-0.5 rounded text-error hover:bg-error/10 transition-colors"
                    onClick={async () => {
                      // Try re-requesting — works in Firefox; Chrome will show
                      // the address-bar blocked indicator so user can unblock.
                      const result = await requestNotifPermission();
                      if (result !== "granted") {
                        toast(
                          "Notifications are blocked. Click the 🔒 lock icon in your browser's address bar and set Notifications to 'Allow'.",
                          { duration: 7000, icon: "🔔" }
                        );
                      }
                    }}
                  >
                    <BellOffIcon className="size-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={requestNotifPermission}
                    title="Enable browser notifications"
                    className="p-0.5 rounded text-base-content/30 hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <BellIcon className="size-3.5" />
                  </button>
                )
              )}
              <Link
                to="/friends"
                title="Browse team"
                className="p-0.5 rounded text-base-content/30 hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <PlusIcon className="size-3.5" />
              </Link>
            </div>
          }
        />
        {sortedContacts.length > 0 ? (
        sortedContacts.slice(0, 8).map((contact) => {
            // Compute the DM channel ID (sorted join) so we can read and toggle
            // the per-conversation mute preference.
            const dmChannelId = authUser
              ? [authUser._id, contact._id].sort().join("-")
              : null;
            const isMuted = dmChannelId ? isMessageMuted(dmChannelId) : false;

            return (
              <DmItem
                key={contact._id}
                to={`/chat/${contact._id}`}
                user={contact}
                currentPath={pathname}
                onAvatarClick={setContactCardUser}
                unread={dmMeta[contact._id]?.unread || 0}
                lastMsg={dmMeta[contact._id]?.lastMsg || ""}
                pinned={pinnedIds.includes(contact._id)}
                muted={isMuted}
                onTogglePin={() => togglePin(contact._id)}
                onToggleMute={() => {
                  if (!dmChannelId) return;
                  toggleNotificationMute(dmChannelId, "messages");
                }}
              />
            );
          })
        ) : (
          <p className="px-5 py-1 text-xs text-base-content/30 italic">No contacts yet</p>
        )}
        {sortedContacts.length > 8 && (
          <Link
            to="/friends"
            className="flex items-center mx-2 px-2 py-1.5 text-xs text-base-content/40 hover:text-primary transition-colors"
          >
            +{sortedContacts.length - 8} more…
          </Link>
        )}

        {/* APPS */}
        <SectionLabel label="Apps" />
        <AppItem to="/files"    icon={FileTextIcon} label="Files"          currentPath={pathname} />
        <AppItem to="/friends"  icon={UsersIcon}    label="Team Directory" currentPath={pathname} />
        <AppItem to="/schedule" icon={VideoIcon}    label="Meetings"       currentPath={pathname} />
        {isAdmin && (
          <AppItem to="/admin" icon={SettingsIcon} label="Settings" currentPath={pathname} />
        )}
      </div>

      {/* ── USER FOOTER ──────────────────────── */}
      <div className="flex-shrink-0 border-t border-base-300 px-3 py-2.5">
        <Link
          to="/profile"
          className="flex items-center gap-2.5 rounded-lg hover:bg-base-200 px-1.5 py-1.5 transition-colors group"
        >
          <div className="relative flex-shrink-0">
            <Avatar
              src={authUser?.profilePic}
              name={authUser?.fullName}
              size="w-7 h-7"
              rounded="rounded-full"
            />
            <span className="absolute -bottom-px -right-px w-2.5 h-2.5 bg-success border-2 border-base-100 rounded-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate leading-tight">{authUser?.fullName}</p>
            <p className="text-[10px] text-base-content/40 capitalize truncate">{authUser?.role || "member"}</p>
          </div>
        </Link>
      </div>

      {/* Contact card modal */}
      {contactCardUser && (
        <ContactCard
          user={contactCardUser}
          selfId={authUser?._id}
          onClose={() => setContactCardUser(null)}
        />
      )}
    </aside>
  );
};

export default Sidebar;
