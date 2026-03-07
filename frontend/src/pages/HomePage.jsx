import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  CalendarIcon,
  FileTextIcon,
  UsersIcon,
  BellIcon,
  VideoIcon,
  ClockIcon,
  HashIcon,
  ChevronRightIcon,
} from "lucide-react";
import { getMeetings, getFiles, getOrgMembers, getFriendRequests } from "../lib/api";
import useAuthUser from "../hooks/useAuthUser";
import Avatar from "../components/Avatar";

/* ── helpers ───────────────────────────────── */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const todayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtRelative = (d) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getFileLabel = (name = "") => {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf")                                           return { label: "PDF",  cls: "bg-red-500/15    text-red-500"    };
  if (["doc", "docx"].includes(ext))                         return { label: "DOC",  cls: "bg-blue-500/15   text-blue-600"   };
  if (["xls", "xlsx"].includes(ext))                         return { label: "XLS",  cls: "bg-green-500/15  text-green-600"  };
  if (["ppt", "pptx"].includes(ext))                         return { label: "PPT",  cls: "bg-orange-500/15 text-orange-500" };
  if (["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return { label: "IMG",  cls: "bg-purple-500/15 text-purple-500" };
  return { label: "FILE", cls: "bg-base-content/10 text-base-content/50" };
};

const isMeetingNow = (m) => {
  const start = new Date(m.startTime).getTime();
  const end   = start + (m.duration || 60) * 60_000;
  const now   = Date.now();
  return now >= start && now <= end;
};

/* ── Card wrapper ────────────────────────── */
const Card = ({ title, icon: Icon, action, children, className = "" }) => (
  <div className={`bg-base-100 border border-base-300 rounded-xl overflow-hidden flex flex-col ${className}`}>
    <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 flex-shrink-0">
      <div className="flex items-center gap-2 font-semibold text-sm">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      {action}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);


/* ════════════════════════════════════════════ */
const HomePage = () => {
  const { authUser } = useAuthUser();
  const firstName = authUser?.fullName?.split(" ")[0] ?? "there";

  /* Today's meetings */
  const { data: todayMeetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ["meetings", "today"],
    queryFn:  () => getMeetings({ from: todayStart(), to: todayEnd() }),
    staleTime: 60_000,
  });

  /* Recent files */
  const { data: filesData = [], isLoading: loadingFiles } = useQuery({
    queryKey: ["files"],
    queryFn:  getFiles,
    staleTime: 30_000,
  });
  const recentFiles = [...filesData]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);

  /* Team members */
  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: ["orgMembers"],
    queryFn:  getOrgMembers,
    staleTime: 60_000,
  });
  const members = (membersData?.members ?? []).slice(0, 6);

  /* Notifications */
  const { data: friendRequests, isLoading: loadingNotifs } = useQuery({
    queryKey: ["friendRequests"],
    queryFn:  getFriendRequests,
    staleTime: 30_000,
  });
  const incomingReqs  = friendRequests?.incomingReqs ?? [];
  const acceptedReqs  = friendRequests?.acceptedReqs ?? [];
  const notifications = [
    ...incomingReqs.map((r) => ({ ...r, _ntype: "request"  })),
    ...acceptedReqs.map((r) => ({ ...r, _ntype: "accepted" })),
  ].slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto bg-base-200 min-h-screen">

      {/* ── Top bar ─────────────────────────── */}
      <div className="sticky top-0 z-10 bg-base-100 border-b border-base-300 px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-tight">Dashboard Overview</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/50 hidden sm:block">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </span>
          <Link to="/notifications" className="relative p-1.5 rounded-lg hover:bg-base-200 transition-colors">
            <BellIcon className="size-4 text-base-content/50" />
            {incomingReqs.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-error rounded-full" />
            )}
          </Link>
          <Link to="/profile" className="flex-shrink-0">
            <Avatar
              src={authUser?.profilePic}
              name={authUser?.fullName}
              size="w-7 h-7"
              rounded="rounded-full"
            />
          </Link>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* ── Greeting banner ─────────────────── */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl px-5 py-4">
          <h2 className="text-xl font-bold">
            {getGreeting()}, {firstName} 👋
          </h2>
          <p className="text-sm text-base-content/60 mt-0.5">
            {todayMeetings.length > 0
              ? `You have ${todayMeetings.length} meeting${todayMeetings.length > 1 ? "s" : ""} scheduled today.`
              : "No meetings today — great time to focus!"}
          </p>
        </div>

        {/* ── 3-col grid ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Today's Schedule (2/3 wide) ─────── */}
          <Card
            title="Today's Schedule"
            icon={CalendarIcon}
            className="lg:col-span-2"
            action={
              <Link to="/schedule" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                View all <ChevronRightIcon className="size-3" />
              </Link>
            }
          >
            {loadingMeetings ? (
              <div className="flex justify-center py-10">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : todayMeetings.length === 0 ? (
              <div className="py-10 text-center text-base-content/40 text-sm">
                <CalendarIcon className="size-8 mx-auto mb-2 opacity-30" />
                No meetings scheduled for today
              </div>
            ) : (
              <ul className="divide-y divide-base-200">
                {todayMeetings.map((m) => {
                  const active = isMeetingNow(m);
                  return (
                    <li
                      key={m._id}
                      className={`flex items-center gap-3 px-4 py-3 ${active ? "bg-primary/5" : ""}`}
                    >
                      <div
                        className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                          active ? "bg-primary" : "bg-base-300"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{m.title}</p>
                          {active && (
                            <span className="badge badge-primary badge-xs">Live</span>
                          )}
                        </div>
                        <p className="text-xs text-base-content/50 flex items-center gap-1 mt-0.5 flex-wrap">
                          <ClockIcon className="size-3 flex-shrink-0" />
                          {fmtTime(m.startTime)} · {m.duration || 60} min
                          {m.channel && (
                            <span className="flex items-center gap-0.5 ml-1">
                              <HashIcon className="size-3" />{m.channel}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Participant avatars */}
                      {m.participants?.length > 0 && (
                        <div className="hidden sm:flex -space-x-1.5 flex-shrink-0">
                          {m.participants.slice(0, 3).map((p, i) => (
                            <Avatar
                              key={i}
                              src={p?.profilePic ?? p}
                              name={p?.fullName ?? String(p)}
                              size="w-6 h-6"
                              rounded="rounded-full"
                              className="ring-1 ring-base-100"
                            />
                          ))}
                          {m.participants.length > 3 && (
                            <span className="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center text-[10px] font-bold ring-1 ring-base-100">
                              +{m.participants.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {active && m.meetingLink && (
                        <a
                          href={m.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-xs gap-1 flex-shrink-0"
                        >
                          <VideoIcon className="size-3" /> Join
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ── Recent Files (1/3 wide) ──────────── */}
          <Card
            title="Recent Files"
            icon={FileTextIcon}
            action={
              <Link to="/files" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Browse <ChevronRightIcon className="size-3" />
              </Link>
            }
          >
            {loadingFiles ? (
              <div className="flex justify-center py-10">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : recentFiles.length === 0 ? (
              <div className="py-10 text-center text-base-content/40 text-sm">
                <FileTextIcon className="size-8 mx-auto mb-2 opacity-30" />
                No files uploaded yet
              </div>
            ) : (
              <ul className="divide-y divide-base-200">
                {recentFiles.map((f) => {
                  const { label, cls } = getFileLabel(f.name);
                  return (
                    <li key={f._id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${cls}`}
                      >
                        {label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-base-content/40">{fmtRelative(f.updatedAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ── What's New (2/3 wide) ─────────────── */}
          <Card
            title="What's New"
            icon={BellIcon}
            className="lg:col-span-2"
            action={
              <Link to="/notifications" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                See all <ChevronRightIcon className="size-3" />
              </Link>
            }
          >
            {loadingNotifs ? (
              <div className="flex justify-center py-10">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-base-content/40 text-sm">
                <BellIcon className="size-8 mx-auto mb-2 opacity-30" />
                You're all caught up!
              </div>
            ) : (
              <ul className="divide-y divide-base-200">
                {notifications.map((n) => {
                  const isAccepted = n._ntype === "accepted";
                  const user = isAccepted ? (n.sender ?? n.recipient) : n.sender;
                  return (
                    <li key={n._id} className="flex items-start gap-3 px-4 py-3">
                      <Avatar
                        src={user?.profilePic}
                        name={user?.fullName}
                        size="w-8 h-8"
                        rounded="rounded-full"
                        className="flex-shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{user?.fullName}</p>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isAccepted
                                ? "bg-green-500/15 text-green-600"
                                : "bg-primary/15 text-primary"
                            }`}
                          >
                            {isAccepted ? "Connected" : "Invite"}
                          </span>
                        </div>
                        <p className="text-xs text-base-content/50 mt-0.5">
                          {isAccepted
                            ? `${user?.fullName} accepted your connection request`
                            : `${user?.fullName} wants to connect with you`}
                        </p>
                      </div>
                      {!isAccepted && (
                        <Link
                          to="/notifications"
                          className="btn btn-primary btn-xs mt-1 flex-shrink-0"
                        >
                          Respond
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ── Team Status (1/3 wide) ─────────────── */}
          <Card
            title="Team Status"
            icon={UsersIcon}
            action={
              <Link to="/friends" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Directory <ChevronRightIcon className="size-3" />
              </Link>
            }
          >
            {loadingMembers ? (
              <div className="flex justify-center py-10">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : members.length === 0 ? (
              <div className="py-10 text-center text-base-content/40 text-sm">
                <UsersIcon className="size-8 mx-auto mb-2 opacity-30" />
                No team members yet
              </div>
            ) : (
              <ul className="divide-y divide-base-200">
                {members.map((m) => {
                  const inMeeting = todayMeetings.some(
                    (mt) =>
                      isMeetingNow(mt) &&
                      mt.participants?.some?.((p) => p?._id === m._id || p === m._id)
                  );
                  return (
                    <li key={m._id} className="flex items-center gap-3 px-4 py-3">
                      <div className="relative flex-shrink-0">
                        <Avatar
                          src={m.profilePic}
                          name={m.fullName}
                          size="w-8 h-8"
                          rounded="rounded-full"
                        />
                        <span
                          className={`absolute -bottom-px -right-px w-2.5 h-2.5 border-2 border-base-100 rounded-full ${
                            inMeeting ? "bg-primary" : "bg-success"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.fullName}</p>
                        <p className="text-xs text-base-content/40 capitalize truncate">
                          {m.role || "member"}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${
                          inMeeting
                            ? "bg-primary/15 text-primary"
                            : "bg-success/15 text-success"
                        }`}
                      >
                        {inMeeting ? "In Meeting" : "Active"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

        </div>
      </div>
    </div>
  );



};


export default HomePage;
