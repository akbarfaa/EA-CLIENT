import { useState, useEffect } from "react";
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

let currentActiveAccount: ActiveAccount =
  typeof window !== "undefined" && localStorage.getItem("ea.active_account") === "demo"
    ? "demo"
    : "real";

const accountListeners = new Set<(acc: ActiveAccount) => void>();

export function getActiveAccount(): ActiveAccount {
  if (typeof window === "undefined") return "real";
  return currentActiveAccount;
}

export function useActiveAccount(): ActiveAccount {
  const [acc, setAcc] = useState<ActiveAccount>(getActiveAccount);

  useEffect(() => {
    const handler = (newAcc: ActiveAccount) => setAcc(newAcc);
    accountListeners.add(handler);
    setAcc(getActiveAccount());
    return () => {
      accountListeners.delete(handler);
    };
  }, []);

  return acc;
}

export function setActiveAccount(acc: ActiveAccount) {
  currentActiveAccount = acc;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("ea.active_account", acc);
    } catch {}
    window.dispatchEvent(new CustomEvent("ea-account-changed", { detail: acc }));
  }
  accountListeners.forEach((fn) => fn(acc));
}

export async function api<T>(path: string, init?: RequestInit, accountOverride?: ActiveAccount): Promise<T> {
  const s = getSettings();
  if (!s.apiBase) throw new ApiError(0, "NO_API", "API base URL not configured");
  
  const currentAcc = accountOverride || getActiveAccount();
  
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
  const activeAcc = useActiveAccount();
  return useQuery<T>({
    queryKey: ["api", path, getSettings().demo, activeAcc],
    queryFn: async () => (getSettings().demo ? (demo[demoKey]() as T) : api<T>(path, undefined, activeAcc)),
    ...(refetchMs !== undefined ? { refetchInterval: refetchMs } : {}),
    retry: 1,
    staleTime: 1_000,
  });
}

export const isDemo = () => getSettings().demo;
