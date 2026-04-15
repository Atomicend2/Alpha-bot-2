import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wifi, WifiOff, RefreshCw, Unplug, Trash2 } from "lucide-react";

interface BotStatus {
  connected: boolean;
  connecting: boolean;
  pairingCode: string | null;
  credsRegistered: boolean;
  botId: string | null;
  botName: string | null;
}

const API_BASE = "/api/bot";

async function apiFetch(path: string, method = "GET", body?: object) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function BotAdmin() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [pairingPhone, setPairingPhone] = useState("");
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch("/status");
      setStatus(data);
    } catch {
      toast({ title: "Error", description: "Could not reach API server", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function handleStart() {
    setLoading(true);
    try {
      const data = await apiFetch("/start", "POST", phone ? { phone } : {});
      toast({ title: data.success ? "Started" : "Info", description: data.message });
      await fetchStatus();
    } catch {
      toast({ title: "Error", description: "Failed to start bot", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestPairingCode() {
    if (!pairingPhone) {
      toast({ title: "Phone required", description: "Enter the bot's phone number first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/pairing", "POST", { phone: pairingPhone });
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
      const data = await apiFetch("/disconnect", "POST");
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
      const data = await apiFetch("/clear", "POST");
      toast({ title: "Auth Cleared", description: data.message });
      await fetchStatus();
    } catch {
      toast({ title: "Error", description: "Failed to clear auth", variant: "destructive" });
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
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Bot Admin Panel</h1>
          <button onClick={fetchStatus} className="ml-auto text-gray-400 hover:text-white transition">
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Status Card */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2">
              {status?.connected ? <Wifi size={20} className="text-green-400" /> : <WifiOff size={20} className="text-red-400" />}
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Connection</span>
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
                <span className="text-gray-300 text-xs">{status.botId}</span>
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
                  On WhatsApp: Settings → Linked Devices → Link a Device → Link with phone number
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connect Card */}
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
                  <Label htmlFor="phone" className="text-gray-300">
                    Bot Phone Number (with country code)
                  </Label>
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
              <Button
                onClick={handleStart}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Start Bot
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Request Pairing Code Card */}
        {(status?.connecting || status?.connected) && !status?.pairingCode && !status?.credsRegistered && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Request Pairing Code</CardTitle>
              <CardDescription className="text-gray-400">
                The bot is running but not paired yet. Request a pairing code below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pairingPhone" className="text-gray-300">
                  Bot Phone Number (with country code)
                </Label>
                <Input
                  id="pairingPhone"
                  type="tel"
                  placeholder="e.g. 601112345678"
                  value={pairingPhone}
                  onChange={(e) => setPairingPhone(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <Button
                onClick={handleRequestPairingCode}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Get Pairing Code
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Manage Card */}
        {(status?.connected || status?.credsRegistered) && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Manage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {status?.connected && (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                >
                  <Unplug size={16} /> Disconnect
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={handleClearAuth}
                disabled={loading}
                className="w-full flex items-center gap-2"
              >
                <Trash2 size={16} /> Clear Session &amp; Re-Pair
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-600">
          How to pair: Start bot → Get Pairing Code → Open WhatsApp → Settings → Linked Devices → Link with phone number → Enter code
        </p>
      </div>
    </div>
  );
}
