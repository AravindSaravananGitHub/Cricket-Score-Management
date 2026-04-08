import { useState } from "react";
import { getPlayers, savePlayers } from "../storage";

function Modal({ show, title, onClose, children }) {
  if (!show) return null;
  return (
    <div className="modal-backdrop show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function PlayerManager({ setScreen }) {
  const [players, setPlayers] = useState(getPlayers);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editIdx,  setEditIdx]  = useState(null);
  const [nameVal,  setNameVal]  = useState("");
  const [search,   setSearch]   = useState("");

  const persist = (p) => { setPlayers(p); savePlayers(p); };

  const openAdd  = () => { setNameVal(""); setShowAdd(true); };
  const openEdit = (i) => { setEditIdx(i); setNameVal(players[i].name); };

  const handleAdd = () => {
    const name = nameVal.trim();
    if (!name) { alert("Enter player name"); return; }
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      alert("Player already exists"); return;
    }
    persist([...players, { name }]);
    setShowAdd(false);
    setNameVal("");
  };

  const handleEdit = () => {
    const name = nameVal.trim();
    if (!name) { alert("Enter player name"); return; }
    const dup = players.findIndex((p, i) => p.name.toLowerCase() === name.toLowerCase() && i !== editIdx);
    if (dup >= 0) { alert("Another player with that name already exists"); return; }
    persist(players.map((p, i) => i === editIdx ? { ...p, name } : p));
    setEditIdx(null);
    setNameVal("");
  };

  const handleDelete = (i) => {
    if (!window.confirm(`Delete "${players[i].name}"? Their stats will remain.`)) return;
    persist(players.filter((_, j) => j !== i));
  };

  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <button className="app-button back-btn" onClick={() => setScreen("home")}>⬅ Back</button>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div>
          <div className="screen-title">Players</div>
          <div className="screen-sub">{players.length} player{players.length !== 1 ? "s" : ""} saved</div>
        </div>
        <button className="app-button" style={{ width:"auto", padding:"10px 18px", marginTop:0, fontSize:14 }} onClick={openAdd}>
          + Add Player
        </button>
      </div>

      {/* Search */}
      {players.length > 5 && (
        <input
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom:10 }}
        />
      )}

      {players.length === 0 && (
        <div className="empty-state">
          No players yet.<br/>
          <span style={{ fontSize:12, color:"#94a3b8" }}>Add players to quickly pick them during match setup.</span>
        </div>
      )}

      {filtered.map((p, i) => {
        const realIdx = players.indexOf(p);
        const initials = p.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
        return (
          <div className="team-card" key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }}>
            <div className="psc-avatar" style={{ width:38, height:38, fontSize:14, flexShrink:0 }}>{initials}</div>
            <div style={{ flex:1, fontWeight:700, fontSize:15, color:"var(--text)" }}>{p.name}</div>
            <div className="team-card-actions">
              <button className="icon-btn" onClick={() => openEdit(realIdx)}>✏️</button>
              <button className="icon-btn danger" onClick={() => handleDelete(realIdx)}>🗑</button>
            </div>
          </div>
        );
      })}

      {/* Add modal */}
      <Modal show={showAdd} title="➕ Add Player" onClose={() => setShowAdd(false)}>
        <input
          placeholder="Player name"
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          autoFocus
        />
        <div className="modal-btns">
          <button className="btn-cancel" onClick={() => setShowAdd(false)}>CANCEL</button>
          <button className="btn-confirm" onClick={handleAdd}>ADD</button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal show={editIdx !== null} title="✏️ Edit Player" onClose={() => setEditIdx(null)}>
        <input
          placeholder="Player name"
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleEdit()}
          autoFocus
        />
        <div className="modal-btns">
          <button className="btn-cancel" onClick={() => setEditIdx(null)}>CANCEL</button>
          <button className="btn-confirm" onClick={handleEdit}>SAVE</button>
        </div>
      </Modal>
    </div>
  );
}
