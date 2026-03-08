import { Link, useNavigate } from "react-router";
import { useRef, useState, useEffect } from "react";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getFriendRequests } from "../lib/api";
import useDashboardSummary from "../hooks/useDashboardSummary";
import { BellIcon, LogOutIcon, SearchIcon, SettingsIcon, UserIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import useLogout from "../hooks/useLogout";
import Avatar from "./Avatar";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const navigate = useNavigate();
  const { logoutMutation } = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: dashboardData } = useDashboardSummary();

  const { data: friendRequestsData } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    enabled: !!authUser && !dashboardData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const incomingCount = dashboardData?.incomingReqs?.length ?? friendRequestsData?.incomingReqs?.length ?? 0;

  const handleSearchKey = (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
      e.target.value = "";
    }
  };

  return (
    <nav className="bg-base-100 border-b border-base-300 sticky top-0 z-30 h-12 flex items-center px-4 sm:px-6">
      <div className="flex items-center justify-between w-full max-w-[1600px] mx-auto">
        {/* SEARCH BAR */}
        <div className="flex items-center gap-4 flex-1">
          <div className="hidden md:flex items-center bg-base-200 rounded-lg px-3 py-1.5 w-full max-w-md border border-base-300 focus-within:border-primary transition-colors">
            <SearchIcon className="size-4 text-base-content/50 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search workspace…"
              className="bg-transparent border-none outline-none focus:ring-0 text-sm ml-2 w-full"
              onKeyDown={handleSearchKey}
              onFocus={(e) => e.currentTarget.select()}
            />
            <span className="text-[10px] bg-base-300 px-1.5 py-0.5 rounded text-base-content/50 font-mono whitespace-nowrap">
              ↵ Enter
            </span>
          </div>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notification bell with real badge */}
          <Link to="/notifications" className="relative">
            <button className="btn btn-ghost btn-sm btn-circle">
              <BellIcon className="h-5 w-5 text-base-content/70" />
              {incomingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-base-100 leading-none">
                  {incomingCount > 9 ? "9+" : incomingCount}
                </span>
              )}
            </button>
          </Link>

          {/* Settings (Admin panel) */}
          <Link to="/admin">
            <button className="btn btn-ghost btn-sm btn-circle">
              <SettingsIcon className="h-5 w-5 text-base-content/70" />
            </button>
          </Link>

          <div className="divider divider-horizontal mx-0 h-6 self-center" />

          <ThemeSelector />

          {/* User avatar dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="btn btn-ghost btn-circle p-0 hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <Avatar src={authUser?.profilePic} name={authUser?.fullName} size="w-9 h-9" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 py-1.5 text-sm">
                {/* User info header */}
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <Avatar src={authUser?.profilePic} name={authUser?.fullName} size="w-9 h-9" rounded="rounded-full" />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{authUser?.fullName}</p>
                    <p className="text-[11px] text-base-content/50 capitalize truncate">{authUser?.role || "member"}</p>
                  </div>
                </div>

                <div className="border-t border-base-200 my-1" />
                <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-base-content/40">Account</p>

                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-base-200 transition-colors text-base-content"
                >
                  <UserIcon className="size-4 text-base-content/50" /> Edit Profile
                </Link>
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-base-200 transition-colors text-base-content"
                >
                  <SettingsIcon className="size-4 text-base-content/50" /> Admin Panel
                </Link>

                <div className="border-t border-base-200 my-1" />
                <button
                  onClick={() => { setMenuOpen(false); logoutMutation(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-error/10 text-error transition-colors"
                >
                  <LogOutIcon className="size-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
