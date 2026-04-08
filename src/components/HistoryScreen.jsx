import { useState } from "react";
import { getHistory } from "../storage";

const fmt = (b) => `${Math.floor(b/6)}.${b%6}`;
const sr  = (r,b) => b===0?"0.0":((r/b)*100).toFixed(1);
const econ= (r,b) => b===0?"0.00":(r/(b/6)).toFixed(2);

function ScorecardSection({ label, batters, bowlers, extras, fowList, runs, wickets, legalBalls }) {
  if (!batters || batters.length === 0) return null;
  const tot = (extras?.wides||0)+(extras?.noBalls||0)+(extras?.byes||0)+(extras?.legByes||0);

  return (
    <div style={{ marginTop:14 }}>
      <div style={{ fontSize:12, fontWeight:800, color:"#e8352a", letterSpacing:2, marginBottom:8, textTransform:"uppercase" }}>
        {label}
      </div>

      {/* Batting table */}
      <table className="sc-table" style={{ fontSize:11 }}>
        <thead>
          <tr><th>Batsman</th><th>How Out</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
        </thead>
        <tbody>
          {batters.filter(b=>b.active||b.out||b.balls>0).map((b,i)=>(
            <tr key={i} className={b.out?"out-row":""}>
              <td><span className={!b.out?"not-out-name":""}>{b.name}</span></td>
              <td style={{ fontSize:10, color:"#94a3b8" }}>{b.out?b.dismissal:"not out"}</td>
              <td style={{ fontWeight:700 }}>{b.runs}</td>
              <td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td>
              <td>{sr(b.runs,b.balls)}</td>
            </tr>
          ))}
          <tr style={{ borderTop:"1px solid #e2e8f0" }}>
            <td colSpan={2} style={{ color:"#94a3b8", fontStyle:"italic", fontSize:10 }}>Extras</td>
            <td colSpan={5} style={{ textAlign:"left", fontSize:10, color:"#94a3b8" }}>
              W:{extras?.wides||0} NB:{extras?.noBalls||0} B:{extras?.byes||0} LB:{extras?.legByes||0} = {tot}
            </td>
          </tr>
          <tr className="total-row">
            <td colSpan={2} style={{ fontWeight:800 }}>TOTAL</td>
            <td style={{ fontWeight:800 }}>{runs}</td>
            <td colSpan={2}>{wickets} wkts</td>
            <td colSpan={2}>{fmt(legalBalls)} ov</td>
          </tr>
        </tbody>
      </table>

      {/* Bowling table */}
      {bowlers && bowlers.filter(b=>b.legal>0||b.wides>0||b.noBalls>0).length > 0 && (
        <table className="sc-table" style={{ marginTop:8, fontSize:11 }}>
          <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
          <tbody>
            {bowlers.filter(b=>b.legal>0||b.wides>0||b.noBalls>0).map((b,i)=>(
              <tr key={i}>
                <td>{b.name}</td>
                <td>{fmt(b.legal)}</td><td>{b.maidens}</td>
                <td>{b.runs}</td><td>{b.wickets}</td>
                <td>{econ(b.runs,b.legal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Fall of wickets */}
      {fowList && fowList.length > 0 && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", marginBottom:4 }}>FALL OF WICKETS</div>
          <div>
            {fowList.map((f,i)=>(
              <span key={i} className="fow-chip" style={{ fontSize:10 }}>
                {f.score}/{i+1} {f.name} {f.over}ov
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryScreen({ setScreen }) {
  const history  = getHistory();
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <button className="app-button back-btn" onClick={() => setScreen("home")}>⬅ Back</button>

      <div style={{ marginBottom:14 }}>
        <div className="screen-title">Match History</div>
        <div className="screen-sub">Last {history.length} match{history.length!==1?"es":""} · Tap to expand</div>
      </div>

      {history.length === 0 && (
        <div className="empty-state">
          No matches played yet.<br/>
          <span style={{ fontSize:12, color:"#94a3b8" }}>Complete a match to see history here.</span>
        </div>
      )}

      {history.map((m, i) => {
        const isOpen = expanded === i;
        return (
          <div
            key={i}
            style={{
              background:"var(--surface)", border:"1.5px solid var(--border)",
              borderRadius:14, marginBottom:10, overflow:"hidden"
            }}
          >
            {/* Summary header */}
            <div
              style={{ padding:"14px 14px 10px", cursor:"pointer" }}
              onClick={() => setExpanded(isOpen ? null : i)}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:17, fontWeight:700, color:"var(--text)" }}>
                  {m.team1} vs {m.team2}
                </div>
                <div style={{ fontSize:14, color:"var(--text3)" }}>{isOpen?"▲":"▼"}</div>
              </div>

              {/* Result badge */}
              <div style={{
                display:"inline-block", background:"#dcfce7", border:"1px solid #86efac",
                borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700, color:"#15803d",
                marginBottom:8, marginTop:4
              }}>
                {m.result}
              </div>

              {/* Score summary row */}
              <div style={{ display:"flex", gap:8 }}>
                <div style={{
                  flex:1, background:"#f8fafc", borderRadius:8, padding:"8px 10px",
                  border:"1px solid #e2e8f0"
                }}>
                  <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, letterSpacing:1 }}>{m.team1}</div>
                  <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:20, fontWeight:700 }}>
                    {m.inn1Runs}/{m.inn1Wkts}
                  </div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>{fmt(m.inn1Balls)} overs</div>
                </div>
                <div style={{
                  flex:1, background:"#f8fafc", borderRadius:8, padding:"8px 10px",
                  border:"1px solid #e2e8f0"
                }}>
                  <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, letterSpacing:1 }}>{m.team2}</div>
                  <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:20, fontWeight:700 }}>
                    {m.inn2Runs}/{m.inn2Wkts}
                  </div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>{fmt(m.inn2Balls)} overs</div>
                </div>
              </div>

              <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11, color:"#94a3b8" }}>
                <span>{m.date} · {m.overs} overs</span>
                {m.potm && <span>🏅 {m.potm}</span>}
              </div>
            </div>

            {/* Expanded full scorecard */}
            {isOpen && (
              <div style={{ padding:"0 14px 16px", borderTop:"1px solid var(--border)" }}>
                {m.potm && (
                  <div style={{
                    background:"#fef9c3", border:"1px solid #fcd34d", borderRadius:8,
                    padding:"8px 12px", marginTop:12, display:"flex", alignItems:"center", gap:8
                  }}>
                    <span style={{ fontSize:18 }}>🏅</span>
                    <div>
                      <div style={{ fontSize:10, fontWeight:800, color:"#92400e", letterSpacing:1 }}>PLAYER OF THE MATCH</div>
                      <div style={{ fontSize:14, fontWeight:800, color:"#78350f" }}>{m.potm}</div>
                    </div>
                  </div>
                )}

                {/* 1st innings */}
                <ScorecardSection
                  label={`${m.team1} — 1st Innings`}
                  batters={m.inn1Batters}
                  bowlers={m.inn1Bowlers}
                  extras={m.inn1Extras}
                  fowList={m.inn1FowList}
                  runs={m.inn1Runs}
                  wickets={m.inn1Wkts}
                  legalBalls={m.inn1Balls}
                />

                {/* 2nd innings */}
                <ScorecardSection
                  label={`${m.team2} — 2nd Innings`}
                  batters={m.inn2Batters}
                  bowlers={m.inn2Bowlers}
                  extras={m.inn2Extras}
                  fowList={m.inn2FowList}
                  runs={m.inn2Runs}
                  wickets={m.inn2Wkts}
                  legalBalls={m.inn2Balls}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
