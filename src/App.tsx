/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
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
import socket from "@/src/lib/socket";
import { toast, Toaster } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

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

interface User {
  username: string;
  role: "admin" | "viewer";
}

interface UserAccount {
  id: string;
  username: string;
  role: "admin" | "viewer";
  createdAt: string;
}

interface SecurityConfig {
  failedAttemptThreshold: number;
  autoBlockEnabled: boolean;
  blockedIPRanges: string[];
}

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<string[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [config, setConfig] = useState<SecurityConfig>({
    failedAttemptThreshold: 3,
    autoBlockEnabled: true,
    blockedIPRanges: [],
  });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Modals state
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userForm, setUserForm] = useState({ username: "", role: "viewer" as "admin" | "viewer" });

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    // Apply theme
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    socket.on("initial_logs", (initialLogs: LogEntry[]) => setLogs(initialLogs));
    socket.on("initial_alerts", (initialAlerts: Alert[]) => setAlerts(initialAlerts));
    socket.on("initial_blocked_ips", (ips: string[]) => setBlockedIPs(ips));
    socket.on("initial_config", (initialConfig: SecurityConfig) => setConfig(initialConfig));
    
    socket.on("new_log", (log: LogEntry) => {
      setLogs(prev => [log, ...prev].slice(0, 100));
    });
    
    socket.on("new_alert", (alert: Alert) => {
      setAlerts(prev => {
        if (prev.find(a => a.id === alert.id)) return prev;
        
        // Browser notification for critical alerts
        if (alert.severity === "high") {
          toast.error("Critical Security Alert", {
            description: alert.message,
            action: {
              label: "View Details",
              onClick: () => setSelectedAlert(alert)
            }
          });
        }
        
        return [alert, ...prev].slice(0, 50);
      });
    });

    socket.on("ip_blocked", (ip: string) => {
      setBlockedIPs(prev => {
        if (prev.includes(ip)) return prev;
        toast.warning(`IP Blocked: ${ip}`, {
          description: "Suspicious activity threshold exceeded."
        });
        return [...prev, ip];
      });
    });

    socket.on("ip_unblocked", (ip: string) => {
      setBlockedIPs(prev => prev.filter(i => i !== ip));
    });

    socket.on("config_updated", (newConfig: SecurityConfig) => {
      setConfig(newConfig);
      toast.success("Security configuration updated");
    });

    return () => {
      socket.off("initial_logs");
      socket.off("initial_alerts");
      socket.off("initial_blocked_ips");
      socket.off("initial_config");
      socket.off("new_log");
      socket.off("new_alert");
      socket.off("ip_blocked");
      socket.off("ip_unblocked");
      socket.off("config_updated");
    };
  }, []);

  // Fetch users if admin
  useEffect(() => {
    if (user?.role === "admin") {
      fetch("/api/users")
        .then(res => res.json())
        .then(data => setUsers(data));
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setUser({ username: data.username || loginUsername, role: data.role });
        setLoginError("");
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (err) {
      setLoginError("Connection error");
    }
  };

  const handleSaveUser = async () => {
    const method = editingUser ? "PUT" : "POST";
    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm)
      });
      if (res.ok) {
        const updatedUser = await res.json();
        if (editingUser) {
          setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
          toast.success("User updated successfully");
        } else {
          setUsers(prev => [...prev, updatedUser]);
          toast.success("User created successfully");
        }
        setIsUserModalOpen(false);
        setEditingUser(null);
        setUserForm({ username: "", role: "viewer" });
      }
    } catch (err) {
      toast.error("Failed to save user");
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        toast.success("User deleted");
      }
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  const updateConfig = async (updates: Partial<SecurityConfig>) => {
    const newConfig = { ...config, ...updates };
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        setConfig(newConfig);
      }
    } catch (err) {
      toast.error("Failed to update configuration");
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

  const stats = useMemo(() => {
    const total = logs.length;
    const failed = logs.filter(l => l.status === "failed").length;
    const success = total - failed;
    const highRisk = alerts.filter(a => a.severity === "high").length;
    return { total, failed, success, highRisk, blocked: blockedIPs.length };
  }, [logs, alerts, blockedIPs]);

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
          <CardHeader className="space-y-1 flex flex-col items-center">
            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-zinc-700">
              <Shield className="w-6 h-6 text-zinc-400" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Sentinel Access</CardTitle>
            <CardDescription className="text-zinc-500 text-center">
              Login as <span className="text-zinc-300 font-mono">admin</span> or <span className="text-zinc-300 font-mono">viewer</span> (password: password)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-500 text-sm text-center">
                {loginError}
              </div>
            )}
            <div className="space-y-2">
              <Input 
                className="bg-zinc-800 border-zinc-700 text-zinc-100" 
                placeholder="Username" 
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div className="space-y-2">
              <Input 
                className="bg-zinc-800 border-zinc-700 text-zinc-100" 
                type="password" 
                placeholder="Password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button className="w-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200" onClick={handleLogin}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800 transition-colors duration-300">
      <Toaster position="top-right" richColors />
      {/* Sidebar / Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-100 rounded flex items-center justify-center">
              <Shield className="w-5 h-5 text-white dark:text-zinc-950" />
            </div>
            <h1 className="text-lg font-bold tracking-tight uppercase">Sentinel <span className="text-zinc-500 font-normal">Security</span></h1>
            <Badge variant="outline" className="ml-2 border-zinc-300 dark:border-zinc-700 text-zinc-500">
              {user.role === "admin" ? <ShieldCheck className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
              {user.role}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">System Live</span>
            </div>
            <Separator orientation="vertical" className="h-6 bg-zinc-200 dark:bg-zinc-800" />
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            <Button variant="ghost" size="icon" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setUser(null)}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              {user.role === "admin" && (
                <>
                  <TabsTrigger value="users">Users</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Total Attempts" 
                value={stats.total} 
                icon={<Activity className="w-4 h-4" />} 
                description="Last 24 hours"
                trend="+12%"
              />
              <StatCard 
                title="Failed Logins" 
                value={stats.failed} 
                icon={<Lock className="w-4 h-4" />} 
                description="Potential threats"
                color="text-red-500 dark:text-red-400"
                trend="+5%"
              />
              <StatCard 
                title="Active Threats" 
                value={stats.highRisk} 
                icon={<AlertTriangle className="w-4 h-4" />} 
                description="Immediate attention"
                color="text-orange-500 dark:text-orange-400"
              />
              <StatCard 
                title="Blocked IPs" 
                value={stats.blocked} 
                icon={<Ban className="w-4 h-4" />} 
                description="Restricted access"
                color="text-zinc-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content: Logs & Charts */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-zinc-400" />
                      Traffic Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorAttempts" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={theme === "dark" ? "#71717a" : "#a1a1aa"} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={theme === "dark" ? "#71717a" : "#a1a1aa"} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#27272a" : "#e4e4e7"} vertical={false} />
                          <XAxis 
                            dataKey="time" 
                            stroke="#71717a" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="#71717a" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `${value}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: theme === "dark" ? '#18181b' : '#ffffff', 
                              border: `1px solid ${theme === "dark" ? '#27272a' : '#e4e4e7'}`, 
                              borderRadius: '8px',
                              color: theme === "dark" ? '#f4f4f5' : '#18181b'
                            }}
                            itemStyle={{ color: theme === "dark" ? '#f4f4f5' : '#18181b' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="attempts" 
                            stroke={theme === "dark" ? "#a1a1aa" : "#71717a"} 
                            fillOpacity={1} 
                            fill="url(#colorAttempts)" 
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-zinc-400" />
                      Recent Critical Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {alerts.slice(0, 3).map(alert => (
                        <div key={alert.id} className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${alert.severity === 'high' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>
                              <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{alert.message}</p>
                              <p className="text-xs text-zinc-500">{format(new Date(alert.timestamp), "MMM d, HH:mm:ss")}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedAlert(alert)}>
                            Details <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar: Alerts & Intelligence */}
              <div className="space-y-6">
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                      Security Alerts
                    </CardTitle>
                    <CardDescription className="text-zinc-500">Detected suspicious activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-4">
                        <AnimatePresence initial={false}>
                          {alerts.length === 0 ? (
                            <div className="text-center py-12 text-zinc-400 dark:text-zinc-600">
                              <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                              <p className="text-sm">No threats detected</p>
                            </div>
                          ) : (
                            alerts.map((alert) => {
                              const isBlocked = blockedIPs.includes(alert.ip);
                              return (
                                <motion.div
                                  key={alert.id}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: isBlocked ? 0.5 : 1, x: 0 }}
                                  className={`p-4 rounded-lg border bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2 relative group cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors ${
                                    alert.severity === "high" ? "border-red-500/30" : "border-orange-500/30"
                                  } ${isBlocked ? 'grayscale' : ''}`}
                                  onClick={() => setSelectedAlert(alert)}
                                >
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className={
                                      alert.severity === "high" ? "text-red-500 dark:text-red-400 border-red-500/50" : "text-orange-500 dark:text-orange-400 border-orange-500/50"
                                    }>
                                      {alert.type.replace("_", " ")}
                                    </Badge>
                                    <span className="text-[10px] font-mono text-zinc-500">
                                      {format(new Date(alert.timestamp), "HH:mm:ss")}
                                    </span>
                                  </div>
                                  <p className="text-sm text-zinc-900 dark:text-zinc-200 leading-relaxed">{alert.message}</p>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                                      <Globe className="w-3 h-3" />
                                      {alert.ip}
                                    </div>
                                    {user.role === "admin" && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className={`h-6 px-2 text-[9px] uppercase ${isBlocked ? 'text-emerald-500' : 'text-red-500'}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleBlockIP(alert.ip);
                                        }}
                                      >
                                        {isBlocked ? "Unblock" : "Block IP"}
                                      </Button>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })
                          )}
                        </AnimatePresence>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="p-6 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">Risk Score</h3>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-black text-zinc-900 dark:text-zinc-100">{Math.min(100, alerts.length * 15)}</span>
                      <span className="text-zinc-500 font-medium mb-2">/ 100</span>
                    </div>
                    <div className="mt-4 h-2 bg-zinc-200 dark:bg-zinc-950 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full ${alerts.length > 5 ? 'bg-red-500' : 'bg-orange-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, alerts.length * 15)}%` }}
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-zinc-400" />
                    Authentication Logs
                  </CardTitle>
                  <CardDescription className="text-zinc-500">Real-time stream of login attempts</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input 
                      placeholder="Search IP or user..." 
                      className="pl-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 w-[200px] lg:w-[250px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <TabsList className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="success">Success</TabsTrigger>
                      <TabsTrigger value="failed">Failed</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[700px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                  <Table>
                    <TableHeader className="bg-zinc-100 dark:bg-zinc-900/50 sticky top-0 z-10">
                      <TableRow className="border-zinc-200 dark:border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Timestamp</TableHead>
                        <TableHead className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">User</TableHead>
                        <TableHead className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">IP Address</TableHead>
                        <TableHead className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Location</TableHead>
                        <TableHead className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Status</TableHead>
                        {user.role === "admin" && <TableHead className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence initial={false}>
                        {filteredLogs.map((log) => {
                          const isBlocked = blockedIPs.includes(log.ip);
                          return (
                            <motion.tr
                              key={log.id}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: isBlocked ? 0.4 : 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className={`border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition-colors group ${isBlocked ? 'bg-zinc-100 dark:bg-zinc-900/30' : ''}`}
                            >
                              <TableCell className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                {format(new Date(log.timestamp), "HH:mm:ss")}
                              </TableCell>
                              <TableCell className="font-medium text-zinc-900 dark:text-zinc-200">{log.username}</TableCell>
                              <TableCell className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                {log.ip}
                                {isBlocked && <Badge variant="secondary" className="ml-2 text-[8px] h-4 px-1 bg-zinc-200 dark:bg-zinc-800">BLOCKED</Badge>}
                              </TableCell>
                              <TableCell className="text-zinc-500 dark:text-zinc-400 text-xs">{log.location}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={log.status === "success" ? "outline" : "destructive"}
                                  className={log.status === "success" ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-500 bg-emerald-500/10" : "bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/50"}
                                >
                                  {log.status}
                                </Badge>
                              </TableCell>
                              {user.role === "admin" && (
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={`h-7 px-2 text-[10px] uppercase tracking-tighter ${isBlocked ? 'text-emerald-500 hover:text-emerald-600' : 'text-red-500 hover:text-red-600'}`}
                                    onClick={() => toggleBlockIP(log.ip)}
                                  >
                                    {isBlocked ? "Unblock" : "Block"}
                                  </Button>
                                </TableCell>
                              )}
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {user.role === "admin" && (
            <>
              <TabsContent value="users">
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-zinc-400" />
                        User Management
                      </CardTitle>
                      <CardDescription className="text-zinc-500">Manage dashboard access and roles</CardDescription>
                    </div>
                    <Button onClick={() => {
                      setEditingUser(null);
                      setUserForm({ username: "", role: "viewer" });
                      setIsUserModalOpen(true);
                    }}>
                      <UserPlus className="w-4 h-4 mr-2" /> Add User
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-200 dark:border-zinc-800">
                          <TableHead>Username</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Created At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map(u => (
                          <TableRow key={u.id} className="border-zinc-200 dark:border-zinc-800">
                            <TableCell className="font-medium">{u.username}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-zinc-500 text-xs">
                              {format(new Date(u.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => {
                                  setEditingUser(u);
                                  setUserForm({ username: u.username, role: u.role });
                                  setIsUserModalOpen(true);
                                }}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteUser(u.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldX className="w-5 h-5 text-zinc-400" />
                        Auto-Blocking Rules
                      </CardTitle>
                      <CardDescription>Configure automatic threat mitigation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable Auto-Blocking</Label>
                          <p className="text-xs text-zinc-500">Automatically block IPs after threshold is reached</p>
                        </div>
                        <Switch 
                          checked={config.autoBlockEnabled} 
                          onCheckedChange={(checked) => updateConfig({ autoBlockEnabled: checked })} 
                        />
                      </div>
                      <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                      <div className="space-y-2">
                        <Label>Failed Attempt Threshold</Label>
                        <div className="flex items-center gap-4">
                          <Input 
                            type="number" 
                            className="w-24 bg-zinc-50 dark:bg-zinc-950" 
                            value={config.failedAttemptThreshold}
                            onChange={(e) => updateConfig({ failedAttemptThreshold: parseInt(e.target.value) })}
                          />
                          <p className="text-xs text-zinc-500">Attempts within 60 seconds</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-zinc-400" />
                        IP Range Restrictions
                      </CardTitle>
                      <CardDescription>Define specific IP ranges to always block</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input placeholder="e.g. 192.168.1.0/24" className="bg-zinc-50 dark:bg-zinc-950" />
                        <Button variant="secondary">Add Range</Button>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Currently Restricted</p>
                        <div className="text-sm text-zinc-400 italic py-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                          No custom ranges defined
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      {/* Alert Detail Modal */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${selectedAlert?.severity === 'high' ? 'text-red-500' : 'text-orange-500'}`} />
              Security Alert Details
            </DialogTitle>
            <DialogDescription>
              Detailed analysis and recommended actions
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold">Type</p>
                  <p className="text-sm font-medium capitalize">{selectedAlert.type.replace("_", " ")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold">Severity</p>
                  <Badge variant={selectedAlert.severity === 'high' ? 'destructive' : 'outline'} className="capitalize">
                    {selectedAlert.severity}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold">Source IP</p>
                  <p className="text-sm font-mono">{selectedAlert.ip}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold">Timestamp</p>
                  <p className="text-sm">{format(new Date(selectedAlert.timestamp), "MMM d, yyyy HH:mm:ss")}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] uppercase text-zinc-500 font-bold">Historical Context</p>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 text-sm">
                  {selectedAlert.type === 'brute_force' ? (
                    "This IP has multiple failed attempts in a short period. This pattern is consistent with automated brute-force attacks."
                  ) : (
                    "This login originated from a geographic location that is not typical for this user account."
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase text-zinc-500 font-bold">Recommended Actions</p>
                <ul className="text-sm space-y-1 list-disc list-inside text-zinc-600 dark:text-zinc-400">
                  <li>Immediately block the source IP address</li>
                  <li>Notify the affected user to change their password</li>
                  <li>Enable Multi-Factor Authentication (MFA) for this account</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAlert(null)}>Close</Button>
            {user.role === "admin" && selectedAlert && !blockedIPs.includes(selectedAlert.ip) && (
              <Button variant="destructive" onClick={() => {
                toggleBlockIP(selectedAlert.ip);
                setSelectedAlert(null);
              }}>Block IP Address</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Management Modal */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              Set the username and access level for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input 
                value={userForm.username} 
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                className="bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Tabs value={userForm.role} onValueChange={(v: any) => setUserForm({ ...userForm, role: v })}>
                <TabsList className="w-full bg-zinc-100 dark:bg-zinc-950">
                  <TabsTrigger value="viewer" className="flex-1">Viewer</TabsTrigger>
                  <TabsTrigger value="admin" className="flex-1">Admin</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUser}>Save User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon, description, color = "text-zinc-900 dark:text-zinc-100", trend }: any) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-500">{title}</CardTitle>
        <div className="text-zinc-500">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] text-zinc-500">{description}</p>
          {trend && (
            <span className="text-[10px] font-medium text-emerald-500">{trend}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

