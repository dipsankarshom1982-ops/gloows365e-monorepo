"use client";
// PATH: apps/web/src/app/(app)/ai-guru/notebook/page.tsx
// AI Notebook — mirror of mobile app/ai-guru/notebook.tsx
// Filter by mode, search, pin, delete, expand entries

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, query, orderBy, getDocs,
  deleteDoc, doc, updateDoc, onSnapshot,
} from "firebase/firestore";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

interface NotebookEntry {
  id: string; question: string; answer: string;
  mode: string; modeLabel: string; pinned: boolean;
  createdAt: any;
}

const MODE_COLORS: Record<string,string> = {
  explain:"#6366f1", notes:"#0284c7", exam:"#dc2626",
  doubt:"#d97706", summarize:"#059669", tip:"#7c3aed", language:"#be185d",
};

// FEATURE: refactored to take t as a parameter — standalone helper, can't
// call useAppTranslation() itself; the component body passes its t down.
// Falls back to plain en-IN date formatting for entries older than a week,
// same as before (not translated — a short month abbreviation + day number
// reads fine across locales and matching every language's date convention
// here isn't worth the complexity for a "more than a week ago" timestamp).
function relTime(ts:any, t:(key:string, fallback?:string, values?:Record<string,unknown>)=>string):string {
  if(!ts)return "";
  const ms = ts?.toMillis?.()??((ts?.seconds??0)*1000);
  const ago = Math.floor((Date.now()-ms)/1000);
  if(ago<60)return t("justNow","Just now");
  if(ago<3600)return t("minutesAgo",`${Math.floor(ago/60)}m ago`,{count:Math.floor(ago/60)});
  if(ago<86400)return t("hoursAgo",`${Math.floor(ago/3600)}h ago`,{count:Math.floor(ago/3600)});
  if(ago<604800)return t("daysAgoLabel",`${Math.floor(ago/86400)}d ago`,{count:Math.floor(ago/86400)});
  return new Date(ms).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}

