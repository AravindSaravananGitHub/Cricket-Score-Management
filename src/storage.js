/* ── localStorage keys ── */
export const KEYS = {
  APP:     "cricket_app_state_v2",
  PLAYERS: "cricket_players_v1",
  HISTORY: "cricket_history_v2",
  STATS:   "cricket_stats_v1",
  MATCH:   "cricket_match_v3",
};

/* ════════ PLAYERS ════════ */
export function getPlayers() {
  try { return JSON.parse(localStorage.getItem(KEYS.PLAYERS)) || []; } catch { return []; }
}
export function savePlayers(p) {
  try { localStorage.setItem(KEYS.PLAYERS, JSON.stringify(p)); } catch {}
}

/* ════════ HISTORY ════════ */
export function getHistory() {
  try { return JSON.parse(localStorage.getItem(KEYS.HISTORY)) || []; } catch { return []; }
}
export function addHistory(entry) {
  try {
    const h = getHistory();
    h.unshift({ ...entry, date: new Date().toLocaleDateString("en-IN") });
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(h.slice(0, 10)));
  } catch {}
}

/* ════════ STATS ════════ */
export function blankStat() {
  return {
    matches:0, runs:0, balls:0, fours:0, sixes:0,
    outs:0, notOuts:0, bestRuns:0, bestBalls:0, hundreds:0, fifties:0,
    wickets:0, bowlRuns:0, bowlBalls:0, maidens:0,
    bestWickets:0, bestWicketRuns:999,
    catches:0, stumpings:0,
  };
}

/* BUG 2 FIX: sanitize a stat object — fill any missing/NaN fields with 0 */
function sanitize(s) {
  const blank = blankStat();
  const out = {};
  for (const key of Object.keys(blank)) {
    const v = s[key];
    // If the stored value is a valid finite number, keep it; otherwise use blank default
    out[key] = (typeof v === "number" && isFinite(v)) ? v : blank[key];
  }
  return out;
}

export function getStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.STATS)) || {};
    // Sanitize every entry on load so StatsScreen never sees NaN
    const clean = {};
    for (const [name, s] of Object.entries(raw)) {
      clean[name] = sanitize(typeof s === "object" && s !== null ? s : {});
    }
    return clean;
  } catch { return {}; }
}

export function saveStats(s) {
  try { localStorage.setItem(KEYS.STATS, JSON.stringify(s)); } catch {}
}

/* ════════ UPDATE STATS FROM MATCH ════════ */
export function updateStatsFromMatch({ batters1, bowlers1, fowList1, batters2, bowlers2, fowList2 }) {
  const stats = getStats(); // already sanitized
  const ensure = (name) => { if (!stats[name]) stats[name] = blankStat(); };

  // Count which players actually appeared
  const appeared = new Set([
    ...batters1.filter(b => b.active || b.out || b.balls > 0).map(b => b.name),
    ...batters2.filter(b => b.active || b.out || b.balls > 0).map(b => b.name),
    ...bowlers1.filter(b => b.legal > 0 || b.wides > 0 || b.noBalls > 0).map(b => b.name),
    ...bowlers2.filter(b => b.legal > 0 || b.wides > 0 || b.noBalls > 0).map(b => b.name),
  ]);
  appeared.forEach(name => { ensure(name); stats[name].matches += 1; });

  // Batting
  const applyBat = (arr) => arr.forEach(b => {
    if (!b.active && !b.out && b.balls === 0) return;
    ensure(b.name);
    const s = stats[b.name];
    s.runs  += (b.runs  || 0);
    s.balls += (b.balls || 0);
    s.fours += (b.fours || 0);
    s.sixes += (b.sixes || 0);
    if (b.out) s.outs += 1; else s.notOuts += 1;
    if ((b.runs || 0) >= 100) s.hundreds += 1;
    else if ((b.runs || 0) >= 50) s.fifties += 1;
    if ((b.runs || 0) > (s.bestRuns || 0)) {
      s.bestRuns = b.runs; s.bestBalls = b.balls;
    }
  });
  applyBat(batters1); applyBat(batters2);

  // Bowling
  const applyBowl = (arr) => arr.forEach(b => {
    if (b.legal === 0 && b.wides === 0 && b.noBalls === 0) return;
    ensure(b.name);
    const s = stats[b.name];
    s.wickets   += (b.wickets || 0);
    s.bowlRuns  += (b.runs    || 0);
    s.bowlBalls += (b.legal   || 0);
    s.maidens   += (b.maidens || 0);
    if ((b.wickets || 0) > s.bestWickets ||
        ((b.wickets || 0) === s.bestWickets && (b.runs || 0) < s.bestWicketRuns)) {
      s.bestWickets = b.wickets; s.bestWicketRuns = b.runs;
    }
  });
  applyBowl(bowlers1); applyBowl(bowlers2);

  // Fielding from dismissal strings
  const applyField = (fowList) => (fowList || []).forEach(f => {
    const dis = f.dismissal || "";
    const c  = dis.match(/^c (.+?) b /);
    if (c)  { const n = c[1].trim();  ensure(n); stats[n].catches   += 1; }
    const st = dis.match(/^st (.+?) b /);
    if (st) { const n = st[1].trim(); ensure(n); stats[n].stumpings += 1; }
  });
  applyField(fowList1); applyField(fowList2);

  saveStats(stats);
}
