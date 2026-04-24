import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Users, 
  Search, 
  Filter, 
  Bell,
  Lock,
  LogOut,
  Globe,
  Terminal,
  Sun,
  Moon,
  Ban,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Settings,
  UserPlus,
  Trash2,
  Edit2,
  Info,
  ChevronRight,
  ShieldX,
  History,
  Key,
  RefreshCw,
  Zap,
  MapPin,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";
import { toast, Toaster } from "sonner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as d3 from "d3";
import { GoogleGenAI, Type } from "@google/genai";

import { auth, db } from "./firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updatePassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  addDoc,
  limit,
  getDocFromServer,
  where,
  getDocs
} from "firebase/firestore";

// Types
interface LogEntry {
  id: string;
  username: string;
  ip: string;
  timestamp: any;
  status: "success" | "failed";
  location: string;
  city?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  riskScore?: number;
}

interface UserAccount {
  id: string;
  username: string;
  role: "admin" | "viewer";
  createdAt: any;
  email: string;
}

interface AuditLog {
  id: string;
  adminUsername: string;
  action: string;
  targetUsername: string;
  timestamp: any;
}

interface Alert {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  timestamp: any;
  ip: string;
  location?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: "info" | "warning" | "error";
}

interface User {
  uid: string;
  email: string;
  username: string;
  role: "admin" | "viewer";
}

interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  url: string;
  category: string;
  timestamp: any;
  ip: string;
  action: "allowed" | "blocked" | "flagged";
  duration?: number;
}

interface SystemSettings {
  bruteForceAttempts: number;
  bruteForceTimeframe: number; // in minutes
  riskScoreThreshold: number;
  autoBlockEnabled: boolean;
  realtimeNotifications: boolean;
}

// Components
const WorldMap = ({ logs }: { logs: LogEntry[] }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear before redraw

    const width = 800;
    const height = 400;

    const projection = d3.geoMercator()
      .scale(120)
      .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then((data: any) => {
      svg.selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path as any)
        .attr("fill", "#18181b")
        .attr("stroke", "#27272a")
        .attr("stroke-width", 0.5);

      const points = logs.filter(l => l.lat && l.lon);
      svg.selectAll("circle")
        .data(points)
        .enter()
        .append("circle")
        .attr("cx", d => projection([d.lon!, d.lat!])![0])
        .attr("cy", d => projection([d.lon!, d.lat!])![1])
        .attr("r", d => d.status === "failed" ? 4 : 2)
        .attr("fill", (d: any) => d.riskScore && d.riskScore > 50 ? "#f97316" : d.status === "failed" ? "#ef4444" : "#10b981")
        .attr("opacity", 0.6)
        .append("title")
        .text((d: any) => `${d.username} from ${d.city}, ${d.country} (Risk: ${d.riskScore || 'Low'})`);
    });
  }, [logs]);

  return (
    <div className="w-full flex justify-center bg-zinc-950 p-4 rounded-xl overflow-hidden border border-zinc-800">
      <svg ref={svgRef} viewBox="0 0 800 400" className="w-full h-auto" />
    </div>
  );
};

const Card = ({ children, className, ...props }: any) => (
  <div className={cn("bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden", className)} {...props}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className }: { children: React.ReactNode; variant?: "default" | "outline" | "destructive" | "secondary"; className?: string }) => {
  const variants = {
    default: "bg-zinc-800 text-zinc-100",
    outline: "border border-zinc-700 text-zinc-400",
    destructive: "bg-red-500/10 text-red-500 border border-red-500/20",
    secondary: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider", variants[variant], className)}>
      {children}
    </span>
  );
};

