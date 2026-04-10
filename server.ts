import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-sentinel-key";

interface LogEntry {
  id: string;
  username: string;
  ip: string;
  timestamp: string;
  status: "success" | "failed";
  location: string;
}

interface Alert {
  id: string;
  type: "brute_force" | "rapid_login" | "unusual_location";
  severity: "low" | "medium" | "high";
  message: string;
  timestamp: string;
  ip: string;
}

const logs: LogEntry[] = [];
const alerts: Alert[] = [];
const blockedIPs = new Set<string>();

interface UserAccount {
  id: string;
  username: string;
  role: "admin" | "viewer";
  createdAt: string;
}

const users: UserAccount[] = [
  { id: "1", username: "admin", role: "admin", createdAt: new Date().toISOString() },
  { id: "2", username: "viewer", role: "viewer", createdAt: new Date().toISOString() },
];

interface SecurityConfig {
  failedAttemptThreshold: number;
  autoBlockEnabled: boolean;
  blockedIPRanges: string[];
}

let securityConfig: SecurityConfig = {
  failedAttemptThreshold: 3,
  autoBlockEnabled: true,
  blockedIPRanges: [],
};

// Mock data generator
const USERNAMES = ["admin", "jdoe", "msmith", "root", "guest", "dev_ops"];
const IPS = ["192.168.1.1", "10.0.0.5", "172.16.0.10", "45.33.22.11", "88.99.100.121"];
const LOCATIONS = ["New York, US", "London, UK", "Tokyo, JP", "Berlin, DE", "Moscow, RU", "Beijing, CN"];

function generateLog() {
  const ip = IPS[Math.floor(Math.random() * IPS.length)];
  
  if (blockedIPs.has(ip)) return null;

  const status = Math.random() > 0.3 ? "success" : "failed";
  const log: LogEntry = {
    id: Math.random().toString(36).substr(2, 9),
    username: USERNAMES[Math.floor(Math.random() * USERNAMES.length)],
    ip,
    timestamp: new Date().toISOString(),
    status,
    location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
  };
  
  logs.unshift(log);
  if (logs.length > 100) logs.pop();
  
  detectSuspicious(log);
  
  return log;
}

function detectSuspicious(log: LogEntry) {
  // Brute force: X failed attempts from same IP in last 1 min
  const recentFailed = logs.filter(l => 
    l.ip === log.ip && 
    l.status === "failed" && 
    (new Date().getTime() - new Date(l.timestamp).getTime()) < 60000
  );

  if (recentFailed.length >= securityConfig.failedAttemptThreshold) {
    const alert: Alert = {
      id: Math.random().toString(36).substr(2, 9),
      type: "brute_force",
      severity: "high",
      message: `Brute force detected from IP ${log.ip} (${recentFailed.length} failed attempts)`,
      timestamp: new Date().toISOString(),
      ip: log.ip
    };
    
    if (!alerts.find(a => a.ip === log.ip && a.type === "brute_force")) {
      alerts.unshift(alert);
      
      // Auto-block if enabled
      if (securityConfig.autoBlockEnabled) {
        blockedIPs.add(log.ip);
        // We'll need access to 'io' here, so we'll handle emission in the caller or pass io
      }
    }
  }

  // Unusual location
  if (log.location.includes("Moscow") || log.location.includes("Beijing")) {
    const alert: Alert = {
      id: Math.random().toString(36).substr(2, 9),
      type: "unusual_location",
      severity: "medium",
      message: `Unusual login location: ${log.location} for user ${log.username}`,
      timestamp: new Date().toISOString(),
      ip: log.ip
    };
    alerts.unshift(alert);
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (user && password === "password") {
      const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
      return res.json({ token, role: user.role, username: user.username });
    }
    res.status(401).json({ error: "Invalid credentials" });
  });

  // User Management
  app.get("/api/users", (req, res) => res.json(users));
  app.post("/api/users", (req, res) => {
    const { username, role } = req.body;
    const newUser: UserAccount = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      role,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    res.json(newUser);
  });
  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { username, role } = req.body;
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], username, role };
      res.json(users[index]);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });
  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users.splice(index, 1);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // Config
  app.get("/api/config", (req, res) => res.json(securityConfig));
  app.post("/api/config", (req, res) => {
    securityConfig = { ...securityConfig, ...req.body };
    io.emit("config_updated", securityConfig);
    res.json(securityConfig);
  });

  app.get("/api/logs", (req, res) => {
    res.json(logs);
  });

  app.get("/api/alerts", (req, res) => {
    res.json(alerts);
  });

  app.post("/api/block-ip", (req, res) => {
    const { ip } = req.body;
    if (ip) {
      blockedIPs.add(ip);
      io.emit("ip_blocked", ip);
      res.json({ success: true, blockedIPs: Array.from(blockedIPs) });
    } else {
      res.status(400).json({ error: "IP is required" });
    }
  });

  app.post("/api/unblock-ip", (req, res) => {
    const { ip } = req.body;
    if (ip) {
      blockedIPs.delete(ip);
      io.emit("ip_unblocked", ip);
      res.json({ success: true, blockedIPs: Array.from(blockedIPs) });
    } else {
      res.status(400).json({ error: "IP is required" });
    }
  });

  app.get("/api/stats", (req, res) => {
    const totalLogins = logs.length;
    const failedAttempts = logs.filter(l => l.status === "failed").length;
    const activeThreats = alerts.length;
    res.json({ totalLogins, failedAttempts, activeThreats, blockedCount: blockedIPs.size });
  });

  // Socket.io
  io.on("connection", (socket) => {
    console.log("Client connected");
    socket.emit("initial_logs", logs);
    socket.emit("initial_alerts", alerts);
    socket.emit("initial_blocked_ips", Array.from(blockedIPs));
    socket.emit("initial_config", securityConfig);
  });

  // Simulator
  setInterval(() => {
    const log = generateLog();
    if (log) {
      io.emit("new_log", log);
      // Check if detection auto-blocked
      if (blockedIPs.has(log.ip)) {
        io.emit("ip_blocked", log.ip);
      }
    }
    if (alerts.length > 0) {
      io.emit("new_alert", alerts[0]);
    }
  }, 5000);

  // Vite middleware for development
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

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
