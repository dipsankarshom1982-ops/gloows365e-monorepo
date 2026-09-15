"use client";
// PATH: apps/web/src/app/(app)/ai-guru/ask/page.tsx
//
// REBUILD: this screen used to be functionally redundant with
// /ai-guru/skillguru — both were "type a question, get an AI answer"
// experiences, and this screen's own "limit reached" state even linked to
// SkillGuru as an alternative ("🤖 Chat with SkillGuru instead"),
// underlining the overlap. The split is now: SkillGuru is the ongoing,
// multi-turn conversational skills coach (has memory, follow-ups,
// persisted history); Ask is a single-shot lookup tool — type a query,
// get one direct answer, search again. No conversation, no memory
// between searches, by design — that's SkillGuru's job now.
//
// Built to feel like a search engine scoped to education, skills, and
// general knowledge: a centered search box on first load (no results
// yet), filter pills for query intent (the same 7 modes the backend's
// `mode` param already branches on — kept, not dropped, just restyled as
// search-engine-style tabs), and a featured-snippet-style answer card
// once you search. The search box itself shrinks to the top once a result
// exists, the same transform a real search engine does after your first
// query.
//
// NOT changed: askQuestion()'s payload/endpoint (still /askAiGuruQuestion,
// same {question, classLevel, board, mode} shape) and saveToNotebook()
// (still aiNotebook/{uid}/entries) — those were working correctly before;
// only the UI built around them changed.
//
// Related searches removed per request — the getRelatedSearches module
// (lib/aiGuru/relatedSearches.ts) is untouched since SkillGuru still
// uses it. The pre-search "TRY SEARCHING FOR" rail (a generic curated
// sample shown on the landing state) was already removed earlier —
// mirrors mobile's app/ai-guru/ask.tsx.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useStudentProfile } from "@gloows/shared-logic";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { subscribeToCreditBalance } from "@/services/aiGuruCreditsService";

const CF_URL = process.env.NEXT_PUBLIC_CLOUD_FUNCTION_URL ?? "";

type ModeKey = "explain"|"notes"|"exam"|"doubt"|"summarize"|"tip"|"language";
type ResultState = "idle"|"loading"|"found"|"limit"|"error";
interface ModeChip { key:ModeKey; label:string; emoji:string; color:string; hint:string; sample:string; }

const LANGUAGE_EXAMPLES = [
  { lang:"Bengali",   text:"নিউটনের তৃতীয় সূত্রটা বুঝিয়ে দাও।" },
  { lang:"Hindi",     text:"प्रकाश संश्लेषण क्या होता है?" },
  { lang:"Tamil",     text:"ஒளிச்சேர்க்கை என்றால் என்ன?" },
  { lang:"Telugu",    text:"కిరణజన్య సంయోగక్రియ అంటే ఏమిటి?" },
  { lang:"Marathi",   text:"प्रकाशसंश्लेषण म्हणजे काय?" },
  { lang:"Gujarati",  text:"પ્રકાશસંશ્લેષણ શું છે?" },
  { lang:"Assamese",  text:"পোহৰ সংশ্লেষণ কি?" },
  { lang:"Odia",      text:"ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?" },
  { lang:"Malayalam", text:"ഒരു ലഘുലേഖ തരൂ." },
  { lang:"Kannada",   text:"ಬೆಳಕಿನ ಸಂಶ್ಲೇಷಣೆ ಎಂದರೇನು?" },
  { lang:"Punjabi",   text:"ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਕੀ ਹੈ?" },
  { lang:"Urdu",      text:"روشنی ترکیب کیا ہے؟" },
];

async function askQuestion(payload:{question:string;classLevel:string;board:string;mode:string}) {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");
  const resp = await fetch(`${CF_URL}/askAiGuruQuestion`,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
    body:JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok){
    const e:any=new Error(data.error??"failed");e.code=data.code??"UNKNOWN";
    if (data.creditBalance   !== undefined) e.creditBalance   = data.creditBalance;
    if (data.creditsRequired !== undefined) e.creditsRequired = data.creditsRequired;
    throw e;
  }
  return data as {answer:string};
}