const Button = ({ children, onClick, variant = "primary", className, size = "md", icon: Icon }: any) => {
  const variants = {
    primary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
    secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
    ghost: "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "p-2",
  };
  return (
    <button 
      onClick={onClick} 
      className={cn("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50", variants[variant as keyof typeof variants], sizes[size as keyof typeof sizes], className)}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

const Input = ({ className, ...props }: any) => (
  <input 
    className={cn("w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all", className)} 
    {...props} 
  />
);

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({ total: 0, failed: 0, highRisk: 0, blocked: 0 });
  const [blockedIPs, setBlockedIPs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [theme, setTheme] = useState("dark");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activitySearch, setActivitySearch] = useState("");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isConfirmBlockModalOpen, setIsConfirmBlockModalOpen] = useState(false);
  const [pendingBlockValue, setPendingBlockValue] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanUrl, setScanUrl] = useState("");
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userForm, setUserForm] = useState({ username: "", email: "", password: "", role: "viewer" as "admin" | "viewer" });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [isGlobalSearchFocused, setIsGlobalSearchFocused] = useState(false);

  // Profile management
  const [profileUsername, setProfileUsername] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    bruteForceAttempts: 5,
    bruteForceTimeframe: 1,
    riskScoreThreshold: 75,
    autoBlockEnabled: true,
    realtimeNotifications: true
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("aidooemmanuel038@gmail.com");
  const [loginPassword, setLoginPassword] = useState("12345678");
  const [isSignUp, setIsSignUp] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");

  // Test Firestore Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const isDesignatedAdmin = firebaseUser.email === 'aidoo@gmail.com' || firebaseUser.email === 'aidooemmanuel038@gmail.com';
          const actualRole = isDesignatedAdmin ? 'admin' : userData.role;
          
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            username: userData.username,
            role: actualRole
          });

          // Sync role if it changed to admin
          if (isDesignatedAdmin && userData.role !== 'admin') {
            await updateDoc(doc(db, "users", firebaseUser.uid), { role: 'admin' });
            toast.info("Administrative privileges synchronized.");
          }
        } else {
          // Fallback if user doc doesn't exist yet (e.g. first login of default admin)
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            username: firebaseUser.email!.split('@')[0],
            role: (firebaseUser.email === 'aidoo@gmail.com' || firebaseUser.email === 'aidooemmanuel038@gmail.com') ? 'admin' : 'viewer'
          });
        }
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Data Listeners
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const logsQuery = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(100));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry));
      setLogs(newLogs);
    });

    const alertsQuery = query(collection(db, "alerts"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const newAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      setAlerts(newAlerts);
    });

    const blockedQuery = collection(db, "blockedIPs");
    const unsubscribeBlocked = onSnapshot(blockedQuery, (snapshot) => {
      const ips = snapshot.docs.map(doc => doc.data().ip);
      setBlockedIPs(ips);
    });

    if (user.role === "admin") {
      const usersQuery = collection(db, "users");
      const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAccount));
        setUsers(allUsers);
      });

      const auditQuery = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(100));
      const unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
        setAuditLogs(logs);
      });

      const settingsDoc = doc(db, "settings", "threatDetection");
      const unsubscribeSettings = onSnapshot(settingsDoc, (docSnap) => {
        if (docSnap.exists()) {
          setSystemSettings(docSnap.data() as SystemSettings);
        }
      });

      const activitiesQuery = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"), limit(200));
      const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
        const newActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
        setActivityLogs(newActivities);
      });

      return () => {
        unsubscribeLogs();
        unsubscribeAlerts();
        unsubscribeBlocked();
        unsubscribeUsers();
        unsubscribeAudit();
        unsubscribeSettings();
        unsubscribeActivities();
      };
    }

    const activitiesQuery = query(collection(db, "activityLogs"), where("userId", "==", user.uid), orderBy("timestamp", "desc"), limit(100));
    const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
      const newActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      setActivityLogs(newActivities);
    });

    return () => {
      unsubscribeLogs();
      unsubscribeAlerts();
      unsubscribeBlocked();
      unsubscribeActivities();
    };
  }, [user, isAuthReady]);

  const globalSearchResults = useMemo(() => {
    if (!globalSearchQuery || globalSearchQuery.length < 2) return null;
    const q = globalSearchQuery.toLowerCase();
    
    return {
      logs: logs.filter(l => l.username.toLowerCase().includes(q) || l.ip.includes(q)).slice(0, 5),
      alerts: alerts.filter(a => a.message.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)).slice(0, 5),
      users: users.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 3),
      activity: activityLogs.filter(a => a.url.toLowerCase().includes(q) || a.username.toLowerCase().includes(q)).slice(0, 5)
    };
  }, [globalSearchQuery, logs, alerts, users, activityLogs]);

  // Update Stats based on local data
  useEffect(() => {
    const failed = logs.filter(l => l.status === "failed").length;
    const highRisk = alerts.filter(a => a.severity === "high").length;
    setStats({
      total: logs.length,
      failed,
      highRisk,
      blocked: blockedIPs.length
    });
  }, [logs, alerts, blockedIPs]);

  const getIpInfo = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const defaultInfo = { 
      ip: "127.0.0.1", 
      location: "Unknown", 
      city: "Unknown", 
      country: "Unknown",
      countryCode: "XX",
      lat: 0,
      lon: 0
    };

    try {
      const ipRes = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
      const { ip } = await ipRes.json();
      
      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
      const geo = await geoRes.json();
      
      clearTimeout(timeoutId);

      return {
        ip: ip || defaultInfo.ip,
        city: geo.city || defaultInfo.city,
        country: geo.country_name || defaultInfo.country,
        countryCode: geo.country_code || defaultInfo.countryCode,
        location: `${geo.city || "Unknown"}, ${geo.country_name || "Unknown"}`,
        lat: geo.latitude || defaultInfo.lat,
        lon: geo.longitude || defaultInfo.lon
      };
    } catch (error) {
      console.error("Failed to fetch IP info:", error);
      clearTimeout(timeoutId);
      return defaultInfo;
    }
  };

  const lastActivityRef = useRef<number>(0);
  const THROTTLE_MS = 2000;

  const logActivity = async (url: string, category: string = "web_access", action: "allowed" | "blocked" | "flagged" = "allowed") => {
    if (!user) return;
    
    // Throttle to prevent database flooding, except for critical actions
    const now = Date.now();
    if (category !== "internal_navigation" && category !== "auth_action" && now - lastActivityRef.current < THROTTLE_MS) {
      return;
    }
    lastActivityRef.current = now;

    try {
      let ip = "127.0.0.1";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const ipRes = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
        const data = await ipRes.json();
        ip = data.ip || ip;
        clearTimeout(timeoutId);
      } catch (ipErr) {
        console.warn("Failed to fetch IP for activity log, using fallback", ipErr);
      }

      await addDoc(collection(db, "activityLogs"), {
        userId: user.uid,
        username: user.username,
        url: url || "unknown",
        category: category || "web_access",
        timestamp: serverTimestamp(),
        ip: ip,
        action: action || "allowed"
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const handleGlobalInteraction = (e: MouseEvent | KeyboardEvent) => {
      let targetInfo = "unknown_element";
      if (e.target instanceof HTMLElement) {
        targetInfo = e.target.tagName.toLowerCase() + (e.target.id ? `#${e.target.id}` : "") + (e.target.innerText ? `: ${e.target.innerText.slice(0, 20)}` : "");
      }
      
      const type = e.type === "click" ? "user_click" : "user_input";
      logActivity(`Interaction: ${targetInfo}`, type);
    };

    window.addEventListener("click", handleGlobalInteraction);
    // Only track keys if they are not inside password fields (handled by browser naturally, but good to be specific)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        handleGlobalInteraction(e);
      }
    });

    return () => {
      window.removeEventListener("click", handleGlobalInteraction);
      window.removeEventListener("keydown", handleGlobalInteraction);
    };
  }, [user, isAuthReady]);

  useEffect(() => {
    if (user && isAuthReady) {
      logActivity(`https://sentinel.security/dashboard/${activeTab}`, "internal_navigation");
    }
  }, [activeTab]);

  // Analytics Data Processing
  const authTimelineData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      success: 0,
      failed: 0
    }));

    logs.forEach(log => {
      const date = log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : new Date();
      const hour = date.getHours();
      if (log.status === "success") hours[hour].success++;
      else hours[hour].failed++;
    });

    return hours;
  }, [logs]);

  const activityDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    activityLogs.forEach(log => {
      dist[log.category] = (dist[log.category] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [activityLogs]);

  const authStatusDistribution = useMemo(() => {
    const success = logs.filter(l => l.status === "success").length;
    const failed = logs.filter(l => l.status === "failed").length;
    return [
      { name: "Success", value: success },
      { name: "Failed", value: failed }
    ];
  }, [logs]);

  const topUsersData = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      counts[log.username] = (counts[log.username] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [logs]);

  const activityIntensityData = useMemo(() => {
    const categories = ["web_access", "file_download", "api_call", "internal_navigation", "user_click"];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return categories.map(cat => {
      const catLogs = activityLogs.filter(l => l.category === cat);
      if (catLogs.length === 0) return { name: cat, range: [0, 0], display: "" };

      const times = catLogs.map(l => l.timestamp?.seconds ? l.timestamp.seconds * 1000 : Date.now());
      const min = Math.min(...times);
      const max = Math.max(...times);

      // Start/End relative to 24h ago
      const start = Math.max(0, (min - twentyFourHoursAgo.getTime()) / (3600 * 1000));
      const end = Math.max(0.2, (max - twentyFourHoursAgo.getTime()) / (3600 * 1000));

      return { 
        name: cat.replace("_", " ").toUpperCase(), 
        range: [start, end],
        display: `${format(new Date(min), "HH:mm")} - ${format(new Date(max), "HH:mm")}`
      };
    }).filter(d => d.range[1] > d.range[0]);
  }, [activityLogs]);

  const alertTimelineData = useMemo(() => {
    const types = ["brute_force", "unusual_location", "pwned_credential"];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return types.map(type => {
      const typeAlerts = alerts.filter(a => a.type === type);
      if (typeAlerts.length === 0) return { name: type, range: [0, 0], display: "" };

      const times = typeAlerts.map(a => new Date(a.timestamp).getTime());
      const min = Math.min(...times);
      const max = Math.max(...times);

      const start = Math.max(0, (min - twentyFourHoursAgo.getTime()) / (3600 * 1000));
      const end = Math.max(0.5, (max - twentyFourHoursAgo.getTime()) / (3600 * 1000));

      return {
        name: type.replace("_", " ").toUpperCase(),
        range: [start, end],
        display: `${format(new Date(min), "HH:mm")} - ${format(new Date(max), "HH:mm")}`
      };
    }).filter(d => d.range[1] > d.range[0]);
  }, [alerts]);

  const calculateRiskScore = async (attempt: Partial<LogEntry>) => {
    try {
      const prompt = `Analyze this login attempt for security risk.
      System Settings:
      - Max Attempts: ${systemSettings.bruteForceAttempts}
      - Timeframe: ${systemSettings.bruteForceTimeframe} min
      - Risk Threshold: ${systemSettings.riskScoreThreshold}
      
      Attempt Details:
      - Username: ${attempt.username}
      - IP: ${attempt.ip}
      - Location: ${attempt.location}
      - Status: ${attempt.status}
      
      Return ONLY a JSON object with:
      {
        "score": number (0-100),
        "reason": string
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ["score", "reason"]
          }
        }
      });

      const data = JSON.parse(response.text);
      return data;
    } catch (error) {
      console.error("Risk score calculation failed:", error);
      return { score: 10, reason: "Default baseline risk" };
    }
  };

  const addNotification = (title: string, message: string, type: "info" | "warning" | "error" = "info") => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      timestamp: new Date(),
      read: false,
      type
    };
    setNotifications(prev => [newNotif, ...prev]);
    toast[type === "error" ? "error" : type === "warning" ? "warning" : "info"](`${title}: ${message}`);
  };

  const sendEmailAlert = async (to: string, subject: string, body: string) => {
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body })
      });
    } catch (error) {
      console.error("Failed to send email alert:", error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    
    const ipInfo = await getIpInfo();
    
    try {
      // Set persistence
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      let firebaseUser;
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
        firebaseUser = userCredential.user;
        
        // Initialize profile
        await setDoc(doc(db, "users", firebaseUser.uid), {
          username: loginEmail.split('@')[0],
          email: loginEmail,
          role: (loginEmail === 'aidoo@gmail.com' || loginEmail === 'aidooemmanuel038@gmail.com') ? 'admin' : 'viewer',
          createdAt: serverTimestamp(),
          typicalLocations: [ipInfo.location]
        });
        toast.success("Account created successfully!");
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        firebaseUser = userCredential.user;
      }
      
      // Fetch user profile
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      const userData = userDoc.data();
      
      const risk = await calculateRiskScore({
        username: userData?.username || loginEmail,
        ip: ipInfo.ip,
        location: ipInfo.location,
        status: "success"
      });

      // Log success
      const logData = {
        username: userData?.username || loginEmail || "unknown",
        ip: ipInfo.ip || "127.0.0.1",
        timestamp: serverTimestamp(),
        status: "success" as const,
        location: ipInfo.location || "Unknown",
        city: ipInfo.city || "Unknown",
        country: ipInfo.country || "Unknown",
        countryCode: ipInfo.countryCode || "XX",
        lat: ipInfo.lat ?? 0,
        lon: ipInfo.lon ?? 0,
        riskScore: risk?.score ?? 0
      };
      await addDoc(collection(db, "logs"), logData);

      // Check for unusual location
      const typicalLocations = userData?.typicalLocations || [];
      if (typicalLocations.length > 0 && !typicalLocations.includes(ipInfo.location)) {
        const alertMsg = `Unusual login location for ${userData?.username}: ${ipInfo.location}`;
        await addDoc(collection(db, "alerts"), {
          type: "unusual_location",
          severity: "medium",
          message: alertMsg,
          timestamp: serverTimestamp(),
          ip: ipInfo.ip,
          location: ipInfo.location
        });
        addNotification("Security Alert", alertMsg, "warning");
        if (userData?.email) {
          sendEmailAlert(userData.email, "Security Alert: Unusual Login Location", alertMsg);
        }
      }

      // Update typical locations (keep last 5)
      if (!typicalLocations.includes(ipInfo.location)) {
        const newLocations = [ipInfo.location, ...typicalLocations].slice(0, 5);
        await setDoc(doc(db, "users", firebaseUser.uid), { 
          typicalLocations: newLocations,
          username: userData?.username || firebaseUser.email!.split('@')[0],
          email: firebaseUser.email,
          role: userData?.role || (firebaseUser.email === 'aidoo@gmail.com' ? 'admin' : 'viewer'),
          createdAt: userData?.createdAt || serverTimestamp()
        }, { merge: true });
      }

      toast.success("Welcome back!");
    } catch (err: any) {
      setLoginError(err.message || "Invalid email or password");
      
      // Log failure
      await addDoc(collection(db, "logs"), {
        username: loginEmail || "unknown",
        ip: ipInfo.ip || "127.0.0.1",
        timestamp: serverTimestamp(),
        status: "failed",
        location: ipInfo.location || "Unknown",
        city: ipInfo.city || "Unknown",
        country: ipInfo.country || "Unknown",
        countryCode: ipInfo.countryCode || "XX",
        lat: ipInfo.lat ?? 0,
        lon: ipInfo.lon ?? 0
      });

      // Brute force detection
      const recentFailed = logs.filter(l => 
        l.ip === ipInfo.ip && 
        l.status === "failed" && 
        (Date.now() - (l.timestamp?.seconds * 1000 || Date.now())) < systemSettings.bruteForceTimeframe * 60000
      );

      if (recentFailed.length >= systemSettings.bruteForceAttempts) {
        const alertMsg = `Brute force detection from IP ${ipInfo.ip}: ${recentFailed.length + 1} attempts.`;
        await addDoc(collection(db, "alerts"), {
          type: "brute_force",
          severity: "high",
          message: alertMsg,
          timestamp: serverTimestamp(),
          ip: ipInfo.ip,
          location: ipInfo.location
        });
        addNotification("Critical Alert", alertMsg, "error");
        
        if (systemSettings.autoBlockEnabled && !blockedIPs.includes(ipInfo.ip)) {
          await addDoc(collection(db, "blockedIPs"), { ip: ipInfo.ip, blockedAt: serverTimestamp() });
          toast.error(`IP ${ipInfo.ip} has been automatically blocked.`);
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (err) {
      toast.error("Logout failed");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        username: profileUsername
      });
      setUser({ ...user, username: profileUsername });
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleProfilePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profilePassword) return;
    setIsUpdatingProfile(true);
    try {
      await updatePassword(auth.currentUser!, profilePassword);
      toast.success("Password changed successfully");
      setProfilePassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password. You may need to re-login first.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleResetPasswordEmail = async () => {
    if (!loginEmail) {
      toast.error("Please enter your email address");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      toast.success("Password reset email sent!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleBlockIP = async (ip: string, force: boolean = false) => {
    if (!force && user?.role !== "admin") return;
    const isBlocked = blockedIPs.includes(ip);
    try {
      if (isBlocked) {
        const q = query(collection(db, "blockedIPs"), where("ip", "==", ip));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (d) => await deleteDoc(doc(db, "blockedIPs", d.id)));
        toast.success(`IP Address Unblocked: ${ip}`);
      } else {
        await addDoc(collection(db, "blockedIPs"), { ip, blockedAt: serverTimestamp() });
        toast.warning(`IP Address Blocked: ${ip}`);
      }
      logAudit(isBlocked ? "UNBLOCK_IP" : "BLOCK_IP", ip);
    } catch (err) {
      console.error("Failed to toggle block", err);
      toast.error("Failed to update IP block status");
    }
  };

  const logAudit = async (action: string, targetUsername: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "auditLogs"), {
        adminUsername: user.username,
        action,
        targetUsername,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to log audit", err);
    }
  };

  const exportLogsCSV = () => {
    const headers = ["Timestamp", "Username", "IP Address", "Location", "Status"];
    const csvData = filteredLogs.map(log => [
      format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss"),
      log.username,
      log.ip,
      log.location,
      log.status
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `security_logs_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Logs exported to CSV");
  };

  const exportLogsPDF = () => {
    const doc = new jsPDF();
    doc.text("Sentinel Security Dashboard - Authentication Logs", 14, 15);
    
    const tableData = filteredLogs.map(log => [
      format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss"),
      log.username,
      log.ip,
      log.location,
      log.status
    ]);

    (doc as any).autoTable({
      head: [["Timestamp", "Username", "IP Address", "Location", "Status"]],
      body: tableData,
      startY: 20,
    });

    doc.save(`security_logs_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    toast.success("Logs exported to PDF");
  };

  const handleSaveUser = async () => {
    if (!userForm.email || !userForm.username || (!editingUser && !userForm.password)) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingUser) {
        await updateDoc(doc(db, "users", editingUser.id), {
          username: userForm.username,
          role: userForm.role
        });
        toast.success("User updated successfully");
        logAudit("UPDATE_USER", userForm.username);
      } else {
        // For new users, we'd ideally use a cloud function or admin SDK
        // Since we are in a client-side environment, we'll suggest manual creation or use a placeholder
        // In a real app, this would call a secure backend endpoint
        toast.info("User creation requires Admin SDK. Please use Firebase Console for new users.");
      }
      setIsUserModalOpen(false);
      setUserForm({ username: "", email: "", password: "", role: "viewer" });
    } catch (err: any) {
      toast.error(err.message || "Failed to save user");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const u = users.find(user => user.id === id);
      await deleteDoc(doc(db, "users", id));
      toast.success("User deleted");
      if (u) logAudit("DELETE_USER", u.username);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const handleResetPassword = async (id: string) => {
    const u = users.find(user => user.id === id);
    if (!u) return;
    if (!confirm(`Send password reset email to ${u.email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, u.email);
      toast.success("Password reset email sent!");
      logAudit("RESET_PASSWORD", u.username);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success("Password updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    }
  };

  const handleSaveSettings = async () => {
    if (user?.role !== "admin") return;
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, "settings", "threatDetection"), systemSettings);
      toast.success("Settings saved successfully");
      logAudit("UPDATE_SETTINGS", "System");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.username.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesIp = log.ip.includes(ipFilter);
      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      return matchesSearch && matchesIp && matchesStatus;
    });
  }, [logs, searchTerm, ipFilter, statusFilter]);

  const chartData = useMemo(() => {
    const data: any[] = [];
    for (let i = 9; i >= 0; i--) {
      const time = new Date(Date.now() - i * 60000);
      const label = format(time, "HH:mm");
      const count = logs.filter(l => {
        const logTime = new Date(l.timestamp);
        return logTime.getMinutes() === time.getMinutes() && logTime.getHours() === time.getHours();
      }).length;
      data.push({ time: label, attempts: count });
    }
    return data;
  }, [logs]);

  const alertDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    alerts.forEach(a => {
      dist[a.type] = (dist[a.type] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ 
      name: name.replace("_", " ").toUpperCase(), 
      value 
    }));
  }, [alerts]);

  const ALERT_COLORS = ["#ef4444", "#a855f7", "#f97316", "#3b82f6"];

  if (mustChangePassword) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-2 border border-zinc-700">
                <Key className="w-6 h-6 text-zinc-100" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
              <p className="text-zinc-500 text-sm text-center">You must change your password before continuing.</p>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">New Password</label>
                <Input 
                  type="password"
                  placeholder="••••••••" 
                  value={newPassword} 
                  onChange={(e: any) => setNewPassword(e.target.value)} 
                  required
                />
              </div>
              <Button className="w-full" type="submit">Update Password</Button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Initializing Security Systems...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1920')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="bg-zinc-900/40 backdrop-blur-xl border-zinc-800/50 text-zinc-100 shadow-2xl overflow-hidden">
            <div className="p-8 space-y-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
              <div className="flex flex-col items-center space-y-2 relative z-10">
                <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4 border border-zinc-700/50 backdrop-blur-sm shadow-xl">
                  <Shield className="w-8 h-8 text-blue-400" />
                </div>
                <h1 className="text-3xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
                  Sentinel Security
                </h1>
                <p className="text-zinc-400 text-sm font-medium">Enterprise Threat Intelligence</p>
              </div>
              
              <form onSubmit={handleLogin} className="space-y-5 relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Access Identity (Email)</label>
                  <Input 
                    placeholder="admin@example.com" 
                    className="bg-zinc-950/50 border-zinc-800 focus:border-blue-500/50 transition-all h-11"
                    value={loginEmail} 
                    onChange={(e: any) => setLoginEmail(e.target.value)} 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Security Key</label>
                    {!isSignUp && (
                      <button 
                        type="button"
                        onClick={handleResetPasswordEmail}
                        className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="bg-zinc-950/50 border-zinc-800 focus:border-blue-500/50 transition-all h-11"
                    value={loginPassword} 
                    onChange={(e: any) => setLoginPassword(e.target.value)} 
                    required
                  />
                </div>
                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-blue-500 focus:ring-blue-500/20"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400 transition-colors">Remember Me</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                  >
                    {isSignUp ? "Back to Login" : "Create Account"}
                  </button>
                </div>
                {loginError && (
                  <motion.p 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-red-400 text-xs font-medium bg-red-400/10 p-2 rounded border border-red-400/20"
                  >
                    {loginError}
                  </motion.p>
                )}
                <Button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-600/20" type="submit">
                  {isSignUp ? "Establish Identity" : "Initialize Session"}
                </Button>
              </form>
              
              <div className="text-center space-y-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Authorized Access Only</span>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">
                  DEMO_UID: aidooemmanuel038@gmail.com // DEMO_KEY: 12345678
                </p>
              </div>
            </div>
          </Card>
          <p className="text-center mt-6 text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium">
            &copy; 2026 Sentinel Defense Systems
          </p>
        </motion.div>
      </div>
    );
  }

  const handleScanUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanUrl) return;
    setIsScanning(true);
    setScanResult(null);

    try {
      const res = await fetch("/api/scan/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scanUrl })
      });
      
      if (!res.ok) {
        const text = await res.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || `Server error: ${res.status}`);
        } catch (e) {
          throw new Error(`Unexpected server response (${res.status}). Please check server logs.`);
        }
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const interval = setInterval(async () => {
        try {
          const reportRes = await fetch(`/api/scan/report/${data.analysisId}`);
          if (!reportRes.ok) {
            console.error("Polling error status:", reportRes.status);
            return;
          }
          const reportData = await reportRes.json();
          
          if (reportData.data.attributes.status === "completed") {
            clearInterval(interval);
            setScanResult(reportData.data.attributes.results);
            setIsScanning(false);
            toast.success("Scan completed successfully");
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(interval);
        if (isScanning) {
          setIsScanning(false);
          toast.error("Scan timed out or encountered an issue. Please try again.");
        }
      }, 60000);

    } catch (error: any) {
      toast.error(error.message);
      setIsScanning(false);
    }
  };

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanResult(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/scan/file", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        const text = await res.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || `Server error: ${res.status}`);
        } catch (e) {
          throw new Error(`Unexpected server response (${res.status}). Please check server logs.`);
        }
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const interval = setInterval(async () => {
        try {
          const reportRes = await fetch(`/api/scan/report/${data.analysisId}`);
          if (!reportRes.ok) {
            console.error("Polling error status:", reportRes.status);
            return;
          }
          const reportData = await reportRes.json();
          
          if (reportData.data.attributes.status === "completed") {
            clearInterval(interval);
            setScanResult(reportData.data.attributes.results);
            setIsScanning(false);
            toast.success("File scan completed successfully");
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    } catch (error: any) {
      toast.error(error.message);
      setIsScanning(false);
    }
  };

  return (
    <div className={cn("min-h-screen transition-colors duration-300", theme === "dark" ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900")}>
      <Toaster position="top-right" theme={theme as any} />
      
      {/* Sidebar */}
      <aside className={cn("fixed left-0 top-0 h-full w-64 border-r transition-colors z-50 hidden lg:block", theme === "dark" ? "bg-zinc-950 border-zinc-900" : "bg-white border-zinc-200")}>
        <div className="p-6 flex items-center gap-3 border-b border-zinc-900/50">
          <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center">
            <Shield className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
          </div>
          <span className="font-bold tracking-tight text-lg">Sentinel</span>
        </div>
        <div className="p-4 space-y-2">
          <NavItem active={activeTab === "overview"} onClick={() => setActiveTab("overview")} icon={Activity}>Overview</NavItem>
          <NavItem active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")} icon={ShieldCheck}>Analytics</NavItem>
          <NavItem active={activeTab === "logs"} onClick={() => setActiveTab("logs")} icon={Terminal}>Auth Logs</NavItem>
          <NavItem active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")} icon={AlertTriangle}>Threats</NavItem>
          {user.role === "admin" && (
            <NavItem active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={Users}>Users</NavItem>
          )}
          {user.role === "admin" && (
            <NavItem active={activeTab === "audit"} onClick={() => setActiveTab("audit")} icon={History}>Audit Log</NavItem>
          )}
          <NavItem active={activeTab === "scanner"} onClick={() => setActiveTab("scanner")} icon={ShieldCheck}>Malware Scanner</NavItem>
          <NavItem active={activeTab === "activity"} onClick={() => setActiveTab("activity")} icon={Globe}>Web Activity</NavItem>
          <NavItem active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={Settings}>Settings</NavItem>
          <NavItem active={activeTab === "profile"} onClick={() => {
            setActiveTab("profile");
            setProfileUsername(user.username);
          }} icon={Key}>Profile Settings</NavItem>
        </div>
        
        <div className="px-6 py-4">
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Risk Score</span>
              <span className={cn("text-xs font-bold", alerts.length > 5 ? "text-red-500" : "text-emerald-500")}>
                {Math.min(100, alerts.length * 15)}/100
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className={cn("h-full", alerts.length > 5 ? "bg-red-500" : "bg-emerald-500")}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, alerts.length * 15)}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">
              {alerts.length > 5 ? "High risk detected. Immediate action required." : "System status is currently stable."}
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-zinc-900/50">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer" onClick={handleLogout}>
            <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-[10px] text-zinc-500 uppercase">{user.role}</p>
            </div>
            <LogOut className="w-4 h-4 text-zinc-500" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 min-h-screen">
        {/* Header */}
        <header className={cn("sticky top-0 z-40 border-b backdrop-blur-md transition-colors", theme === "dark" ? "bg-zinc-950/80 border-zinc-900" : "bg-white/80 border-zinc-200")}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Security Dashboard</h2>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                Live Monitoring
              </Badge>
            </div>
            <div className="flex items-center gap-4 flex-1 max-w-2xl px-8">
              <div className="relative w-full group">
                <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", isGlobalSearchFocused ? "text-blue-500" : "text-zinc-500")} />
                <Input 
                  placeholder="Universal Search (Users, Logs, Threats...)" 
                  className="pl-10 h-10 bg-zinc-900/50 border-zinc-800 focus:bg-zinc-900 transition-all"
                  value={globalSearchQuery}
                  onChange={(e: any) => setGlobalSearchQuery(e.target.value)}
                  onFocus={() => setIsGlobalSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsGlobalSearchFocused(false), 200)}
                />
                
                <AnimatePresence>
                  {isGlobalSearchFocused && globalSearchResults && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[60] overflow-hidden p-2 space-y-1"
                    >
                      {Object.values(globalSearchResults).every(list => (list as any[]).length === 0) ? (
                        <div className="p-8 text-center text-zinc-500 text-sm">No global matches found for "{globalSearchQuery}"</div>
                      ) : (
                        <>
                          {globalSearchResults.users.length > 0 && (
                            <div className="space-y-1">
                              <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Identities</p>
                              {globalSearchResults.users.map(u => (
                                <button key={u.id} className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 flex items-center gap-3 transition-colors" onClick={() => { setActiveTab("users"); setGlobalSearchQuery(""); }}>
                                  <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-md">
                                    <Users className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="text-sm font-medium">{u.username}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {globalSearchResults.alerts.length > 0 && (
                            <div className="space-y-1 pt-2">
                              <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-orange-500">Threat Alerts</p>
                              {globalSearchResults.alerts.map(a => (
                                <button key={a.id} className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 flex flex-col gap-0.5 transition-colors" onClick={() => { setActiveTab("alerts"); setGlobalSearchQuery(""); }}>
                                  <span className="text-xs font-semibold">{a.type}</span>
                                  <span className="text-[10px] text-zinc-500 truncate">{a.message}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {globalSearchResults.logs.length > 0 && (
                            <div className="space-y-1 pt-2">
                              <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-emerald-500">Security Logs</p>
                              {globalSearchResults.logs.map(l => (
                                <button key={l.id} className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 flex items-center justify-between transition-colors" onClick={() => { setActiveTab("logs"); setGlobalSearchQuery(""); setSelectedLog(l); }}>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium">{l.username}</span>
                                    <span className="text-[10px] text-zinc-500">{l.ip}</span>
                                  </div>
                                  <Badge variant={l.status === "success" ? "secondary" : "destructive"}>{l.status}</Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <div className="relative">
                <Button variant="ghost" size="icon" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative">
                  <Bell className="w-4 h-4" />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-950" />
                  )}
                </Button>
                
                <AnimatePresence>
                  {isNotificationsOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                        <h4 className="font-bold text-sm">Notifications</h4>
                        <button 
                          className="text-xs text-zinc-500 hover:text-zinc-300"
                          onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-zinc-600 text-sm">No new notifications</div>
                        ) : (
                          notifications.map(n => (
                            <div key={n.id} className={cn("p-4 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors", !n.read && "bg-blue-500/5")}>
                              <div className="flex items-start gap-3">
                                <div className={cn("mt-1 p-1.5 rounded-lg", 
                                  n.type === "error" ? "bg-red-500/10 text-red-500" : 
                                  n.type === "warning" ? "bg-orange-500/10 text-orange-500" : 
                                  "bg-blue-500/10 text-blue-500"
                                )}>
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-bold text-zinc-200">{n.title}</p>
                                  <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{n.message}</p>
                                  <p className="text-[9px] text-zinc-600 mt-1 uppercase">
                                    {format(n.timestamp, "HH:mm:ss")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-8">
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Attempts" value={stats.total} icon={Activity} trend="+12%" />
                <StatCard title="Failed Logins" value={stats.failed} icon={Lock} color="text-red-500" trend="+5%" />
                <StatCard title="Active Threats" value={stats.highRisk} icon={AlertTriangle} color="text-orange-500" />
                <StatCard title="Blocked IPs" value={stats.blocked} icon={Ban} />
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Auth Distribution</h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={authStatusDistribution}
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {authStatusDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#3b82f6" : "#ef4444"} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="xl:col-span-2 p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Activity Volume (Hourly)</h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={authTimelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} strokeOpacity={0.5} />
                        <XAxis dataKey="hour" stroke="#52525b" fontSize={8} tickLine={false} axisLine={false} />
                        <YAxis stroke="#52525b" fontSize={8} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px" }} />
                        <Bar dataKey="success" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="failed" fill="#ef4444" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Geographic and Alerts Section */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-2 p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Live Threat Map</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-zinc-500 uppercase">Successful</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-[10px] text-zinc-500 uppercase">Failed</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[300px]">
                    <WorldMap logs={logs} />
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Recent Alerts</h3>
                  <div className="space-y-4">
                    {alerts.slice(0, 5).map(alert => (
                      <div key={alert.id} className="flex gap-4 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                        <div className={cn("p-2 rounded-full h-fit", alert.severity === "high" ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500")}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium leading-tight">{alert.message}</p>
                          <p className="text-[10px] text-zinc-500">{format(new Date(alert.timestamp), "HH:mm:ss")}</p>
                        </div>
                      </div>
                    ))}
                    {alerts.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                        <ShieldCheck className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-xs">No active threats detected</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Recent Logs Table */}
              <Card className="overflow-hidden">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Recent Activity</h3>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("logs")}>View All Logs</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-medium">Identity</th>
                        <th className="px-6 py-3 font-medium">Address</th>
                        <th className="px-6 py-3 font-medium">Geographical Origin</th>
                        <th className="px-6 py-3 font-medium">Risk</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {logs.slice(0, 8).map(log => (
                        <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 font-medium">{log.username}</td>
                          <td className="px-6 py-4 font-mono text-xs text-zinc-400">{log.ip}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-zinc-400">
                              {log.countryCode && (
                                <img 
                                  src={`https://flagcdn.com/w20/${log.countryCode.toLowerCase()}.png`} 
                                  alt={log.countryCode}
                                  className="w-4 h-auto opacity-70"
                                />
                              )}
                              <span>{log.city}, {log.country}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-1.5">
                                <div className={cn("w-1.5 h-1.5 rounded-full", (log.riskScore || 0) > 60 ? "bg-red-500" : (log.riskScore || 0) > 30 ? "bg-orange-500" : "bg-emerald-500")} />
                                <span className="text-[10px] font-mono">{log.riskScore || 0}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={log.status === "success" ? "secondary" : "destructive"}>
                              {log.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-500 text-xs">
                            {log.timestamp?.seconds 
                              ? format(new Date(log.timestamp.seconds * 1000), "HH:mm:ss") 
                              : format(new Date(), "HH:mm:ss")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-8 pb-12">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Security Analytics</h2>
                  <p className="text-sm text-zinc-500 mt-1">Deep visual insights into authentication traffic and behavioral patterns.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-3 py-1">
                    <Clock className="w-3 h-3 mr-1.5" />
                    Last 24 Hours
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Authentication Velocity</h3>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-[10px] text-zinc-500 uppercase">Success</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-[10px] text-zinc-500 uppercase">Failed</span>
                       </div>
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={authTimelineData}>
                        <defs>
                          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="hour" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px" }}
                          itemStyle={{ fontSize: "10px" }}
                        />
                        <Area type="monotone" dataKey="success" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSuccess)" strokeWidth={2} />
                        <Area type="monotone" dataKey="failed" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8">Login Success vs. Failure</h3>
                  <div className="h-[300px] flex items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={authStatusDistribution}
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {authStatusDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#3b82f6" : "#ef4444"} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-4 pr-8">
                       {authStatusDistribution.map((item, index) => (
                         <div key={item.name} className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-zinc-500">{item.name}</span>
                            <span className="text-2xl font-bold">{item.value}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8">Top Targeted Identities</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topUsersData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={100} />
                        <Tooltip 
                          cursor={{ fill: "transparent" }}
                          contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px" }}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8">Activity Categorization</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="name" stroke="#a1a1aa" fontSize={8} tickLine={false} axisLine={false} interval={0} />
                        <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px" }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                           {activityDistribution.map((_, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6 lg:col-span-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8">Activity Intensity Timelines (Last 24h)</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityIntensityData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} strokeOpacity={0.3} />
                        <XAxis type="number" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} domain={[0, 24]} hide />
                        <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} width={150} />
                        <Tooltip 
                          cursor={{ fill: "#27272a", opacity: 0.1 }}
                          contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px" }}
                          formatter={(value: any, name: string, props: any) => [props.payload.display, "Window"]}
                        />
                        <Bar dataKey="range" fill="#3b82f6" radius={4} barSize={24}>
                          {activityIntensityData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={["#3b82f6", "#ef4444", "#a855f7", "#f97316", "#10b981"][index % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex justify-between text-[10px] text-zinc-600 uppercase tracking-widest font-bold border-t border-zinc-900 pt-4">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-zinc-800" /> T-24 Hours</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-zinc-800" /> T-12 Hours</span>
                    <span className="flex items-center gap-2 text-zinc-400"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Real-time Now</span>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8">Alert Distribution</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={alertDistribution}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {alertDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={ALERT_COLORS[index % ALERT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {alertDistribution.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALERT_COLORS[index % ALERT_COLORS.length] }} />
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">{entry.name}</span>
                      </div>
                    ))}
                    {alerts.length === 0 && <span className="text-[10px] text-zinc-600 italic">No alerts recorded in this period</span>}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8">Threat Active Windows</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={alertTimelineData} layout="vertical">
                         <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} strokeOpacity={0.3} />
                         <XAxis type="number" domain={[0, 24]} hide />
                         <YAxis dataKey="name" type="category" stroke="#52525b" fontSize={10} width={120} tickLine={false} axisLine={false} />
                         <Tooltip 
                           cursor={{ fill: "#27272a", opacity: 0.1 }}
                           contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                           formatter={(value: any, name: string, props: any) => [props.payload.display, "Activity Window"]}
                         />
                         <Bar dataKey="range" radius={4} barSize={20}>
                            {alertTimelineData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={ALERT_COLORS[index % ALERT_COLORS.length]} />
                            ))}
                         </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex justify-between text-[8px] text-zinc-600 uppercase tracking-widest font-bold border-t border-zinc-900 pt-4">
                    <span>Severity Intensity</span>
                    <span>T-24h Monitoring</span>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                      placeholder="Filter by username..." 
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e: any) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                      placeholder="Filter by IP address..." 
                      className="pl-10 font-mono"
                      value={ipFilter}
                      onChange={(e: any) => setIpFilter(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={statusFilter === "all" ? "primary" : "secondary"} size="sm" onClick={() => setStatusFilter("all")}>All</Button>
                  <Button variant={statusFilter === "success" ? "primary" : "secondary"} size="sm" onClick={() => setStatusFilter("success")}>Success</Button>
                  <Button variant={statusFilter === "failed" ? "primary" : "secondary"} size="sm" onClick={() => setStatusFilter("failed")}>Failed</Button>
                  {user.role === "admin" && (
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="secondary" size="sm" onClick={exportLogsCSV}>CSV</Button>
                      <Button variant="secondary" size="sm" onClick={exportLogsPDF}>PDF</Button>
                    </div>
                  )}
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-medium">Identity</th>
                        <th className="px-6 py-3 font-medium">Network Address</th>
                        <th className="px-6 py-3 font-medium">Geo-Location</th>
                        <th className="px-6 py-3 font-medium">Risk Score</th>
                        <th className="px-6 py-3 font-medium text-center">Status</th>
                        <th className="px-6 py-3 font-medium text-right">Access Time</th>
                        {user.role === "admin" && <th className="px-6 py-3 font-medium text-right">Control</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      <AnimatePresence initial={false}>
                        {filteredLogs.map(log => (
                          <motion.tr 
                            key={log.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="px-6 py-4 font-medium">{log.username}</td>
                            <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                              {log.ip}
                              {blockedIPs.includes(log.ip) && <span className="ml-2 text-red-500 text-[8px] border border-red-500/30 px-1 rounded">BLOCKED</span>}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-zinc-400">
                                {log.countryCode && (
                                  <img 
                                    src={`https://flagcdn.com/w20/${log.countryCode.toLowerCase()}.png`} 
                                    alt={log.countryCode}
                                    className="w-4 h-auto opacity-70"
                                  />
                                )}
                                <span>{log.city}, {log.country}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden w-16">
                                  <div 
                                    className={cn("h-full", 
                                      (log.riskScore || 0) > 60 ? "bg-red-500" : 
                                      (log.riskScore || 0) > 30 ? "bg-orange-500" : "bg-emerald-500"
                                    )}
                                    style={{ width: `${log.riskScore || 10}%` }}
                                  />
                                </div>
                                <span className={cn("text-[10px] font-mono", (log.riskScore || 0) > 60 ? "text-red-500" : "text-zinc-400")}>
                                  {log.riskScore || 0}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant={log.status === "success" ? "secondary" : "destructive"}>
                                {log.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right text-zinc-500 text-xs">
                              {log.timestamp?.seconds 
                                ? format(new Date(log.timestamp.seconds * 1000), "HH:mm:ss") 
                                : format(new Date(), "HH:mm:ss")}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {user.role === "admin" && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => toggleBlockIP(log.ip)}
                                  className={blockedIPs.includes(log.ip) ? "text-emerald-500" : "text-red-500"}
                                >
                                  {blockedIPs.includes(log.ip) ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                </Button>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="space-y-8">
              {alerts.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="p-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Threat Distribution</h3>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={alertDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {alertDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={ALERT_COLORS[index % ALERT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                            itemStyle={{ color: '#f4f4f5' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      {alertDistribution.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ALERT_COLORS[index % ALERT_COLORS.length] }} />
                          <span className="text-[10px] text-zinc-400 uppercase font-bold">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6 lg:col-span-2">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Threat Active Windows (Last 24h)</h3>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={alertTimelineData} layout="vertical">
                           <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} strokeOpacity={0.3} />
                           <XAxis type="number" domain={[0, 24]} hide />
                           <YAxis dataKey="name" type="category" stroke="#52525b" fontSize={10} width={150} tickLine={false} axisLine={false} />
                           <Tooltip 
                             cursor={{ fill: "#27272a", opacity: 0.1 }}
                             contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                             formatter={(value: any, name: string, props: any) => [props.payload.display, "Active Window"]}
                           />
                           <Bar dataKey="range" fill="#ef4444" radius={4} barSize={24}>
                              {alertTimelineData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={ALERT_COLORS[index % ALERT_COLORS.length]} />
                              ))}
                           </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex justify-between text-[10px] text-zinc-600 uppercase tracking-widest font-bold border-t border-zinc-900 pt-4">
                      <span>T-24h</span>
                      <span>T-12h</span>
                      <span>Incident Active</span>
                    </div>
                  </Card>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {alerts.map(alert => (
                <Card key={alert.id} className={cn("p-6 border-l-4", alert.severity === "high" ? "border-l-red-500" : "border-l-orange-500")}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "p-2 rounded-lg", 
                      alert.type === "brute_force" ? "bg-red-500/10 text-red-500" : 
                      alert.type === "unusual_location" ? "bg-purple-500/10 text-purple-500" :
                      "bg-orange-500/10 text-orange-500"
                    )}>
                      {alert.type === "brute_force" ? <Zap className="w-5 h-5" /> : 
                       alert.type === "unusual_location" ? <MapPin className="w-5 h-5" /> :
                       <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div title={`Severity: ${alert.severity.toUpperCase()}`}>
                      <Badge variant={alert.severity === "high" ? "destructive" : "outline"}>{alert.severity}</Badge>
                    </div>
                  </div>
                  <h4 className="font-bold text-lg mb-2 capitalize">{alert.type.replace("_", " ")}</h4>
                  <p className="text-sm text-zinc-400 mb-4">{alert.message}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                      <Globe className="w-3 h-3" />
                      {alert.ip}
                    </div>
                    <span className="text-[10px] text-zinc-500">{format(new Date(alert.timestamp), "MMM d, HH:mm:ss")}</span>
                  </div>
                  {user.role === "admin" && !blockedIPs.includes(alert.ip) && (
                    <Button variant="destructive" size="sm" className="w-full mt-4" onClick={() => toggleBlockIP(alert.ip)}>Block IP</Button>
                  )}
                </Card>
              ))}
              {alerts.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-24 text-zinc-600">
                  <ShieldCheck className="w-20 h-20 mb-4 opacity-10" />
                  <h3 className="text-xl font-medium">System Secure</h3>
                  <p className="text-sm">No suspicious activities detected in the last 24 hours.</p>
                </div>
              )}
            </div>
          </div>
        )}

          {activeTab === "users" && user.role === "admin" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">User Management</h3>
                <Button onClick={() => {
                  setEditingUser(null);
                  setUserForm({ username: "", email: "", password: "", role: "viewer" });
                  setIsUserModalOpen(true);
                }}>
                  <UserPlus className="w-4 h-4 mr-2" /> Add User
                </Button>
              </div>
              <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">Username</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Created At</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{u.username}</td>
                        <td className="px-6 py-4 text-zinc-400">{u.email}</td>
                        <td className="px-6 py-4">
                          <Badge variant={u.role === "admin" ? "default" : "outline"}>{u.role}</Badge>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 text-xs">
                          {u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), "MMM d, yyyy") : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Button variant="ghost" size="icon" title="Reset Password" onClick={() => handleResetPassword(u.id)}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditingUser(u);
                            setUserForm({ username: u.username, email: u.email, password: "", role: u.role });
                            setIsUserModalOpen(true);
                          }}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteUser(u.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {activeTab === "audit" && user.role === "admin" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Audit Trail</h3>
                <Button variant="secondary" size="sm" onClick={() => {}}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
              </div>
              <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">Admin</th>
                      <th className="px-6 py-3 font-medium">Action</th>
                      <th className="px-6 py-3 font-medium">Target User</th>
                      <th className="px-6 py-3 font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{log.adminUsername}</td>
                        <td className="px-6 py-4">
                          <Badge variant={
                            log.action.includes("DELETE") ? "destructive" : 
                            log.action.includes("CREATE") ? "secondary" : "outline"
                          }>
                            {log.action.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-zinc-400">{log.targetUsername}</td>
                        <td className="px-6 py-4 text-zinc-500 text-xs">{format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss")}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-600">No audit logs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-2xl space-y-8">
              <Card className="p-8 space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-zinc-800 rounded-xl">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">System Configuration</h3>
                    <p className="text-sm text-zinc-500">Manage global security rules and thresholds</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-Block Brute Force</p>
                      <p className="text-xs text-zinc-500">Automatically block IPs after failed attempts</p>
                    </div>
                    <div 
                      className={cn("w-12 h-6 border rounded-full relative cursor-pointer transition-colors", systemSettings.autoBlockEnabled ? "bg-emerald-500/20 border-emerald-500/50" : "bg-zinc-800 border-zinc-700")}
                      onClick={() => {
                        setPendingBlockValue(!systemSettings.autoBlockEnabled);
                        setIsConfirmBlockModalOpen(true);
                      }}
                    >
                      <div className={cn("absolute top-1 w-4 h-4 rounded-full transition-all", systemSettings.autoBlockEnabled ? "right-1 bg-emerald-500" : "left-1 bg-zinc-500")} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Real-time Notifications</p>
                      <p className="text-xs text-zinc-500">Push alerts to browser when threats are detected</p>
                    </div>
                    <div 
                      className={cn("w-12 h-6 border rounded-full relative cursor-pointer transition-colors", systemSettings.realtimeNotifications ? "bg-emerald-500/20 border-emerald-500/50" : "bg-zinc-800 border-zinc-700")}
                      onClick={() => setSystemSettings(s => ({ ...s, realtimeNotifications: !s.realtimeNotifications }))}
                    >
                      <div className={cn("absolute top-1 w-4 h-4 rounded-full transition-all", systemSettings.realtimeNotifications ? "right-1 bg-emerald-500" : "left-1 bg-zinc-500")} />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-zinc-800">
                    <h4 className="font-medium text-sm text-zinc-400 uppercase tracking-wider">Threat Detection Thresholds</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Max Failed Attempts</label>
                        <Input 
                          type="number" 
                          min="1"
                          value={systemSettings.bruteForceAttempts}
                          onChange={(e: any) => setSystemSettings(s => ({ ...s, bruteForceAttempts: parseInt(e.target.value) || 5 }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Timeframe (Minutes)</label>
                        <Input 
                          type="number" 
                          min="1"
                          value={systemSettings.bruteForceTimeframe}
                          onChange={(e: any) => setSystemSettings(s => ({ ...s, bruteForceTimeframe: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-500">Risk Score Threshold</label>
                        <span className="text-xs font-mono text-zinc-400">{systemSettings.riskScoreThreshold}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        className="w-full accent-blue-500"
                        value={systemSettings.riskScoreThreshold}
                        onChange={(e: any) => setSystemSettings(s => ({ ...s, riskScoreThreshold: parseInt(e.target.value) }))}
                      />
                      <p className="text-xs text-zinc-500">Alerts will be generated when a user's calculated risk score exceeds this threshold.</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800">
                    <Button 
                      className="w-full" 
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings || user?.role !== "admin"}
                    >
                      {isSavingSettings ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-8 border-red-500/20">
                <h3 className="text-lg font-bold text-red-500 mb-4">Danger Zone</h3>
                <div className="space-y-4">
                  <Button variant="destructive" className="w-full justify-start gap-3">
                    <Trash2 className="w-4 h-4" />
                    Flush All Security Logs
                  </Button>
                  <Button variant="destructive" className="w-full justify-start gap-3">
                    <Ban className="w-4 h-4" />
                    Clear Blocked IP List
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="max-w-2xl space-y-8">
              <Card className="p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700">
                    <Users className="w-8 h-8 text-zinc-100" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Profile Identity</h3>
                    <p className="text-sm text-zinc-500">{user.email}</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Display Identity (Username)</label>
                    <Input 
                      value={profileUsername}
                      onChange={(e: any) => setProfileUsername(e.target.value)}
                      placeholder="Enter new username"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={isUpdatingProfile} className="w-full">
                    {isUpdatingProfile ? "Updating..." : "Synchronize Identity"}
                  </Button>
                </form>

                <div className="mt-12 pt-8 border-t border-zinc-800">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-zinc-400" />
                    Security Key Management
                  </h3>
                  <form onSubmit={handleProfilePasswordChange} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">New Security Key</label>
                      <Input 
                        type="password"
                        value={profilePassword}
                        onChange={(e: any) => setProfilePassword(e.target.value)}
                        placeholder="Enter new security key"
                        required
                        minLength={8}
                      />
                    </div>
                    <Button type="submit" variant="secondary" disabled={isUpdatingProfile} className="w-full">
                      Change Security Key
                    </Button>
                    <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest">
                      Session re-authentication may be required for key rotation
                    </p>
                  </form>
                </div>
              </Card>

              <Card className="p-8 border-emerald-500/20">
                <h3 className="text-lg font-bold text-emerald-500 mb-4">Account Metadata</h3>
                <div className="space-y-4">
                  <DetailRow label="Access Tier" value={user.role} />
                  <DetailRow label="Primary Email" value={user.email} />
                  <DetailRow label="Session Persistence" value={rememberMe ? "Enabled (Local)" : "Disabled (Session)"} />
                </div>
              </Card>
            </div>
          )}

          {activeTab === "scanner" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-500">Threat Intelligence</h2>
                  <p className="text-sm text-zinc-500 mt-1">Unified malware engine powered by VirusTotal to verify malicious artifacts.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 p-6 space-y-6 bg-zinc-900/10 border-zinc-900 shadow-2xl">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-500">
                      <Globe className="w-5 h-5" />
                      <h3 className="font-bold text-sm uppercase tracking-widest">URL Scanner</h3>
                    </div>
                    <form onSubmit={handleScanUrl} className="space-y-3">
                      <Input 
                        placeholder="Paste suspicious URL here..." 
                        value={scanUrl}
                        onChange={(e: any) => setScanUrl(e.target.value)}
                        className="bg-zinc-950/50"
                      />
                      <Button type="submit" disabled={isScanning} className="w-full bg-blue-600 hover:bg-blue-500">
                        {isScanning ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                        Scan Link
                      </Button>
                    </form>
                  </div>

                  <div className="pt-6 border-t border-zinc-900 space-y-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <ShieldCheck className="w-5 h-5" />
                      <h3 className="font-bold text-sm uppercase tracking-widest">File Analysis</h3>
                    </div>
                    <div className="relative">
                      <input 
                        type="file" 
                        onChange={handleScanFile}
                        disabled={isScanning}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 text-center hover:border-zinc-700 transition-colors">
                        <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                        <p className="text-xs font-medium text-zinc-400">Drag or click to upload</p>
                        <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-tighter">Max 32MB • Binary / Archive</p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="lg:col-span-2 p-0 overflow-hidden bg-zinc-950/50 border-zinc-900">
                  <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Detection Engine Analysis</h3>
                    {scanResult && (
                      <Badge variant={Object.values(scanResult).some((r: any) => r.category === "malicious") ? "destructive" : "secondary"}>
                         Detections: {Object.values(scanResult).filter((r: any) => r.category === "malicious").length}
                      </Badge>
                    )}
                  </div>
                  <div className="p-0 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {!scanResult && !isScanning && (
                      <div className="p-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto">
                          <Eye className="w-8 h-8 text-zinc-700" />
                        </div>
                        <div className="max-w-xs mx-auto">
                          <p className="text-sm font-bold text-zinc-400">System Idle</p>
                          <p className="text-xs text-zinc-600 mt-1 leading-relaxed">Submit a URL or upload a file to begin real-time multi-engine malware analysis.</p>
                        </div>
                      </div>
                    )}

                    {isScanning && (
                      <div className="p-20 text-center space-y-6">
                        <div className="relative w-16 h-16 mx-auto">
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-pulse" />
                          <RefreshCw className="w-16 h-16 text-blue-500 animate-spin" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-blue-500">Artifact Decryption in Progress</p>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Polling global security engines...</p>
                        </div>
                      </div>
                    )}

                    {scanResult && (
                      <div className="divide-y divide-zinc-900">
                        {Object.entries(scanResult).map(([engine, result]: [string, any]) => (
                          <div key={engine} className="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-1.5 h-1.5 rounded-full", 
                                result.category === "malicious" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                                result.category === "suspicious" ? "bg-orange-500" : "bg-emerald-500"
                              )} />
                              <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">{engine}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">{result.method}</span>
                              <Badge variant={result.category === "malicious" ? "destructive" : "secondary"} className="text-[9px] uppercase">
                                {result.result || "clean"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-xl font-bold">Activity Feed</h3>
                      <p className="text-sm text-zinc-500">Real-time monitoring of user web activities and sessions</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <Input 
                          placeholder="Filter activities..." 
                          className="pl-10 w-full md:w-64"
                          value={activitySearch}
                          onChange={(e: any) => setActivitySearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-900/50 text-xs font-bold text-zinc-500 uppercase tracking-widest text-left">
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Target Activity</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/50">
                        {activityLogs
                          .filter(l => 
                            l.url.toLowerCase().includes(activitySearch.toLowerCase()) || 
                            l.username.toLowerCase().includes(activitySearch.toLowerCase())
                          )
                          .map((log) => (
                          <tr key={log.id} className="group hover:bg-zinc-900/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                                  {log.username[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{log.username}</p>
                                  <p className="text-[10px] text-zinc-500 font-mono">{log.ip}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 max-w-xs overflow-hidden">
                                <Globe className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                                <span className="text-xs font-mono text-zinc-300 truncate">{log.url}</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{log.category}</span>
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={log.action === "allowed" ? "secondary" : "destructive"}>
                                {log.action}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-zinc-500 text-xs font-mono">
                              {log.timestamp ? format(log.timestamp.toDate(), "HH:mm:ss") : "Just now"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <div className="space-y-6">
                  <Card className="p-6">
                    <h4 className="font-bold mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-500" />
                      Activity Simulator
                    </h4>
                    <p className="text-xs text-zinc-500 mb-6 font-medium">Use this console to simulate and test activity logging signatures.</p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-zinc-500">Target URL</label>
                        <Input 
                          id="sim-url" 
                          placeholder="https://example.com" 
                          className="bg-zinc-950" 
                          defaultValue="https://malicious-site.com/exploit"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-zinc-500">Activity Type</label>
                        <select id="sim-cat" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm">
                          <option value="web_access">Web Access</option>
                          <option value="file_download">File Download</option>
                          <option value="api_call">API Invocation</option>
                          <option value="credential_input">Credential Input</option>
                        </select>
                      </div>
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-500"
                        onClick={() => {
                          const url = (document.getElementById("sim-url") as HTMLInputElement).value;
                          const cat = (document.getElementById("sim-cat") as HTMLSelectElement).value;
                          const action = url.includes("malicious") ? "blocked" : "allowed";
                          logActivity(url, cat, action);
                          toast.success("Activity logged across network");
                        }}
                      >
                        Simulate Activity
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h4 className="font-bold mb-4 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-500" />
                      Live Event Stream
                    </h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {activityLogs
                        .filter(l => l.category.startsWith("user_"))
                        .slice(0, 10)
                        .map((log) => (
                          <motion.div 
                            key={log.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-3 bg-zinc-950 rounded-lg border border-zinc-900 flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                                {log.category.replace("user_", "")}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-600">
                                {log.timestamp ? format(log.timestamp.toDate(), "HH:mm:ss") : "now"}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 font-mono break-all leading-tight">{log.url}</p>
                          </motion.div>
                        ))}
                      {activityLogs.filter(l => l.category.startsWith("user_")).length === 0 && (
                        <p className="text-center py-8 text-xs text-zinc-600">No live interactions detected.</p>
                      )}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h4 className="font-bold mb-4 text-xs uppercase tracking-widest text-zinc-500">Activity Stats</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-zinc-400">Total Requests</span>
                        <span className="text-xl font-bold">{activityLogs.length}</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-[65%]" />
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-zinc-400">Security Intercepts</span>
                        <span className="text-xl font-bold text-red-500">
                          {activityLogs.filter(l => l.action === "blocked").length}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500" 
                          style={{ width: `${(activityLogs.filter(l => l.action === "blocked").length / (activityLogs.length || 1)) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Log Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-bold">Log Entry Details</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)}>
                  <ShieldX className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6 space-y-4">
                <DetailRow label="ID" value={selectedLog.id} />
                <DetailRow label="Timestamp" value={format(new Date(selectedLog.timestamp), "yyyy-MM-dd HH:mm:ss")} />
                <DetailRow label="Username" value={selectedLog.username} />
                <DetailRow label="IP Address" value={selectedLog.ip} />
                <DetailRow label="Location" value={selectedLog.location} />
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-zinc-500 uppercase font-bold">Status</span>
                  <Badge variant={selectedLog.status === "success" ? "secondary" : "destructive"}>
                    {selectedLog.status}
                  </Badge>
                </div>
              </div>
              <div className="p-6 bg-zinc-950/50 border-t border-zinc-800">
                <Button className="w-full" onClick={() => setSelectedLog(null)}>Close</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800">
                <h3 className="text-lg font-bold">{editingUser ? "Edit User" : "Create New User"}</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Username</label>
                  <Input 
                    value={userForm.username} 
                    onChange={(e: any) => setUserForm({ ...userForm, username: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Password {editingUser && "(Leave blank to keep current)"}</label>
                  <Input 
                    type="password"
                    value={userForm.password} 
                    onChange={(e: any) => setUserForm({ ...userForm, password: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Role</label>
                  <select 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setIsUserModalOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleSaveUser}>Save User</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Auto-Block */}
      <AnimatePresence>
        {isConfirmBlockModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto border border-orange-500/20">
                  <ShieldAlert className="w-8 h-8 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-100">Security Guardrail</h3>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                    {pendingBlockValue 
                      ? "Activating Auto-Block will strictly enforce IP bans for detected threats. Ensure your thresholds are properly calibrated to avoid false positives." 
                      : "Deactivating Auto-Block will require manual intervention for all threats. This increases your exposure to sustained network attacks."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <Button 
                    className={cn("w-full py-3 h-12 shadow-lg transition-transform", pendingBlockValue ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10" : "bg-orange-600 hover:bg-orange-500 shadow-orange-500/10")}
                    onClick={() => {
                      setSystemSettings(s => ({ ...s, autoBlockEnabled: pendingBlockValue }));
                      setIsConfirmBlockModalOpen(false);
                      toast.info(`Auto-Block Brute Force ${pendingBlockValue ? 'Enabled' : 'Disabled'}`);
                    }}
                  >
                    Proceed with {pendingBlockValue ? 'Activation' : 'Deactivation'}
                  </Button>
                  <Button variant="ghost" className="w-full text-zinc-500 hover:text-zinc-100" onClick={() => setIsConfirmBlockModalOpen(false)}>
                    Cancel Operation
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
      <span className="text-xs text-zinc-500 uppercase font-bold">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// Helper Components
function NavItem({ children, icon: Icon, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
        active 
          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-sm" 
          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function StatCard({ title, value, icon: Icon, trend, color = "text-zinc-100" }: any) {
  return (
    <Card className="p-5 hover:border-zinc-700 transition-colors group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-800 group-hover:border-zinc-700 transition-colors">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
        {trend && (
          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {trend}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</p>
        <h4 className={cn("text-2xl font-bold tracking-tight", color)}>{value}</h4>
      </div>
    </Card>
  );
}
