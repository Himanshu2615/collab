import File from "../models/File.js";
import cloudinary from "../lib/cloudinary.js";

export const getFiles = async (req, res) => {
    try {
        const organizationId = req.user.organization;
        if (!organizationId) {
            return res.status(400).json({ message: "User does not belong to an organization" });
        }

        const files = await File.find({ organization: organizationId })
            .populate("sharedBy", "fullName profilePic")
            .sort({ createdAt: -1 });

        res.status(200).json(files);
    } catch (error) {
        console.error("Error in getFiles controller:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const uploadFile = async (req, res) => {
    try {
        const { name, type, fileBase64, channel } = req.body;
        const organizationId = req.user.organization;

        if (!organizationId) {
            return res.status(400).json({ message: "User does not belong to an organization" });
        }

        if (!fileBase64) {
            return res.status(400).json({ message: "File data is required" });
        }

        // Upload to Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(fileBase64, {
            folder: `collab_org_${organizationId}`,
            resource_type: "auto",
        });

        const newFile = new File({
            name,
            type: type || "other",
            size: uploadResponse.bytes,
            cloudinaryPublicId: uploadResponse.public_id,
            url: uploadResponse.secure_url,
            sharedBy: req.user._id,
            organization: organizationId,
            channel,
        });

        await newFile.save();
        res.status(201).json(newFile);
    } catch (error) {
        console.error("Error in uploadFile controller:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const moveFile = async (req, res) => {
    try {
        const { id } = req.params;
        const { folderId } = req.body; // null = remove from folder

        const file = await File.findById(id);
        if (!file) return res.status(404).json({ message: "File not found" });

        if (file.organization.toString() !== req.user.organization.toString())
            return res.status(403).json({ message: "Unauthorized" });

        file.folder = folderId || null;
        await file.save();

        res.status(200).json(file);
    } catch (error) {
        console.error("Error in moveFile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const deleteFile = async (req, res) => {
    try {
        const { id } = req.params;
        const file = await File.findById(id);

        if (!file) {
            return res.status(404).json({ message: "File not found" });
        }

        // Only uploader or admin can delete
        if (file.sharedBy.toString() !== req.user._id.toString() && !["admin", "owner"].includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized to delete this file" });
        }

        // Delete from Cloudinary if we have the public_id stored
        if (file.cloudinaryPublicId) {
            try {
                // Mapping our custom file type to Cloudinary's required resource_type
                // Images are 'image', but documents/others are 'raw'
                let resourceType = "raw";
                if (file.type === "image") resourceType = "image";
                else if (file.type === "video") resourceType = "video";

                await cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: resourceType });
            } catch (cloudErr) {
                console.error("Cloudinary deletion failed:", cloudErr.message);
                // Non-fatal: still remove the DB record
            }
        }
        await File.findByIdAndDelete(id);

        res.status(200).json({ message: "File deleted successfully" });
    } catch (error) {
        console.error("Error in deleteFile controller:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