async function saveToNotebook(entry:{question:string;answer:string;mode:string;modeLabel:string}) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  const ref = await addDoc(collection(getFirestore(),"aiNotebook",uid,"entries"),{...entry,pinned:false,createdAt:serverTimestamp()});
  return ref.id;
}

export default function AskAiGuruPage() {
  const { studentProfile } = useStudentProfile();
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const studentClass = String(studentProfile?.class ?? "10");
  const board        = (studentProfile?.board as string) ?? "CBSE";

  // Page chrome — search box, mode chips, results card, plain text — all
  // follow the theme. Mode-identity colors (chip.color, e.g. #6366f1 for
  // "Quick Answer") and small branded gradients (the avatar orb, the send
  // button) stay fixed in both themes, same as the colorful feature cards
  // on the hub page — that's intentional, not a theming gap.
  const pageBg        = colors.background;
  const surfaceBg      = isDarkMode ? "#1e293b" : colors.card;
  const borderSoft      = isDarkMode ? "rgba(255,255,255,0.12)" : colors.border;
  const borderSofter    = isDarkMode ? "rgba(255,255,255,0.08)" : colors.border;
  const borderSoftest   = isDarkMode ? "rgba(255,255,255,0.06)" : colors.border;
  const chipUnselectedBg = isDarkMode ? "rgba(255,255,255,0.03)" : colors.card;
  const iconMuted       = colors.textSecondary;
  const textPrimary     = colors.text;
  const textMuted       = colors.textSecondary;

  const CHIPS:ModeChip[] = useMemo(()=>[
    {key:"doubt",    label:t("modeDoubt","Quick Answer"),          emoji:"🔍",color:"#6366f1",hint:t("modeDoubtHint","Search anything…"),      sample:"Why does ice float on water?"},
    {key:"explain",  label:t("modeExplain","Explain"),             emoji:"📝",color:"#0284c7",hint:t("modeExplainHint","Explain a concept…"),   sample:"Explain Newton's Third Law of Motion"},
    {key:"notes",    label:t("modeNotes","Notes"),                 emoji:"🗒️",color:"#059669",hint:t("modeNotesHint","Make notes on…"),         sample:"Make notes on the French Revolution"},
    {key:"exam",     label:t("modeExam","Exam Prep"),              emoji:"🎯",color:"#dc2626",hint:t("modeExamHint","Help me prepare for…"),    sample:"Help me prepare for the Chapter 3 Science exam"},
    {key:"summarize",label:t("modeSummarize","Summarize"),         emoji:"📖",color:"#d97706",hint:t("modeSummarizeHint","Summarize chapter…"), sample:"Summarize Chapter 5: Light – Reflection and Refraction"},
    {key:"tip",      label:t("modeTip","Study Tip"),                emoji:"💡",color:"#7c3aed",hint:t("modeTipHint","Give me a study tip for…"),sample:"Give me a study tip for Mathematics"},
    {key:"language", label:t("modeLanguage","My Language"),         emoji:"🌐",color:"#be185d",hint:"अपनी भाषा में • বাংলায় • ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ",  sample:"নিউটনের তৃতীয় সূত্রটা বুঝিয়ে দাও।"},
  ],[t]);

  const [query,      setQuery]      = useState("");
  const [activeMode, setActiveMode] = useState<ModeKey>("doubt");
  const [result,     setResult]     = useState<ResultState>("idle");
  const [answer,     setAnswer]     = useState("");
  const [askedQ,     setAskedQ]     = useState("");
  const [askedMode,  setAskedMode]  = useState<ModeKey>("doubt");
  const [errMsg,     setErrMsg]     = useState("");
  // Set only on a CREDITS_EXHAUSTED response — undefined keeps the
  // "limit" screen's plain pre-credits render.
  const [creditInfo, setCreditInfo] = useState<{ balance: number; required: number } | undefined>(undefined);
  const [saving,     setSaving]     = useState(false);
  const [savedId,    setSavedId]    = useState<string|null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const chip = CHIPS.find(c=>c.key===activeMode)!;
  const aChip = CHIPS.find(c=>c.key===askedMode)!;
  const hasSearched = result !== "idle";

  // Credit balance — replaces the old "X/1" badge below, which was built
  // entirely around the removed FREE_DAILY_ASK=1 client constant and
  // never reflected the server's real count.
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    return subscribeToCreditBalance(uid, setCreditBalance);
  }, []);

  async function runSearch(text?: string, mode?: ModeKey) {
    const q = (text ?? query).trim();
    const m = mode ?? activeMode;
    if (!q || result === "loading") return;
    // FIX: this used to hard-block after 1 question via a client-side
    // FREE_DAILY_ASK=1 constant that didn't match the server's real free
    // limit (5/day, functions/src/usageCheck.ts) — nobody could ever
    // reach the credits fallback. Removed; the server is the source of
    // truth. Mirrors apps/mobile/app/ai-guru/ask.tsx's identical fix.
    if (mode) setActiveMode(mode);
    setQuery(q);
    setAskedQ(q); setAskedMode(m); setResult("loading"); setAnswer(""); setErrMsg(""); setSavedId(null);
    try {
      const d = await askQuestion({ question: q, classLevel: studentClass, board, mode: m });
      setAnswer(d.answer); setResult("found");
    } catch (e: any) {
      if (e?.code === "CREDITS_EXHAUSTED") {
        setCreditInfo({ balance: e.creditBalance ?? 0, required: e.creditsRequired ?? 1 });
        setResult("limit");
      } else if (e?.code === "LIMIT_REACHED") {
        setCreditInfo(undefined);
        setResult("limit");
      } else {
        setErrMsg(e?.message ?? t("somethingWentWrong","Something went wrong")); setResult("error");
      }
    }
  }

  async function handleSave(){
    if(!answer||saving)return; setSaving(true);
    try{
      const id=await saveToNotebook({question:askedQ,answer,mode:askedMode,modeLabel:`${aChip.emoji} ${aChip.label}`});
      setSavedId(id);
    }catch(e:any){alert(e?.message??t("couldNotSave","Could not save"));}
    finally{setSaving(false);}
  }

  function newSearch(){
    setQuery("");setResult("idle");setAnswer("");setAskedQ("");setErrMsg("");setSavedId(null);
    setTimeout(()=>taRef.current?.focus(),100);
  }

  function selectMode(k:ModeKey){
    setActiveMode(k);
    // Switching mode mid-result re-runs the same query under the new
    // mode, matching what a search-engine category tab does (re-filter
    // the same search) rather than discarding the query.
    if (hasSearched && askedQ) runSearch(askedQ, k);
  }

  const canSend = query.trim().length > 0 && result !== "loading";

  return (
    <div style={{ minHeight: "100dvh", background: pageBg, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .ask-scr-btn{cursor:pointer}
        .ask-scr-btn:hover{opacity:.85}
        textarea{resize:none;font-family:inherit}
        textarea::placeholder{color:${textMuted}}
      `}</style>

      {/* Top bar — always present, but minimal until a search has happened */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 8, flexShrink: 0 }}>
        <Link href="/ai-guru" style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(255,255,255,0.08)" : colors.card, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: textMuted, fontSize: 20, fontWeight: 900 }}>‹</Link>
        {hasSearched && (
          <span style={{ flex: 1, color: textPrimary, fontSize: 16, fontWeight: 800 }}>{t("askAiGuruTitle","Ask AI Guru")}</span>
        )}
        {!!creditBalance && (
          <Link href="/ai-guru/credits" style={{ marginLeft: hasSearched ? 0 : "auto", display: "flex", alignItems: "center", gap: 5, background: "linear-gradient(90deg,#4f46e5,#7c3aed)", borderRadius: 20, padding: "5px 10px", textDecoration: "none" }}>
            <span style={{ fontSize: 11 }}>⚡</span>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>{creditBalance}</span>
          </Link>
        )}
        <Link href="/ai-guru/notebook" style={{ display: "flex", alignItems: "center", gap: 5, background: isDarkMode ? "rgba(255,255,255,0.06)" : colors.card, border: `1px solid ${borderSoft}`, borderRadius: 20, padding: "5px 10px", textDecoration: "none" }}>
          <span style={{ fontSize: 14 }}>📓</span>
          {hasSearched && <span style={{ color: colors.accent, fontSize: 11, fontWeight: 700 }}>{t("notebook","Notebook")}</span>}
        </Link>
      </div>

      {/* ── LANDING STATE: centered search box, search-engine-homepage style ── */}
      {!hasSearched && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 20px 60px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 18, boxShadow: "0 0 40px rgba(99,102,241,0.35)" }}>🤖</div>
          <div style={{ color: textPrimary, fontSize: 28, fontWeight: 900, marginBottom: 6, textAlign: "center" }}>{t("askAiGuruTitle","Ask AI Guru")}</div>
          <div style={{ color: textMuted, fontSize: 14, marginBottom: 28, textAlign: "center", maxWidth: 360 }}>
            {t("askAiGuruTagline","Search anything about your studies, skills, or general knowledge")}
          </div>

          {/* Search box */}
          <div style={{ width: "100%", maxWidth: 560 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: surfaceBg, border: `1.5px solid ${canSend ? chip.color : borderSoft}`, borderRadius: 30, padding: "6px 8px 6px 20px", boxShadow: "0 4px 24px rgba(0,0,0,0.3)", transition: "border-color 0.2s" }}>
              <span style={{ fontSize: 17, color: textMuted }}>🔍</span>
              <textarea ref={taRef} value={query} onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();runSearch();}}}
                placeholder={chip.hint} rows={1} maxLength={300} autoFocus
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: textPrimary, fontSize: 16, lineHeight: 1.5, padding: "10px 4px" }}
              />
              <button className="ask-scr-btn" onClick={() => runSearch()} disabled={!canSend} style={{ width: 42, height: 42, borderRadius: 21, border: "none", background: canSend ? `linear-gradient(135deg,${chip.color},${chip.color}cc)` : (isDarkMode ? "rgba(255,255,255,0.05)" : colors.card), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: canSend ? 1 : 0.4 }}>
                <span style={{ color: "#fff", fontSize: 16 }}>→</span>
              </button>
            </div>

            {/* Mode pills — search-engine category-tab styling */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 14, paddingBottom: 4 }}>
              {CHIPS.map(c=>(
                <button key={c.key} className="ask-scr-btn" onClick={()=>selectMode(c.key)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 20, border: `1px solid ${activeMode===c.key?c.color:borderSoft}`, background: activeMode===c.key?`${c.color}18`:"transparent", whiteSpace: "nowrap", flexShrink: 0 }}>
                  <span style={{ fontSize: 13 }}>{c.emoji}</span>
                  <span style={{ color: activeMode===c.key?c.color:textMuted, fontSize: 12, fontWeight: 700 }}>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Language examples — only for the "My Language" mode */}
            {activeMode==="language" && (
              <div style={{ borderRadius: 16, border: "1px solid #be185d", background: isDarkMode ? "rgba(190,24,93,0.08)" : "rgba(190,24,93,0.06)", padding: 14, marginTop: 12 }}>
                <div style={{ color: "#f9a8d4", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🌐 {t("writeInYourLanguage","Write in your language — AI answers in the same language")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {LANGUAGE_EXAMPLES.map(ex=>(
                    <button key={ex.lang} className="ask-scr-btn" onClick={()=>runSearch(ex.text)} style={{ borderRadius: 10, border: `1px solid ${borderSofter}`, background: isDarkMode ? "rgba(255,255,255,0.04)" : colors.card, padding: "6px 10px", textAlign: "left" }}>
                      <div style={{ color: "#be185d", fontSize: 10, fontWeight: 800, marginBottom: 2 }}>{ex.lang}</div>
                      <div style={{ color: textMuted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.text}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── RESULTS STATE: search box shrinks to top, answer renders as a featured-snippet card ── */}
      {hasSearched && (
        <>
          <div style={{ padding: "0 16px 10px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: surfaceBg, border: `1.5px solid ${canSend?chip.color:borderSoft}`, borderRadius: 26, padding: "4px 6px 4px 16px" }}>
              <span style={{ fontSize: 15, color: textMuted }}>🔍</span>
              <textarea ref={taRef} value={query} onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();runSearch();}}}
                placeholder={chip.hint} rows={1} maxLength={300}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: textPrimary, fontSize: 14, lineHeight: 1.5, padding: "8px 4px" }}
              />
              <button className="ask-scr-btn" onClick={() => runSearch()} disabled={!canSend} style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: canSend ? `linear-gradient(135deg,${chip.color},${chip.color}cc)` : (isDarkMode ? "rgba(255,255,255,0.05)" : colors.card), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: canSend ? 1 : 0.4 }}>
                <span style={{ color: "#fff", fontSize: 14 }}>→</span>
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
              {CHIPS.map(c=>(
                <button key={c.key} className="ask-scr-btn" onClick={()=>selectMode(c.key)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 20, border: `1px solid ${activeMode===c.key?c.color:borderSofter}`, background: activeMode===c.key?`${c.color}18`:chipUnselectedBg, whiteSpace: "nowrap", flexShrink: 0 }}>
                  <span style={{ fontSize: 12 }}>{c.emoji}</span>
                  <span style={{ color: activeMode===c.key?c.color:textMuted, fontSize: 10, fontWeight: 700 }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 32px" }}>
            {result==="loading"&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 0",gap:16}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:`linear-gradient(135deg,${chip.color},${chip.color}cc)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:28,height:28,border:"3px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                </div>
                <div style={{color:textPrimary,fontSize:18,fontWeight:800}}>{t("searching","Searching…")}</div>
                <div style={{color:textMuted,fontSize:13,textAlign:"center",fontStyle:"italic",maxWidth:280}}>"{askedQ}"</div>
              </div>
            )}

            {result==="found"&&(
              <div style={{display:"flex",flexDirection:"column",gap:12,paddingTop:6}}>
                <div style={{ color: textMuted, fontSize: 13, lineHeight: 1.4 }}>
                  {t("resultsFor","Results for")} <span style={{ color: textPrimary, fontWeight: 700 }}>"{askedQ}"</span>
                </div>

                {/* Featured-snippet-style answer card */}
                <div style={{borderRadius:18,border:`1px solid ${aChip.color}40`,background:surfaceBg,padding:18,display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:16,background:`linear-gradient(135deg,${aChip.color},${aChip.color}cc)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{color:"#fff",fontSize:14}}>{aChip.emoji}</span>
                    </div>
                    <span style={{color:aChip.color,fontSize:12,fontWeight:800}}>{aChip.label} · {t("aiGuru","AI Guru")}</span>
                  </div>
                  <div style={{color:textPrimary,fontSize:15,lineHeight:1.75,whiteSpace:"pre-wrap"}}>{answer}</div>
                  <div style={{height:1,background:borderSoftest}}/>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button className="ask-scr-btn" onClick={handleSave} disabled={saving||!!savedId} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 0",borderRadius:12,border:`1px solid ${savedId?"#10b981":colors.accent}`,background:savedId?"rgba(16,185,129,0.12)":`${colors.accent}1f`,color:savedId?"#10b981":colors.accent,fontSize:12,fontWeight:700}}>
                      {saving?"⏳":savedId?"✓":"📌"} {savedId?t("savedToNotebook","Saved to Notebook"):saving?t("saving","Saving…"):t("saveToNotebook","Save to Notebook")}
                    </button>
                    <Link href="/ai-guru/notebook" style={{display:"flex",alignItems:"center",gap:5,padding:"10px 12px",borderRadius:12,border:`1px solid ${borderSofter}`,color:textMuted,fontSize:12,fontWeight:600,textDecoration:"none"}}>📓 {t("viewNotebook","View Notebook")}</Link>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Link href="/ai-guru/setup" style={{flex:1,padding:"10px 0",borderRadius:12,border:"1px solid #6366f1",background:"rgba(99,102,241,0.1)",color:"#818cf8",fontSize:12,fontWeight:700,textAlign:"center",textDecoration:"none"}}>{t("generateFullLessonAction","✨ Generate Full Lesson")}</Link>
                    <Link href="/ai-guru/exam-simulator" style={{flex:1,padding:"10px 0",borderRadius:12,border:"1px solid #dc2626",background:"rgba(220,38,38,0.1)",color:"#f87171",fontSize:12,fontWeight:700,textAlign:"center",textDecoration:"none"}}>🎯 {t("practiceExam","Practice Exam")}</Link>
                  </div>
                </div>

                <button className="ask-scr-btn" onClick={newSearch} style={{display:"flex",alignItems:"center",gap:6,alignSelf:"center",background:"none",border:"none",color:colors.accent,fontSize:14,fontWeight:600,padding:"10px 0",marginTop:4}}>🔄 {t("newSearch","New search")}</button>
              </div>
            )}

            {result==="limit"&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 0",gap:16}}>
                <span style={{fontSize:52}}>⏰</span>
                <div style={{color:textPrimary,fontSize:19,fontWeight:800,textAlign:"center"}}>{t("dailyLimitTitle","Daily limit reached")}</div>
                <div style={{color:textMuted,fontSize:13,textAlign:"center",maxWidth:280,lineHeight:1.6}}>
                  {creditInfo
                    ? `You've used today's free questions. You have ${creditInfo.balance} credit${creditInfo.balance===1?"":"s"} — buy more or upgrade to Premium.`
                    : t("dailyLimitMessage","You've used your free questions for today. Come back tomorrow or upgrade to Premium.")}
                </div>
                <Link href={creditInfo ? "/ai-guru/credits" : "/ai-guru/subscription"} style={{width:"100%",maxWidth:320,padding:"15px 0",borderRadius:16,background:"linear-gradient(90deg,#312e81,#4f46e5)",color:"#fff",fontSize:15,fontWeight:800,textAlign:"center",textDecoration:"none",display:"block"}}>
                  {creditInfo ? "⚡ Buy Credits" : `✨ ${t("upgradeToPremium","Upgrade to Premium")}`}
                </Link>
                {creditInfo && (
                  <Link href="/ai-guru/subscription" style={{color:"#a5b4fc",fontSize:12,textDecoration:"none"}}>
                    Or upgrade to Premium for unlimited access
                  </Link>
                )}
                {/* NOTE: no longer links to SkillGuru as an alternative —
                    that cross-link was a symptom of the redundancy this
                    rebuild removes. The two tools now have distinct
                    purposes, so "out of searches" isn't a reason to push
                    someone toward the skills-coach chat instead. */}
              </div>
            )}

            {result==="error"&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 0",gap:16}}>
                <span style={{fontSize:42}}>⚠️</span>
                <div style={{color:textPrimary,fontSize:19,fontWeight:800}}>{t("somethingWentWrong","Something went wrong")}</div>
                <div style={{color:textMuted,fontSize:13}}>{errMsg}</div>
                <button className="ask-scr-btn" onClick={()=>runSearch(askedQ,askedMode)} style={{padding:"12px 28px",borderRadius:12,border:`1px solid ${borderSoft}`,background:"none",color:colors.accent,fontSize:14,fontWeight:700}}>{t("tryAgainLabel","Try again")}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}