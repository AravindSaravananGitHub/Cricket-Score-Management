import { useState, useEffect } from "react";
import "./styles/app.css";
import GullySetup    from "./components/GullySetup";
import MatchScreen   from "./components/MatchScreen";
import PlayerManager from "./components/PlayerManager";
import HistoryScreen from "./components/HistoryScreen";
import StatsScreen   from "./components/StatsScreen";

const APP_KEY = "cricket_app_state_v2";

function App() {
  const [screen, setScreen] = useState(() => {
    try { const s = localStorage.getItem(APP_KEY); if (s) return JSON.parse(s).screen || "home"; } catch {}
    return "home";
  });
  const [matchData, setMatchData] = useState(() => {
    try { const s = localStorage.getItem(APP_KEY); if (s) return JSON.parse(s).matchData || null; } catch {}
    return null;
  });
  const [lastMatchData, setLastMatchData] = useState(() => {
    try { const s = localStorage.getItem(APP_KEY); if (s) return JSON.parse(s).lastMatchData || null; } catch {}
    return null;
  });

  useEffect(() => {
    try { localStorage.setItem(APP_KEY, JSON.stringify({ screen, matchData, lastMatchData })); } catch {}
  }, [screen, matchData, lastMatchData]);

  const goHome = () => { setScreen("home"); setMatchData(null); };

  const startRematch = () => {
    if (!lastMatchData) return;
    localStorage.removeItem("cricket_match_v3");
    setMatchData(null);
    setScreen("setup");
  };

  const menuItems = [
    { icon:"🏏", label:"Gully Cricket", sub:"Start a new match",       screen:"setup",   color:"btn-icon-green", enabled:true  },
    { icon:"👤", label:"Players",        sub:"Create & manage players", screen:"players", color:"btn-icon-blue",  enabled:true  },
    { icon:"📊", label:"Statistics",     sub:"Player career stats",     screen:"stats",   color:"btn-icon-gold",  enabled:true  },
    { icon:"📜", label:"Match History",  sub:"Last 10 matches",         screen:"history", color:"btn-icon-red",   enabled:true  },
    { icon:"🏆", label:"Series",         sub:"Coming Soon",             screen:null,      color:"btn-icon-gray",  enabled:false },
    { icon:"📋", label:"Tournament",     sub:"Coming Soon",             screen:null,      color:"btn-icon-gray",  enabled:false },
  ];

  return (
    <div className="app">
      <div className="header">
        <div className="header-title">🏏 Cricket Score App</div>
        {matchData && screen === "match" && (
          <div className="header-badge">{matchData.overs}ov</div>
        )}
      </div>

      <div className="content">
        {screen === "home" && (
          <div>
            <div className="home-hero">
              <h2>Cricket Umpire Tool</h2>
              <p>Professional score management for umpires</p>
            </div>

            {/* Resume match banner */}
            {matchData && (
              <div style={{
                background:"linear-gradient(135deg,#dcfce7,#f0fdf4)",
                border:"2px solid #86efac", borderRadius:12,
                padding:"12px 16px", marginBottom:10,
                display:"flex", justifyContent:"space-between", alignItems:"center"
              }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:"#15803d", letterSpacing:1 }}>MATCH IN PROGRESS</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#166534" }}>{matchData.team1} vs {matchData.team2}</div>
                </div>
                <button
                  className="app-button"
                  style={{ width:"auto", padding:"8px 16px", marginTop:0, fontSize:13 }}
                  onClick={() => setScreen("match")}
                >
                  Resume ›
                </button>
              </div>
            )}

            {/* Rematch banner */}
            {lastMatchData && !matchData && (
              <div style={{
                background:"linear-gradient(135deg,#eff6ff,#dbeafe)",
                border:"2px solid #93c5fd", borderRadius:12,
                padding:"12px 16px", marginBottom:10,
                display:"flex", justifyContent:"space-between", alignItems:"center"
              }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:"#1d4ed8", letterSpacing:1 }}>LAST MATCH</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#1e40af" }}>
                    {lastMatchData.team1} vs {lastMatchData.team2}
                  </div>
                </div>
                <button
                  className="app-button"
                  style={{ width:"auto", padding:"8px 16px", marginTop:0, fontSize:13, background:"linear-gradient(135deg,#3b82f6,#1d4ed8)" }}
                  onClick={startRematch}
                >
                  🔄 Rematch
                </button>
              </div>
            )}

            {menuItems.map((m, i) => (
              <button
                key={i}
                className="home-menu-btn"
                disabled={!m.enabled}
                onClick={() => m.enabled && m.screen && setScreen(m.screen)}
              >
                <div className={`btn-icon ${m.color}`}>{m.icon}</div>
                <div className="btn-text">{m.label}<small>{m.sub}</small></div>
                {m.enabled && <div className="btn-arrow">›</div>}
              </button>
            ))}
          </div>
        )}

        {screen === "setup" && (
          <GullySetup
            setScreen={setScreen}
            setMatchData={setMatchData}
            lastMatchData={lastMatchData}
          />
        )}

        {screen === "match" && matchData && (
          <MatchScreen
            matchData={matchData}
            setScreen={setScreen}
            goHome={goHome}
            onMatchComplete={(data) => {
              setLastMatchData(data);
              setMatchData(null);
            }}
          />
        )}

        {screen === "players" && <PlayerManager setScreen={setScreen} />}
        {screen === "history" && <HistoryScreen setScreen={setScreen} />}
        {screen === "stats"   && <StatsScreen   setScreen={setScreen} />}
      </div>

      {screen === "home" && <div className="footer">© 2026 Cricket App</div>}
    </div>
  );
}

export default App;
