import mongoose from "mongoose";
import crypto from "crypto";

const channelSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: "" },
    isDefault: { type: Boolean, default: false }, // default channels can't be deleted
}, { _id: true, timestamps: false });

const organizationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },
        inviteCode: {
            type: String,
            required: true,
            unique: true,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        admins: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        channels: {
            type: [channelSchema],
            default: [
                { name: "general", description: "General discussion", isDefault: true },
                { name: "announcements", description: "Important announcements", isDefault: true },
            ],
        },
    },
    { timestamps: true }
);

// Note: slug and inviteCode indexes are already defined via `unique: true` in the schema fields above.
// Only compound or non-unique indexes go here.


// Helper: generate a random 8-char alphanumeric invite code
organizationSchema.statics.generateInviteCode = function () {
    return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F7B2C1"
};

const Organization = mongoose.model("Organization", organizationSchema);
export default Organization;
