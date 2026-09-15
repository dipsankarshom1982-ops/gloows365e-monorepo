import { collection, getDocs } from "firebase/firestore";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";

// Student-submitted feature ratings + free-text suggestions (Settings →
// Feedback & Ratings, web + mobile). Read-only — same posture as
// Grievances.tsx/Waitlist.tsx toward inbound user data, no edit/delete.
// The rateable-feature list itself is managed at /feedback-features.

interface FeedbackDoc {
  id: string;          // == userId
  userId: string;
  ratings: Record<string, number>;
  suggestion: string;
  updatedAt?: { toDate?: () => Date };
}

interface Feature { id: string; name: string; icon?: string; order: number; }
interface Student { name?: string; email?: string; }

function formatDate(ts?: { toDate?: () => Date }): string {
  return ts?.toDate ? ts.toDate().toLocaleDateString("en-IN") : "—";
}

export default function Feedback() {
  const [submissions, setSubmissions] = useState<FeedbackDoc[]>([]);
  const [features, setFeatures]       = useState<Record<string, Feature>>({});
  const [featureOrder, setFeatureOrder] = useState<string[]>([]);
  const [students, setStudents]       = useState<Record<string, Student>>({});
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      const [feedbackSnap, featuresSnap, studentsSnap] = await Promise.all([
        getDocs(collection(db, "feedback")),
        getDocs(collection(db, "feedbackFeatures")),
        getDocs(collection(db, "students")),
      ]);

      setSubmissions(feedbackSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackDoc)));

      const featMap: Record<string, Feature> = {};
      featuresSnap.docs.forEach((d) => { featMap[d.id] = { id: d.id, ...d.data() } as Feature; });
      setFeatures(featMap);
      setFeatureOrder(Object.values(featMap).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => f.id));

      const studentMap: Record<string, Student> = {};
      studentsSnap.docs.forEach((d) => { studentMap[d.id] = d.data() as Student; });
      setStudents(studentMap);

      setLoading(false);
    })();
  }, []);

  // Per-feature average + count — a single client-side reduce over the
  // fetched submissions (this app's admin pages never paginate; same scale
  // as Waitlist.tsx's client-side filtering).
  const analytics = useMemo(() => {
    const sums: Record<string, { sum: number; count: number }> = {};
    submissions.forEach((s) => {
      Object.entries(s.ratings ?? {}).forEach(([featureId, stars]) => {
        if (!sums[featureId]) sums[featureId] = { sum: 0, count: 0 };
        sums[featureId].sum += stars;
        sums[featureId].count += 1;
      });
    });
    // Known features in admin order, then any orphaned (deleted) feature
    // IDs that still appear in submissions, appended at the end.
    const orphanIds = Object.keys(sums).filter((id) => !features[id]);
    const orderedIds = [...featureOrder, ...orphanIds];
    return orderedIds
      .filter((id) => sums[id])
      .map((id) => ({
        id,
        name: features[id]?.name ?? "(deleted feature)",
        icon: features[id]?.icon ?? "❓",
        avg: sums[id].sum / sums[id].count,
        count: sums[id].count,
      }));
  }, [submissions, features, featureOrder]);

  const featureLabel = (id: string) => features[id]
    ? `${features[id].icon ? features[id].icon + " " : ""}${features[id].name}`
    : "(deleted feature)";

  const studentLabel = (uid: string) => {
    const s = students[uid];
    if (!s) return uid;
    return s.name ?? s.email ?? uid;
  };

  const sorted = [...submissions].sort((a, b) => {
    const ta = a.updatedAt?.toDate?.()?.getTime() ?? 0;
    const tb = b.updatedAt?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">💬 Feedback</h1>
          <p className="text-slate-400 text-sm mt-1">{submissions.length} submission(s)</p>
        </div>
        <Link to="/feedback-features" className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold">
          Manage Rateable Features →
        </Link>
      </div>

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">Loading…</div>
      ) : (
        <>
          {/* Analytics */}
          {analytics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analytics.map((a) => (
                <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-xl mb-1">{a.icon}</div>
                  <p className="text-white font-bold text-sm truncate">{a.name}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-amber-400 font-black text-lg">★ {a.avg.toFixed(1)}</span>
                    <span className="text-slate-500 text-xs">({a.count})</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submissions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {submissions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No feedback submitted yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="text-left p-4">Student</th>
                    <th className="text-left p-4">Ratings</th>
                    <th className="text-left p-4">Suggestion</th>
                    <th className="text-right p-4">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => (
                    <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors align-top">
                      <td className="p-4 text-white font-medium whitespace-nowrap">{studentLabel(s.userId)}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {Object.entries(s.ratings ?? {}).length === 0
                            ? <span className="text-slate-500 text-xs">—</span>
                            : Object.entries(s.ratings).map(([featureId, stars]) => (
                              <span key={featureId} className="bg-slate-800 text-amber-400 text-xs px-2 py-1 rounded-lg whitespace-nowrap">
                                ★{stars} {featureLabel(featureId)}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="p-4 text-slate-300 max-w-sm" title={s.suggestion}>
                        {s.suggestion ? (s.suggestion.length > 120 ? `${s.suggestion.slice(0, 120)}…` : s.suggestion) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="p-4 text-right text-slate-400 text-xs whitespace-nowrap">{formatDate(s.updatedAt)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
