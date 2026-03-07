import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import useLogout from "../hooks/useLogout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyOrganization, getUserFriends } from "../lib/api";
import {
  FileTextIcon,
  HashIcon,
  LockIcon,
  LogOutIcon,
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

const DmItem = ({ to, user, currentPath, onAvatarClick }) => {
  const active = currentPath === to || currentPath.startsWith(to + "/");
  return (
    <div
      className={`flex items-center gap-2.5 mx-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
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
      {/* Name — navigates to DM */}
      <Link to={to} className="truncate flex-1">{user.fullName}</Link>
    </div>
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
            <Link
              to="/friends"
              title="Browse team"
              className="p-0.5 rounded text-base-content/30 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <PlusIcon className="size-3.5" />
            </Link>
          }
        />
        {friends.length > 0 ? (
          friends.slice(0, 8).map((friend) => (
            <DmItem
              key={friend._id}
              to={`/chat/${friend._id}`}
              user={friend}
              currentPath={pathname}
              onAvatarClick={setContactCardUser}
            />
          ))
        ) : (
          <p className="px-5 py-1 text-xs text-base-content/30 italic">No contacts yet</p>
        )}
        {friends.length > 8 && (
          <Link
            to="/friends"
            className="flex items-center mx-2 px-2 py-1.5 text-xs text-base-content/40 hover:text-primary transition-colors"
          >
            +{friends.length - 8} more…
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
