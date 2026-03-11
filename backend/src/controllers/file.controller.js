import File from "../models/File.js";
import cloudinary from "../lib/cloudinary.js";

const ALLOWED_IMAGE_PROXY_HOSTS = new Set([
    "res.cloudinary.com",
]);

const IMAGE_PROXY_TIMEOUT_MS = 10000;

function getProxiedImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return null;

    try {
        const parsedUrl = new URL(rawUrl);
        const isAllowedHost = ALLOWED_IMAGE_PROXY_HOSTS.has(parsedUrl.hostname);
        const isSafeProtocol = parsedUrl.protocol === "https:";
        const isImagePath = parsedUrl.pathname.includes("/image/") || parsedUrl.pathname.includes("/video/");

        if (!isAllowedHost || !isSafeProtocol || !isImagePath) {
            return null;
        }

        return parsedUrl;
    } catch {
        return null;
    }
}

export const getFiles = async (req, res) => {
    try {
        const organizationId = req.user.organization;
        if (!organizationId) {
            return res.status(400).json({ message: "User does not belong to an organization" });
        }

        const files = await File.find({ organization: organizationId })
            .populate("sharedBy", "fullName profilePic")
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json(files);
    } catch (error) {
        console.error("Error in getFiles controller:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const proxyImage = async (req, res) => {
    try {
        const parsedUrl = getProxiedImageUrl(req.query.url);

        if (!parsedUrl) {
            return res.status(400).json({ message: "Invalid image URL" });
        }

        const upstreamResponse = await fetch(parsedUrl, {
            signal: AbortSignal.timeout(IMAGE_PROXY_TIMEOUT_MS),
            headers: {
                Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
        });

        if (!upstreamResponse.ok) {
            return res.status(upstreamResponse.status).json({ message: "Unable to fetch image" });
        }

        const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream";
        const cacheControl = upstreamResponse.headers.get("cache-control") || "public, max-age=3600";
        const imageBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", cacheControl);
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        return res.status(200).send(imageBuffer);
    } catch (error) {
        console.error("Error in proxyImage controller:", error);
        return res.status(500).json({ message: "Internal Server Error" });
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
