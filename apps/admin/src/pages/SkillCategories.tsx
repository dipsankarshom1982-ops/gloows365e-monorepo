// PATH: apps/admin/src/pages/SkillCategories.tsx
//
// Phase 2B — Domain Foundation: minimum admin CRUD for the skill taxonomy
// (skillCategories → skills) the Phase 2A blueprint's §8 calls for.
// Deliberately mirrors AppModules.tsx's existing pattern (simple list +
// add form + toggle + inline edit) rather than inventing a new admin UI
// idiom — "the objective is functionality, not visual redesign."
//
// Write access is enforced server-side (firestore.rules: skillCategories/
// skills are admin-write-only, and a skill's categoryId is validated to
// reference a real category at write time) — canManage below only hides
// the management controls from non-admins, it isn't the security boundary.

import { useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import ToggleSwitch from "../components/ToggleSwitch";
import { useAuth } from "../context/AuthContext";

interface SkillCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  order: number;
}

interface Skill {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  isActive: boolean;
  order: number;
}

type Tab = "categories" | "skills";

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function SkillCategories() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canManage = isAdmin || isSuperAdmin;

  const [tab, setTab] = useState<Tab>("categories");
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "skillCategories")),
      getDocs(collection(db, "skills")),
    ]).then(([catSnap, skillSnap]) => {
      setCategories(
        catSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as SkillCategory))
          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      );
      setSkills(
        skillSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Skill))
          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      );
      setLoading(false);
    });
  }, []);

  const toggleCategoryActive = async (c: SkillCategory) => {
    await updateDoc(doc(db, "skillCategories", c.id), { isActive: !c.isActive });
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, isActive: !c.isActive } : x)));
  };
  const toggleSkillActive = async (s: Skill) => {
    await updateDoc(doc(db, "skills", s.id), { isActive: !s.isActive });
    setSkills((prev) => prev.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)));
  };
  const reorderCategory = async (c: SkillCategory, order: number) => {
    await updateDoc(doc(db, "skillCategories", c.id), { order });
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, order } : x)).sort((a, b) => a.order - b.order));
  };
  const reorderSkill = async (s: Skill, order: number) => {
    await updateDoc(doc(db, "skills", s.id), { order });
    setSkills((prev) => prev.map((x) => (x.id === s.id ? { ...x, order } : x)).sort((a, b) => a.order - b.order));
  };

  // ── Add/edit category ───────────────────────────────────────────────────
  const [catForm, setCatForm] = useState({ id: "", name: "", description: "", icon: "" });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  const startEditCategory = (c: SkillCategory) => {
    setEditingCatId(c.id);
    setCatForm({ id: c.id, name: c.name, description: c.description ?? "", icon: c.icon ?? "" });
  };
  const resetCatForm = () => { setEditingCatId(null); setCatForm({ id: "", name: "", description: "", icon: "" }); };

  const saveCategory = async () => {
    const name = catForm.name.trim();
    if (!name) return;
    setSavingCat(true);
    try {
      if (editingCatId) {
        await updateDoc(doc(db, "skillCategories", editingCatId), {
          name, description: catForm.description.trim(), icon: catForm.icon.trim(),
        });
        setCategories((prev) => prev.map((c) => (c.id === editingCatId ? { ...c, name, description: catForm.description, icon: catForm.icon } : c)));
      } else {
        const id = slugify(catForm.id || name);
        if (!id || categories.some((c) => c.id === id)) return;
        const order = categories.reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1;
        await setDoc(doc(db, "skillCategories", id), {
          name, description: catForm.description.trim(), icon: catForm.icon.trim(), isActive: true, order,
        });
        setCategories((prev) => [...prev, { id, name, description: catForm.description, icon: catForm.icon, isActive: true, order }]);
      }
      resetCatForm();
    } finally {
      setSavingCat(false);
    }
  };

  // ── Add/edit skill ──────────────────────────────────────────────────────
  const [skillForm, setSkillForm] = useState({ id: "", name: "", description: "", categoryId: "" });
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [savingSkill, setSavingSkill] = useState(false);

  const startEditSkill = (s: Skill) => {
    setEditingSkillId(s.id);
    setSkillForm({ id: s.id, name: s.name, description: s.description ?? "", categoryId: s.categoryId });
  };
  const resetSkillForm = () => { setEditingSkillId(null); setSkillForm({ id: "", name: "", description: "", categoryId: "" }); };

  const saveSkill = async () => {
    const name = skillForm.name.trim();
    const categoryId = skillForm.categoryId;
    if (!name || !categoryId) return;
    setSavingSkill(true);
    try {
      if (editingSkillId) {
        await updateDoc(doc(db, "skills", editingSkillId), {
          name, description: skillForm.description.trim(), categoryId,
        });
        setSkills((prev) => prev.map((s) => (s.id === editingSkillId ? { ...s, name, description: skillForm.description, categoryId } : s)));
      } else {
        const id = slugify(skillForm.id || name);
        if (!id || skills.some((s) => s.id === id)) return;
        const order = skills.reduce((max, s) => Math.max(max, s.order ?? 0), 0) + 1;
        // firestore.rules re-validates categoryId references a real
        // skillCategories doc — this dropdown just keeps the admin from
        // typing a bad one by hand, it isn't the actual guarantee.
        await setDoc(doc(db, "skills", id), {
          name, description: skillForm.description.trim(), categoryId, isActive: true, order,
        });
        setSkills((prev) => [...prev, { id, name, description: skillForm.description, categoryId, isActive: true, order }]);
      }
      resetSkillForm();
    } finally {
      setSavingSkill(false);
    }
  };

  if (loading) return <div className="text-center text-slate-400 py-16">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🎯 Skill Taxonomy</h1>
        <p className="text-slate-400 text-sm mt-1">
          {canManage
            ? "Manage the skill categories and skills every Skill Battle is tagged with."
            : "View-only — admin access required to manage."}
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-800">
        {(["categories", "skills"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-colors ${
              tab === t ? "bg-slate-900 text-white border border-b-0 border-slate-800" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "categories" ? "📂 Categories" : "🎯 Skills"}
          </button>
        ))}
      </div>

      {tab === "categories" && (
        <div className="space-y-4">
          {canManage && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <p className="text-slate-300 text-sm font-bold">{editingCatId ? "Edit category" : "Add category"}</p>
              <div className="grid sm:grid-cols-4 gap-3">
                {!editingCatId && (
                  <input
                    value={catForm.id}
                    onChange={(e) => setCatForm((f) => ({ ...f, id: e.target.value }))}
                    placeholder="id (optional, auto from name)"
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                )}
                <input
                  value={catForm.name}
                  onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name (e.g. Creative)"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  value={catForm.icon}
                  onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="Icon (emoji)"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  value={catForm.description}
                  onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveCategory}
                  disabled={savingCat || !catForm.name.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl"
                >
                  {savingCat ? "Saving…" : editingCatId ? "Save changes" : "Create category"}
                </button>
                {editingCatId && (
                  <button onClick={resetCatForm} className="text-slate-400 text-sm px-4 py-2">Cancel</button>
                )}
              </div>
            </div>
          )}

          {categories.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              No skill categories yet.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    {c.icon && <span className="text-2xl">{c.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold truncate">{c.name}</p>
                      {c.description && <p className="text-slate-400 text-xs truncate">{c.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <ToggleSwitch value={c.isActive} onChange={() => toggleCategoryActive(c)} label={c.isActive ? "Enabled" : "Disabled"} disabled={!canManage} />
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={c.order}
                          onChange={(e) => reorderCategory(c, Number(e.target.value))}
                          className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                        />
                        <button onClick={() => startEditCategory(c)} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">Edit</button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "skills" && (
        <div className="space-y-4">
          {canManage && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <p className="text-slate-300 text-sm font-bold">{editingSkillId ? "Edit skill" : "Add skill"}</p>
              <div className="grid sm:grid-cols-4 gap-3">
                {!editingSkillId && (
                  <input
                    value={skillForm.id}
                    onChange={(e) => setSkillForm((f) => ({ ...f, id: e.target.value }))}
                    placeholder="id (optional, auto from name)"
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                )}
                <input
                  value={skillForm.name}
                  onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name (e.g. Singing)"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <select
                  value={skillForm.categoryId}
                  onChange={(e) => setSkillForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>
                  ))}
                </select>
                <input
                  value={skillForm.description}
                  onChange={(e) => setSkillForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveSkill}
                  disabled={savingSkill || !skillForm.name.trim() || !skillForm.categoryId}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl"
                >
                  {savingSkill ? "Saving…" : editingSkillId ? "Save changes" : "Create skill"}
                </button>
                {editingSkillId && (
                  <button onClick={resetSkillForm} className="text-slate-400 text-sm px-4 py-2">Cancel</button>
                )}
              </div>
              {categories.length === 0 && (
                <p className="text-amber-400 text-xs">Create a category first — a skill must belong to one.</p>
              )}
            </div>
          )}

          {skills.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              No skills yet.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((s, i) => {
                const cat = categories.find((c) => c.id === s.categoryId);
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
                  >
                    <div>
                      <p className="text-white font-bold">{s.name}</p>
                      <p className="text-slate-500 text-xs">{cat ? `${cat.icon ?? ""} ${cat.name}` : "⚠️ unknown category"}</p>
                      {s.description && <p className="text-slate-400 text-xs mt-1 truncate">{s.description}</p>}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <ToggleSwitch value={s.isActive} onChange={() => toggleSkillActive(s)} label={s.isActive ? "Enabled" : "Disabled"} disabled={!canManage} />
                      {canManage && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={s.order}
                            onChange={(e) => reorderSkill(s, Number(e.target.value))}
                            className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                          />
                          <button onClick={() => startEditSkill(s)} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">Edit</button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
