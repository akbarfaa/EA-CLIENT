export type SimInput = { balance: number; riskPct: number; rr: number; winRate: number; trades: number; costPct: number; paths: number };

const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };

export function monteCarlo(p: SimInput, rand: () => number = Math.random) {
  const n = Math.max(1, Math.min(2000, Math.floor(p.trades)));
  const paths = Math.max(1, Math.min(2000, Math.floor(p.paths)));
  const ends: number[] = [], dds: number[] = [], streaks: number[] = [];
  let ruin = 0;
  const samples: number[][] = [];
  for (let k = 0; k < paths; k++) {
    let b = p.balance, peak = b, dd = 0, st = 0, maxSt = 0, hit = false;
    const path = [b];
    for (let i = 0; i < n; i++) {
      const risk = b * (p.riskPct / 100);
      const win = rand() < p.winRate / 100;
      b += (win ? risk * p.rr : -risk) - b * (p.costPct / 100);
      st = win ? 0 : st + 1; maxSt = Math.max(maxSt, st);
      peak = Math.max(peak, b); dd = Math.max(dd, (peak - b) / peak);
      if (b <= p.balance * 0.5) hit = true;
      if (k < 12) path.push(b);
    }
    ends.push(b); dds.push(dd * 100); streaks.push(maxSt); if (hit) ruin++;
    if (k < 12) samples.push(path);
  }
  const keys = samples.map((_, i) => `p${i}`);
  const chart = Array.from({ length: n + 1 }, (_, i) => Object.fromEntries([["i", i], ...samples.map((s, j) => [`p${j}`, +(s[i] ?? 0).toFixed(2)])]));
  return { p5: q(ends, 0.05), p50: q(ends, 0.5), p95: q(ends, 0.95), medDd: q(dds, 0.5), streak95: q(streaks, 0.95), ruin: ruin / paths, chart, keys };
}
