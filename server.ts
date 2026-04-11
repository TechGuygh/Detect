import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = 3000;
const JWT_SECRET = "sentinel-secret-key";

app.use(cors());
app.use(express.json());

// Mock Data
let logs: any[] = [];
let alerts: any[] = [];
let blockedIPs = new Set<string>();
let failedAttempts: Record<string, { count: number; lastAttempt: number }> = {};

// Helper to generate random logs
const usernames = ["admin", "user1", "guest", "dev_ops", "security_bot", "unknown"];
const locations = ["New York, USA", "London, UK", "Tokyo, JP", "Berlin, DE", "Accra, GH", "Moscow, RU"];
const ips = ["192.168.1.1", "10.0.0.5", "172.16.0.10", "45.12.33.1", "88.201.5.12", "203.0.113.42"];

function generateLog() {
  const isFailed = Math.random() > 0.7;
  const ip = ips[Math.floor(Math.random() * ips.length)];
  
  if (blockedIPs.has(ip)) return null;

  const log = {
    id: Math.random().toString(36).substr(2, 9),
    username: usernames[Math.floor(Math.random() * usernames.length)],
    ip: ip,
    timestamp: new Date().toISOString(),
    status: isFailed ? "failed" : "success",
    location: locations[Math.floor(Math.random() * locations.length)],
  };

  logs.unshift(log);
  if (logs.length > 100) logs.pop();

  // Threat Detection Logic
  detectThreats(log);

  return log;
}

function detectThreats(log: any) {
  const now = Date.now();

  // 1. Brute Force Detection
  if (log.status === "failed") {
    if (!failedAttempts[log.ip]) {
      failedAttempts[log.ip] = { count: 0, lastAttempt: now };
    }
    
    const timeDiff = now - failedAttempts[log.ip].lastAttempt;
    if (timeDiff < 60000) { // 1 minute window
      failedAttempts[log.ip].count++;
    } else {
      failedAttempts[log.ip].count = 1;
    }
    failedAttempts[log.ip].lastAttempt = now;

    if (failedAttempts[log.ip].count >= 5) {
      const alert = {
        id: Math.random().toString(36).substr(2, 9),
        type: "brute_force",
        severity: "high",
        message: `Brute force attack detected from IP ${log.ip}. 5+ failed attempts in 1 min.`,
        timestamp: new Date().toISOString(),
        ip: log.ip,
      };
      alerts.unshift(alert);
      io.emit("new_alert", alert);
      
      // Auto-block simulation
      blockedIPs.add(log.ip);
      io.emit("ip_blocked", log.ip);
      
      // Reset counter after block
      failedAttempts[log.ip].count = 0;
    }
  }

  // 2. Unusual Location Detection (Simulated)
  if (log.location === "Moscow, RU" && log.username === "admin") {
    const alert = {
      id: Math.random().toString(36).substr(2, 9),
      type: "unusual_location",
      severity: "medium",
      message: `Admin login attempt from unusual location: ${log.location}`,
      timestamp: new Date().toISOString(),
      ip: log.ip,
    };
    alerts.unshift(alert);
    io.emit("new_alert", alert);
  }
}

// API Routes
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  // Simple mock auth
  if (password === "password") {
    const role = username === "admin" ? "admin" : "viewer";
    const token = jwt.sign({ username, role }, JWT_SECRET, { expiresIn: "1h" });
    return res.json({ token, role, username });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

app.get("/api/logs", (req, res) => res.json(logs));
app.get("/api/alerts", (req, res) => res.json(alerts));
app.get("/api/stats", (req, res) => {
  res.json({
    total: logs.length,
    failed: logs.filter(l => l.status === "failed").length,
    highRisk: alerts.filter(a => a.severity === "high").length,
    blocked: blockedIPs.size,
  });
});

app.post("/api/block-ip", (req, res) => {
  const { ip } = req.body;
  blockedIPs.add(ip);
  io.emit("ip_blocked", ip);
  res.json({ success: true });
});

app.post("/api/unblock-ip", (req, res) => {
  const { ip } = req.body;
  blockedIPs.delete(ip);
  io.emit("ip_unblocked", ip);
  res.json({ success: true });
});

// Real-time loop
setInterval(() => {
  const log = generateLog();
  if (log) {
    io.emit("new_log", log);
  }
}, 3000);

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
