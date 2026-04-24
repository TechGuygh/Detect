import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import axios from "axios";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const httpServer = createServer(app);

const PORT = 3000;

// Rate Limiter: General API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: "Too many requests from this IP, please try again after 15 minutes." });
  }
});

// Rate Limiter: VirusTotal Proxies
const vtLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500, 
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: "Security scan quota exceeded for this hour." });
  }
});

// Rate Limiter: Strict for Notifications (prevent spam)
const notifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 notifications per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: "Notification quota exceeded for this hour." });
  }
});

app.use(cors());
app.use(express.json());

// General API Rate Limiter
app.use("/api", apiLimiter);

// Specific Rate Limiters
app.use("/api/notify", notifyLimiter);
app.use("/api/scan", vtLimiter);

// Request logger
app.use((req, res, next) => {
  if (req.url.startsWith("/api")) {
    console.log(`[API] ${req.method} ${req.url}`);
  }
  next();
});

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Debug route to check env
app.get("/api/debug", (req, res) => {
  res.json({
    hasVTKey: !!process.env.VIRUSTOTAL_API_KEY,
    nodeVersion: process.version,
    env: process.env.NODE_ENV
  });
});

// Email Notification Endpoint
app.post("/api/notify", async (req, res) => {
  const { to, subject, body } = req.body;

  const service = process.env.EMAIL_SERVICE;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!service || !user || !pass) {
    console.warn("Email configuration missing. Notification skipped.");
    return res.status(503).json({ error: "Email configuration missing" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Sentinel Security" <${user}>`,
      to,
      subject,
      text: body,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to send email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// VirusTotal Proxy Endpoints
app.post("/api/scan/url", async (req, res) => {
  const { url } = req.body;
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) return res.status(503).json({ error: "VirusTotal configuration missing" });
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const params = new URLSearchParams();
    params.append("url", url);
    
    const scanResponse = await axios.post("https://www.virustotal.com/api/v3/urls", params, {
      headers: {
        "x-apikey": apiKey,
        "content-type": "application/x-www-form-urlencoded"
      }
    });

    res.json({ 
      success: true, 
      analysisId: scanResponse.data.data.id,
      originalUrl: url
    });
  } catch (error: any) {
    console.error("VT URL Scan Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to scan URL" });
  }
});

app.get("/api/scan/report/:id", async (req, res) => {
  const { id } = req.params;
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) return res.status(503).json({ error: "VirusTotal configuration missing" });

  try {
    const reportResponse = await axios.get(`https://www.virustotal.com/api/v3/analyses/${id}`, {
      headers: { "x-apikey": apiKey }
    });
    res.json(reportResponse.data);
  } catch (error: any) {
    console.error("VT Report Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to fetch report" });
  }
});

app.post("/api/scan/file", upload.single("file"), async (req, res) => {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "VirusTotal configuration missing" });
  if (!req.file) return res.status(400).json({ error: "File is required" });

  try {
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname);

    const scanResponse = await axios.post("https://www.virustotal.com/api/v3/files", formData, {
      headers: {
        "x-apikey": apiKey
      }
    });

    res.json({
      success: true,
      analysisId: scanResponse.data.data.id,
      fileName: req.file.originalname
    });
  } catch (error: any) {
    console.error("VT File Scan Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: "Failed to scan file",
      details: error.response?.data?.error?.message || error.message 
    });
  }
});

// Final error handler to catch unhandled errors and return JSON
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[Unhandled Error]", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    details: err.message
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Security Server running on http://localhost:${PORT}`);
  });
}

startServer();
