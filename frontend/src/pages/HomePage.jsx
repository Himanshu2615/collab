import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getOutgoingFriendReqs,
  getRecommendedUsers,
  getUserFriends,
  getFriendRequests,
  sendFriendRequest,
} from "../lib/api";
import { Link } from "react-router";
import {
  CheckCircleIcon,
  UserPlusIcon,
  UsersIcon,
  MessageSquareIcon,
  BellIcon,
  ZapIcon,
  SearchIcon,
} from "lucide-react";

import FriendCard from "../components/FriendCard";
import NoFriendsFound from "../components/NoFriendsFound";
import useAuthUser from "../hooks/useAuthUser";
import Avatar from "../components/Avatar";


const HomePage = () => {
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: recommendedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
  });

  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
  });

  const { data: friendRequests } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
  });

  const { mutate: sendRequestMutation, isPending } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] }),
  });

  useEffect(() => {
    const outgoingIds = new Set();
    if (outgoingFriendReqs && outgoingFriendReqs.length > 0) {
      outgoingFriendReqs.forEach((req) => {
        outgoingIds.add(req.recipient._id);
      });
      setOutgoingRequestsIds(outgoingIds);
    }
  }, [outgoingFriendReqs]);

  const pendingRequests = friendRequests?.incomingReqs?.length || 0;

  return (
    <div className="p-4 sm:p-8 space-y-8 bg-base-100 min-h-screen">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Welcome back, {authUser?.fullName.split(" ")[0]}! 👋
          </h1>
          <p className="text-base-content/60 max-w-2xl">
            Here's what's happening in your workspace today. You have{" "}
            <span className="text-primary font-semibold">{friends.length} team member{friends.length !== 1 ? "s" : ""}</span> connected.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/search" className="btn btn-ghost border-base-300">
            <SearchIcon className="size-4 mr-2" />
            Find Anything
          </Link>
          <Link to="/notifications" className="btn btn-primary text-white shadow-lg shadow-primary/20">
            <ZapIcon className="size-4 mr-2" />
            Quick Action
          </Link>
        </div>
      </div>

      {/* STATS OVERVIEW — all real data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          to="/friends"
          className="card bg-base-200 p-6 flex flex-row items-center gap-4 transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <div className="bg-primary/10 p-3 rounded-xl text-primary">
            <UsersIcon className="size-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-base-content/50 uppercase">Team Members</div>
            <div className="text-2xl font-bold">{friends.length}</div>
          </div>
        </Link>

        <Link
          to="/notifications"
          className="card bg-base-200 p-6 flex flex-row items-center gap-4 transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <div className="bg-secondary/10 p-3 rounded-xl text-secondary">
            <BellIcon className="size-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-base-content/50 uppercase">Pending Requests</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              {pendingRequests}
              {pendingRequests > 0 && (
                <span className="badge badge-secondary badge-sm animate-pulse">New</span>
              )}
            </div>
          </div>
        </Link>

        <div className="card bg-base-200 p-6 flex flex-row items-center gap-4 transition-transform hover:scale-[1.02] cursor-default">
          <div className="bg-accent/10 p-3 rounded-xl text-accent">
            <MessageSquareIcon className="size-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-base-content/50 uppercase">Suggested Contacts</div>
            <div className="text-2xl font-bold">{recommendedUsers.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* TEAM MEMBERS SECTION */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <UsersIcon className="size-6 text-primary" />
              Your Team
            </h2>
            <Link to="/friends" className="btn btn-link btn-sm text-primary no-underline hover:underline">
              View all members
            </Link>
          </div>

          {loadingFriends ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : friends.length === 0 ? (
            <NoFriendsFound />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.slice(0, 6).map((friend) => (
                <FriendCard key={friend._id} friend={friend} />
              ))}
            </div>
          )}
        </div>

        {/* RECENT ACTIVITY & RECOMMENDED */}
        <div className="space-y-8">
          <section className="bg-base-200 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <ZapIcon className="size-5 text-secondary" />
              Suggested Partners
            </h3>
            {loadingUsers ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md text-secondary" />
              </div>
            ) : recommendedUsers.length === 0 ? (
              <p className="text-base-content/50 text-center py-4">No suggestions yet</p>
            ) : (
              <div className="space-y-4">
                {recommendedUsers.slice(0, 4).map((user) => (
                  <div key={user._id} className="flex items-center justify-between bg-base-100 p-3 rounded-xl border border-base-300">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={user.profilePic}
                        name={user.fullName}
                        size="w-10 h-10"
                      />

                      <div>
                        <div className="font-bold text-sm truncate w-24">{user.fullName}</div>
                        <div className="text-xs opacity-50 capitalize">{user.nativeLanguage || "Unknown"}</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm btn-circle"
                      onClick={() => sendRequestMutation(user._id)}
                      disabled={outgoingRequestsIds.has(user._id) || isPending}
                      title={outgoingRequestsIds.has(user._id) ? "Request sent" : "Send friend request"}
                    >
                      {outgoingRequestsIds.has(user._id) ? (
                        <CheckCircleIcon className="size-5 text-success" />
                      ) : (
                        <UserPlusIcon className="size-5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Link to="/notifications" className="btn btn-outline btn-block mt-6 border-base-300">
              Manage Connection Requests
            </Link>
          </section>

          <section className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
            <h3 className="text-xl font-bold mb-4">💡 Workspace Tip</h3>
            <p className="text-sm text-base-content/70 mb-4">
              Use message threading to keep conversations organized and easy to follow. Click on any message to start a thread!
            </p>
            <Link to="/chat/general" className="btn btn-primary btn-sm btn-block">Open a Chat</Link>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
