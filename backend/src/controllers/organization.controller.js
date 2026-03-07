import Organization from "../models/Organization.js";
import User from "../models/User.js";
import { upsertStreamUser } from "../lib/stream.js";


/* ─────────────────────────────────────────
   POST /api/organizations/create
   Body: { name, description? }
   Creates a new org; caller becomes owner
──────────────────────────────────────────── */
export async function createOrganization(req, res) {
    try {
        const { name, description = "" } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: "Organization name is required" });

        // Prevent creating if already in an org
        const currentUser = await User.findById(req.user._id);
        if (currentUser.organization) {
            return res.status(400).json({ message: "You are already part of an organization" });
        }

        // Build a URL-safe slug from the name
        const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        // Guarantee slug uniqueness by appending a random suffix if needed
        let slug = baseSlug;
        let exists = await Organization.findOne({ slug });
        if (exists) slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

        const inviteCode = Organization.generateInviteCode();

        const org = await Organization.create({
            name: name.trim(),
            slug,
            description,
            inviteCode,
            owner: req.user._id,
            admins: [req.user._id],
        });

        // Link the user to this organization and make them owner
        const updatedUser = await User.findByIdAndUpdate(req.user._id, {
            organization: org._id,
            role: "owner",
        }, { new: true });

        // Sync with Stream Chat - Grant access to the org's team
        try {
            await upsertStreamUser({
                id: updatedUser._id.toString(),
                name: updatedUser.fullName,
                image: updatedUser.profilePic || "",
                teams: [org.slug], // Set the team slug for multi-tenancy
            });
            console.log(`✅ Stream user synced for ${updatedUser.fullName} in team ${org.slug}`);
        } catch (streamError) {
            console.error("⚠️ Stream sync error on org create:", streamError.message);
        }


        res.status(201).json({ success: true, organization: org });
    } catch (error) {
        console.error("Error in createOrganization:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/* ─────────────────────────────────────────
   POST /api/organizations/join
   Body: { inviteCode }
──────────────────────────────────────────── */
export async function joinOrganization(req, res) {
    try {
        const { inviteCode } = req.body;
        if (!inviteCode?.trim()) return res.status(400).json({ message: "Invite code is required" });

        const org = await Organization.findOne({ inviteCode: inviteCode.trim().toUpperCase() });
        if (!org) return res.status(404).json({ message: "Invalid invite code" });

        // Prevent joining if already in an org
        const currentUser = await User.findById(req.user._id);
        if (currentUser.organization) {
            if (currentUser.organization.toString() === org._id.toString()) {
                return res.status(400).json({ message: "You are already a member of this organization" });
            }
            return res.status(400).json({ message: "You are already part of another organization" });
        }

        // Add user to org
        const updatedUser = await User.findByIdAndUpdate(req.user._id, {
            organization: org._id,
            role: "member",
        }, { new: true });

        // Sync with Stream Chat
        try {
            await upsertStreamUser({
                id: updatedUser._id.toString(),
                name: updatedUser.fullName,
                image: updatedUser.profilePic || "",
                teams: [org.slug],
            });
            console.log(`✅ Stream user synced for ${updatedUser.fullName} in team ${org.slug}`);
        } catch (streamError) {
            console.error("⚠️ Stream sync error on org join:", streamError.message);
        }

        // Return org data (without sensitive invite code for members)
        const orgData = org.toObject();
        delete orgData.inviteCode;

        res.status(200).json({ success: true, organization: orgData });
    } catch (error) {
        console.error("Error in joinOrganization:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/* ─────────────────────────────────────────
   GET /api/organizations/me
   Returns the current user's organization
──────────────────────────────────────────── */
export async function getMyOrganization(req, res) {
    try {
        const user = await User.findById(req.user._id).select("organization role");
        if (!user?.organization) {
            return res.status(200).json({ organization: null });
        }

        const org = await Organization.findById(user.organization).populate("owner", "fullName profilePic");
        if (!org) return res.status(404).json({ message: "Organization not found" });

        // Compute live member count — avoids drift from a denormalized counter
        const memberCount = await User.countDocuments({ organization: org._id });

        // Only owners/admins see the invite code
        const isAdminOrOwner = org.admins.some((a) => a.toString() === req.user._id.toString());
        const orgData = org.toObject();
        if (!isAdminOrOwner) delete orgData.inviteCode;
        orgData.memberCount = memberCount;

        res.status(200).json({ success: true, organization: orgData, role: user.role });
    } catch (error) {
        console.error("Error in getMyOrganization:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/* ─────────────────────────────────────────
   POST /api/organizations/regenerate-code
   Admin/Owner regenerates invite code
──────────────────────────────────────────── */
export async function regenerateInviteCode(req, res) {
    try {
        const user = await User.findById(req.user._id).select("organization role");
        if (!user?.organization) return res.status(404).json({ message: "You are not in an organization" });
        if (!["admin", "owner"].includes(user.role)) return res.status(403).json({ message: "Admins only" });

        const newCode = Organization.generateInviteCode();
        const org = await Organization.findByIdAndUpdate(
            user.organization,
            { inviteCode: newCode },
            { new: true }
        );

        res.status(200).json({ success: true, inviteCode: org.inviteCode });
    } catch (error) {
        console.error("Error in regenerateInviteCode:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/* ─────────────────────────────────────────
   POST /api/organizations/channels
   Admin adds a new channel
──────────────────────────────────────────── */
export async function createChannel(req, res) {
    try {
        const user = await User.findById(req.user._id).select("organization role");
        if (!user?.organization) return res.status(400).json({ message: "You are not in an organization" });
        if (!["admin", "owner"].includes(user.role)) return res.status(403).json({ message: "Admins only" });

        const { name, description = "" } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: "Channel name is required" });

        const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");

        const org = await Organization.findById(user.organization);
        const exists = org.channels.some((c) => c.name === cleanName);
        if (exists) return res.status(400).json({ message: "A channel with that name already exists" });

        org.channels.push({ name: cleanName, description, isDefault: false });
        await org.save();

        res.status(201).json({ success: true, channels: org.channels });
    } catch (error) {
        console.error("Error in createChannel:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/* ─────────────────────────────────────────
   DELETE /api/organizations/channels/:channelId
   Admin deletes a custom channel
──────────────────────────────────────────── */
export async function deleteChannel(req, res) {
    try {
        const user = await User.findById(req.user._id).select("organization role");
        if (!user?.organization) return res.status(400).json({ message: "Not in an organization" });
        if (!["admin", "owner"].includes(user.role)) return res.status(403).json({ message: "Admins only" });

        const org = await Organization.findById(user.organization);
        const channel = org.channels.id(req.params.channelId);
        if (!channel) return res.status(404).json({ message: "Channel not found" });
        if (channel.isDefault) return res.status(400).json({ message: "Cannot delete default channels" });

        channel.deleteOne();
        await org.save();

        res.status(200).json({ success: true, channels: org.channels });
    } catch (error) {
        console.error("Error in deleteChannel:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/* ─────────────────────────────────────────
   GET /api/organizations/members
   List all members of the org
──────────────────────────────────────────── */
export async function getOrgMembers(req, res) {
    try {
        const user = await User.findById(req.user._id).select("organization");
        if (!user?.organization) return res.status(400).json({ message: "Not in an organization" });

        const members = await User.find({ organization: user.organization, isOnboarded: true })
            .select("fullName profilePic nativeLanguage learningLanguage location role bio")
            .lean();

        res.status(200).json({ success: true, members });
    } catch (error) {
        console.error("Error in getOrgMembers:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}
