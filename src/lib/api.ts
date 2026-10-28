// API client for the VPS Fastify backend. No secrets are stored here:
// the API base URL is public; the session token comes from /auth/login.
import { useQuery } from "@tanstack/react-query";
import { demo } from "./demo";

const KEY = "xau.settings";
export type Settings = { apiBase: string; token: string; demo: boolean; tz: string };

const DEFAULT_API_BASE = "https://43-163-101-252.sslip.io";

export function getSettings(): Settings {
  const env = import.meta.env as Record<string, string | undefined>;
  const envBase = env["VITE_API_BASE_URL"] || DEFAULT_API_BASE;
  const def: Settings = { apiBase: envBase, token: "", demo: false, tz: "Asia/Jakarta" };
  if (typeof window === "undefined") return def;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    if (!parsed.apiBase) parsed.apiBase = envBase;
    return { ...def, ...parsed };
  } catch {
    return def;
  }
}
export function saveSettings(s: Partial<Settings>) {
  localStorage.setItem(KEY, JSON.stringify({ ...getSettings(), ...s }));
  window.dispatchEvent(new Event("xau-settings"));
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, msg: string) { super(msg); }
}

export type ActiveAccount = "real" | "demo";

export function getActiveAccount(): ActiveAccount {
  if (typeof window === "undefined") return "real";
  const acc = localStorage.getItem("ea.active_account");
  return acc === "demo" ? "demo" : "real";
}

export function setActiveAccount(acc: ActiveAccount) {
  localStorage.setItem("ea.active_account", acc);
  window.dispatchEvent(new CustomEvent("ea-account-changed", { detail: acc }));
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const s = getSettings();
  if (!s.apiBase) throw new ApiError(0, "NO_API", "API base URL not configured");
  
  const currentAcc = getActiveAccount();
  
  // Transform path dynamically to target the active account
  let resolvedPath = path.replace("/accounts/default/", `/accounts/${currentAcc}/`);
  
  // Append account_id filter for EAs and events if not already specified
  if (resolvedPath === "/eas" || resolvedPath.startsWith("/eas?")) {
    const sep = resolvedPath.includes("?") ? "&" : "?";
    if (!resolvedPath.includes("account_id=")) {
      resolvedPath = `${resolvedPath}${sep}account_id=${currentAcc}`;
    }
  } else if (resolvedPath === "/telemetry/events" || resolvedPath.startsWith("/telemetry/events?")) {
    const sep = resolvedPath.includes("?") ? "&" : "?";
    if (!resolvedPath.includes("account_id=")) {
      resolvedPath = `${resolvedPath}${sep}account_id=${currentAcc}`;
    }
  } else if (resolvedPath === "/trades" || resolvedPath.startsWith("/trades?")) {
    const sep = resolvedPath.includes("?") ? "&" : "?";
    if (!resolvedPath.includes("account_id=")) {
      resolvedPath = `${resolvedPath}${sep}account_id=${currentAcc}`;
    }
  }

  const res = await fetch(`${s.apiBase.replace(/\/$/, "")}/api/v1${resolvedPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(s.token ? { Authorization: `Bearer ${s.token}` } : {}),
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.code ?? "HTTP_ERROR", body?.message ?? res.statusText);
  return (body?.data ?? body) as T;
}

/** Fetch from backend, or return clearly-labelled simulated demo data when demo mode is on. */
export function useApi<T>(path: string, demoKey: keyof typeof demo, refetchMs?: number) {
  return useQuery<T>({
    queryKey: ["api", path, getSettings().demo, getActiveAccount()],
    queryFn: async () => (getSettings().demo ? (demo[demoKey]() as T) : api<T>(path)),
    ...(refetchMs !== undefined ? { refetchInterval: refetchMs } : {}),
    retry: 1,
    staleTime: 1_500,
  });
}

export const isDemo = () => getSettings().demo;