export default function NotebookPage() {
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const [entries,     setEntries]     = useState<NotebookEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterMode,  setFilterMode]  = useState("all");
  const [expanded,    setExpanded]    = useState<string|null>(null);

  const load = useCallback(()=>{
    const uid = getAuth().currentUser?.uid; if(!uid){setLoading(false);return;}
    const db = getFirestore();
    const q  = query(collection(db,"aiNotebook",uid,"entries"),orderBy("pinned","desc"),orderBy("createdAt","desc"));
    const unsub = onSnapshot(q,snap=>{
      setEntries(snap.docs.map(d=>({id:d.id,...d.data()} as NotebookEntry)));
      setLoading(false);
    },()=>setLoading(false));
    return unsub;
  },[]);

  useEffect(()=>{ const unsub=load(); return ()=>unsub?.(); },[load]);

  async function handleDelete(entry:NotebookEntry){
    if(!confirm(t("deleteConfirm",`Delete "${entry.question.slice(0,60)}…"?`,{question:entry.question.slice(0,60)})))return;
    const uid=getAuth().currentUser?.uid; if(!uid)return;
    await deleteDoc(doc(getFirestore(),"aiNotebook",uid,"entries",entry.id));
  }

  async function handlePin(entry:NotebookEntry){
    const uid=getAuth().currentUser?.uid; if(!uid)return;
    await updateDoc(doc(getFirestore(),"aiNotebook",uid,"entries",entry.id),{pinned:!entry.pinned});
  }

  const allModes = Array.from(new Set(entries.map(e=>e.mode)));
  const filtered = entries.filter(e=>{
    const matchMode  = filterMode==="all"||e.mode===filterMode;
    const matchSearch= !search||e.question.toLowerCase().includes(search.toLowerCase())||e.answer.toLowerCase().includes(search.toLowerCase());
    return matchMode&&matchSearch;
  });

  // Page chrome — header, search box, filter chips, entry cards — follows
  // the theme. Per-mode accent colors (MODE_COLORS) stay fixed in both
  // themes since they're a semantic/categorical color code, not a theme
  // choice — same treatment as the mode chips on Ask AI Guru.
  const cardBg       = isDarkMode ? "#1e293b" : colors.card;
  const borderSoft     = isDarkMode ? "rgba(255,255,255,0.06)" : colors.border;
  const borderSofter    = isDarkMode ? "rgba(255,255,255,0.04)" : colors.border;
  const chipUnselectedBg = isDarkMode ? "rgba(255,255,255,0.03)" : colors.card;
  const textPrimary   = colors.text;
  const textMuted     = colors.textSecondary;

  return(
    <div style={{minHeight:"100dvh",background:isDarkMode?"#060612":colors.background,paddingBottom:40}}>
      <style>{`.nb-btn{cursor:pointer}.nb-btn:hover{opacity:.8}`}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",padding:"12px 16px",gap:8,borderBottom:`1px solid ${borderSoft}`,background:isDarkMode?"rgba(6,6,18,0.98)":"rgba(255,255,255,0.95)",position:"sticky",top:0,zIndex:10}}>
        <Link href="/ai-guru/ask" style={{width:40,height:40,borderRadius:12,background:isDarkMode?"rgba(255,255,255,0.08)":colors.card,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:textMuted,fontSize:20,fontWeight:900}}>‹</Link>
        <span style={{flex:1,color:textPrimary,fontSize:18,fontWeight:900}}>📓 {t("notebookTitle","My AI Notebook")}</span>
        <span style={{color:textMuted,fontSize:12}}>{t("entriesCount",`${filtered.length} entries`,{count:filtered.length})}</span>
      </div>

      <div style={{padding:"12px 16px"}}>
        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("searchNotebookPlaceholder","🔍  Search notebook…")}
          style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1px solid ${isDarkMode?"rgba(255,255,255,0.1)":colors.border}`,background:cardBg,color:textPrimary,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:10}}
        />

        {/* Mode filter chips */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:12}}>
          {["all",...allModes].map(m=>(
            <button key={m} className="nb-btn" onClick={()=>setFilterMode(m)} style={{
              padding:"5px 12px",borderRadius:20,border:`1px solid ${filterMode===m?(MODE_COLORS[m]??"#6366f1"):borderSofter}`,
              background:filterMode===m?`${MODE_COLORS[m]??"#6366f1"}18`:chipUnselectedBg,
              color:filterMode===m?(MODE_COLORS[m]??"#818cf8"):textMuted,
              fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,
            }}>
              {m==="all"?t("allLabel","All"):m}
            </button>
          ))}
        </div>

        {loading&&(
          <div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}>
            <div style={{width:28,height:28,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          </div>
        )}

        {!loading&&filtered.length===0&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",gap:10}}>
            <span style={{fontSize:48,opacity:.3}}>📓</span>
            <div style={{color:textMuted,fontSize:15,fontWeight:600}}>{search?t("noMatchesFound","No matches found"):t("notebookEmpty","Notebook is empty")}</div>
            <div style={{color:textMuted,fontSize:13,textAlign:"center"}}>{t("saveAnswersDesc","Save answers from Ask AI Guru to see them here")}</div>
            <Link href="/ai-guru/ask" style={{marginTop:8,padding:"10px 20px",borderRadius:12,background:"#6366f1",color:"#fff",fontSize:13,fontWeight:700,textDecoration:"none"}}>{t("goAskSomething","Go Ask Something")}</Link>
          </div>
        )}

        {filtered.map(entry=>{
          const accentColor = MODE_COLORS[entry.mode]??"#6366f1";
          const isExpanded  = expanded===entry.id;
          return(
            <div key={entry.id} style={{marginBottom:12,borderRadius:18,border:`1px solid ${isExpanded?accentColor+"50":borderSoft}`,background:cardBg,overflow:"hidden",transition:"border-color 0.2s"}}>
              {/* Card header */}
              <div style={{padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:10}}>
                {/* Mode dot */}
                <div style={{width:10,height:10,borderRadius:"50%",background:accentColor,flexShrink:0,marginTop:5}}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <span style={{color:accentColor,fontSize:10,fontWeight:800,textTransform:"uppercase"}}>{entry.mode}</span>
                    {entry.pinned&&<span style={{color:"#fbbf24",fontSize:10}}>{t("pinnedLabel","📌 Pinned")}</span>}
                    <span style={{color:textMuted,fontSize:10,marginLeft:"auto"}}>{relTime(entry.createdAt,t)}</span>
                  </div>
                  <div style={{color:textPrimary,fontSize:14,fontWeight:700,lineHeight:1.4,cursor:"pointer"}} onClick={()=>setExpanded(isExpanded?null:entry.id)}>
                    {entry.question}
                  </div>
                  {!isExpanded&&(
                    <div style={{color:textMuted,fontSize:12,marginTop:4,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                      {entry.answer}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded answer */}
              {isExpanded&&(
                <div style={{padding:"0 16px 14px 36px"}}>
                  <div style={{color:textPrimary,fontSize:14,lineHeight:1.75,whiteSpace:"pre-wrap",borderTop:`1px solid ${borderSoft}`,paddingTop:12}}>
                    {entry.answer}
                  </div>
                </div>
              )}

              {/* Footer actions */}
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",borderTop:`1px solid ${borderSofter}`}}>
                <button className="nb-btn" onClick={()=>setExpanded(isExpanded?null:entry.id)} style={{fontSize:11,color:colors.accent,fontWeight:700,background:"none",border:"none",padding:"4px 8px"}}>
                  {isExpanded?t("collapseLabel","▲ Collapse"):t("expandLabel","▼ Expand")}
                </button>
                <div style={{flex:1}}/>
                <button className="nb-btn" onClick={()=>handlePin(entry)} style={{fontSize:11,color:entry.pinned?"#fbbf24":textMuted,fontWeight:700,background:"none",border:"none",padding:"4px 8px"}}>
                  {entry.pinned?t("unpinLabel","📌 Unpin"):t("pinLabel","📌 Pin")}
                </button>
                <button className="nb-btn" onClick={()=>handleDelete(entry)} style={{fontSize:11,color:"#ef4444",fontWeight:700,background:"none",border:"none",padding:"4px 8px"}}>
                  {t("deleteLabel2","🗑 Delete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}