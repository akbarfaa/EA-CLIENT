// SIMULATED demo data — used ONLY when "Demo mode" is enabled, always labelled in the UI.
// Deterministic PRNG so the preview is stable. Not real trading results.
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const reset = () => (seed = 42);
const now = () => Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export type Health = "healthy" | "delayed" | "stale" | "offline" | "error" | "unknown";

export const demo = {
  summary: () => ({
    accountId: "EXN-DEMO-01", currency: "USD", source: "simulated",
    balance: 10482.36, equity: 10417.9, floating: -64.46, margin: 211.4, freeMargin: 10206.5,
    pnlToday: 38.2, pnlWeek: 142.75, pnlMonth: 482.36, dailyDrawdownPct: 0.92,
    openRisk: null as number | null, openRiskNote: "1 position without SL — not calculable",
    closedTrades: 186, winRate: 0.532, profitFactor: 1.31, expectancy: 2.59, maxDrawdownPct: 6.8,
    lastTelemetry: iso(now() - 14_000),
  }),
  equity: () => {
    reset();
    let b = 10000, e = 10000, peak = 10000;
    return Array.from({ length: 60 }, (_, i) => {
      const d = (rnd() - 0.45) * 60;
      b += d; e = b + (rnd() - 0.5) * 40; peak = Math.max(peak, e);
      return { t: iso(now() - (60 - i) * 86400000).slice(5, 10), balance: +b.toFixed(2), equity: +e.toFixed(2), dd: +(((e - peak) / peak) * 100).toFixed(2), pnl: +d.toFixed(2) };
    });
  },
  byHour: () => { reset(); return Array.from({ length: 24 }, (_, h) => ({ h: `${h}`, pnl: +((rnd() - 0.45) * 80).toFixed(1) })); },
  eas: () => [
    { id: "ea01", name: "EA01", strategy: "Trend Pullback + VWAP", magic: 20240001, version: "1.4.2", health: "healthy" as Health, heartbeat: iso(now() - 9000), netPnl: 312.4, floating: -64.46, trades: 92, winRate: 0.55, pf: 1.42, expectancy: 3.4, avgWin: 18.2, avgLoss: -15.6, maxDd: 3.1, avgR: 0.21, longs: 51, shorts: 41, positions: 1, skipped: { spread: 14, news: 6, noSignal: 410, dailyLock: 1 } },
    { id: "ea02", name: "EA02", strategy: "Liquidity Sweep + Reclaim", magic: 20240002, version: "0.9.0", health: "healthy" as Health, heartbeat: iso(now() - 15000), netPnl: 141.2, floating: 0, trades: 71, winRate: 0.49, pf: 1.18, expectancy: 1.99, avgWin: 22.1, avgLoss: -18.4, maxDd: 4.8, avgR: 0.08, longs: 30, shorts: 41, positions: 0, skipped: { spread: 22, news: 4, noSignal: 220, rejected: 3 } },
    { id: "ea03", name: "EA03", strategy: "Volatility Expansion / Breakout", magic: 20240003, version: "0.3.1", health: "healthy" as Health, heartbeat: iso(now() - 22000), netPnl: 28.76, floating: 0, trades: 23, winRate: 0.52, pf: 1.09, expectancy: 1.25, avgWin: 25, avgLoss: -24.1, maxDd: 2.2, avgR: 0.04, longs: 12, shorts: 11, positions: 0, skipped: { spread: 5, noSignal: 96, error: 2 } },
    { id: "ea04", name: "EA04", strategy: "Fair Value Gap (FVG)", magic: 20240004, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 12000), netPnl: 88.5, floating: 0, trades: 38, winRate: 0.53, pf: 1.26, expectancy: 2.33, avgWin: 21.0, avgLoss: -17.5, maxDd: 2.9, avgR: 0.12, longs: 20, shorts: 18, positions: 0, skipped: { spread: 8, news: 2, noSignal: 180 } },
    { id: "ea05", name: "EA05", strategy: "Range Boundary Fakeout", magic: 20240005, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 18000), netPnl: 64.2, floating: 0, trades: 29, winRate: 0.48, pf: 1.15, expectancy: 2.21, avgWin: 24.5, avgLoss: -19.0, maxDd: 3.5, avgR: 0.09, longs: 14, shorts: 15, positions: 0, skipped: { spread: 12, noSignal: 150 } },
    { id: "ea06", name: "EA06", strategy: "Momentum Pin Bar Rejection", magic: 20240006, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 25000), netPnl: 52.1, floating: 0, trades: 31, winRate: 0.51, pf: 1.22, expectancy: 1.68, avgWin: 19.8, avgLoss: -16.2, maxDd: 2.4, avgR: 0.11, longs: 16, shorts: 15, positions: 0, skipped: { spread: 7, noSignal: 195 } },
    { id: "ea07", name: "EA07", strategy: "News Momentum Breakout", magic: 20240007, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 30000), netPnl: 45.0, floating: 0, trades: 19, winRate: 0.58, pf: 1.35, expectancy: 2.37, avgWin: 32.0, avgLoss: -22.0, maxDd: 4.1, avgR: 0.18, longs: 10, shorts: 9, positions: 0, skipped: { spread: 19, noSignal: 110 } },
    { id: "ea01_btc", name: "EA01_BTC", strategy: "TTM Squeeze Breakout (BTCUSD)", magic: 20250001, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 11000), netPnl: 215.8, floating: 42.10, trades: 45, winRate: 0.56, pf: 1.51, expectancy: 4.80, avgWin: 48.5, avgLoss: -31.2, maxDd: 3.8, avgR: 0.28, longs: 25, shorts: 20, positions: 1, skipped: { spread: 3, noSignal: 310 } },
    { id: "ea02_btc", name: "EA02_BTC", strategy: "Supertrend Adaptive Trend (BTCUSD)", magic: 20250002, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 17000), netPnl: 178.4, floating: 0, trades: 34, winRate: 0.53, pf: 1.38, expectancy: 5.25, avgWin: 55.0, avgLoss: -39.0, maxDd: 4.5, avgR: 0.22, longs: 18, shorts: 16, positions: 0, skipped: { spread: 2, noSignal: 280 } },
    { id: "ea03_btc", name: "EA03_BTC", strategy: "Liquidity Sweep & Reclaim (BTCUSD)", magic: 20250003, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 28000), netPnl: 95.6, floating: 0, trades: 26, winRate: 0.50, pf: 1.25, expectancy: 3.68, avgWin: 52.0, avgLoss: -41.0, maxDd: 3.9, avgR: 0.15, longs: 14, shorts: 12, positions: 0, skipped: { spread: 4, noSignal: 240 } },
    { id: "ea01_usoil", name: "EA01_USOIL", strategy: "Asian Box London Drive (USOIL)", magic: 20260001, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 8000), netPnl: 135.2, floating: 18.50, trades: 41, winRate: 0.54, pf: 1.44, expectancy: 3.30, avgWin: 28.0, avgLoss: -20.5, maxDd: 3.2, avgR: 0.24, longs: 22, shorts: 19, positions: 1, skipped: { spread: 6, news: 5, noSignal: 260 } },
    { id: "ea02_usoil", name: "EA02_USOIL", strategy: "Daily Anchored VWAP Pullback (USOIL)", magic: 20260002, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 16000), netPnl: 112.0, floating: 0, trades: 36, winRate: 0.50, pf: 1.30, expectancy: 3.11, avgWin: 26.5, avgLoss: -21.0, maxDd: 3.6, avgR: 0.19, longs: 19, shorts: 17, positions: 0, skipped: { spread: 8, news: 4, noSignal: 290 } },
    { id: "ea03_usoil", name: "EA03_USOIL", strategy: "Donchian Volatility Expansion (USOIL)", magic: 20260003, version: "1.0.0", health: "healthy" as Health, heartbeat: iso(now() - 24000), netPnl: 82.4, floating: 0, trades: 28, winRate: 0.50, pf: 1.21, expectancy: 2.94, avgWin: 30.0, avgLoss: -25.0, maxDd: 3.9, avgR: 0.14, longs: 15, shorts: 13, positions: 0, skipped: { spread: 5, news: 5, noSignal: 210 } },
  ],
  positions: () => [
    { ticket: 5512031, symbol: "XAUUSDc", side: "BUY", volume: 0.05, entry: 2712.35, price: 2711.06, sl: 2705.1, tp: 2726.9, pnl: -6.45, openedAt: iso(now() - 42 * 60000), ea: "EA01", magic: 20240001, riskToSl: 36.25 },
    { ticket: 5512044, symbol: "BTCUSDm", side: "BUY", volume: 0.01, entry: 67450.0, price: 67871.0, sl: 66900.0, tp: 68500.0, pnl: 42.10, openedAt: iso(now() - 18 * 60000), ea: "EA01_BTC", magic: 20250001, riskToSl: 55.00 },
    { ticket: 5512055, symbol: "USOILm", side: "BUY", volume: 0.02, entry: 71.40, price: 72.325, sl: 70.80, tp: 72.80, pnl: 18.50, openedAt: iso(now() - 8 * 60000), ea: "EA01_USOIL", magic: 20260001, riskToSl: 12.00 },
  ],
  trades: () => {
    reset();
    return Array.from({ length: 40 }, (_, i) => {
      const side = rnd() > 0.5 ? "BUY" : "SELL"; const entry = 2380 + rnd() * 50; const move = (rnd() - 0.45) * 12;
      const vol = [0.01, 0.02, 0.05][Math.floor(rnd() * 3)]; const gross = +(move * vol * 100).toFixed(2); const comm = -(vol * 7).toFixed(2);
      const ea = ["EA01", "EA02", "EA03"][i % 3]; const t = now() - i * 7 * 3600000;
      return { id: 900000 + i, symbol: "XAUUSDc", side, ea, magic: 1001 + (i % 3), volume: vol, entry: +entry.toFixed(2), exit: +(entry + (side === "BUY" ? move : -move)).toFixed(2), sl: +(entry - 7).toFixed(2), tp: +(entry + 14).toFixed(2), gross, commission: comm, swap: 0, net: +(gross + comm).toFixed(2), openedAt: iso(t - 3600000 * (1 + rnd() * 4)), closedAt: iso(t), r: +(move / 7).toFixed(2), source: i % 4 === 0 ? "import" : "live", exitReason: move > 0 ? "TP" : "SL" };
    });
  },
  events: () => {
    const b = now() - 5 * 60000;
    return [
      { id: "e1", t: iso(b), ea: "EA01", type: "BAR_NEW", status: "info", msg: "New M5 bar detected" },
      { id: "e2", t: iso(b + 120), ea: "EA01", type: "DATA_CHECK", status: "pass", msg: "Market & indicator data ok" },
      { id: "e3", t: iso(b + 260), ea: "EA01", type: "SIGNAL_EVAL", status: "pass", msg: "Pullback to VWAP, direction BUY" },
      { id: "e4", t: iso(b + 300), ea: "EA01", type: "NEWS_FILTER", status: "pass", msg: "No high-impact event within 30m" },
      { id: "e5", t: iso(b + 320), ea: "EA01", type: "SPREAD_FILTER", status: "fail", msg: "Spread 42 pts > max 30 pts" },
      { id: "e6", t: iso(b + 330), ea: "EA01", type: "ENTRY_SKIPPED", status: "skip", msg: "Order intentionally skipped: SPREAD_TOO_WIDE" },
      { id: "e7", t: iso(b + 61000), ea: "EA02", type: "ORDER_SEND", status: "fail", msg: "retcode 10016 TRADE_RETCODE_INVALID_STOPS" },
      { id: "e8", t: iso(b + 90000), ea: "EA03", type: "INDICATOR_ERROR", status: "error", msg: "iATR handle invalid (4806)" },
    ];
  },
  imports: () => [
    { id: "imp-3", file: "ReportHistory-2026-09.csv", at: iso(now() - 86400000 * 2), type: "MT5 Deals", range: "2026-09-01 → 2026-09-30", parsed: 412, accepted: 398, rejected: 4, duplicates: 10, status: "completed" },
    { id: "imp-2", file: "ReportHistory-2026-08.csv", at: iso(now() - 86400000 * 30), type: "MT5 Deals", range: "2026-08-01 → 2026-08-31", parsed: 380, accepted: 380, rejected: 0, duplicates: 0, status: "completed" },
  ],
  research: () => [
    { id: "r1", strategy: "EA01 Trend Pullback", period: "2023-01 → 2026-06", model: "Every tick real", trades: 1240, pf: 1.36, maxDd: 9.4, sharpe: 1.1, oos: true, status: "validated-oos" },
    { id: "r2", strategy: "EA02 Liquidity Sweep", period: "2024-01 → 2026-06", model: "1m OHLC", trades: 410, pf: 1.52, maxDd: 12.1, sharpe: 1.3, oos: false, status: "in-sample only" },
    { id: "r3", strategy: "EA03 Breakout", period: "2025-01 → 2026-06", model: "Every tick", trades: 88, pf: 1.12, maxDd: 7.0, sharpe: 0.4, oos: false, status: "insufficient sample" },
  ],
  market: () => ({ configured: false, events: [] as unknown[] }),
  system: () => ({ api: "simulated", db: "simulated", version: "demo", uptime: "—" }),
};
