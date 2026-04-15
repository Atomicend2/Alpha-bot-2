import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Wifi, WifiOff, RefreshCw, Unplug, Trash2, Lock,
  Plus, Bot, Circle, ImagePlus, Upload, LayoutGrid, X,
} from "lucide-react";

interface BotStatus {
  connected: boolean;
  connecting: boolean;
  pairingCode: string | null;
  credsRegistered: boolean;
  botId: string | null;
  botName: string | null;
}

interface BotProfile {
  id: string;
  name: string;
  phone: string;
  status: "online" | "offline";
  createdAt: number;
}

interface FrameEntry {
  id: string;
  name: string;
  createdAt: number;
}

const API_BASE = "/api/bot";

async function apiFetch(path: string, method = "GET", body?: object, adminPassword?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminPassword) headers["x-admin-password"] = adminPassword;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageUploadBox({
  label,
  preview,
  onFile,
  onClear,
}: {
  label: string;
  preview: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <Label className="text-gray-300 text-xs">{label}</Label>
      <div
        className="relative w-20 h-20 rounded-full border-2 border-dashed border-gray-600 hover:border-indigo-500 cursor-pointer flex items-center justify-center bg-gray-800 transition group overflow-hidden"
        onClick={() => ref.current?.click()}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" className="w-full h-full object-cover rounded-full" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="absolute top-0 right-0 bg-red-700 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
            >
              <X size={10} className="text-white" />
            </button>
          </>
        ) : (
          <ImagePlus size={22} className="text-gray-500 group-hover:text-indigo-400 transition" />
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>
      <p className="text-xs text-gray-500">Click to choose image</p>
    </div>
  );
}

function BotAvatar({ botId, name, cacheKey }: { botId: string; name: string; cacheKey: number }) {
  const [imgOk, setImgOk] = useState(botId !== "__active__");
  if (imgOk && botId !== "__active__") {
    return (
      <div className="w-10 h-10 rounded-full border border-indigo-700/50 shrink-0 overflow-hidden">
        <img
          src={`${API_BASE}/bots/${botId}/image?t=${cacheKey}`}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgOk(false)}
        />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-900/60 border border-indigo-700/50 flex items-center justify-center shrink-0">
      <Bot size={16} className="text-indigo-400" />
    </div>
  );
}

