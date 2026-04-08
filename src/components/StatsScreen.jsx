import { useState } from "react";
import { getStats, getPlayers } from "../storage";

/* Safe helpers — never produce NaN */
const n    = (v) => (typeof v === "number" && isFinite(v)) ? v : 0;
const fmt  = (b) => `${Math.floor(n(b)/6)}.${n(b)%6}`;
const avg  = (r,o) => n(o)===0 ? (n(r)>0 ? n(r).toFixed(1) : "—") : (n(r)/n(o)).toFixed(1);
const sr   = (r,b) => n(b)===0 ? "—" : ((n(r)/n(b))*100).toFixed(0);
const econ = (r,b) => n(b)===0 ? "—" : (n(r)/(n(b)/6)).toFixed(2);
const bAvg = (r,w) => n(w)===0 ? "—" : (n(r)/n(w)).toFixed(1);

export default function StatsScreen({ setScreen }) {
  const allPlayers = getPlayers();          // [{name}]
  const rawStats   = getStats();            // sanitized by storage.js
  const [search,   setSearch]   = useState("");
  const [sortBy,   setSortBy]   = useState("name");
  const [expanded, setExpanded] = useState(null);

  /* Safe stat getter — every field guaranteed to be a number */
  const getStat = (name) => {
    const s = rawStats[name] || {};
    return {
      matches:       n(s.matches),
      runs:          n(s.runs),
      balls:         n(s.balls),
      fours:         n(s.fours),
      sixes:         n(s.sixes),
      outs:          n(s.outs),
      notOuts:       n(s.notOuts),
      bestRuns:      n(s.bestRuns),
      bestBalls:     n(s.bestBalls),
      hundreds:      n(s.hundreds),
      fifties:       n(s.fifties),
      wickets:       n(s.wickets),
      bowlRuns:      n(s.bowlRuns),
      bowlBalls:     n(s.bowlBalls),
      maidens:       n(s.maidens),
      bestWickets:   n(s.bestWickets),
      bestWicketRuns:n(s.bestWicketRuns) === 999 ? 0 : n(s.bestWicketRuns),
      catches:       n(s.catches),
      stumpings:     n(s.stumpings),
    };
  };

  const list = allPlayers
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .map(p => ({ name: p.name, s: getStat(p.name) }))
    .sort((a,b) => {
      if (sortBy === "runs")    return b.s.runs    - a.s.runs;
      if (sortBy === "wickets") return b.s.wickets - a.s.wickets;
      if (sortBy === "matches") return b.s.matches - a.s.matches;
      return a.name.localeCompare(b.name);
    });

  const runColor = (r) => r >= 100 ? "#f59e0b" : r >= 50 ? "#16a34a" : "var(--text)";
  const wktColor = (w) => w >= 5  ? "#ef4444" : w >= 3  ? "#f97316" : "var(--text)";

  return (
    <div>
      <button className="app-button back-btn" onClick={() => setScreen("home")}>⬅ Back</button>

      <div style={{ marginBottom:12 }}>
        <div className="screen-title">Player Statistics</div>
        <div className="screen-sub">{list.length} player{list.length!==1?"s":""} · Tap card to expand</div>
      </div>

      {/* Search + Sort */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <input
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex:1, marginTop:0, fontSize:13, padding:"8px 12px" }}
          autoComplete="off"
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ width:112, marginTop:0, fontSize:13, padding:"8px 8px" }}
        >
          <option value="name">A–Z</option>
          <option value="matches">Matches</option>
          <option value="runs">Top Scorers</option>
          <option value="wickets">Top Bowlers</option>
        </select>
      </div>

      {list.length === 0 && (
        <div className="empty-state">
          No players found.<br/>
          <span style={{ fontSize:12, color:"#94a3b8" }}>
            Add players in the Players section and play matches to see stats.
          </span>
        </div>
      )}

      {list.map(({ name, s }) => {
        const initials = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) || "?";
        const isOpen   = expanded === name;
        const innings  = s.outs + s.notOuts;

        return (
          <div key={name} style={{
            background:"var(--surface)", border:"1.5px solid var(--border)",
            borderRadius:14, marginBottom:10, overflow:"hidden",
            boxShadow:"0 2px 10px rgba(0,0,0,0.05)", transition:"box-shadow 0.2s",
          }}>

            {/* ── Summary row (always visible) ── */}
            <div
              style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 14px", cursor:"pointer" }}
              onClick={() => setExpanded(isOpen ? null : name)}
            >
              <div style={{
                width:44, height:44, borderRadius:"50%", flexShrink:0,
                background:"linear-gradient(135deg,#ff512f,#dd2476)",
                color:"#fff", fontSize:16, fontWeight:800,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>{initials}</div>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {name}
                </div>
                <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600, marginTop:2 }}>
                  {s.matches} match{s.matches!==1?"es":""} played
                </div>
              </div>

              <div style={{ display:"flex", gap:16, alignItems:"center", flexShrink:0 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:22, fontWeight:700, color:runColor(s.runs), lineHeight:1 }}>
                    {s.runs}
                  </div>
                  <div style={{ fontSize:9, color:"var(--text3)", fontWeight:700, letterSpacing:1 }}>RUNS</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:22, fontWeight:700, color:wktColor(s.wickets), lineHeight:1 }}>
                    {s.wickets}
                  </div>
                  <div style={{ fontSize:9, color:"var(--text3)", fontWeight:700, letterSpacing:1 }}>WKTS</div>
                </div>
                <div style={{ color:"var(--text3)", fontSize:14 }}>{isOpen?"▲":"▼"}</div>
              </div>
            </div>

            {/* ── Expanded detail ── */}
            {isOpen && (
              <div style={{ borderTop:"1px solid var(--border)", padding:"12px 14px 16px" }}>

                {/* BATTING */}
                <div style={{ fontSize:11, fontWeight:800, color:"#e8352a", letterSpacing:2, marginBottom:8, textTransform:"uppercase" }}>
                  🏏 Batting
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
                  {[
                    ["Innings",   innings],
                    ["Runs",      s.runs],
                    ["Avg",       avg(s.runs, s.outs)],
                    ["SR",        sr(s.runs, s.balls)],
                    ["Best",      s.bestRuns > 0 ? `${s.bestRuns}(${s.bestBalls})` : "—"],
                    ["4s",        s.fours],
                    ["6s",        s.sixes],
                    ["50s/100s",  `${s.fifties}/${s.hundreds}`],
                    ["Not Outs",  s.notOuts],
                    ["Balls",     s.balls],
                  ].map(([lbl,val]) => (
                    <div key={lbl} style={{ background:"#f8fafc", borderRadius:8, padding:"7px 4px", textAlign:"center", border:"1px solid #e2e8f0" }}>
                      <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:16, fontWeight:700, color:"var(--text)" }}>{val}</div>
                      <div style={{ fontSize:8, color:"#94a3b8", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginTop:1 }}>{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* BOWLING */}
                <div style={{ fontSize:11, fontWeight:800, color:"#1d4ed8", letterSpacing:2, margin:"12px 0 8px", textTransform:"uppercase" }}>
                  🎳 Bowling
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
                  {[
                    ["Wickets",  s.wickets],
                    ["Overs",    fmt(s.bowlBalls)],
                    ["Runs",     s.bowlRuns],
                    ["Economy",  econ(s.bowlRuns, s.bowlBalls)],
                    ["Avg",      bAvg(s.bowlRuns, s.wickets)],
                    ["Maidens",  s.maidens],
                    ["Best",     s.bestWickets > 0 ? `${s.bestWickets}/${s.bestWicketRuns}` : "—"],
                    ["5-Wkts",   s.bestWickets >= 5 ? "Yes" : "No"],
                  ].map(([lbl,val]) => (
                    <div key={lbl} style={{ background:"#eff6ff", borderRadius:8, padding:"7px 4px", textAlign:"center", border:"1px solid #bfdbfe" }}>
                      <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:16, fontWeight:700, color:"var(--text)" }}>{val}</div>
                      <div style={{ fontSize:8, color:"#60a5fa", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginTop:1 }}>{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* FIELDING */}
                <div style={{ fontSize:11, fontWeight:800, color:"#15803d", letterSpacing:2, margin:"12px 0 8px", textTransform:"uppercase" }}>
                  🧤 Fielding
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
                  {[
                    ["Catches",    s.catches],
                    ["Stumpings",  s.stumpings],
                    ["Total",      s.catches + s.stumpings],
                  ].map(([lbl,val]) => (
                    <div key={lbl} style={{ background:"#f0fdf4", borderRadius:8, padding:"7px 4px", textAlign:"center", border:"1px solid #86efac" }}>
                      <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:18, fontWeight:700, color:"#15803d" }}>{val}</div>
                      <div style={{ fontSize:8, color:"#4ade80", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginTop:1 }}>{lbl}</div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
