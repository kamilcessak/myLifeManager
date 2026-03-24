import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
import path from "path";

import { configurePassport } from "./config/passport.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import tasksRoutes from "./routes/tasks.js";
import eventsRoutes from "./routes/events.js";
import categoriesRoutes from "./routes/categories.js";
import uploadRoutes from "./routes/upload.js";
import attachmentsRoutes from "./routes/attachments.js";
import searchRoutes from "./routes/search.js";
import notificationsRoutes from "./routes/notifications.js";
import { startReminderCron } from "./cron/reminders.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : true, // dev: allow web (localhost:5173/3000) and mobile (any EXPO_PUBLIC_API_URL)
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport configuration
configurePassport(passport);
app.use(passport.initialize());

// Static files for uploads (katalog `uploads/` w katalogu roboczym API, np. api/uploads)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/attachments", attachmentsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/health`);

  startReminderCron();
});

export default app;
