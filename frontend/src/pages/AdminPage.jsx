import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyOrganization,
  getOrgMembers,
  regenerateInviteCode,
  updateOrganizationSettings,
  createOrgChannel,
  deleteOrgChannel,
} from "../lib/api";
import useAuthUser from "../hooks/useAuthUser";
import {
  CameraIcon,
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
  SaveIcon,

  LoaderIcon,
  XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import Avatar from "../components/Avatar";

const AdminPage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const logoInputRef = useRef(null);
  const [newChannel, setNewChannel] = useState({ name: "", description: "", memberIds: [] });
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [logoChanged, setLogoChanged] = useState(false);
  const [orgForm, setOrgForm] = useState({
    name: "",
    description: "",
    website: "",
    logo: "",
  });

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

  useEffect(() => {
    if (!org) return;
    setOrgForm({
      name: org.name || "",
      description: org.description || "",
      website: org.website || "",
      logo: "",
    });
    setLogoChanged(false);
  }, [org]);

  const { mutate: regenCode, isPending: regenPending } = useMutation({
    mutationFn: regenerateInviteCode,
    onSuccess: (data) => {
      toast.success("Invite code regenerated!");
      queryClient.invalidateQueries({ queryKey: ["myOrganization"] });
    },
    onError: () => toast.error("Failed to regenerate code"),
  });

  const { mutate: saveOrgSettings, isPending: saveOrgPending } = useMutation({
    mutationFn: updateOrganizationSettings,
    onSuccess: (data) => {
      toast.success("Organization updated!");
      setOrgForm((prev) => ({ ...prev, logo: "" }));
      setLogoChanged(false);
      queryClient.setQueryData(["myOrganization"], (old) => (
        old ? { ...old, organization: data.organization } : old
      ));
      queryClient.invalidateQueries({ queryKey: ["myOrganization"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update organization"),
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

  const setOrgField = (key, value) => setOrgForm((prev) => ({ ...prev, [key]: value }));

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoChanged(true);
      setOrgField("logo", ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveOrgSettings = (e) => {
    e.preventDefault();
    if (!orgForm.name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    saveOrgSettings({
      name: orgForm.name,
      description: orgForm.description,
      website: orgForm.website,
      logo: logoChanged ? orgForm.logo : (org?.logo || ""),
    });
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
        {isAdminOrOwner && (
          <form onSubmit={handleSaveOrgSettings} className="card bg-base-200 border border-base-300 p-6 lg:col-span-2">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="size-5 text-primary" />
                  <h3 className="text-lg font-bold">Organization Profile</h3>
                </div>
                <p className="text-sm text-base-content/60 max-w-2xl">
                  Customize how your workspace appears with a logo, description, and website.
                </p>
              </div>

              <button type="submit" disabled={saveOrgPending} className="btn btn-primary gap-2 self-start">
                {saveOrgPending ? <LoaderIcon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                Save changes
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-base-300 bg-base-100 p-5">
                <p className="text-sm font-semibold mb-4">Workspace logo</p>
                <div
                  className="group relative mx-auto flex w-fit cursor-pointer items-center justify-center rounded-[28px] ring-2 ring-base-300 transition-all hover:ring-primary"
                  onClick={() => logoInputRef.current?.click()}
                  title="Upload organization logo"
                >
                  <Avatar
                    src={logoChanged ? orgForm.logo : org?.logo}
                    name={orgForm.name || org?.name}
                    size="w-28 h-28"
                    rounded="rounded-[28px]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <CameraIcon className="size-6 text-white" />
                  </div>
                </div>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="btn btn-outline btn-sm w-full gap-2"
                  >
                    <CameraIcon className="size-4" /> Upload logo
                  </button>
                  {(logoChanged ? orgForm.logo : org?.logo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoChanged(true);
                        setOrgField("logo", "");
                      }}
                      className="btn btn-ghost btn-sm w-full text-error"
                    >
                      Remove logo
                    </button>
                  )}
                  <p className="text-xs text-base-content/45 text-center">
                    PNG, JPG or GIF · max 5 MB
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="form-control sm:col-span-2">
                  <label className="label pb-1">
                    <span className="label-text font-medium">Organization name</span>
                  </label>
                  <input
                    type="text"
                    value={orgForm.name}
                    onChange={(e) => setOrgField("name", e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="Enter organization name"
                  />
                </div>

                <div className="form-control sm:col-span-2">
                  <label className="label pb-1">
                    <span className="label-text font-medium">Description</span>
                  </label>
                  <textarea
                    value={orgForm.description}
                    onChange={(e) => setOrgField("description", e.target.value.slice(0, 220))}
                    className="textarea textarea-bordered min-h-28 resize-none"
                    placeholder="Tell your team what this workspace is for"
                  />
                  <label className="label pt-1">
                    <span className="label-text-alt text-base-content/40">{orgForm.description.length}/220</span>
                  </label>
                </div>

                <div className="form-control sm:col-span-2">
                  <label className="label pb-1">
                    <span className="label-text font-medium flex items-center gap-1.5">
                      <GlobeIcon className="size-3.5" /> Website
                    </span>
                  </label>
                  <input
                    type="url"
                    value={orgForm.website}
                    onChange={(e) => setOrgField("website", e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="https://your-company.com"
                  />
                </div>

                <div className="sm:col-span-2 rounded-2xl border border-base-300 bg-base-100 px-4 py-3 text-sm text-base-content/60">
                  <span className="font-semibold text-base-content">Workspace slug:</span> @{org.slug}
                </div>
              </div>
            </div>
          </form>
        )}

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
                          <Avatar
                            src={member.profilePic}
                            name={member.fullName}
                            size="w-8 h-8"
                          />
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
                  <Avatar
                    src={m.profilePic}
                    name={m.fullName}
                    size="w-9 h-9"
                  />
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
