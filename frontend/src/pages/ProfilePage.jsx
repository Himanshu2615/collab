import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { updateProfile } from "../lib/api";
import { setCachedAuthUser } from "../lib/authCache";
import useAuthUser from "../hooks/useAuthUser";
import {
    CameraIcon, SaveIcon, LoaderIcon, UserIcon,
    MapPinIcon, GlobeIcon, FileTextIcon, ArrowLeftIcon,
} from "lucide-react";
import { Link } from "react-router";
import { LANGUAGES } from "../constants";
import Avatar from "../components/Avatar";


const ProfilePage = () => {

    const { authUser } = useAuthUser();
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({
        fullName: "",
        bio: "",
        nativeLanguage: "",
        learningLanguage: "",
        location: "",
        profilePic: "",
    });

    // Sync from authUser once available
    useEffect(() => {
        if (!authUser) return;
        setForm({
            fullName: authUser.fullName || "",
            bio: authUser.bio || "",
            nativeLanguage: authUser.nativeLanguage || "",
            learningLanguage: authUser.learningLanguage || "",
            location: authUser.location || "",
            profilePic: "",   // intentionally empty; show initials by default
        });
    }, [authUser]);

    const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
        const reader = new FileReader();
        reader.onload = (ev) => { set("profilePic", ev.target.result); };
        reader.readAsDataURL(file);
    };

    const { mutate: save, isPending } = useMutation({
        mutationFn: updateProfile,
        onSuccess: (data) => {
            toast.success("Profile updated!");
            setCachedAuthUser({ success: true, user: data.user });
            queryClient.setQueryData(["authUser"], (old) =>
                old ? { ...old, user: data.user } : old
            );
        },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to save profile"),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.fullName.trim()) return toast.error("Name is required");
        // Only include profilePic when the user explicitly chose a new image.
        // Sending "" would overwrite the existing Cloudinary URL in the DB.
        const payload = { ...form };
        if (!payload.profilePic) delete payload.profilePic;
        save(payload);
    };

    const displayName = form.fullName || authUser?.fullName || "";

    return (
        <div className="min-h-screen bg-base-100 p-4 sm:p-8">
            <div className="max-w-2xl mx-auto">
                {/* HEADER */}
                <div className="flex items-center gap-3 mb-8">
                    <Link to="/" className="btn btn-ghost btn-sm btn-circle">
                        <ArrowLeftIcon className="size-4" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">Edit Profile</h1>
                        <p className="text-base-content/50 text-sm">Changes are saved immediately</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* AVATAR SECTION */}
                    <div className="card bg-base-200 border border-base-300 p-6">
                        <h2 className="font-bold mb-4 flex items-center gap-2">
                            <UserIcon className="size-4 text-primary" /> Profile Picture
                        </h2>
                        <div className="flex items-center gap-6">
                            <div
                                className="relative cursor-pointer ring-2 ring-base-300 hover:ring-primary transition-all rounded-2xl group overflow-hidden"
                                onClick={() => fileInputRef.current?.click()}
                                title="Click to upload photo"
                            >
                                <Avatar
                                    src={form.profilePic || authUser?.profilePic}
                                    name={displayName}
                                    size="w-24 h-24"
                                    rounded="rounded-2xl"
                                />
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <CameraIcon className="size-6 text-white" />
                                </div>
                            </div>


                            <div className="space-y-2">
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn btn-outline btn-sm gap-2"
                                >
                                    <CameraIcon className="size-4" /> Upload Photo
                                </button>
                                {form.profilePic && (
                                    <button
                                        type="button"
                                        onClick={() => set("profilePic", "")}
                                        className="btn btn-ghost btn-sm text-error block"
                                    >
                                        Remove photo
                                    </button>
                                )}
                                <p className="text-xs text-base-content/40">
                                    JPG, PNG, GIF · max 5 MB<br />
                                    Or keep the initials avatar — it's generated from your name
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* BASIC INFO */}
                    <div className="card bg-base-200 border border-base-300 p-6 space-y-5">
                        <h2 className="font-bold flex items-center gap-2">
                            <FileTextIcon className="size-4 text-secondary" /> Basic Information
                        </h2>

                        {/* Full Name */}
                        <div className="form-control">
                            <label className="label pb-1">
                                <span className="label-text font-medium">Full Name <span className="text-error">*</span></span>
                            </label>
                            <input
                                type="text"
                                value={form.fullName}
                                onChange={(e) => set("fullName", e.target.value)}
                                className="input input-bordered w-full focus:input-primary"
                                placeholder="Your full name"
                            />
                        </div>

                        {/* Bio */}
                        <div className="form-control">
                            <label className="label pb-1">
                                <span className="label-text font-medium">Bio</span>
                                <span className="label-text-alt text-base-content/40">{form.bio.length}/160</span>
                            </label>
                            <textarea
                                value={form.bio}
                                onChange={(e) => set("bio", e.target.value.slice(0, 160))}
                                className="textarea textarea-bordered resize-none focus:textarea-primary"
                                placeholder="Tell your teammates a little about yourself…"
                                rows={3}
                            />
                        </div>

                        {/* Location */}
                        <div className="form-control">
                            <label className="label pb-1">
                                <span className="label-text font-medium flex items-center gap-1">
                                    <MapPinIcon className="size-3.5" /> Location
                                </span>
                            </label>
                            <input
                                type="text"
                                value={form.location}
                                onChange={(e) => set("location", e.target.value)}
                                className="input input-bordered w-full focus:input-primary"
                                placeholder="e.g. Mumbai, India"
                            />
                        </div>
                    </div>

                    {/* LANGUAGES */}
                    <div className="card bg-base-200 border border-base-300 p-6 space-y-5">
                        <h2 className="font-bold flex items-center gap-2">
                            <GlobeIcon className="size-4 text-success" /> Languages
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Native Language */}
                            <div className="form-control">
                                <label className="label pb-1">
                                    <span className="label-text font-medium">Native Language</span>
                                </label>
                                <select
                                    value={form.nativeLanguage}
                                    onChange={(e) => set("nativeLanguage", e.target.value)}
                                    className="select select-bordered focus:select-primary"
                                >
                                    <option value="">Select language…</option>
                                    {LANGUAGES.map((language) => (
                                        <option key={language} value={language}>{language}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Preferred Language */}
                            <div className="form-control">
                                <label className="label pb-1">
                                    <span className="label-text font-medium">Preferred Language</span>
                                </label>
                                <select
                                    value={form.learningLanguage}
                                    onChange={(e) => set("learningLanguage", e.target.value)}
                                    className="select select-bordered focus:select-primary"
                                >
                                    <option value="">Select language…</option>
                                    {LANGUAGES.filter((language) => language !== form.nativeLanguage).map((language) => (
                                        <option key={language} value={language}>{language}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SAVE BUTTON */}
                    <button
                        type="submit"
                        disabled={isPending || !form.fullName.trim()}
                        className="btn btn-primary w-full gap-2 shadow-lg shadow-primary/20"
                    >
                        {isPending ? (
                            <><LoaderIcon className="animate-spin size-5" /> Saving…</>
                        ) : (
                            <><SaveIcon className="size-5" /> Save Changes</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;
