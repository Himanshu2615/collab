import { useQuery } from "@tanstack/react-query";
import { getUserFriends } from "../lib/api";
import FriendCard from "../components/FriendCard";
import { UsersIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

const FriendsPage = () => {
  const [search, setSearch] = useState("");

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const filtered = friends.filter((f) =>
    f.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (f.nativeLanguage || "").toLowerCase().includes(search.toLowerCase()) ||
    (f.learningLanguage || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-base-100">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <UsersIcon className="size-8 text-primary" />
            Team Directory
          </h1>
          <p className="text-base-content/60 mt-1">
            {friends.length} team member{friends.length !== 1 ? "s" : ""} connected
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

      {/* CONTENT */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="bg-base-200 rounded-full p-6 mb-4">
            <UsersIcon className="size-10 text-base-content/30" />
          </div>
          {search ? (
            <p className="text-base-content/60">No matches found for <strong>"{search}"</strong></p>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">No team members yet</h2>
              <p className="text-base-content/60 max-w-sm">
                Start connecting with people from the Dashboard to build your team.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((friend) => (
            <FriendCard key={friend._id} friend={friend} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FriendsPage;