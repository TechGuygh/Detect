import React, { useState, useEffect, useMemo } from "react";
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
  ShieldX
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { io, Socket } from "socket.io-client";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { toast, Toaster } from "sonner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
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
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  timestamp: string;
  ip: string;
}

interface User {
  username: string;
  role: "admin" | "viewer";
  token: string;
}

// Components
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({ total: 0, failed: 0, highRisk: 0, blocked: 0 });
  const [blockedIPs, setBlockedIPs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [theme, setTheme] = useState("dark");
  const [socket, setSocket] = useState<Socket | null>(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("new_log", (log: LogEntry) => {
      setLogs(prev => [log, ...prev].slice(0, 100));
      updateStats();
    });

    newSocket.on("new_alert", (alert: Alert) => {
      setAlerts(prev => [alert, ...prev]);
      toast.error(`New Security Alert: ${alert.message}`, {
        description: format(new Date(alert.timestamp), "HH:mm:ss"),
      });
      updateStats();
    });

    newSocket.on("ip_blocked", (ip: string) => {
      setBlockedIPs(prev => [...prev, ip]);
      toast.warning(`IP Address Blocked: ${ip}`);
      updateStats();
    });

    newSocket.on("ip_unblocked", (ip: string) => {
      setBlockedIPs(prev => prev.filter(i => i !== ip));
      toast.success(`IP Address Unblocked: ${ip}`);
      updateStats();
    });

    fetchInitialData();

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [logsRes, alertsRes, statsRes] = await Promise.all([
        fetch("/api/logs"),
        fetch("/api/alerts"),
        fetch("/api/stats")
      ]);
      setLogs(await logsRes.json());
      setAlerts(await alertsRes.json());
      setStats(await statsRes.json());
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  const updateStats = async () => {
    try {
      const res = await fetch("/api/stats");
      setStats(await res.json());
    } catch (err) {
      console.error("Failed to update stats", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        toast.success(`Welcome back, ${data.username}`);
      } else {
        setLoginError("Invalid username or password");
      }
    } catch (err) {
      setLoginError("Connection failed");
    }
  };

  const toggleBlockIP = async (ip: string) => {
    if (user?.role !== "admin") return;
    const isBlocked = blockedIPs.includes(ip);
    const endpoint = isBlocked ? "/api/unblock-ip" : "/api/block-ip";
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip })
      });
    } catch (err) {
      console.error("Failed to toggle block", err);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           log.ip.includes(searchTerm);
      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

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

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-2 border border-zinc-700">
                <Shield className="w-6 h-6 text-zinc-100" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Sentinel Security</h1>
              <p className="text-zinc-500 text-sm">Sign in to access the dashboard</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Username</label>
                <Input 
                  placeholder="admin" 
                  value={loginUsername} 
                  onChange={(e: any) => setLoginUsername(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Password</label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  value={loginPassword} 
                  onChange={(e: any) => setLoginPassword(e.target.value)} 
                />
              </div>
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <Button className="w-full" type="submit">Sign In</Button>
            </form>
            <div className="text-center text-[10px] text-zinc-600">
              <p>Demo Credentials: admin / password</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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
          <NavItem active={activeTab === "logs"} onClick={() => setActiveTab("logs")} icon={Terminal}>Auth Logs</NavItem>
          <NavItem active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")} icon={AlertTriangle}>Threats</NavItem>
          <NavItem active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={Settings}>Settings</NavItem>
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
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer" onClick={() => setUser(null)}>
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
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon">
                <Bell className="w-4 h-4" />
              </Button>
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
                <Card className="xl:col-span-2 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Traffic Analysis</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-zinc-100" />
                        <span className="text-[10px] text-zinc-500 uppercase">Attempts</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorAttempts" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f4f4f5" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#f4f4f5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                          itemStyle={{ color: '#f4f4f5' }}
                        />
                        <Area type="monotone" dataKey="attempts" stroke="#f4f4f5" fillOpacity={1} fill="url(#colorAttempts)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
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
                        <th className="px-6 py-3 font-medium">User</th>
                        <th className="px-6 py-3 font-medium">IP Address</th>
                        <th className="px-6 py-3 font-medium">Location</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {logs.slice(0, 8).map(log => (
                        <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 font-medium">{log.username}</td>
                          <td className="px-6 py-4 font-mono text-xs text-zinc-400">{log.ip}</td>
                          <td className="px-6 py-4 text-zinc-400">{log.location}</td>
                          <td className="px-6 py-4">
                            <Badge variant={log.status === "success" ? "secondary" : "destructive"}>
                              {log.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-zinc-500 text-xs">{format(new Date(log.timestamp), "HH:mm:ss")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input 
                    placeholder="Search by IP or username..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e: any) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={statusFilter === "all" ? "primary" : "secondary"} size="sm" onClick={() => setStatusFilter("all")}>All</Button>
                  <Button variant={statusFilter === "success" ? "primary" : "secondary"} size="sm" onClick={() => setStatusFilter("success")}>Success</Button>
                  <Button variant={statusFilter === "failed" ? "primary" : "secondary"} size="sm" onClick={() => setStatusFilter("failed")}>Failed</Button>
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-medium">User</th>
                        <th className="px-6 py-3 font-medium">IP Address</th>
                        <th className="px-6 py-3 font-medium">Location</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Time</th>
                        {user.role === "admin" && <th className="px-6 py-3 font-medium text-right">Actions</th>}
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
                            <td className="px-6 py-4 text-zinc-400">{log.location}</td>
                            <td className="px-6 py-4">
                              <Badge variant={log.status === "success" ? "secondary" : "destructive"}>
                                {log.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-zinc-500 text-xs">{format(new Date(log.timestamp), "HH:mm:ss")}</td>
                            {user.role === "admin" && (
                              <td className="px-6 py-4 text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => toggleBlockIP(log.ip)}
                                  className={blockedIPs.includes(log.ip) ? "text-emerald-500" : "text-red-500"}
                                >
                                  {blockedIPs.includes(log.ip) ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                </Button>
                              </td>
                            )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {alerts.map(alert => (
                <Card key={alert.id} className={cn("p-6 border-l-4", alert.severity === "high" ? "border-l-red-500" : "border-l-orange-500")}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn("p-2 rounded-lg", alert.severity === "high" ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500")}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <Badge variant={alert.severity === "high" ? "destructive" : "outline"}>{alert.severity}</Badge>
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
                      <p className="text-xs text-zinc-500">Automatically block IPs after 5 failed attempts</p>
                    </div>
                    <div className="w-12 h-6 bg-emerald-500/20 border border-emerald-500/50 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-emerald-500 rounded-full" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Real-time Notifications</p>
                      <p className="text-xs text-zinc-500">Push alerts to browser when threats are detected</p>
                    </div>
                    <div className="w-12 h-6 bg-zinc-800 border border-zinc-700 rounded-full relative cursor-pointer">
                      <div className="absolute left-1 top-1 w-4 h-4 bg-zinc-500 rounded-full" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium">Threat Sensitivity</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="w-3/4 h-full bg-zinc-100" />
                      </div>
                      <span className="text-xs font-mono">High</span>
                    </div>
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
        </div>
      </main>
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