function PasswordGate({ onVerified }: { onVerified: (pwd: string) => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setError("Password is required."); return; }
    setLoading(true);
    setError("");
    try {
      const data = await fetch(`${API_BASE}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }).then(r => r.json());
      if (data.success) {
        onVerified(password);
      } else {
        setError("Incorrect password. Access denied.");
      }
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
      <Card className="bg-gray-900 border-gray-800 w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-indigo-900/60 border border-indigo-700 flex items-center justify-center">
              <Lock size={26} className="text-indigo-400" />
            </div>
          </div>
          <CardTitle className="text-white text-xl">Admin Panel</CardTitle>
          <CardDescription className="text-gray-400">
            Enter the admin password to access bot management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminPassword" className="text-gray-300">Password</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock size={14} className="mr-2" />}
              Unlock Panel
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BotAdmin() {
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [frames, setFrames] = useState<FrameEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [pairingPhone, setPairingPhone] = useState("");

  const [showAddBot, setShowAddBot] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotPhone, setNewBotPhone] = useState("");
  const [newBotImageBase64, setNewBotImageBase64] = useState<string | null>(null);
  const [newBotImagePreview, setNewBotImagePreview] = useState<string | null>(null);

  const [showAddFrame, setShowAddFrame] = useState(false);
  const [newFrameName, setNewFrameName] = useState("");
  const [newFrameImageBase64, setNewFrameImageBase64] = useState<string | null>(null);
  const [newFrameImagePreview, setNewFrameImagePreview] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch("/status");
      setStatus(data);
    } catch {
      toast({ title: "Error", description: "Could not reach API server", variant: "destructive" });
    }
  }, [toast]);

  const fetchBots = useCallback(async () => {
    try {
      const data = await apiFetch("/bots");
      setBots(data.bots || []);
    } catch { /* ignore */ }
  }, []);

  const fetchFrames = useCallback(async () => {
    try {
      const data = await apiFetch("/frames");
      setFrames(data.frames || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!adminPassword) return;
    fetchStatus();
    fetchBots();
    fetchFrames();
    const interval = setInterval(() => {
      fetchStatus();
      fetchBots();
    }, 4000);
    return () => clearInterval(interval);
  }, [adminPassword, fetchStatus, fetchBots, fetchFrames]);

  if (!adminPassword) {
    return <PasswordGate onVerified={setAdminPassword} />;
  }

  async function handleStart() {
    setLoading(true);
    try {
      const data = await apiFetch(
        "/start",
        "POST",
        phone ? { phone, adminPassword } : { adminPassword },
        adminPassword
      );
      toast({ title: data.success ? "Started" : "Info", description: data.message });
      await fetchStatus();
    } catch {
      toast({ title: "Error", description: "Failed to start bot", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestPairingCode() {
    const phoneToUse = pairingPhone || phone;
    if (!phoneToUse) {
      toast({ title: "Phone required", description: "Enter the bot's phone number first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/pairing", "POST", { phone: phoneToUse, adminPassword }, adminPassword);
      if (data.success) {
        toast({ title: "Pairing Code Generated", description: `Code: ${data.code} — enter this in WhatsApp on your phone` });
        await fetchStatus();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to request pairing code", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      const data = await apiFetch("/disconnect", "POST", { adminPassword }, adminPassword);
      toast({ title: "Disconnected", description: data.message });
      await fetchStatus();
    } catch {
      toast({ title: "Error", description: "Failed to disconnect", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleClearAuth() {
    if (!confirm("This will wipe all WhatsApp session data and require re-pairing. Continue?")) return;
    setLoading(true);
    try {
      const data = await apiFetch("/clear", "POST", { adminPassword }, adminPassword);
      toast({ title: "Auth Cleared", description: data.message });
      await fetchStatus();
    } catch {
      toast({ title: "Error", description: "Failed to clear auth", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleBotImageFile(file: File) {
    const b64 = await fileToBase64(file);
    setNewBotImageBase64(b64);
    setNewBotImagePreview(URL.createObjectURL(file));
  }

  async function handleAddBot() {
    if (!newBotName.trim()) {
      toast({ title: "Name required", description: "Enter a name for the bot.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/bots", "POST", {
        adminPassword,
        name: newBotName.trim(),
        phone: newBotPhone.trim(),
        imageBase64: newBotImageBase64 || undefined,
      }, adminPassword);
      if (data.success) {
        toast({ title: "Bot Added", description: `"${newBotName}" registered successfully.` });
        setNewBotName("");
        setNewBotPhone("");
        setNewBotImageBase64(null);
        setNewBotImagePreview(null);
        setShowAddBot(false);
        await fetchBots();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to add bot.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveBot(id: string, name: string) {
    if (!confirm(`Remove bot "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const data = await fetch(`${API_BASE}/bots/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
      }).then(r => r.json());
      if (data.success) {
        toast({ title: "Bot Removed", description: `"${name}" has been removed.` });
        await fetchBots();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove bot.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleFrameImageFile(file: File) {
    const b64 = await fileToBase64(file);
    setNewFrameImageBase64(b64);
    setNewFrameImagePreview(URL.createObjectURL(file));
  }

  async function handleAddFrame() {
    if (!newFrameName.trim()) {
      toast({ title: "Name required", description: "Enter a name for the frame.", variant: "destructive" });
      return;
    }
    if (!newFrameImageBase64) {
      toast({ title: "Image required", description: "Upload an image for the frame.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/frames", "POST", {
        adminPassword,
        name: newFrameName.trim(),
        imageBase64: newFrameImageBase64,
      }, adminPassword);
      if (data.success) {
        toast({ title: "Frame Added", description: `"${newFrameName}" uploaded successfully.` });
        setNewFrameName("");
        setNewFrameImageBase64(null);
        setNewFrameImagePreview(null);
        setShowAddFrame(false);
        await fetchFrames();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to add frame.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveFrame(id: string, name: string) {
    if (!confirm(`Remove frame "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const data = await fetch(`${API_BASE}/frames/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
      }).then(r => r.json());
      if (data.success) {
        toast({ title: "Frame Removed", description: `"${name}" removed.` });
        await fetchFrames();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove frame.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const statusColor = status?.connected
    ? "text-green-400"
    : status?.connecting
      ? "text-yellow-400"
      : "text-red-400";

  const statusLabel = status?.connected
    ? "Connected"
    : status?.connecting
      ? "Connecting..."
      : "Disconnected";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Bot Admin Panel</h1>
          <span className="ml-2 text-xs text-indigo-400 bg-indigo-900/40 border border-indigo-700/50 px-2 py-0.5 rounded-full">Authenticated</span>
          <button onClick={() => { fetchStatus(); fetchBots(); fetchFrames(); }} className="ml-auto text-gray-400 hover:text-white transition">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => setAdminPassword(null)} className="text-gray-500 hover:text-red-400 transition text-xs">
            Lock
          </button>
        </div>

        {/* ── Active Connection Status ── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2">
              {status?.connected ? <Wifi size={20} className="text-green-400" /> : <WifiOff size={20} className="text-red-400" />}
              Active Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
            </div>
            {status?.botName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Bot Account</span>
                <span className="text-white">{status.botName}</span>
              </div>
            )}
            {status?.botId && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Bot ID</span>
                <span className="text-gray-300 text-xs font-mono">{status.botId}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Session Saved</span>
              <span className={status?.credsRegistered ? "text-green-400" : "text-gray-500"}>
                {status?.credsRegistered ? "Yes" : "No"}
              </span>
            </div>

            {status?.pairingCode && (
              <div className="mt-4 p-4 bg-indigo-950 border border-indigo-700 rounded-lg text-center">
                <p className="text-xs text-indigo-300 mb-1">Pairing Code — enter this in WhatsApp</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-indigo-300">
                  {status.pairingCode}
                </p>
                <p className="text-xs text-indigo-400 mt-2">
                  WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Connect Bot ── */}
        {!status?.connected && !status?.connecting && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Connect Bot</CardTitle>
              <CardDescription className="text-gray-400">
                {status?.credsRegistered
                  ? "Session found — click Start to reconnect."
                  : "No session saved. Enter the bot's phone number to pair."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!status?.credsRegistered && (
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-300">Bot Phone Number (with country code)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="e.g. 601112345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
              )}
              <Button onClick={handleStart} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Start Bot
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Request Pairing Code ── */}
        {(status?.connecting || status?.connected) && !status?.pairingCode && !status?.credsRegistered && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Request Pairing Code</CardTitle>
              <CardDescription className="text-gray-400">
                The bot is running but not paired yet. Enter the phone number to pair.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pairingPhone" className="text-gray-300">Bot Phone Number (with country code)</Label>
                <Input
                  id="pairingPhone"
                  type="tel"
                  placeholder="e.g. 601112345678"
                  value={pairingPhone || phone}
                  onChange={(e) => setPairingPhone(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <Button onClick={handleRequestPairingCode} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Get Pairing Code
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Manage Active Connection ── */}
        {(status?.connected || status?.credsRegistered) && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Manage Connection</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {status?.connected && (
                <Button variant="outline" onClick={handleDisconnect} disabled={loading}
                  className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center gap-2">
                  <Unplug size={16} /> Disconnect
                </Button>
              )}
              <Button variant="destructive" onClick={handleClearAuth} disabled={loading}
                className="w-full flex items-center gap-2">
                <Trash2 size={16} /> Clear Session &amp; Re-Pair
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Registered Bots ── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Bot size={18} className="text-indigo-400" /> Registered Bots
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Each bot has a name, phone number, and optional profile image.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddBot(!showAddBot)}
              className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
            >
              <Plus size={14} className="mr-1" /> Add Bot
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Add Bot Form */}
            {showAddBot && (
              <div className="p-4 rounded-lg bg-gray-800/60 border border-gray-700 space-y-4">
                <h3 className="text-sm font-semibold text-white">New Bot Profile</h3>

                {/* Image upload */}
                <ImageUploadBox
                  label="Bot Profile Image (optional)"
                  preview={newBotImagePreview}
                  onFile={handleBotImageFile}
                  onClear={() => { setNewBotImageBase64(null); setNewBotImagePreview(null); }}
                />

                <div className="space-y-2">
                  <Label className="text-gray-300 text-xs">Bot Name *</Label>
                  <Input
                    placeholder="e.g. Shadow Alpha"
                    value={newBotName}
                    onChange={(e) => setNewBotName(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 text-xs">Phone Number (with country code)</Label>
                  <Input
                    placeholder="e.g. 601112345678"
                    value={newBotPhone}
                    onChange={(e) => setNewBotPhone(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddBot} disabled={loading} size="sm" className="bg-green-600 hover:bg-green-700">
                    {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Register Bot
                  </Button>
                  <Button onClick={() => setShowAddBot(false)} size="sm" variant="ghost" className="text-gray-400">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Bot List */}
            {bots.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
                No bots registered yet. Click "Add Bot" to register your first bot profile.
              </div>
            ) : (
              <div className="space-y-2">
                {bots.map((bot) => (
                  <div key={bot.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    {/* Bot avatar — show uploaded image or fallback icon */}
                    <BotAvatar botId={bot.id} name={bot.name} cacheKey={bot.createdAt} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm truncate">{bot.name}</span>
                        <Circle
                          size={8}
                          className={bot.status === "online" ? "text-green-400 fill-green-400" : "text-red-400 fill-red-400"}
                        />
                        <span className={`text-xs ${bot.status === "online" ? "text-green-400" : "text-gray-500"}`}>
                          {bot.status === "online" ? "Online" : "Offline"}
                        </span>
                      </div>
                      {bot.phone && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">+{bot.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick-pair: click phone number to pre-fill pairing */}
                      {bot.phone && !status?.connected && !status?.credsRegistered && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setPhone(bot.phone); setPairingPhone(bot.phone); toast({ title: "Phone set", description: `Using +${bot.phone} for pairing.` }); }}
                          className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20 text-xs px-2"
                        >
                          Use
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveBot(bot.id, bot.name)}
                        disabled={loading || bot.id === "__active__"}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Menu Preview */}
            {bots.length > 0 && (
              <div className="mt-4 p-4 bg-black/60 rounded-lg border border-gray-700 font-mono text-xs text-gray-300">
                <p className="text-gray-500 mb-2">Bot menu preview (.bots):</p>
                <p>┌─❖</p>
                <p>│「 <span className="text-white font-bold">SHADOW GARDEN</span> 」</p>
                <p>└┬❖ 「 𝗕𝗢𝗧𝗦 」</p>
                {bots.map((bot) => (
                  <p key={bot.id}>
                    {"   "}│✑{"  "}
                    <span className={bot.status === "online" ? "text-green-400" : "text-red-400"}>
                      {bot.status === "online" ? "🟢" : "🔴"}
                    </span>{" "}
                    {bot.name}{bot.phone ? ` (+${bot.phone})` : ""}
                  </p>
                ))}
                <p>{"   "}└────────────┈ ⳹</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Profile Frames ── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <LayoutGrid size={18} className="text-purple-400" /> Profile Frames
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Frame overlays shown around user profile pictures. Upload via this panel or use <code className="text-purple-300">.frame upload &lt;name&gt;</code> in WhatsApp (reply to image).
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddFrame(!showAddFrame)}
              className="bg-purple-700 hover:bg-purple-800 shrink-0"
            >
              <Upload size={14} className="mr-1" /> Upload Frame
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Add Frame Form */}
            {showAddFrame && (
              <div className="p-4 rounded-lg bg-gray-800/60 border border-gray-700 space-y-4">
                <h3 className="text-sm font-semibold text-white">New Profile Frame</h3>
                <ImageUploadBox
                  label="Frame Image * (PNG with transparent background recommended)"
                  preview={newFrameImagePreview}
                  onFile={handleFrameImageFile}
                  onClear={() => { setNewFrameImageBase64(null); setNewFrameImagePreview(null); }}
                />
                <div className="space-y-2">
                  <Label className="text-gray-300 text-xs">Frame Name *</Label>
                  <Input
                    placeholder="e.g. Golden Crown"
                    value={newFrameName}
                    onChange={(e) => setNewFrameName(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddFrame} disabled={loading} size="sm" className="bg-purple-700 hover:bg-purple-800">
                    {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Upload Frame
                  </Button>
                  <Button onClick={() => setShowAddFrame(false)} size="sm" variant="ghost" className="text-gray-400">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Frame Grid */}
            {frames.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
                No frames yet. Upload one above or use <code className="text-purple-300">.frame upload</code> in WhatsApp.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {frames.map((frame) => (
                  <div key={frame.id} className="relative group rounded-xl bg-gray-800/60 border border-gray-700 p-3 flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-900 border border-gray-600 flex items-center justify-center">
                      <img
                        src={`${API_BASE}/frames/${frame.id}/image?t=${frame.createdAt}`}
                        alt={frame.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-white font-medium text-center truncate w-full">{frame.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono truncate w-full text-center">{frame.id}</p>
                    <button
                      onClick={() => handleRemoveFrame(frame.id, frame.name)}
                      disabled={loading}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition bg-red-700/80 hover:bg-red-600 rounded-full p-0.5"
                    >
                      <X size={11} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-600 mt-2">
              Users set their frame with <code className="text-purple-400">.setframe &lt;frame-id&gt;</code> in WhatsApp.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-600">
          How to pair: Add bot with name + phone → Start bot → Get Pairing Code → Open WhatsApp → Settings → Linked Devices → Link with phone number → Enter code
        </p>
      </div>
    </div>
  );
}
