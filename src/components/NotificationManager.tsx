import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing, BellOff, Volume2, VolumeX, Smartphone, CheckCircle2, AlertTriangle, Info, Play } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { soundNotifier } from "@/lib/audio";
import { api, getSettings } from "@/lib/api";

export interface TelemetryEvent {
  id: string;
  t: string;
  ea: string;
  type: string; // 'order', 'deal_closed', 'patrol', 'skip', 'news'
  status: string; // 'pass', 'fail', 'skip', 'error'
  msg: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  type: "entry" | "win" | "loss" | "system";
  ea: string;
}

export function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Track seen IDs to prevent re-firing on poll
  const seenEventIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  // Initialize service worker & preferences
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setPermission(Notification.permission);
      }
      
      const savedSound = localStorage.getItem("xau.sound_enabled");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");

      const savedPush = localStorage.getItem("xau.push_enabled");
      if (savedPush !== null) setPushEnabled(savedPush === "true");

      // Register PWA service worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then(() => console.log("PWA Service Worker registered"))
          .catch((err) => console.warn("PWA SW registration:", err));
      }
    }
  }, []);

  const updateSound = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem("xau.sound_enabled", String(val));
  };

  const updatePush = (val: boolean) => {
    setPushEnabled(val);
    localStorage.setItem("xau.push_enabled", String(val));
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser ini tidak mendukung Web Notifications API.");
      return;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === "granted") {
        toast.success("✅ Push Notification Berhasil Diaktifkan!", {
          description: "Anda akan menerima notifikasi setiap kali EA Entry atau Trade Closed.",
        });
        triggerOSNotification("🔔 Notifikasi EA Aktif", "Anda siap menerima sinyal realtime dari ketiga EA (EA01, EA02, EA03)!");
        soundNotifier.playEntry();
      } else if (res === "denied") {
        toast.error("Izin Notifikasi Ditolak", {
          description: "Silakan ubah pengaturan browser Anda jika ingin mengaktifkan push notif.",
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerOSNotification = (title: string, body: string, tag?: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted" && pushEnabled) {
      try {
        new Notification(title, {
          body,
          icon: "/logo.svg",
          badge: "/logo.svg",
          tag: tag || String(Date.now()),
        });
      } catch (err) {
        console.warn("Direct Notification constructor failed, trying SW:", err);
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon: "/logo.svg",
              badge: "/logo.svg",
              tag: tag || String(Date.now()),
            });
          });
        }
      }
    }
  };

  // Poll live events every 3 seconds
  const isDemo = getSettings().demo;
  const eventsQuery = useQuery<TelemetryEvent[]>({
    queryKey: ["notification_events", isDemo],
    queryFn: async () => {
      if (isDemo) return [];
      return api<TelemetryEvent[]>("/telemetry/events?limit=30");
    },
    refetchInterval: 3000,
    staleTime: 1500,
  });

  useEffect(() => {
    if (!eventsQuery.data || eventsQuery.data.length === 0) return;

    const events = eventsQuery.data;

    // First run: seed existing IDs to avoid spamming historical logs
    if (!initialLoadDone.current) {
      events.forEach((e) => seenEventIds.current.add(e.id));
      initialLoadDone.current = true;
      return;
    }

    // Process newer events in chronological order (oldest to newest among new arrivals)
    const newEvents = events
      .filter((e) => !seenEventIds.current.has(e.id))
      .reverse();

    for (const evt of newEvents) {
      seenEventIds.current.add(evt.id);

      // 1. FILTER FOR ORDER ENTRY
      if (evt.type === "order" || evt.type === "order_entry") {
        const isSuccess = evt.status === "pass";
        const title = isSuccess
          ? `🔔 [${evt.ea}] New Order Entry!`
          : `❌ [${evt.ea}] Order Entry Failed`;

        // Play chime
        if (soundEnabled && isSuccess) {
          soundNotifier.playEntry();
        }

        // Show Toast
        if (isSuccess) {
          toast.info(title, {
            description: evt.msg,
            duration: 8000,
          });
        } else {
          toast.error(title, {
            description: evt.msg,
            duration: 8000,
          });
        }

        // Show Native OS Push Notification
        triggerOSNotification(title, evt.msg, evt.id);

        setRecentNotifications((prev) => [
          {
            id: evt.id,
            title,
            body: evt.msg,
            time: new Date(evt.t).toLocaleTimeString(),
            type: "entry",
            ea: evt.ea,
          },
          ...prev.slice(0, 19),
        ]);
      }

      // 2. FILTER FOR DEAL CLOSED (Trade Exit & Result)
      else if (evt.type === "deal_closed" || evt.type === "deal") {
        const isWin = evt.status === "pass" || evt.msg.includes("WIN") || evt.msg.includes("Net=+");
        const title = isWin
          ? `🎉 [${evt.ea}] Trade Closed: WIN / PROFIT!`
          : `⚠️ [${evt.ea}] Trade Closed: LOSS / STOP OUT`;

        // Play chime
        if (soundEnabled) {
          if (isWin) soundNotifier.playWin();
          else soundNotifier.playLoss();
        }

        // Show Toast
        if (isWin) {
          toast.success(title, {
            description: evt.msg,
            duration: 9000,
          });
        } else {
          toast.error(title, {
            description: evt.msg,
            duration: 9000,
          });
        }

        // Show Native OS Push Notification
        triggerOSNotification(title, evt.msg, evt.id);

        setRecentNotifications((prev) => [
          {
            id: evt.id,
            title,
            body: evt.msg,
            time: new Date(evt.t).toLocaleTimeString(),
            type: isWin ? "win" : "loss",
            ea: evt.ea,
          },
          ...prev.slice(0, 19),
        ]);
      }
    }
  }, [eventsQuery.data, soundEnabled, pushEnabled]);

  // Test helpers
  const runTestEntry = () => {
    soundNotifier.playEntry();
    const title = "🔔 [EA02_Sweep] Test Order Entry";
    const body = "ORDER OK | BUY | Lots=0.04 | Entry=2715.40 | SL=2708.50 | TP=2729.20 | Risk$=$20.00";
    toast.info(title, { description: body });
    triggerOSNotification(title, body);
    setRecentNotifications((prev) => [
      {
        id: String(Date.now()),
        title,
        body,
        time: new Date().toLocaleTimeString(),
        type: "entry",
        ea: "EA02",
      },
      ...prev,
    ]);
  };

  const runTestWin = () => {
    soundNotifier.playWin();
    const title = "🎉 [EA01_VWAP] Test Trade Result: WIN";
    const body = "DEAL CLOSED | Ticket=455174099 | WIN BUY | Net=+$45.20 USD | Vol=0.02";
    toast.success(title, { description: body });
    triggerOSNotification(title, body);
    setRecentNotifications((prev) => [
      {
        id: String(Date.now()),
        title,
        body,
        time: new Date().toLocaleTimeString(),
        type: "win",
        ea: "EA01",
      },
      ...prev,
    ]);
  };

  const runTestLoss = () => {
    soundNotifier.playLoss();
    const title = "⚠️ [EA03_Breakout] Test Trade Result: LOSS";
    const body = "DEAL CLOSED | Ticket=455174100 | LOSS SELL | Net=-$15.00 USD | Hit SL";
    toast.error(title, { description: body });
    triggerOSNotification(title, body);
    setRecentNotifications((prev) => [
      {
        id: String(Date.now()),
        title,
        body,
        time: new Date().toLocaleTimeString(),
        type: "loss",
        ea: "EA03",
      },
      ...prev,
    ]);
  };

  const isGranted = permission === "granted";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notification Center"
          className="relative rounded-sm p-1.5 transition-colors hover:bg-accent flex items-center justify-center"
        >
          {isGranted ? (
            <div className="relative">
              <Bell className="size-4 text-emerald-400" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
          ) : (
            <div className="relative">
              <BellOff className="size-4 text-amber-400 opacity-80" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500"></span>
            </div>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 md:w-96 p-4 bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-amber-400" />
            <div>
              <h4 className="text-sm font-semibold tracking-tight">EA Push Notifications</h4>
              <p className="text-[11px] text-zinc-400">Order Entry & Hasil Trade Ketiga EA</p>
            </div>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isGranted
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                : "bg-amber-950/80 text-amber-300 border-amber-800"
            }`}
          >
            {isGranted ? "ACTIVE" : "INACTIVE"}
          </span>
        </div>

        {/* Permission Request Prompt */}
        {!isGranted && (
          <div className="mt-3 p-2.5 rounded bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Push Notifikasi browser belum aktif. Aktifkan agar HP atau Laptop Anda menerima notifikasi saat EA entry dan exit.</span>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="w-full py-1.5 px-3 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
            >
              <Bell className="size-3.5" /> Aktifkan Notifikasi Web & Mobile
            </button>
          </div>
        )}

        {/* Preference Controls */}
        <div className="mt-3 space-y-2.5 text-xs py-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-zinc-300">
              {soundEnabled ? <Volume2 className="size-4 text-emerald-400" /> : <VolumeX className="size-4 text-zinc-500" />}
              Audio Chime (Suara Bel Sinyal)
            </span>
            <Switch checked={soundEnabled} onCheckedChange={updateSound} />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-zinc-300">
              <Smartphone className="size-4 text-cyan-400" />
              Notifikasi Sistem OS / Pop-up
            </span>
            <Switch checked={pushEnabled} onCheckedChange={updatePush} />
          </div>
        </div>

        {/* Quick Test Alerts */}
        <div className="mt-3 pt-2 border-t border-zinc-800/80">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Uji Coba Notifikasi (Simulasi)</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={runTestEntry}
              className="px-2 py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-[10px] text-cyan-300 font-medium flex items-center justify-center gap-1 transition"
            >
              <Play className="size-3" /> Tes Entry
            </button>
            <button
              onClick={runTestWin}
              className="px-2 py-1.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-[10px] text-emerald-300 font-medium flex items-center justify-center gap-1 transition"
            >
              <Play className="size-3" /> Tes Win
            </button>
            <button
              onClick={runTestLoss}
              className="px-2 py-1.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-[10px] text-rose-300 font-medium flex items-center justify-center gap-1 transition"
            >
              <Play className="size-3" /> Tes Loss
            </button>
          </div>
        </div>

        {/* Mobile PWA Installation Guide */}
        <div className="mt-3 p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
          <div className="font-semibold text-zinc-200 flex items-center gap-1.5 mb-1">
            <Smartphone className="size-3.5 text-gold" />
            Install di HP (PWA App):
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[10px] text-zinc-400">
            <li><strong className="text-zinc-200">Android:</strong> Buka Chrome &rarr; Menu ⋮ &rarr; "Install App" / "Tambahkan ke Layar Utama".</li>
            <li><strong className="text-zinc-200">iPhone (iOS):</strong> Buka Safari &rarr; Tombol Share ⎋ &rarr; "Add to Home Screen".</li>
          </ul>
        </div>

        {/* Recent Alerts Feed */}
        <div className="mt-3 pt-2 border-t border-zinc-800">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            Riwayat Notifikasi Sesi Ini ({recentNotifications.length})
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
            {recentNotifications.length === 0 ? (
              <p className="text-zinc-500 italic py-1 text-center">Belum ada sinyal entry/exit baru di sesi ini.</p>
            ) : (
              recentNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-1.5 rounded border leading-tight ${
                    n.type === "entry"
                      ? "bg-cyan-950/40 border-cyan-800 text-cyan-200"
                      : n.type === "win"
                      ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                      : "bg-rose-950/40 border-rose-800 text-rose-200"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{n.title}</span>
                    <span className="text-[9px] opacity-75">{n.time}</span>
                  </div>
                  <p className="text-[9px] opacity-90 mt-0.5 line-clamp-2">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
