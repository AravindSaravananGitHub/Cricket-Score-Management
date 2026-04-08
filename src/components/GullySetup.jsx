import { useState, useRef, useCallback } from "react";
import { getPlayers } from "../storage";

/* ── Modal (outside component so never re-created) ── */
function Modal({ show, title, onClose, children }) {
  if (!show) return null;
  return (
    <div className="modal-backdrop show"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

/*
 * KEY FIX for Bug 1:
 * PlayerRow is defined OUTSIDE GullySetup so React never unmounts/remounts it
 * during a parent re-render. onMouseDown on remove uses preventDefault() so
 * blur never fires before the click registers.
 */
function PlayerRow({ num, idx, value, total, onChange, onRemove }) {
  return (
    <div className="player-row">
      <div className="player-num">{idx + 1}</div>
      <input
        value={value}
        onChange={e => onChange(num, idx, e.target.value)}
        placeholder={`Player ${idx + 1}`}
        style={{ marginTop: 0 }}
        /* autoComplete off stops mobile browsers from inserting text that
           triggers a synthetic re-render and closes the keyboard */
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
      />
      {total > 2 && (
        <button
          className="remove-player-btn"
          /* preventDefault stops the input losing focus before onRemove runs */
          onMouseDown={e => { e.preventDefault(); onRemove(num, idx); }}
          onTouchStart={e => { e.preventDefault(); onRemove(num, idx); }}
        >✕</button>
      )}
    </div>
  );
}

/* ── Main component ── */
export default function GullySetup({ setScreen, setMatchData, lastMatchData }) {
  const savedPlayers = getPlayers(); // [{name}] from localStorage

  const [team1,    setTeam1]    = useState(lastMatchData?.team1    || "");
  const [team2,    setTeam2]    = useState(lastMatchData?.team2    || "");
  const [overs,    setOvers]    = useState(String(lastMatchData?.overs || "6"));
  const [toss,     setToss]     = useState("");
  const [decision, setDecision] = useState("");
  const [players1, setPlayers1] = useState(lastMatchData?.players1 || []);
  const [players2, setPlayers2] = useState(lastMatchData?.players2 || []);

  // Modal state
  const [showPicker,   setShowPicker]   = useState(false);
  const [pickingFor,   setPickingFor]   = useState(1);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickedNames,  setPickedNames]  = useState([]);
  // Custom name entry inside picker modal
  const [customName,   setCustomName]   = useState("");

  // Stable refs for player arrays (avoid stale closures in callbacks)
  const p1Ref = useRef(players1);
  const p2Ref = useRef(players2);
  p1Ref.current = players1;
  p2Ref.current = players2;

  /* ── Player list mutators (stable, never change identity) ── */
  const updatePlayer = useCallback((team, idx, val) => {
    if (team === 1) {
      setPlayers1(prev => { const a = [...prev]; a[idx] = val; return a; });
    } else {
      setPlayers2(prev => { const a = [...prev]; a[idx] = val; return a; });
    }
  }, []);

  const addPlayer = useCallback((team) => {
    if (team === 1) setPlayers1(prev => prev.length < 11 ? [...prev, ""] : prev);
    else            setPlayers2(prev => prev.length < 11 ? [...prev, ""] : prev);
  }, []);

  const removePlayer = useCallback((team, idx) => {
    if (team === 1) setPlayers1(prev => prev.length > 2 ? prev.filter((_,i) => i !== idx) : prev);
    else            setPlayers2(prev => prev.length > 2 ? prev.filter((_,i) => i !== idx) : prev);
  }, []);

  /* ── Picker modal ── */
  const openPicker = (num) => {
    setPickingFor(num);
    setPickerSearch("");
    setCustomName("");
    // Pre-select what's already chosen for this team
    setPickedNames(num === 1 ? [...p1Ref.current] : [...p2Ref.current]);
    setShowPicker(true);
  };

  const togglePick = useCallback((name) => {
    setPickedNames(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  }, []);

  const addCustomToPicked = () => {
    const n = customName.trim();
    if (!n) return;
    if (!pickedNames.includes(n)) setPickedNames(prev => [...prev, n]);
    setCustomName("");
  };

  const confirmPick = () => {
    const names = pickedNames.filter(n => n.trim());
    if (names.length < 2) { alert("Select at least 2 players"); return; }
    if (pickingFor === 1) setPlayers1(names);
    else                  setPlayers2(names);
    setShowPicker(false);
  };

  /* ── Start match ── */
  const handleStart = () => {
    if (!team1 || !team2 || !overs || !toss || !decision) {
      alert("Please fill all fields"); return;
    }
    const f1 = players1.filter(p => p.trim());
    const f2 = players2.filter(p => p.trim());
    if (f1.length < 2) { alert("Team 1 needs at least 2 players"); return; }
    if (f2.length < 2) { alert("Team 2 needs at least 2 players"); return; }

    // Determine batting/bowling order from toss + decision
    // toss: "team1" or "team2" — who won the toss
    // decision: "bat" or "bowl" — what the toss winner chose
    // batting first = toss winner chose bat, OR toss loser (other team) chose bowl
    const team1BatsFirst =
      (toss === "team1" && decision === "bat") ||
      (toss === "team2" && decision === "bowl");

    // MatchScreen always expects players1 = batting first, players2 = bowling first
    const battingTeam  = team1BatsFirst ? team1 : team2;
    const bowlingTeam  = team1BatsFirst ? team2 : team1;
    const battingPlayers = team1BatsFirst ? f1 : f2;
    const bowlingPlayers = team1BatsFirst ? f2 : f1;

    setMatchData({
      team1: battingTeam,   // team1 in matchData = always bats first
      team2: bowlingTeam,   // team2 in matchData = always bowls first
      overs: parseInt(overs),
      toss, decision,
      players1: battingPlayers,
      players2: bowlingPlayers,
    });
    setScreen("match");
  };

  /* ── Picker filtered list ── */
  const pickerFiltered = savedPlayers.filter(p =>
    p.name.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  /* ── Team section renderer ── */
  const renderTeam = (num) => {
    const isT1    = num === 1;
    const name    = isT1 ? team1 : team2;
    const setName = isT1 ? setTeam1 : setTeam2;
    const players = isT1 ? players1 : players2;
    const label   = isT1 ? "Team 1" : "Team 2";

    return (
      <div className="card" key={`team-${num}`}>
        <div className="card-title">{label}</div>

        {/* Team name input */}
        <input
          placeholder={isT1 ? "Team 1 Name" : "Team 2 Name"}
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
        />

        {/* Pick from saved players button */}
        {savedPlayers.length > 0 && (
          <button
            className="app-button"
            style={{
              marginTop: 10, marginBottom: 0,
              background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
              fontSize: 14, padding: 11
            }}
            onClick={() => openPicker(num)}
          >
            👤 Pick Players ({players.length} selected)
          </button>
        )}

        {/* Manual player list */}
        <div className="player-list" style={{ marginTop: 10 }}>
          {players.map((p, i) => (
            <PlayerRow
              key={`t${num}-p${i}`}
              num={num}
              idx={i}
              value={p}
              total={players.length}
              onChange={updatePlayer}
              onRemove={removePlayer}
            />
          ))}
        </div>

        {players.length === 0 && (
          <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>
            {savedPlayers.length > 0
              ? "Tap 'Pick Players' above or add manually below"
              : "Add players manually below"}
          </div>
        )}

        {players.length < 11 && (
          <button className="add-player-btn" onClick={() => addPlayer(num)}>
            + Add Player Manually
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <button className="app-button back-btn" onClick={() => setScreen("home")}>⬅ Back</button>

      {/* Match config */}
      <div className="card">
        <div className="card-title">Match Setup</div>
        <div className="input-row">
          <div className="input-group">
            <label>Format / Overs</label>
            <select value={overs} onChange={e => setOvers(e.target.value)}>
              <option value="5">5 Overs</option>
              <option value="6">6 Overs</option>
              <option value="8">8 Overs</option>
              <option value="10">10 Overs</option>
              <option value="15">15 Overs</option>
              <option value="20">T20 (20)</option>
              <option value="50">ODI (50)</option>
            </select>
          </div>
          <div className="input-group">
            <label>Toss Winner</label>
            <select value={toss} onChange={e => setToss(e.target.value)}>
              <option value="">Select</option>
              <option value="team1">{team1 || "Team 1"}</option>
              <option value="team2">{team2 || "Team 2"}</option>
            </select>
          </div>
        </div>
        <div className="input-row" style={{ marginTop: 0 }}>
          <div className="input-group">
            <label>Decision</label>
            <select value={decision} onChange={e => setDecision(e.target.value)}>
              <option value="">Select</option>
              <option value="bat">Bat First</option>
              <option value="bowl">Bowl First</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Live batting order preview ── */}
      {toss && decision && team1 && team2 && (
        <div style={{
          background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
          border: "1.5px solid #86efac",
          borderRadius: 10, padding: "10px 14px", marginTop: 8,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>🏏</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#15803d", letterSpacing: 0.5 }}>
              {(() => {
                const t1Bats = (toss==="team1"&&decision==="bat")||(toss==="team2"&&decision==="bowl");
                return (
                  <>
                    <span style={{ color: "#166534" }}>{t1Bats ? team1 : team2}</span>
                    <span style={{ color: "#4ade80", fontWeight: 600 }}> will bat first</span>
                    <span style={{ color: "#86efac" }}> · </span>
                    <span style={{ color: "#166534" }}>{t1Bats ? team2 : team1}</span>
                    <span style={{ color: "#4ade80", fontWeight: 600 }}> will bowl first</span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {renderTeam(1)}
      {renderTeam(2)}

      <button className="app-button" onClick={handleStart} style={{ marginBottom: 20 }}>
        🏏 START MATCH
      </button>

      {/* ═══ PLAYER PICKER MODAL ═══ */}
      <Modal
        show={showPicker}
        title={`Pick Players — ${pickingFor === 1 ? (team1 || "Team 1") : (team2 || "Team 2")}`}
        onClose={() => setShowPicker(false)}
      >
        {/* Info */}
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, fontWeight: 600, lineHeight: 1.5 }}>
          ✅ {pickedNames.length} selected &nbsp;·&nbsp;
          Players can play for any team &nbsp;·&nbsp;
          Tap a player to select/deselect
        </div>

        {/* Search saved players */}
        {savedPlayers.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
              Saved Players
            </div>
            <input
              placeholder="Search saved players…"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              style={{ marginTop: 0, marginBottom: 8 }}
              autoComplete="off"
            />
            <div className="player-checkbox-list" style={{ maxHeight: 220, marginBottom: 10 }}>
              {pickerFiltered.length === 0 && (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: "14px 0", fontSize: 13 }}>
                  No players match search
                </div>
              )}
              {pickerFiltered.map((p, i) => {
                const isSelected = pickedNames.includes(p.name);
                return (
                  <div
                    key={i}
                    onClick={() => togglePick(p.name)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                      background: isSelected ? "#dcfce7" : "transparent",
                      border: isSelected ? "1.5px solid #86efac" : "1.5px solid transparent",
                      marginBottom: 4, transition: "all 0.15s",
                    }}
                  >
                    {/* Custom checkbox UI — avoids React synthetic event issues */}
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                      background: isSelected ? "#16a34a" : "#f1f5f9",
                      border: isSelected ? "2px solid #16a34a" : "2px solid #cbd5e1",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected && <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flex: 1 }}>
                      {p.name}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>Selected</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Add a custom name directly in the modal */}
        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
          {savedPlayers.length > 0 ? "Or Add Custom Name" : "Type Player Names"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Type a player name…"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustomToPicked()}
            style={{ flex: 1, marginTop: 0 }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
          />
          <button
            className="btn-confirm"
            style={{ width: "auto", padding: "0 16px", borderRadius: 8, flexShrink: 0 }}
            onClick={addCustomToPicked}
          >
            Add
          </button>
        </div>

        {/* Selected summary chips */}
        {pickedNames.length > 0 && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
              Selected ({pickedNames.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {pickedNames.map((name, i) => (
                <span
                  key={i}
                  style={{
                    background: "#dcfce7", border: "1px solid #86efac",
                    borderRadius: 16, padding: "3px 10px", fontSize: 12, fontWeight: 700,
                    color: "#15803d", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  }}
                  onClick={() => togglePick(name)}
                >
                  {name} <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn-cancel" onClick={() => setShowPicker(false)}>CANCEL</button>
          <button className="btn-confirm" onClick={confirmPick}>
            CONFIRM ({pickedNames.length} players)
          </button>
        </div>
      </Modal>
    </div>
  );
}
