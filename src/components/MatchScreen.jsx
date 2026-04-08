import { useState, useRef, useEffect } from "react";
import { addHistory, updateStatsFromMatch } from "../storage";

/* ═══════ HELPERS ═══════ */
const fmtOvers  = (b) => `${Math.floor(b/6)}.${b%6}`;
const calcSR    = (r,b) => b===0?"0.0":((r/b)*100).toFixed(1);
const calcEcon  = (r,b) => b===0?"0.00":(r/(b/6)).toFixed(2);
const calcCRR   = (r,b) => b===0?"0.00":(r/(b/6)).toFixed(2);
const calcRRR   = (need,left) => left<=0?"-":(need/(left/6)).toFixed(2);
const makeBowler= (name)=>({name,legal:0,runs:0,wickets:0,maidens:0,wides:0,noBalls:0,curOverRuns:0});
const makeBatter= (name)=>({name,runs:0,balls:0,fours:0,sixes:0,out:false,dismissal:"",active:false,retired:false});

const STORE_KEY = "cricket_match_v3";

/* ═══════ MODAL ═══════ */
function Modal({show,title,sub,onClose,children}){
  if(!show) return null;
  return(
    <div className="modal-backdrop show" onClick={e=>e.target===e.currentTarget&&onClose&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <div className="modal-title">{title}</div>
        {sub&&<div className="modal-sub">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

/* ═══════ SCORECARD TABLE (reusable) ═══════ */
function ScorecardTable({batters,strikerIdx,nonStrikerIdx,bowlers,extras,fowList,runs,wickets,legalBalls,label}){
  const totalExtras=extras.wides+extras.noBalls+extras.byes+extras.legByes;
  return(
    <div>
      <div className="section-title" style={{color:"#e8352a",marginBottom:8}}>{label}</div>
      <table className="sc-table">
        <thead><tr><th>Batsman</th><th>How Out</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
        <tbody>
          {batters.map((b,i)=>{
            const atCrease=i===strikerIdx||i===nonStrikerIdx;
            // BUG1 FIX: show retired hurt batters (retired=true, out=false, active=false)
            // BUG2 FIX: for completed innings (strikerIdx=-1), show "not out" for active batters
            //           instead of "dnb"
            const isRetired = b.retired && !b.out;
            const hasPlayed = b.balls > 0 || b.runs > 0 || b.out || isRetired || atCrease || b.active;
            if (!hasPlayed) return null; // truly DNB — never faced a ball
            // Determine status label
            let statusLabel;
            if (b.out) {
              statusLabel = b.dismissal;
            } else if (isRetired) {
              statusLabel = "Retired Hurt";
            } else if (atCrease || b.active) {
              // BUG2 FIX: if strikerIdx===-1 (completed innings view), show "not out"
              statusLabel = "not out";
            } else {
              statusLabel = "dnb"; // genuinely did not bat
            }
            const isNotOut = !b.out && !isRetired;
            return(
              <tr key={i} className={b.out?"out-row":isRetired?"retired-row":""}>
                <td><span className={isNotOut&&(atCrease||b.active)?"not-out-name":""}>{b.name}</span></td>
                <td style={{fontSize:11,color:b.out?"#94a3b8":isRetired?"#d97706":"#16a34a"}}>{statusLabel}</td>
                <td>{b.runs}</td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td>
                <td>{calcSR(b.runs,b.balls)}</td>
              </tr>
            );
          })}
          <tr className="extras-row">
            <td colSpan={2}>Extras</td>
            <td colSpan={5} style={{textAlign:"left"}}>W:{extras.wides} NB:{extras.noBalls} B:{extras.byes} LB:{extras.legByes} = {totalExtras}</td>
          </tr>
          <tr className="total-row">
            <td colSpan={2}>TOTAL</td><td>{runs}</td>
            <td colSpan={2}>{wickets} wkts</td>
            <td colSpan={2}>{fmtOvers(legalBalls)} ov</td>
          </tr>
        </tbody>
      </table>
      <div style={{marginTop:10}}>
        <div className="section-title" style={{marginBottom:6,fontSize:11}}>BOWLING</div>
        <table className="sc-table">
          <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
          <tbody>
            {bowlers.filter(b=>b.legal>0||b.wides>0||b.noBalls>0).map((b,i)=>(
              <tr key={i}>
                <td>{b.name}</td><td>{fmtOvers(b.legal)}</td><td>{b.maidens}</td>
                <td>{b.runs}</td><td>{b.wickets}</td><td>{calcEcon(b.runs,b.legal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fowList.length>0&&(
        <div style={{marginTop:10}}>
          <div className="section-title" style={{marginBottom:6,fontSize:11}}>FALL OF WICKETS</div>
          <div>{fowList.map((f,i)=>(
            <span key={i} className="fow-chip">{f.score}/{i+1} ({f.name}, {f.over})</span>
          ))}</div>
        </div>
      )}
    </div>
  );
}

/* ═══════ MAIN ═══════ */
export default function MatchScreen({matchData,setScreen,goHome,onMatchComplete}){
  const {team1,team2,overs:maxOvers,players1,players2}=matchData;

  function buildFresh(){
    const bats=players1.map(makeBatter);
    bats[0].active=true; bats[1].active=true;
    return {
      innings:1, runs:0, wickets:0, legalBalls:0,
      extras:{wides:0,noBalls:0,byes:0,legByes:0},
      batters:bats, strikerIdx:0, nonStrikerIdx:1, nextBatterIdx:2,
      bowlers:players2.map(makeBowler), curBowlerIdx:-1,
      curOverBalls:[], completedOvers:[], fowList:[],
      target:0, matchOver:false, resultMsg:"",
      lastBowlerIdx:-1,
      // Feature 3: innings break state
      inningsBreak:false,
      // Feature 4: save 1st innings stats
      inn1Batters:[], inn1Bowlers:[], inn1Extras:{wides:0,noBalls:0,byes:0,legByes:0},
      inn1Runs:0, inn1Wickets:0, inn1LegalBalls:0, inn1FowList:[],
      // Feature 8: POTM
      potm:"",
    };
  }

  function loadInitial(){
    try{
      const raw=localStorage.getItem(STORE_KEY);
      if(raw){
        const saved=JSON.parse(raw);
        if(saved._t1===team1&&saved._t2===team2&&saved._ov===maxOvers){
          const {_t1,_t2,_ov,...rest}=saved; return rest;
        }
      }
    }catch(_){}
    return buildFresh();
  }

  const [gs,setGs]   = useState(loadInitial);
  const [undo,setUndo]= useState([]);
  const [tab,setTab]  = useState("live");

  /* UI state */
  const [modalWicket,  setModalWicket]  = useState(false);
  const [modalBowler,  setModalBowler]  = useState(gs.curBowlerIdx===-1&&!gs.inningsBreak&&!gs.matchOver);
  const [modalExtra,   setModalExtra]   = useState(false);
  const [modalOT,      setModalOT]      = useState(false);
  const [modalSwapBat, setModalSwapBat] = useState(false); // Feature 6
  const [pendingExtra, setPendingExtra] = useState(null);
  const [dismissal,    setDismissal]    = useState("Bowled");
  const [caughtBy,     setCaughtBy]     = useState(""); // Feature 5
  const [runOutWhich,  setRunOutWhich]  = useState("striker"); // FIX 2: which batsman is run out
  const [runOutRuns,   setRunOutRuns]   = useState(0);          // FIX 2: runs completed before run-out
  const [selBatter,    setSelBatter]    = useState(null);
  const [customBatter, setCustomBatter] = useState("");
  const [selBowler,    setSelBowler]    = useState(null);
  const [customBowler, setCustomBowler] = useState("");
  const [toast,        setToast]        = useState("");
  const [toastType,    setToastType]    = useState("");
  const [potmInput,    setPotmInput]    = useState(""); // Feature 8
  const toastRef=useRef(null);

  /* Persist */
  useEffect(()=>{
    try{ localStorage.setItem(STORE_KEY,JSON.stringify({...gs,_t1:team1,_t2:team2,_ov:maxOvers})); }
    catch(_){}
  },[gs,team1,team2,maxOvers]);

  const toast$=(msg,type="")=>{
    if(toastRef.current) clearTimeout(toastRef.current);
    setToast(msg); setToastType(type);
    toastRef.current=setTimeout(()=>setToast(""),2400);
  };

  const snapshot=(g)=>setUndo(prev=>[...prev.slice(-19),JSON.parse(JSON.stringify(g))]);

  const handleUndo=()=>{
    if(!undo.length){toast$("Nothing to undo","red");return;}
    const p=undo[undo.length-1]; setUndo(u=>u.slice(0,-1)); setGs(p); toast$("Undo ✓","amber");
  };

  /* ── Over end ── */
  function applyOverEnd(g){
    const bwl=g.bowlers[g.curBowlerIdx];
    const overRuns=bwl.curOverRuns;
    const isMaiden=overRuns===0;
    const fin={overNum:g.completedOvers.length+1,bowlerName:bwl.name,balls:[...g.curOverBalls],runs:overRuns};
    const newBowlers=g.bowlers.map((b,i)=>
      i===g.curBowlerIdx?{...b,maidens:isMaiden?b.maidens+1:b.maidens,curOverRuns:0}:b
    );
    if(isMaiden) toast$("MAIDEN OVER! 🎉","amber");
    else toast$(`Over ${g.completedOvers.length+1} done! ${overRuns} runs`);
    return{
      ...g, bowlers:newBowlers,
      completedOvers:[...g.completedOvers,fin],
      curOverBalls:[],
      lastBowlerIdx:g.curBowlerIdx,
      strikerIdx:g.nonStrikerIdx, nonStrikerIdx:g.strikerIdx,
    };
  }

  /* ── Innings/match end ── Feature 3 & 4 ── */
  function applyInningsEnd(g){
    const batCount=g.innings===1?players1.length:players2.length;
    const allOut  =g.wickets>=batCount-1;
    const oversUp =g.legalBalls>=maxOvers*6;
    const chased  =g.innings===2&&g.runs>=g.target;
    if(!allOut&&!oversUp&&!chased) return g;

    if(g.innings===1){
      // Feature 3: innings break — save 1st innings, show break screen
      toast$(`1st Innings done! Target: ${g.runs+1}`,"amber");
      return{
        ...g,
        inningsBreak:true,
        inn1Batters:[...g.batters.map(b=>({...b}))],
        inn1Bowlers:[...g.bowlers.map(b=>({...b}))],
        inn1Extras:{...g.extras},
        inn1Runs:g.runs, inn1Wickets:g.wickets,
        inn1LegalBalls:g.legalBalls, inn1FowList:[...g.fowList],
        target:g.runs+1,
      };
    } else {
      // Match over
      const batName=team2; const bwlName=team1;
      let msg="";
      if(g.runs>=g.target){
        const wLeft=players2.length-1-g.wickets;
        msg=`${batName} won by ${Math.max(0,wLeft)} wicket${wLeft!==1?"s":""}! 🏆`;
      } else {
        const diff=g.target-g.runs-1;
        msg=`${bwlName} won by ${Math.max(0,diff)} run${diff!==1?"s":""}! 🏆`;
      }
      return{...g,matchOver:true,resultMsg:msg};
    }
  }

  /* ── Start 2nd innings (Feature 3 button) ── */
  function startSecondInnings(){
    const bats2=players2.map(makeBatter);
    bats2[0].active=true; bats2[1].active=true;
    setGs(prev=>({
      ...prev,
      innings:2, inningsBreak:false,
      runs:0, wickets:0, legalBalls:0,
      extras:{wides:0,noBalls:0,byes:0,legByes:0},
      batters:bats2, strikerIdx:0, nonStrikerIdx:1, nextBatterIdx:2,
      bowlers:players1.map(makeBowler), curBowlerIdx:-1, lastBowlerIdx:-1,
      curOverBalls:[], completedOvers:[], fowList:[],
    }));
    setSelBowler(null); setCustomBowler("");
    setModalBowler(true);
  }

  /* ═══════ PROCESS BALL ═══════ */
  function processBall(type,extraVal=0){
    if(gs.curBowlerIdx<0){toast$("Select a bowler first!","red");return;}
    snapshot(gs);
    setGs(prev=>{
      let g={
        ...prev,
        batters:prev.batters.map(b=>({...b})),
        bowlers:prev.bowlers.map(b=>({...b})),
        extras:{...prev.extras},
        curOverBalls:[...prev.curOverBalls],
        fowList:[...prev.fowList],
        completedOvers:[...prev.completedOvers],
      };
      const bwl=g.bowlers[g.curBowlerIdx];
      // rotateRuns = runs that determine strike rotation (excludes wide/noball penalty run)
      let isLegal=true,label="",cls="",addRuns=0,bwlRuns=0,strRuns=0,strBalls=1,rotateRuns=0;

      if(type==="dot"){label="•";cls="bc-dot";}
      else if(type===1||type===2||type===3){addRuns=type;strRuns=type;bwlRuns=type;rotateRuns=type;label=String(type);cls=`bc-${type}`;}
      else if(type===4){addRuns=4;strRuns=4;bwlRuns=4;rotateRuns=4;label="4";cls="bc-4";g.batters[g.strikerIdx].fours+=1;}
      else if(type===6){addRuns=6;strRuns=6;bwlRuns=6;rotateRuns=6;label="6";cls="bc-6";g.batters[g.strikerIdx].sixes+=1;}
      else if(type==="wide"){
        // FIX 1: wide penalty run (1) does NOT rotate strike — only extraVal runs rotate
        isLegal=false;strBalls=0;addRuns=1+extraVal;bwlRuns=1+extraVal;rotateRuns=extraVal;
        label=extraVal>0?`WD+${extraVal}`:"WD";cls="bc-WD";
        g.extras.wides+=1+extraVal;bwl.wides+=1;
      } else if(type==="noball"){
        // FIX 1: noball penalty run (1) does NOT rotate strike — only extraVal rotates
        isLegal=false;strBalls=0;addRuns=1+extraVal;bwlRuns=1+extraVal;strRuns=extraVal;rotateRuns=extraVal;
        label=extraVal>0?`NB+${extraVal}`:"NB";cls="bc-NB";
        g.extras.noBalls+=1;bwl.noBalls+=1;
        if(extraVal===4) g.batters[g.strikerIdx].fours+=1;
        if(extraVal===6) g.batters[g.strikerIdx].sixes+=1;
      } else if(type==="bye"){
        addRuns=extraVal||1;bwlRuns=0;strRuns=0;rotateRuns=extraVal||1;
        label=`B${extraVal||1}`;cls="bc-B";g.extras.byes+=extraVal||1;
      } else if(type==="legbye"){
        addRuns=extraVal||1;bwlRuns=0;strRuns=0;rotateRuns=extraVal||1;
        label=`LB${extraVal||1}`;cls="bc-LB";g.extras.legByes+=extraVal||1;
      } else if(type==="overthrow"){
        addRuns=extraVal;strRuns=extraVal;bwlRuns=extraVal;rotateRuns=extraVal;label=`+${extraVal}`;cls="bc-1";
      } else return prev;

      g.runs+=addRuns;
      g.batters[g.strikerIdx].runs+=strRuns;
      g.batters[g.strikerIdx].balls+=strBalls;
      bwl.runs+=bwlRuns; bwl.curOverRuns+=bwlRuns;
      if(isLegal){bwl.legal+=1;g.legalBalls+=1;}

      // FIX 1: rotate strike using rotateRuns (not addRuns) — wide/noball penalty excluded
      if(rotateRuns%2!==0){const tmp=g.strikerIdx;g.strikerIdx=g.nonStrikerIdx;g.nonStrikerIdx=tmp;}

      // Feature 7: insert ball at correct position in over
      // For illegal balls (wide/noball): insert after the current legal ball position
      // We track position by insertion order — legal balls fill slots 0-5, extras appear inline
      g.curOverBalls.push({label,cls,legal:isLegal});

      const legalInOver=g.curOverBalls.filter(b=>b.legal).length;
      if(isLegal&&legalInOver>=6) g=applyOverEnd(g);
      g=applyInningsEnd(g);
      return g;
    });
  }

  /* ═══════ WICKET ═══════ */
  function handleWicketClick(){
    if(gs.curBowlerIdx<0){toast$("Select a bowler first!","red");return;}
    setDismissal("Bowled"); setCaughtBy(""); setRunOutWhich("striker"); setRunOutRuns(0);
    setSelBatter(null); setCustomBatter("");
    setModalWicket(true);
  }

  function confirmWicket(){
    const hasAvail=gs.batters.some((b,i)=>!b.out&&!b.active&&i!==gs.strikerIdx&&i!==gs.nonStrikerIdx);
    const hasCustom=customBatter.trim().length>0;
    const isRunOut=dismissal==="Run Out";
    snapshot(gs);

    // Build dismissal string with fielder (Feature 5)
    let disStr=dismissal;
    if(dismissal==="Caught"&&caughtBy.trim()) disStr=`c ${caughtBy.trim()} b ${gs.bowlers[gs.curBowlerIdx]?.name||""}`;
    else if(dismissal==="Run Out") disStr=caughtBy.trim()?`run out (${caughtBy.trim()})`:"run out";
    else if(dismissal==="Stumped"&&caughtBy.trim()) disStr=`st ${caughtBy.trim()} b ${gs.bowlers[gs.curBowlerIdx]?.name||""}`;

    // FIX 2: determine which batsman index is out
    // runOutWhich = "striker" | "nonStriker"
    const outIdx   = isRunOut && runOutWhich==="nonStriker" ? gs.nonStrikerIdx : gs.strikerIdx;
    const safeIdx  = isRunOut && runOutWhich==="nonStriker" ? gs.strikerIdx    : gs.nonStrikerIdx;

    setGs(prev=>{
      let g={
        ...prev,
        batters:prev.batters.map(b=>({...b})),
        bowlers:prev.bowlers.map(b=>({...b})),
        curOverBalls:[...prev.curOverBalls],
        fowList:[...prev.fowList],
        completedOvers:[...prev.completedOvers],
      };

      // FIX Bug1: capture who is striker/non-striker BEFORE any rotation
      // runOutWhich="striker" means the person who was AT STRIKE when W button was pressed
      // runOutWhich="nonStriker" means the person at the non-striker end
      const origStrikerIdx    = g.strikerIdx;
      const origNonStrikerIdx = g.nonStrikerIdx;

      // FIX 2: add completed runs before the run-out dismissal
      if(isRunOut && runOutRuns>0){
        g.runs+=runOutRuns;
        // Credit runs to the striker (who hit the ball)
        g.batters[origStrikerIdx].runs+=runOutRuns;
        // Rotate strike if odd runs completed (batsmen crossed each other)
        if(runOutRuns%2!==0){g.strikerIdx=origNonStrikerIdx;g.nonStrikerIdx=origStrikerIdx;}
      }

      // FIX Bug1: actualOutIdx is determined from the ORIGINAL positions (before any rotation)
      // "striker" = origStrikerIdx, "nonStriker" = origNonStrikerIdx
      const actualOutIdx = isRunOut && runOutWhich==="nonStriker" ? origNonStrikerIdx : origStrikerIdx;
      const outBat=g.batters[actualOutIdx];
      g.batters[actualOutIdx]={...outBat,out:true,active:false,dismissal:disStr};
      g.fowList.push({
        name:outBat.name,runs:outBat.runs,balls:outBat.balls,
        score:g.runs,over:fmtOvers(g.legalBalls),dismissal:disStr
      });

      // FIX 3: Run Out does NOT credit bowler wickets — only these dismissals do:
      // Bowled, Caught, LBW, Stumped, Hit Wicket
      const bowlerWicketTypes=["Bowled","Caught","LBW","Stumped","Hit Wicket"];
      if(bowlerWicketTypes.includes(dismissal)){
        g.bowlers[g.curBowlerIdx].wickets+=1;
      }

      g.bowlers[g.curBowlerIdx].legal+=1;
      g.legalBalls+=1; g.wickets+=1;
      g.curOverBalls.push({label:"W",cls:"bc-W",legal:true});

      // Bring in new batsman (replacing the dismissed batsman's slot)
      let newIdx=-1;
      if(selBatter!==null){
        newIdx=selBatter;
        g.batters[newIdx].active=true;
        g.batters[newIdx].retired=false; // FIX: clear retired flag when coming back
      }
      else if(hasCustom){
        const slot=g.nextBatterIdx<g.batters.length?g.nextBatterIdx:g.batters.length-1;
        g.batters[slot]={...makeBatter(customBatter.trim()),active:true};
        newIdx=slot; g.nextBatterIdx=slot+1;
      } else if(hasAvail){
        const slot=g.batters.findIndex((b,i)=>!b.out&&!b.active&&i!==g.strikerIdx&&i!==g.nonStrikerIdx);
        if(slot>=0){g.batters[slot].active=true;newIdx=slot;g.nextBatterIdx=slot+1;}
      }
      // New batsman comes in at the dismissed batsman's position
      if(newIdx>=0){
        const dismissedIsStriker = actualOutIdx===g.strikerIdx;
        if(dismissedIsStriker) g.strikerIdx=newIdx;
        else g.nonStrikerIdx=newIdx;
      }

      const legalNow=g.curOverBalls.filter(b=>b.legal).length;
      if(legalNow>=6) g=applyOverEnd(g);
      g=applyInningsEnd(g);
      return g;
    });
    toast$(`Wicket! — ${disStr}`,"red");
    setModalWicket(false);
  }

  /* ═══════ BOWLER CONFIRM ═══════ */
  function confirmBowler(){
    if(selBowler===null&&!customBowler.trim()){toast$("Select or enter a bowler","red");return;}
    // Bug 4 fix: block consecutive overs by same bowler
    if(selBowler!==null){
      if(selBowler===gs.lastBowlerIdx){
        toast$("Bowler cannot bowl consecutive overs!","red"); return;
      }
      setGs(prev=>({...prev,curBowlerIdx:selBowler}));
    } else {
      const name=customBowler.trim();
      setGs(prev=>{
        const ex=prev.bowlers.findIndex(b=>b.name.toLowerCase()===name.toLowerCase());
        if(ex>=0) return{...prev,curBowlerIdx:ex};
        const arr=[...prev.bowlers,makeBowler(name)];
        return{...prev,bowlers:arr,curBowlerIdx:arr.length-1};
      });
    }
    setSelBowler(null); setCustomBowler(""); setModalBowler(false);
  }

  /* Feature 6: swap batsman at crease */
  function confirmSwapBatter(){
    // We just rotate: non-striker becomes striker
    // Or user can pick who to replace and with whom from bench
    setGs(prev=>({...prev,strikerIdx:prev.nonStrikerIdx,nonStrikerIdx:prev.strikerIdx}));
    toast$("Batsmen swapped ⇄");
    setModalSwapBat(false);
  }

  function confirmExtra(val){setModalExtra(false);processBall(pendingExtra,val);setPendingExtra(null);}

  /* ═══════ COMPUTED ═══════ */
  const battingName =gs.innings===1?team1:team2;
  const bowlingName =gs.innings===1?team2:team1;
  const oversStr    =fmtOvers(gs.legalBalls);
  const crr         =calcCRR(gs.runs,gs.legalBalls);
  const ballsLeft   =maxOvers*6-gs.legalBalls;
  const need        =gs.innings===2?Math.max(0,gs.target-gs.runs):0;
  const rrr         =gs.innings===2?calcRRR(need,ballsLeft):"-";
  const totalExtras =gs.extras.wides+gs.extras.noBalls+gs.extras.byes+gs.extras.legByes;
  const striker     =gs.batters[gs.strikerIdx]   ||makeBatter("—");
  const nonStriker  =gs.batters[gs.nonStrikerIdx]||makeBatter("—");
  const curBowler   =gs.curBowlerIdx>=0?gs.bowlers[gs.curBowlerIdx]:null;
  const legalThisOver=gs.curOverBalls.filter(b=>b.legal).length;

  /* ═══════ saveAndExit: persist history+stats, notify parent ═══════ */
  function saveAndExit(goToHome){
    // Build history entry
    const allBatters=[...gs.inn1Batters,...gs.batters].filter(b=>b.balls>0);
    const allBowlers=[...gs.inn1Bowlers,...gs.bowlers].filter(b=>b.legal>0);
    const topBat=allBatters.slice().sort((a,b)=>b.runs-a.runs)[0];
    const topBwl=allBowlers.slice().sort((a,b)=>b.wickets-a.wickets||a.runs-b.runs)[0];

    addHistory({
      team1, team2, overs: maxOvers, result: gs.resultMsg,
      // Summary
      inn1Runs: gs.inn1Runs, inn1Wkts: gs.inn1Wickets, inn1Balls: gs.inn1LegalBalls,
      inn2Runs: gs.runs,     inn2Wkts: gs.wickets,     inn2Balls: gs.legalBalls,
      topScorer: topBat ? `${topBat.name} ${topBat.runs}(${topBat.balls}b)` : "",
      topBowler: topBwl ? `${topBwl.name} ${topBwl.wickets}/${topBwl.runs}` : "",
      potm: gs.potm || "",
      // Full scorecard data for history detail view
      inn1Batters: gs.inn1Batters, inn1Bowlers: gs.inn1Bowlers,
      inn1Extras:  gs.inn1Extras,  inn1FowList: gs.inn1FowList,
      inn2Batters: gs.batters,     inn2Bowlers: gs.bowlers,
      inn2Extras:  gs.extras,      inn2FowList: gs.fowList,
    });

    updateStatsFromMatch({
      batters1: gs.inn1Batters,  bowlers1: gs.inn1Bowlers,  fowList1: gs.inn1FowList,
      batters2: gs.batters,      bowlers2: gs.bowlers,      fowList2: gs.fowList,
    });

    localStorage.removeItem(STORE_KEY);

    if(onMatchComplete){
      onMatchComplete({ team1, team2, overs: maxOvers, players1, players2 });
    }
    if(goToHome) goHome();
    else {
      // Rematch: go to setup with same teams
      goHome();
      // App will show rematch banner — user clicks it to go to setup
    }
  }

  /* ═══════ Feature 8: RESULT + POTM ═══════ */
  if(gs.matchOver){
    // Find top run scorer and top wicket taker across both innings
    const allBatters=[...gs.inn1Batters,...gs.batters].filter(b=>b.balls>0);
    const allBowlers=[...gs.inn1Bowlers,...gs.bowlers].filter(b=>b.legal>0);
    const topBat=allBatters.sort((a,b)=>b.runs-a.runs)[0];
    const topBwl=allBowlers.sort((a,b)=>b.wickets-a.wickets||a.runs-b.runs)[0];
    const suggestPOTM=topBat?.name||"";

    return(
      <div style={{paddingBottom:40}}>
        <div className="result-wrap">
          <div className="result-trophy">🏆</div>
          <div className="result-title">Match Complete!</div>
          <div className="result-sub">{gs.resultMsg}</div>

          {/* POTM selector */}
          <div className="result-card" style={{marginBottom:12}}>
            <div style={{fontFamily:"Rajdhani,sans-serif",fontSize:16,fontWeight:700,color:"#e8352a",marginBottom:8}}>🏅 Player of the Match</div>
            <select value={gs.potm||suggestPOTM} onChange={e=>setGs(prev=>({...prev,potm:e.target.value}))}
              style={{marginTop:0}}>
              <option value="">Select Player</option>
              {[...players1,...players2].map((p,i)=><option key={i} value={p}>{p}</option>)}
            </select>
            {(gs.potm||suggestPOTM)&&(()=>{
              const potmName=gs.potm||suggestPOTM;
              const bat=[...gs.inn1Batters,...gs.batters].find(b=>b.name===potmName);
              const bwl=[...gs.inn1Bowlers,...gs.bowlers].find(b=>b.name===potmName);
              return(
                <div style={{marginTop:10,padding:"10px 12px",background:"#fef9c3",borderRadius:8,border:"1px solid #fcd34d"}}>
                  <div style={{fontWeight:800,fontSize:15,color:"#92400e"}}>{potmName} 🌟</div>
                  {bat&&bat.balls>0&&<div style={{fontSize:12,color:"#78350f",marginTop:3}}>Batting: {bat.runs} runs ({bat.balls}b) | SR {calcSR(bat.runs,bat.balls)} | 4s:{bat.fours} 6s:{bat.sixes}</div>}
                  {bwl&&bwl.legal>0&&<div style={{fontSize:12,color:"#78350f",marginTop:2}}>Bowling: {bwl.wickets}/{bwl.runs} | {fmtOvers(bwl.legal)} ov | Econ {calcEcon(bwl.runs,bwl.legal)}</div>}
                </div>
              );
            })()}
          </div>

          {/* Match summary */}
          <div className="result-card" style={{marginBottom:12}}>
            <div style={{fontFamily:"Rajdhani,sans-serif",fontSize:15,fontWeight:700,color:"#475569",marginBottom:8}}>MATCH SUMMARY</div>
            <div className="r-stat"><span className="rk">{team1} (1st Innings)</span><span className="rv">{gs.inn1Runs}/{gs.inn1Wickets} ({fmtOvers(gs.inn1LegalBalls)} ov)</span></div>
            <div className="r-stat"><span className="rk">{team2} (2nd Innings)</span><span className="rv">{gs.runs}/{gs.wickets} ({oversStr} ov)</span></div>
            <div className="r-stat"><span className="rk">Result</span><span className="rv" style={{color:"#16a34a"}}>{gs.resultMsg}</span></div>
            {topBat&&<div className="r-stat"><span className="rk">Top Scorer</span><span className="rv">{topBat.name} {topBat.runs}({topBat.balls}b)</span></div>}
            {topBwl&&<div className="r-stat"><span className="rk">Best Bowler</span><span className="rv">{topBwl.name} {topBwl.wickets}/{topBwl.runs}</span></div>}
          </div>

          {/* 1st innings scorecard */}
          <div className="card" style={{marginBottom:10}}>
            <div className="card-title">{team1} — 1st Innings</div>
            <ScorecardTable batters={gs.inn1Batters} strikerIdx={-1} nonStrikerIdx={-1}
              bowlers={gs.inn1Bowlers} extras={gs.inn1Extras} fowList={gs.inn1FowList}
              runs={gs.inn1Runs} wickets={gs.inn1Wickets} legalBalls={gs.inn1LegalBalls}
              label=""/>
          </div>

          {/* 2nd innings scorecard */}
          <div className="card" style={{marginBottom:20}}>
            <div className="card-title">{team2} — 2nd Innings</div>
            <ScorecardTable batters={gs.batters} strikerIdx={-1} nonStrikerIdx={-1}
              bowlers={gs.bowlers} extras={gs.extras} fowList={gs.fowList}
              runs={gs.runs} wickets={gs.wickets} legalBalls={gs.legalBalls}
              label=""/>
          </div>

          {/* Feature 5: Rematch button */}
          <button className="app-button"
            style={{background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",marginBottom:8}}
            onClick={()=>{
              // Save history + stats then go to setup with same teams pre-filled
              saveAndExit(false);
            }}>
            🔄 Rematch Same Teams
          </button>
          <button className="app-button" onClick={()=>saveAndExit(true)}>
            🏠 New Match
          </button>
        </div>
      </div>
    );
  }

  /* ═══════ Feature 3: INNINGS BREAK SCREEN ═══════ */
  if(gs.inningsBreak){
    const inn1Extras=gs.inn1Extras||gs.extras;
    return(
      <div style={{paddingBottom:40}}>
        <div style={{background:"linear-gradient(135deg,#1e293b,#0f172a)",padding:"20px 16px",textAlign:"center",borderRadius:"0 0 16px 16px",marginBottom:12}}>
          <div style={{color:"#f59e0b",fontFamily:"Rajdhani,sans-serif",fontSize:13,fontWeight:700,letterSpacing:2,marginBottom:4}}>1ST INNINGS COMPLETE</div>
          <div style={{color:"#fff",fontFamily:"Rajdhani,sans-serif",fontSize:48,fontWeight:700,lineHeight:1}}>{gs.inn1Runs}<span style={{color:"#22c55e"}}>/{gs.inn1Wickets}</span></div>
          <div style={{color:"#94a3b8",fontSize:13,marginTop:4}}>{team1} · {fmtOvers(gs.inn1LegalBalls)} overs</div>
          <div style={{marginTop:12,background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.4)",borderRadius:8,padding:"10px 16px",display:"inline-block"}}>
            <div style={{color:"#f59e0b",fontSize:11,fontWeight:800,letterSpacing:1}}>TARGET</div>
            <div style={{color:"#fff",fontFamily:"Rajdhani,sans-serif",fontSize:28,fontWeight:700}}>{gs.target}</div>
            <div style={{color:"#94a3b8",fontSize:11}}>{team2} needs {gs.target} in {maxOvers} overs</div>
          </div>
        </div>

        <div style={{padding:"0 14px"}}>
          {/* 1st innings full scorecard */}
          <div className="card" style={{marginBottom:10}}>
            <div className="card-title">{team1} — 1st Innings Scorecard</div>
            <ScorecardTable
              batters={gs.inn1Batters} strikerIdx={-1} nonStrikerIdx={-1}
              bowlers={gs.inn1Bowlers} extras={gs.inn1Extras||{wides:0,noBalls:0,byes:0,legByes:0}}
              fowList={gs.inn1FowList} runs={gs.inn1Runs} wickets={gs.inn1Wickets}
              legalBalls={gs.inn1LegalBalls} label=""/>
          </div>

          <button className="app-button" onClick={startSecondInnings} style={{marginBottom:8}}>
            🏏 Start 2nd Innings ({team2} batting)
          </button>
          <button className="app-button back-btn" onClick={()=>{if(window.confirm("Exit? Data saved.")) setScreen("home");}}>
            ⬅ Back to Home
          </button>
        </div>
      </div>
    );
  }

  /* ═══════ MAIN RENDER ═══════ */
  return(
    <div>
      <button className="app-button back-btn"
        onClick={()=>{if(window.confirm("Exit match? Data is auto-saved.")) setScreen("home");}}>
        ⬅ Back
      </button>

      <div className="tab-bar">
        {["live","scorecard","overs","info"].map(t=>(
          <div key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </div>
        ))}
      </div>

      {/* ══ LIVE TAB ══ */}
      {tab==="live"&&(
        <div className="tab-content active">
          <span className="innings-label">{gs.innings===1?"1st Innings":"2nd Innings"}</span>

          <div className="scoreboard" style={{marginTop:8}}>
            <div className="sb-team">{battingName.toUpperCase()} BATTING</div>
            <div className="sb-score">{gs.runs}<span>/{gs.wickets}</span></div>
            <div className="sb-overs">Overs: {oversStr} | CRR: {crr}</div>
            {gs.innings===2&&(
              <div className="target-chip">
                <div>
                  <div className="tc-label">TARGET</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Need {need} off {ballsLeft} balls</div>
                </div>
                <div className="tc-val">{gs.target}</div>
              </div>
            )}
            <div className="sb-stats-row">
              <div className="sb-stat"><div className="sb-stat-val">{crr}</div><div className="sb-stat-lbl">CRR</div></div>
              <div className="sb-stat">
                <div className="sb-stat-val" style={{color:gs.innings===2?(parseFloat(rrr)>parseFloat(crr)?"#ef4444":"#22c55e"):"#fff"}}>{rrr}</div>
                <div className="sb-stat-lbl">RRR</div>
              </div>
              <div className="sb-stat"><div className="sb-stat-val">{totalExtras}</div><div className="sb-stat-lbl">Extras</div></div>
              <div className="sb-stat"><div className="sb-stat-val">{ballsLeft}</div><div className="sb-stat-lbl">Left</div></div>
            </div>
          </div>

          {/* Batters */}
          <div style={{marginTop:10}}>
            <div className="section-hdr">
              <div className="section-title">At The Crease</div>
              {/* Feature 6: change batsman button */}
              <span className="change-link" onClick={()=>setModalSwapBat(true)}>Change bat ›</span>
            </div>
            <div className="batters-grid">
              {[{b:striker,isS:true},{b:nonStriker,isS:false}].map(({b,isS})=>(
                <div key={isS?"s":"ns"} className={`batter-card ${isS?"on-strike":""}`}>
                  <div className="bc-name">{b.name}</div>
                  <div><span className="bc-runs">{b.runs}</span><span className="bc-balls"> ({b.balls})</span></div>
                  <div className="bc-stats">
                    <div className="bc-stat">SR <b>{calcSR(b.runs,b.balls)}</b></div>
                    <div className="bc-stat">4s <b>{b.fours}</b></div>
                    <div className="bc-stat">6s <b>{b.sixes}</b></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bowler */}
          <div style={{marginTop:10}}>
            <div className="section-hdr">
              <div className="section-title">Bowler</div>
              <span className="change-link" onClick={()=>{setSelBowler(null);setCustomBowler("");setModalBowler(true);}}>Change ›</span>
            </div>
            {curBowler?(
              <div className="bowler-card">
                <div className="bowler-info">
                  <div className="bow-name">{curBowler.name}</div>
                  <div className="bow-fig">{curBowler.wickets}-{curBowler.runs} | {fmtOvers(curBowler.legal)} ov</div>
                </div>
                <div className="bowler-stats">
                  <div className="bow-stat"><div className="bsv">{fmtOvers(curBowler.legal)}</div><div className="bsl">Overs</div></div>
                  <div className="bow-stat"><div className="bsv">{calcEcon(curBowler.runs,curBowler.legal)}</div><div className="bsl">Econ</div></div>
                  <div className="bow-stat"><div className="bsv">{curBowler.maidens}</div><div className="bsl">Mdns</div></div>
                </div>
              </div>
            ):(
              <div className="bowler-card" style={{justifyContent:"center"}}>
                <span style={{color:"#94a3b8",fontSize:14,fontWeight:700}}>Tap "Change" to select bowler</span>
              </div>
            )}
          </div>

          {/* Current Over — Feature 7 */}
          <div style={{marginTop:10}}>
            <div className="section-hdr">
              <div className="section-title">Current Over</div>
              <div className="over-note">{legalThisOver} / 6 legal balls</div>
            </div>
            <div style={{background:"#fff",borderRadius:10,padding:"10px 12px",border:"1px solid #e2e8f0"}}>
              <div className="over-balls">
                {/* Feature 7: render balls in order — legal balls in slots, extras inline at their position */}
                {(()=>{
                  const rendered=[];
                  let legalCount=0;
                  gs.curOverBalls.forEach((ball,idx)=>{
                    rendered.push(
                      <div key={idx} className={`ball-chip ${ball.cls}`}>{ball.label}</div>
                    );
                    if(ball.legal) legalCount++;
                  });
                  // Empty slots for remaining legal balls
                  for(let i=legalCount;i<6;i++){
                    rendered.push(<div key={`empty-${i}`} className="ball-chip bc-empty"></div>);
                  }
                  return rendered;
                })()}
              </div>
              <div className="over-note" style={{marginTop:6}}>
                {gs.curOverBalls.length===0?"No balls yet this over":(()=>{
                  const r=gs.curOverBalls.reduce((s,b)=>{
                    if(b.label==="•"||b.label==="W") return s;
                    const n=parseInt(b.label.replace(/[^0-9]/g,""))||0;
                    if(b.label.startsWith("WD")||b.label.startsWith("NB")) return s+1+(b.label.includes("+")?n:0);
                    return s+n;
                  },0);
                  return`This over: ${r} runs`;
                })()}
              </div>
            </div>
          </div>

          {/* Fall of Wickets */}
          {gs.fowList.length>0&&(
            <div style={{marginTop:10}}>
              <div className="section-hdr"><div className="section-title">Fall of Wickets</div></div>
              <div className="wicket-log">
                {gs.fowList.map((f,i)=>(
                  <div className="wk-entry" key={i}>
                    <div>
                      <div className="we-name">{f.name}</div>
                      <div className="we-how">{f.dismissal} · {f.over} ov</div>
                    </div>
                    <div className="we-score">{f.runs} ({f.balls}b) — {f.score}/{i+1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RRR bar */}
          {gs.innings===2&&(
            <div className="rrr-bar">
              <div className="rrr-row">
                <div className="rrr-item">
                  <div className="ri-lbl">Required Rate</div>
                  <div className={`ri-val ${parseFloat(rrr)<=parseFloat(crr)?"good":parseFloat(rrr)<=12?"warn":"bad"}`}>{rrr}</div>
                </div>
                <div className="rrr-item" style={{textAlign:"right"}}>
                  <div className="ri-lbl">Current Rate</div>
                  <div className="ri-val">{crr}</div>
                </div>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{width:`${Math.min(100,(gs.runs/(gs.target||1))*100).toFixed(1)}%`}}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ SCORECARD TAB — Feature 4 ══ */}
      {tab==="scorecard"&&(
        <div className="tab-content active">
          {/* Current innings */}
          <ScorecardTable batters={gs.batters} strikerIdx={gs.strikerIdx} nonStrikerIdx={gs.nonStrikerIdx}
            bowlers={gs.bowlers} extras={gs.extras} fowList={gs.fowList}
            runs={gs.runs} wickets={gs.wickets} legalBalls={gs.legalBalls}
            label={`${battingName} — ${gs.innings===1?"1st":"2nd"} Innings`}/>

          {/* Feature 4: Show 1st innings scorecard in 2nd innings */}
          {gs.innings===2&&gs.inn1Batters.length>0&&(
            <div style={{marginTop:20,paddingTop:16,borderTop:"2px solid #e2e8f0"}}>
              <ScorecardTable batters={gs.inn1Batters} strikerIdx={-1} nonStrikerIdx={-1}
                bowlers={gs.inn1Bowlers} extras={gs.inn1Extras||{wides:0,noBalls:0,byes:0,legByes:0}}
                fowList={gs.inn1FowList} runs={gs.inn1Runs} wickets={gs.inn1Wickets}
                legalBalls={gs.inn1LegalBalls} label={`${team1} — 1st Innings`}/>
            </div>
          )}
        </div>
      )}

      {/* ══ OVERS TAB ══ */}
      {tab==="overs"&&(
        <div className="tab-content active">
          {gs.completedOvers.length===0
            ?<div style={{color:"#94a3b8",textAlign:"center",padding:"40px 0",fontWeight:700}}>No completed overs yet</div>
            :gs.completedOvers.map((ov,i)=>(
              <div className="oh-row" key={i}>
                <div className="oh-num">Ov {i+1}</div>
                <div style={{flex:1}}>
                  <div className="oh-balls">
                    {ov.balls.map((b,j)=>(
                      <div key={j} className={`oh-ball ${b.cls}`}>{b.label}</div>
                    ))}
                  </div>
                  <div className="oh-bowler">{ov.bowlerName}</div>
                </div>
                <div className="oh-runs">{ov.runs}</div>
              </div>
            ))
          }
        </div>
      )}

      {/* ══ INFO TAB ══ */}
      {tab==="info"&&(
        <div className="tab-content active">
          <div className="info-grid">
            {[
              ["Format",`${maxOvers} Overs`],["Innings",gs.innings===1?"1st":"2nd"],
              ["Batting",battingName],["Bowling",bowlingName],
              ["Overs",oversStr],["Balls Left",ballsLeft],
              ["Wides",gs.extras.wides],["No Balls",gs.extras.noBalls],
              ["Byes",gs.extras.byes],["Leg Byes",gs.extras.legByes],
              ...(gs.innings===2?[["Target",gs.target],["Need",need]]:[]),
            ].map(([lbl,val])=>(
              <div key={lbl} className="info-card">
                <div className="ic-label">{lbl}</div>
                <div className="ic-val" style={{fontSize:String(val).length>6?16:26}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ SCORING PAD ══ */}
      <div className="scoring-pad">
        <div className="score-grid">
          <button className="score-btn sb-dot" onClick={()=>processBall("dot")}>•<span>DOT</span></button>
          <button className="score-btn sb-1"   onClick={()=>processBall(1)}>1<span>RUN</span></button>
          <button className="score-btn sb-2"   onClick={()=>processBall(2)}>2<span>RUNS</span></button>
          <button className="score-btn sb-3"   onClick={()=>processBall(3)}>3<span>RUNS</span></button>
        </div>
        <div className="score-grid">
          <button className="score-btn sb-4"  onClick={()=>processBall(4)}>4<span>FOUR</span></button>
          <button className="score-btn sb-6"  onClick={()=>processBall(6)}>6<span>SIX</span></button>
          <button className="score-btn sb-WD" onClick={()=>{setPendingExtra("wide");setModalExtra(true);}}>WD<span>WIDE</span></button>
          <button className="score-btn sb-NB" onClick={()=>{setPendingExtra("noball");setModalExtra(true);}}>NB<span>NO BALL</span></button>
        </div>
        <div className="score-grid">
          <button className="score-btn sb-W"  onClick={handleWicketClick}>W<span>WICKET</span></button>
          <button className="score-btn sb-B"  onClick={()=>{setPendingExtra("bye");setModalExtra(true);}}>BYE<span>BYE</span></button>
          <button className="score-btn sb-LB" onClick={()=>{setPendingExtra("legbye");setModalExtra(true);}}>LB<span>LEG BYE</span></button>
          <button className="score-btn sb-OT" onClick={()=>setModalOT(true)}>OT<span>OVERTHROW</span></button>
        </div>
        <div className="action-row">
          <button className="btn-undo"    onClick={handleUndo}>↩ UNDO</button>
          <button className="btn-strike"  onClick={()=>{
            setGs(prev=>({...prev,strikerIdx:prev.nonStrikerIdx,nonStrikerIdx:prev.strikerIdx}));
            toast$("Strike rotated ⇄");
          }}>⇄ SWITCH</button>
          <button className="btn-end-inn" onClick={()=>{
            if(window.confirm("End innings now?"))
              setGs(prev=>applyInningsEnd({...prev,legalBalls:maxOvers*6}));
          }}>END INN.</button>
        </div>
      </div>

      {/* ══ MODAL: WICKET — Feature 5 ══ */}
      <Modal show={modalWicket} title="🏏 Wicket!" sub="Select dismissal and incoming batsman"
        onClose={()=>setModalWicket(false)}>
        <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>Dismissal Type</div>
        <div className="dismissal-grid">
          {["Bowled","Caught","LBW","Run Out","Stumped","Hit Wicket"].map(d=>(
            <button key={d} className={`dis-btn ${dismissal===d?"sel":""}`} onClick={()=>{setDismissal(d);setCaughtBy("");}}>{d}</button>
          ))}
        </div>
        {/* Feature 5: fielder name for Caught / Run Out / Stumped */}
        {(dismissal==="Caught"||dismissal==="Run Out"||dismissal==="Stumped")&&(
          <div style={{marginTop:8}}>
            {/* FIX 2: Run Out — ask which batsman is out */}
            {dismissal==="Run Out"&&(
              <div style={{marginBottom:10}}>
                <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>Which batsman is OUT?</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <button
                    className={`dis-btn ${runOutWhich==="striker"?"sel":""}`}
                    onClick={()=>setRunOutWhich("striker")}>
                    ⭐ {gs.batters[gs.strikerIdx]?.name||"Striker"}<br/>
                    <span style={{fontSize:10,opacity:0.7}}>(Striker)</span>
                  </button>
                  <button
                    className={`dis-btn ${runOutWhich==="nonStriker"?"sel":""}`}
                    onClick={()=>setRunOutWhich("nonStriker")}>
                    🏃 {gs.batters[gs.nonStrikerIdx]?.name||"Non-Striker"}<br/>
                    <span style={{fontSize:10,opacity:0.7}}>(Non-Striker)</span>
                  </button>
                </div>
                <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>Runs completed before dismissal?</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                  {[0,1,2,3].map(n=>(
                    <button key={n}
                      className={`er-btn ${runOutRuns===n?"sel":""}`}
                      style={{border: runOutRuns===n?"2px solid #22c55e":"",background:runOutRuns===n?"#dcfce7":""}}
                      onClick={()=>setRunOutRuns(n)}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:4}}>
              {dismissal==="Caught"?"Caught by:":dismissal==="Stumped"?"Stumped by (keeper):":"Run Out by (fielder):"}
            </div>
            <div className="avail-list">
              {(gs.innings===1?players2:players1).map((p,i)=>(
                <div key={i} className={`avail-item ${caughtBy===p?"selected":""}`}
                  onClick={()=>setCaughtBy(p)}>
                  <div className="ai-num">{i+1}</div>
                  <div className="ai-name">{p}</div>
                </div>
              ))}
            </div>
            <input placeholder={`Or type ${dismissal==="Caught"?"fielder":"player"} name`}
              value={caughtBy} onChange={e=>setCaughtBy(e.target.value)} style={{marginTop:6}}/>
          </div>
        )}
        <div style={{fontSize:12,color:"#64748b",fontWeight:700,margin:"12px 0 6px"}}>Incoming Batsman</div>
        {gs.batters.some((b,i)=>!b.out&&!b.active&&i!==gs.strikerIdx&&i!==gs.nonStrikerIdx)&&(
          <div className="avail-list">
            {gs.batters.map((b,i)=>{
              if(b.out||b.active||i===gs.strikerIdx||i===gs.nonStrikerIdx) return null;
              return(
                <div key={i} className={`avail-item ${selBatter===i?"selected":""}`}
                  onClick={()=>{setSelBatter(i);setCustomBatter("");}}>
                  <div className="ai-num">{i+1}</div>
                  <div style={{flex:1}}>
                    <div className="ai-name">{b.name}</div>
                    {/* BUG1 FIX: show retired status so umpire knows they can bat again */}
                    {b.retired&&<div style={{fontSize:10,color:"#d97706",fontWeight:700}}>Retired Hurt — can bat again</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="or-divider">OR ENTER NAME</div>
        <input placeholder="Custom batsman name" value={customBatter}
          onChange={e=>{setCustomBatter(e.target.value);setSelBatter(null);}}/>
        <div className="modal-btns">
          <button className="btn-cancel"  onClick={()=>setModalWicket(false)}>CANCEL</button>
          <button className="btn-confirm" onClick={confirmWicket}>CONFIRM</button>
        </div>
      </Modal>

      {/* ══ MODAL: BOWLER ══ */}
      <Modal show={modalBowler} title="🎳 Select Bowler" sub="Who will bowl this over?"
        onClose={()=>gs.curBowlerIdx>=0&&setModalBowler(false)}>
        {gs.bowlers.map((b,i)=>{
          const isLast=i===gs.lastBowlerIdx;
          return(
          <div key={i}
            className={`bowler-option ${selBowler===i?"selected":""}`}
            style={isLast?{opacity:0.45,cursor:"not-allowed"}:{}}
            onClick={()=>{ if(isLast){toast$("Cannot bowl consecutive overs","red");return;} setSelBowler(i);setCustomBowler(""); }}>
            <div>
              <div className="bo-name">{b.name}{isLast&&<span style={{fontSize:10,color:"#ef4444",marginLeft:6,fontWeight:700}}>prev over</span>}</div>
              <div className="bo-stats">{fmtOvers(b.legal)} ov · {b.runs} runs · {b.wickets} wkts · Econ {calcEcon(b.runs,b.legal)}</div>
            </div>
            {selBowler===i&&<span style={{color:"#16a34a",fontSize:20}}>✓</span>}
          </div>
          );
        })}
        <div className="or-divider">OR NEW BOWLER</div>
        <input placeholder="Enter bowler name" value={customBowler}
          onChange={e=>{setCustomBowler(e.target.value);setSelBowler(null);}}/>
        <div className="modal-btns">
          {gs.curBowlerIdx>=0&&<button className="btn-cancel" onClick={()=>setModalBowler(false)}>CANCEL</button>}
          <button className="btn-confirm" onClick={confirmBowler}>CONFIRM</button>
        </div>
      </Modal>

      {/* ══ MODAL: EXTRA RUNS ══ */}
      <Modal show={modalExtra}
        title={pendingExtra==="wide"?"Wide — Extra Runs?":pendingExtra==="noball"?"No Ball — Runs?":pendingExtra==="bye"?"Bye Runs?":"Leg Bye Runs?"}
        sub="Select runs scored" onClose={()=>setModalExtra(false)}>
        <div className="extra-runs-grid">
          {(pendingExtra==="bye"||pendingExtra==="legbye"?[1,2,3,4]:[0,1,2,3,4]).map(n=>(
            <button key={n} className="er-btn" onClick={()=>confirmExtra(n)}>{n}</button>
          ))}
        </div>
        <button className="btn-cancel" style={{width:"100%"}} onClick={()=>setModalExtra(false)}>CANCEL</button>
      </Modal>

      {/* ══ MODAL: OVERTHROW ══ */}
      <Modal show={modalOT} title="⚡ Overthrow Runs" sub="How many overthrow runs?" onClose={()=>setModalOT(false)}>
        <div className="extra-runs-grid">
          {[1,2,3,4,6].map(n=>(
            <button key={n} className="er-btn" onClick={()=>{setModalOT(false);processBall("overthrow",n);}}>{n}</button>
          ))}
        </div>
        <button className="btn-cancel" style={{width:"100%"}} onClick={()=>setModalOT(false)}>CANCEL</button>
      </Modal>

      {/* ══ MODAL: SWAP BATSMAN — Feature 6 ══ */}
      <Modal show={modalSwapBat} title="🔄 Change Batsman" sub="Switch striker/non-striker or retire a batter"
        onClose={()=>setModalSwapBat(false)}>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:8}}>Current batsmen at crease:</div>
          <div className={`avail-item selected`} style={{marginBottom:6}}>
            <div className="ai-num">⭐</div>
            <div className="ai-name">{striker.name} — STRIKER ({striker.runs} runs)</div>
          </div>
          <div className="avail-item" style={{marginBottom:6}}>
            <div className="ai-num">🏃</div>
            <div className="ai-name">{nonStriker.name} — NON-STRIKER ({nonStriker.runs} runs)</div>
          </div>
        </div>
        <button className="btn-confirm" style={{width:"100%",marginBottom:8}} onClick={confirmSwapBatter}>
          ⇄ Swap Striker / Non-Striker
        </button>
        {gs.batters.some((b,i)=>!b.out&&!b.active&&i!==gs.strikerIdx&&i!==gs.nonStrikerIdx)&&(
          <>
            <div className="or-divider">RETIRE STRIKER & BRING IN</div>
            {gs.batters.map((b,i)=>{
              if(b.out||b.active||i===gs.strikerIdx||i===gs.nonStrikerIdx) return null;
              return(
                <div key={i} className="avail-item" style={{marginBottom:6,borderColor:b.retired?"#f59e0b":undefined}} onClick={()=>{
                  setGs(prev=>{
                    const arr=prev.batters.map(b=>({...b}));
                    // BUG1 FIX: mark as retired (not out, not active, retired=true)
                    arr[prev.strikerIdx].active=false;
                    arr[prev.strikerIdx].retired=true;
                    arr[i].active=true;
                    return{...prev,batters:arr,strikerIdx:i};
                  });
                  toast$(`${b.name} in as striker · ${striker.name} retired hurt`);
                  setModalSwapBat(false);
                }}>
                  <div className="ai-num">{i+1}</div>
                  <div style={{flex:1}}>
                    <div className="ai-name">{b.name}</div>
                    <div style={{fontSize:10,color:b.retired?"#d97706":"#94a3b8",fontWeight:700}}>{b.retired?"Retired Hurt — can bat again":"Yet to bat"}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <button className="btn-cancel" style={{width:"100%",marginTop:8}} onClick={()=>setModalSwapBat(false)}>CLOSE</button>
      </Modal>

      <div className={`toast ${toast?"show":""} ${toastType}`}>{toast}</div>
    </div>
  );
}
