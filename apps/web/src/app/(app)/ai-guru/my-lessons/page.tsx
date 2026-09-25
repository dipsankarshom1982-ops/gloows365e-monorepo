"use client";
// PATH: apps/web/src/app/(app)/ai-guru/my-lessons/page.tsx
// My Lessons — mirror of mobile app/ai-guru/my-lessons.tsx
// Lists all AI-generated lessons with status, progress bar, subject icon, resume button

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useAppTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

interface AiGuruLesson {
  id:string; subject:string; classLevel:string; chapter:string; topic?:string;
  language:string; lessonStyle:string; status:"generating"|"completed"|"failed";
  progress:number; createdAt:any; board?:string; difficulty?:string;
}

const SUBJECT_ICONS:Record<string,string> = {
  Computer:"💻", Science:"🔬", Math:"🔢", English:"📖",
  "Social Science":"🌍", Hindi:"🇮🇳", Bengali:"🅱️", Other:"📚",
};

// FEATURE: refactored to take t as a parameter — this is a standalone
// helper function (not a component/hook), so it can't call useAppTranslation()
// itself; the caller (the component body, which does have access) passes
// its t down here instead.
function relTime(ts:any, t:(key:string, fallback?:string, values?:Record<string,unknown>)=>string):string {
  if(!ts)return "";
  const ms=(ts?.toMillis?.()??((ts?.seconds??0)*1000));
  const d=Math.floor((Date.now()-ms)/86400000);
  if(d===0)return t("todayLabel","Today");
  if(d===1)return t("yesterdayLabel","Yesterday");
  return t("daysAgoLabel",`${d}d ago`,{count:d});
}

