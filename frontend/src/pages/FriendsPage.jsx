import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrgMembers, getUserFriends, lookupUserById, sendFriendRequest } from "../lib/api";
import FriendCard from "../components/FriendCard";
import NoFriendsFound from "../components/NoFriendsFound";
import { UsersIcon, SearchIcon, UserPlusIcon, CheckCircleIcon, HashIcon, HeartIcon, Building2Icon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import Avatar from "../components/Avatar";

const FriendsPage = () => {
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["orgMembers"],
    queryFn:  getOrgMembers,
  });

  const { data: myFriends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const friendIds = new Set(myFriends.map((friend) => friend._id));
  const teamMembers = (membersData?.members ?? []).filter((member) => !friendIds.has(member._id));

  const { mutate: findUserById, isPending: isLookingUp } = useMutation({
    mutationFn: lookupUserById,
    onSuccess: (data) => {
      setLookupResult(data);
      toast.success("User found");
    },
    onError: (error) => {
      setLookupResult(null);
      toast.error(error.response?.data?.message || "Could not find that user");
    },
  });

  const { mutate: sendRequest, isPending: isSendingRequest } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      toast.success("Friend request sent");
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      setLookupResult((prev) => prev
        ? {
            ...prev,
            existingRequest: {
              sender: "self",
              recipient: prev.user?._id,
              status: "pending",
            },
          }
        : prev);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not send request");
    },
  });

  const handleLookup = () => {
    const trimmed = lookupId.trim();
    if (!trimmed) return toast.error("Enter a user ID");
    findUserById(trimmed);
  };

  const filterPeople = (people) => people.filter((person) =>
    person.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (person.nativeLanguage || "").toLowerCase().includes(search.toLowerCase()) ||
    (person.learningLanguage || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredFriends = filterPeople(myFriends);
  const filteredTeamMembers = filterPeople(teamMembers);
  const isLoading = membersLoading || friendsLoading;

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-base-100">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <UsersIcon className="size-8 text-primary" />
            Team & Friends
          </h1>
          <p className="text-base-content/60 mt-1">
            {myFriends.length} friend{myFriends.length !== 1 ? "s" : ""} · {teamMembers.length} team member{teamMembers.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Search by name or language..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-bordered w-full pl-10"
          />
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300 p-5 sm:p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-primary/10 text-primary rounded-xl p-2.5">
            <HashIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Add by User ID</h2>
            <p className="text-sm text-base-content/60">
              Find someone by exact user ID and send a friend request, even outside your organization.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Paste user ID..."
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            className="input input-bordered flex-1 font-mono"
          />
          <button
            onClick={handleLookup}
            disabled={isLookingUp || !lookupId.trim()}
            className="btn btn-primary gap-2"
          >
            <SearchIcon className="size-4" />
            {isLookingUp ? "Searching..." : "Find User"}
          </button>
        </div>

        {lookupResult?.user && (
          <div className="mt-4 rounded-xl border border-base-300 bg-base-100 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar
              src={lookupResult.user.profilePic}
              name={lookupResult.user.fullName}
              size="w-12 h-12"
              rounded="rounded-xl"
            />

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">{lookupResult.user.fullName}</p>
              <p className="text-xs text-base-content/50 font-mono truncate">ID: {lookupResult.user._id}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`badge badge-sm ${lookupResult.user.sameOrganization ? "badge-success" : "badge-warning"}`}>
                  {lookupResult.user.sameOrganization ? "Same org" : "External"}
                </span>
                {lookupResult.user.nativeLanguage && (
                  <span className="badge badge-ghost badge-sm capitalize">{lookupResult.user.nativeLanguage}</span>
                )}
                {lookupResult.user.learningLanguage && (
                  <span className="badge badge-outline badge-sm capitalize">Learning {lookupResult.user.learningLanguage}</span>
                )}
              </div>
            </div>

            {lookupResult.user.isFriend ? (
              <span className="btn btn-success btn-sm gap-2 pointer-events-none">
                <CheckCircleIcon className="size-4" /> Already connected
              </span>
            ) : lookupResult.existingRequest ? (
              <span className="btn btn-outline btn-sm gap-2 pointer-events-none">
                <CheckCircleIcon className="size-4 text-success" /> Request pending
              </span>
            ) : (
              <button
                onClick={() => sendRequest(lookupResult.user._id)}
                disabled={isSendingRequest}
                className="btn btn-primary btn-sm gap-2"
              >
                <UserPlusIcon className="size-4" />
                {isSendingRequest ? "Sending..." : "Send Request"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="card bg-base-200 border border-base-300 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-xl p-2.5">
              <HeartIcon className="size-5" />
            </div>
            <div>
              <p className="text-sm text-base-content/60">Friends</p>
              <p className="text-2xl font-bold">{myFriends.length}</p>
            </div>
          </div>
        </div>
        <div className="card bg-base-200 border border-base-300 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-secondary/10 text-secondary rounded-xl p-2.5">
              <Building2Icon className="size-5" />
            </div>
            <div>
              <p className="text-sm text-base-content/60">Team members</p>
              <p className="text-2xl font-bold">{teamMembers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <HeartIcon className="size-5 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Friends</h2>
                <p className="text-sm text-base-content/60">People you are already connected with.</p>
              </div>
            </div>

            {filteredFriends.length === 0 ? (
              search ? (
                <div className="card bg-base-200 border border-base-300 p-8 text-center text-base-content/60">
                  No friend matches found for <strong>"{search}"</strong>
                </div>
              ) : (
                <NoFriendsFound />
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredFriends.map((friend) => (
                  <FriendCard key={`friend-${friend._id}`} friend={friend} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <Building2Icon className="size-5 text-secondary" />
              <div>
                <h2 className="text-xl font-bold">Team</h2>
                <p className="text-sm text-base-content/60">Everyone in your current organization.</p>
              </div>
            </div>

            {filteredTeamMembers.length === 0 ? (
              <div className="card bg-base-200 border border-base-300 p-8 text-center text-base-content/60">
                {search ? (
                  <>No team matches found for <strong>"{search}"</strong></>
                ) : (
                  <>No additional team members yet.</>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredTeamMembers.map((member) => (
                  <FriendCard key={`team-${member._id}`} friend={member} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default FriendsPage;