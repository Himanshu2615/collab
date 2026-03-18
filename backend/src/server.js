import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import compression from "compression";
import path from "path";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import organizationRoutes from "./routes/organization.route.js";
import fileRoutes from "./routes/file.route.js";
import meetingRoutes from "./routes/meeting.route.js";
import folderRoutes from "./routes/folder.route.js";
import transcriptRoutes from "./routes/transcript.route.js";
import callLogRoutes from "./routes/callLog.route.js";




import { connectDB } from "./lib/db.js";
import { initScheduler } from "./lib/scheduler.js";

const app = express();
const PORT = process.env.PORT || 5000;

const __dirname = path.resolve();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // allow frontend to send cookies
  })
);

// Compress all responses except SSE streams (compression buffers chunks and
// can delay realtime delivery).
app.use(
  compression({
    filter: (req, res) => {
      if (req.path === "/api/users/stream" || req.headers.accept === "text/event-stream") {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/transcripts", transcriptRoutes);
app.use("/api/call-logs", callLogRoutes);




if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Connect to MongoDB BEFORE accepting requests
const startServer = async () => {
  try {
    await connectDB();
    await initScheduler();
    
    // Only listen in non-production/local environments. 
    // Vercel handles invocation automatically via the exported 'app'.
    if (process.env.NODE_ENV !== "production") {
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    }
  } catch (err) {
    console.error("Failed to start server:", err);
  }
};

startServer();

// Export for Vercel
export default app;