export default function MyLessonsPage() {
  const { t } = useAppTranslation();
  const { colors, isDarkMode } = useTheme();
  const [lessons,    setLessons]    = useState<AiGuruLesson[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLessons = useCallback(async(silent=false)=>{
    const uid=getAuth().currentUser?.uid; if(!uid){setLoading(false);return;}
    if(!silent)setLoading(true);
    try{
      const snap=await getDocs(query(collection(getFirestore(),"aiGuruLessons"),where("uid","==",uid),orderBy("createdAt","desc")));
      setLessons(snap.docs.map(d=>({id:d.id,...d.data()}as AiGuruLesson)));
    }catch{}
    setLoading(false); setRefreshing(false);
  },[]);

  useEffect(()=>{fetchLessons();},[fetchLessons]);

  // Page chrome — header, lesson list cards, empty/loading states —
  // follows the theme. The subject icon tile keeps its fixed indigo
  // gradient, matching the same treatment elsewhere in AI Guru.
  const cardBg     = isDarkMode ? "#1e293b" : colors.card;
  const borderSoft  = isDarkMode ? "rgba(255,255,255,0.06)" : colors.border;
  const textPrimary = colors.text;
  const textMuted   = colors.textSecondary;

  return(
    <div style={{minHeight:"100dvh",background:isDarkMode?"#060612":colors.background,paddingBottom:40}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .ml-btn{cursor:pointer}.ml-btn:hover{opacity:.8}`}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",padding:"12px 16px",gap:8,borderBottom:`1px solid ${borderSoft}`,background:isDarkMode?"rgba(6,6,18,0.98)":"rgba(255,255,255,0.95)",position:"sticky",top:0,zIndex:10}}>
        <Link href="/ai-guru" style={{width:40,height:40,borderRadius:12,background:isDarkMode?"rgba(255,255,255,0.08)":colors.card,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:textMuted,fontSize:20,fontWeight:900}}>‹</Link>
        <span style={{flex:1,color:textPrimary,fontSize:18,fontWeight:900}}>📚 {t("myLessonsTitle","My Lessons")}</span>
        <button className="ml-btn" onClick={()=>{setRefreshing(true);fetchLessons(true);}} style={{background:"none",border:"none",color:colors.accent,fontSize:20,padding:"4px 8px"}}>↻</button>
        <Link href="/ai-guru/setup" style={{padding:"7px 14px",borderRadius:20,background:"#6366f1",color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none"}}>{t("newLesson","+ New Lesson")}</Link>
      </div>

      <div style={{padding:"12px 16px"}}>
        {(loading||refreshing)&&(
          <div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}>
            <div style={{width:28,height:28,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          </div>
        )}

        {!loading&&lessons.length===0&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",gap:12}}>
            <span style={{fontSize:52,opacity:.3}}>📚</span>
            <div style={{color:textMuted,fontSize:16,fontWeight:700}}>{t("noLessonsYet","No lessons yet")}</div>
            <div style={{color:textMuted,fontSize:13,textAlign:"center",maxWidth:260}}>{t("generateFirstLessonDesc","Generate your first AI-powered lesson and it will appear here.")}</div>
            <Link href="/ai-guru/setup" style={{marginTop:8,padding:"12px 24px",borderRadius:14,background:"#6366f1",color:"#fff",fontSize:14,fontWeight:700,textDecoration:"none"}}>{t("generateALesson","✨ Generate a Lesson")}</Link>
          </div>
        )}

        {!loading&&lessons.map(item=>{
          const icon      = SUBJECT_ICONS[item.subject]??"📚";
          const pct       = item.progress??0;
          const completed = item.status==="completed";
          const failed    = item.status==="failed";
          return(
            <Link key={item.id} href={completed?`/ai-guru/player?lessonId=${item.id}`:"#"} style={{display:"block",textDecoration:"none",marginBottom:12,borderRadius:18,border:`1px solid ${borderSoft}`,background:cardBg,overflow:"hidden",cursor:completed?"pointer":"default"}}>
              <div style={{display:"flex",alignItems:"center",padding:16,gap:12}}>
                {/* Subject icon */}
                <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#1e1b4b,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>
                  {icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:textMuted,fontSize:11,fontWeight:700,marginBottom:2}}>
                    {item.subject} · {t("classLabel","Class")} {item.classLevel} · {item.board??""}
                  </div>
                  <div style={{color:textPrimary,fontSize:14,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {item.chapter}
                  </div>
                  {item.topic&&<div style={{color:textMuted,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.topic}</div>}
                  <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                    <span style={{background:"rgba(99,102,241,0.15)",borderRadius:20,padding:"2px 8px",color:"#818cf8",fontSize:10,fontWeight:700}}>{item.language}</span>
                    <span style={{background:isDarkMode?"rgba(255,255,255,0.06)":colors.border,borderRadius:20,padding:"2px 8px",color:textMuted,fontSize:10}}>{item.lessonStyle}</span>
                    {!completed&&(
                      <span style={{background:failed?"rgba(239,68,68,0.15)":"rgba(245,158,11,0.15)",borderRadius:20,padding:"2px 8px",color:failed?"#ef4444":"#f59e0b",fontSize:10,fontWeight:700}}>
                        {failed?t("failedLabel2","⚠️ Failed"):t("generatingLabel","⏳ Generating")}
                      </span>
                    )}
                  </div>
                  {completed&&(
                    <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,height:4,background:isDarkMode?"rgba(255,255,255,0.1)":colors.border,borderRadius:4,overflow:"hidden"}}>
                        <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#6366f1,#a78bfa)",borderRadius:4}}/>
                      </div>
                      <span style={{color:"#6366f1",fontSize:10,fontWeight:700}}>{pct}%</span>
                    </div>
                  )}
                </div>
                {completed&&(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                    <span style={{color:textMuted,fontSize:10}}>{relTime(item.createdAt,t)}</span>
                    <div style={{display:"flex",alignItems:"center",gap:4,color:"#6366f1",fontSize:12,fontWeight:700}}>{t("resumeLabel","Resume ›")}</div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}