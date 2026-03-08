import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyOrganization,
  getOrgMembers,
  regenerateInviteCode,
  createOrgChannel,
  deleteOrgChannel,
} from "../lib/api";
import useAuthUser from "../hooks/useAuthUser";
import {
  ShieldCheckIcon,
  UsersIcon,
  KeyRoundIcon,
  PlusIcon,
  TrashIcon,
  RefreshCwIcon,
  HashIcon,
  CopyIcon,
  Building2,
  LockIcon,
  GlobeIcon,
  UserPlusIcon,

  LoaderIcon,
  XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";

const AdminPage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const [newChannel, setNewChannel] = useState({ name: "", description: "", memberIds: [] });
  const [showAddChannel, setShowAddChannel] = useState(false);

  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ["myOrganization"],
    queryFn: getMyOrganization,
    staleTime: 60_000,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["orgMembers"],
    queryFn: getOrgMembers,
    staleTime: 60_000,
  });

  const org = orgData?.organization;
  const members = membersData?.members || [];
  const isAdminOrOwner = ["admin", "owner"].includes(authUser?.role);
  const isPrivateChannel = newChannel.memberIds.length > 0;

  const { mutate: regenCode, isPending: regenPending } = useMutation({
    mutationFn: regenerateInviteCode,
    onSuccess: (data) => {
      toast.success("Invite code regenerated!");
      queryClient.invalidateQueries({ queryKey: ["myOrganization"] });
    },
    onError: () => toast.error("Failed to regenerate code"),
  });

  const { mutate: addChannel, isPending: addPending } = useMutation({
    mutationFn: createOrgChannel,
    onSuccess: () => {
      toast.success("Channel created!");
      setNewChannel({ name: "", description: "", memberIds: [] });
      setShowAddChannel(false);
      queryClient.invalidateQueries({ queryKey: ["myOrganization"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create channel"),
  });

  const { mutate: removeChannel } = useMutation({
    mutationFn: deleteOrgChannel,
    onSuccess: () => {
      toast.success("Channel deleted");
      queryClient.invalidateQueries({ queryKey: ["myOrganization"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Cannot delete this channel"),
  });

  const copyInviteCode = () => {
    if (!org?.inviteCode) return;
    navigator.clipboard.writeText(org.inviteCode);
    toast.success("Invite code copied!");
  };

  const toggleChannelMember = (memberId) => {
    setNewChannel((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(memberId)
        ? prev.memberIds.filter((id) => id !== memberId)
        : [...prev.memberIds, memberId],
    }));
  };

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoaderIcon className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <Building2 className="size-12 text-base-content/20 mx-auto mb-4" />

          <h2 className="text-xl font-bold">No Organization</h2>
          <p className="text-base-content/50 mt-1">You haven't joined or created an organization yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto min-h-screen">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <ShieldCheckIcon className="size-8 text-primary" />
          Admin Panel
        </h1>
        <p className="text-base-content/60 mt-1">Manage <span className="font-semibold text-base-content">{org.name}</span></p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Members", value: members.length, icon: UsersIcon, color: "text-primary" },
          { label: "Channels", value: org.channels?.length, icon: HashIcon, color: "text-secondary" },
          { label: "Role", value: authUser?.role, icon: ShieldCheckIcon, color: "text-success" },
          { label: "Slug", value: `@${org.slug}`, icon: Building2, color: "text-warning" },

        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat bg-base-200 rounded-2xl border border-base-300">
            <div className={`stat-figure ${color}`}><Icon className="size-6" /></div>
            <div className="stat-title text-xs">{label}</div>
            <div className={`stat-value text-xl capitalize ${color}`}>{value ?? "—"}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* INVITE CODE */}
        {isAdminOrOwner && (
          <div className="card bg-base-200 border border-base-300 p-6">
            <div className="flex items-center gap-3 mb-4">
              <KeyRoundIcon className="size-5 text-primary" />
              <h3 className="text-lg font-bold">Invite Code</h3>
            </div>
            <p className="text-sm text-base-content/60 mb-4">
              Share this code to invite new members to your organization.
            </p>
            <div className="flex items-center gap-3 bg-base-300 rounded-xl p-4 mb-4">
              <code className="flex-1 text-2xl font-mono font-bold tracking-[0.3em] text-center text-primary">
                {org.inviteCode}
              </code>
            </div>
            <div className="flex gap-2">
              <button onClick={copyInviteCode} className="btn btn-outline flex-1 gap-2">
                <CopyIcon className="size-4" /> Copy
              </button>
              <button
                onClick={() => regenCode()}
                disabled={regenPending}
                className="btn btn-outline btn-warning flex-1 gap-2"
                title="Generate a new code (old one will stop working)"
              >
                {regenPending ? <LoaderIcon className="animate-spin size-4" /> : <RefreshCwIcon className="size-4" />}
                New Code
              </button>
            </div>
            <p className="text-xs text-base-content/40 mt-2 text-center">
              ⚠️ Regenerating invalidates the old code immediately.
            </p>
          </div>
        )}

        {/* CHANNEL MANAGEMENT */}
        <div className="card bg-base-200 border border-base-300 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <HashIcon className="size-5 text-secondary" />
              <h3 className="text-lg font-bold">Channels</h3>
            </div>
            {isAdminOrOwner && (
              <button
                onClick={() => setShowAddChannel((s) => !s)}
                className="btn btn-sm btn-outline btn-secondary gap-1"
              >
                <PlusIcon className="size-4" /> Add
              </button>
            )}
          </div>

          {/* Add channel form */}
          {showAddChannel && (
            <div className="bg-base-300 rounded-xl p-4 mb-4 space-y-3">
              <input
                type="text"
                placeholder="Channel name (e.g., design)"
                value={newChannel.name}
                onChange={(e) => setNewChannel((p) => ({ ...p, name: e.target.value }))}
                className="input input-bordered input-sm w-full"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newChannel.description}
                onChange={(e) => setNewChannel((p) => ({ ...p, description: e.target.value }))}
                className="input input-bordered input-sm w-full"
              />
              <div className="rounded-xl border border-base-content/10 bg-base-100/60 p-3">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold">Channel audience</p>
                    <p className="text-xs text-base-content/50">
                      Leave everyone unchecked for a public channel, or pick specific members for a private group.
                    </p>
                  </div>
                  <span className={`badge ${isPrivateChannel ? "badge-secondary" : "badge-success"}`}>
                    {isPrivateChannel ? "Private" : "Public"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setNewChannel((p) => ({ ...p, memberIds: [] }))}
                    className={`btn btn-xs gap-1 ${!isPrivateChannel ? "btn-success" : "btn-outline"}`}
                  >
                    <GlobeIcon className="size-3" /> Everyone in workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannel((p) => ({
                      ...p,
                      memberIds: members.filter((member) => member._id !== authUser?._id).map((member) => member._id),
                    }))}
                    className="btn btn-xs btn-outline gap-1"
                  >
                    <UserPlusIcon className="size-3" /> Select all members
                  </button>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                  {members
                    .filter((member) => member._id !== authUser?._id)
                    .map((member) => {
                      const isSelected = newChannel.memberIds.includes(member._id);
                      return (
                        <label
                          key={member._id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                            isSelected
                              ? "border-secondary bg-secondary/10"
                              : "border-base-content/10 hover:bg-base-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-secondary"
                            checked={isSelected}
                            onChange={() => toggleChannelMember(member._id)}
                          />
                          <div className="avatar">
                            <div className="w-8 rounded-full bg-base-200 overflow-hidden">
                              {member.profilePic ? (
                                <img src={member.profilePic} alt={member.fullName} />
                              ) : null}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{member.fullName}</p>
                            <p className="text-xs text-base-content/50 capitalize">{member.role || "member"}</p>
                          </div>
                        </label>
                      );
                    })}
                </div>
                {isPrivateChannel && (
                  <p className="text-xs text-base-content/50 mt-3">
                    Selected members plus you will be added to this private channel.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addChannel(newChannel)}
                  disabled={addPending || !newChannel.name.trim()}
                  className="btn btn-sm btn-secondary gap-1"
                >
                  {addPending ? <LoaderIcon className="animate-spin size-3" /> : <PlusIcon className="size-3" />}
                  Create
                </button>
                <button onClick={() => setShowAddChannel(false)} className="btn btn-sm btn-ghost gap-1">
                  <XIcon className="size-3" /> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {org.channels?.map((ch) => (
              <div
                key={ch._id}
                className="flex items-center gap-3 p-3 bg-base-300 rounded-xl"
              >
                {ch.isPrivate ? (
                  <LockIcon className="size-4 text-secondary flex-shrink-0" />
                ) : (
                  <HashIcon className="size-4 text-primary flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{ch.name}</p>
                    <span className={`badge badge-xs ${ch.isPrivate ? "badge-secondary" : "badge-ghost"}`}>
                      {ch.isPrivate ? "private" : "public"}
                    </span>
                    {ch.isPrivate && (
                      <span className="badge badge-outline badge-xs">{(ch.members?.length || 0)} members</span>
                    )}
                  </div>
                  {ch.description && <p className="text-xs text-base-content/50 truncate">{ch.description}</p>}
                </div>
                {ch.isDefault ? (
                  <span className="badge badge-ghost badge-xs">default</span>
                ) : (
                  isAdminOrOwner && (
                    <button
                      onClick={() => removeChannel(ch._id)}
                      className="btn btn-ghost btn-xs btn-circle text-error"
                      title="Delete channel"
                    >
                      <TrashIcon className="size-3" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* MEMBERS LIST */}
        <div className="card bg-base-200 border border-base-300 p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <UsersIcon className="size-5 text-success" />
            <h3 className="text-lg font-bold">Members ({members.length})</h3>
          </div>
          {membersLoading ? (
            <div className="flex justify-center py-8">
              <LoaderIcon className="animate-spin size-6 text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {members.map((m) => (
                <div key={m._id} className="flex items-center gap-3 p-3 bg-base-300 rounded-xl">
                  <div className="avatar">
                    <div className="w-9 rounded-full">
                      <img src={m.profilePic} alt={m.fullName} onError={(e) => (e.target.style.display = "none")} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{m.fullName}</p>
                    <p className="text-xs text-base-content/50 capitalize truncate">{m.role || "member"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
