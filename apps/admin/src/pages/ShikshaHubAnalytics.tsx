// PATH: apps/admin/src/pages/ShikshaHubAnalytics.tsx
// ShikshaHub admin analytics phase — a ShikshaHub-specific aggregate
// view. Every other ShikshaHub admin screen (TutorVerifications,
// TutorPayouts, TutorReviews, PayoutSettings) is a per-collection queue;
// nothing rolls the whole tutor economy up into one place. Mirrors
// PlatformAnalytics.tsx's own pattern exactly — KpiCard/ChartTooltip,
// recharts, client-side aggregation via a one-time getDocs per
// collection (same "point in time on load" convention that page already
// uses, no live listeners here either) — rather than inventing a new
// analytics approach for one feature area.

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import KpiCard from "../components/KpiCard";
import ChartTooltip from "../components/ChartTooltip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

const BOOKING_STATUS_LABEL: Record<string, string> = {
  requested: "Requested", accepted: "Accepted", declined: "Declined",
  cancelled: "Cancelled", completed: "Completed",
};

function last30Dates(): string[] {
  const now = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default function ShikshaHubAnalytics() {
  const [loading, setLoading] = useState(true);

  const [verifiedTutors, setVerifiedTutors] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [creditsRevenue, setCreditsRevenue] = useState(0);
  const [payoutsPaid, setPayoutsPaid] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  const [activityData, setActivityData] = useState<{ date: string; bookings: number; sessions: number }[]>([]);
  const [bookingStatusDist, setBookingStatusDist] = useState<{ name: string; value: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [tutorsSnap, bookingsSnap, sessionsSnap, ordersSnap, payoutsSnap] = await Promise.all([
        getDocs(collection(db, "tutors")),
        getDocs(collection(db, "bookings")),
        getDocs(collection(db, "instantHelpSessions")),
        getDocs(query(collection(db, "tutorCreditOrders"), where("status", "==", "paid"))),
        getDocs(query(collection(db, "payoutRequests"), where("status", "==", "paid"))),
      ]);

      // ── KPIs ──────────────────────────────────────────────────────────
      const tutors = tutorsSnap.docs.map((d) => d.data());
      setVerifiedTutors(tutors.filter((t) => t.verified === true).length);
      setTotalBookings(bookingsSnap.size);
      setTotalSessions(sessionsSnap.size);

      const revenuePaise = ordersSnap.docs.reduce((sum, d) => sum + (Number(d.data().amountPaise) || 0), 0);
      setCreditsRevenue(Math.round(revenuePaise / 100));

      const paidOut = payoutsSnap.docs.reduce((sum, d) => sum + (Number(d.data().payoutAmount) || 0), 0);
      setPayoutsPaid(paidOut);

      const rated = tutors.filter((t) => Number(t.ratingCount) > 0 && typeof t.ratingAverage === "number");
      setAvgRating(rated.length > 0 ? rated.reduce((sum, t) => sum + t.ratingAverage, 0) / rated.length : null);

      // ── Booking status distribution ──────────────────────────────────
      const statusCounts: Record<string, number> = {};
      bookingsSnap.docs.forEach((d) => {
        const status = String(d.data().status ?? "unknown");
        statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      });
      setBookingStatusDist(
        Object.entries(statusCounts).map(([status, value]) => ({ name: BOOKING_STATUS_LABEL[status] ?? status, value }))
      );

      // ── Activity (last 30 days): bookings + Instant Help sessions ────
      const days = last30Dates();
      const bookingsByDay: Record<string, number> = {};
      bookingsSnap.docs.forEach((d) => {
        const ts = d.data().createdAt?.toDate?.() as Date | undefined;
        if (ts) {
          const key = ts.toISOString().slice(0, 10);
          bookingsByDay[key] = (bookingsByDay[key] ?? 0) + 1;
        }
      });
      const sessionsByDay: Record<string, number> = {};
      sessionsSnap.docs.forEach((d) => {
        const ts = d.data().createdAt?.toDate?.() as Date | undefined;
        if (ts) {
          const key = ts.toISOString().slice(0, 10);
          sessionsByDay[key] = (sessionsByDay[key] ?? 0) + 1;
        }
      });
      setActivityData(days.map((date) => ({
        date: date.slice(5),
        bookings: bookingsByDay[date] ?? 0,
        sessions: sessionsByDay[date] ?? 0,
      })));

      // ── Revenue trend (last 30 days): paid tutor credit orders ───────
      const revenueByDay: Record<string, number> = {};
      ordersSnap.docs.forEach((d) => {
        const data = d.data();
        const ts = (data.paidAt?.toDate?.() ?? data.createdAt?.toDate?.()) as Date | undefined;
        if (ts) {
          const key = ts.toISOString().slice(0, 10);
          revenueByDay[key] = (revenueByDay[key] ?? 0) + (Number(data.amountPaise) || 0) / 100;
        }
      });
      setRevenueData(days.map((date) => ({ date: date.slice(5), revenue: Math.round(revenueByDay[date] ?? 0) })));

      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">🎓 ShikshaHub Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Tutor marketplace overview — bookings, Instant Help, revenue, payouts, ratings</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Verified Tutors"      value={verifiedTutors}  icon="🎓" color="bg-indigo-500/20 text-indigo-400" />
        <KpiCard label="Total Bookings"       value={totalBookings}   icon="📅" color="bg-blue-500/20 text-blue-400" />
        <KpiCard label="Instant Help Sessions" value={totalSessions}  icon="⚡" color="bg-amber-500/20 text-amber-400" />
        <KpiCard label="Credits Revenue (₹)"  value={creditsRevenue}  icon="💰" color="bg-green-500/20 text-green-400" />
        <KpiCard label="Payouts Paid (₹)"     value={payoutsPaid}     icon="💸" color="bg-purple-500/20 text-purple-400" />
        <KpiCard label="Avg Tutor Rating"     value={avgRating ?? 0}  icon="⭐" color="bg-teal-500/20 text-teal-400" format="decimal" />
      </div>

      {!loading && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:col-span-2">
            <h2 className="text-white font-bold mb-4">Session Activity (Last 30 Days)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={6} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sessions" name="Instant Help" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-4">Booking Status Distribution</h2>
            {bookingStatusDist.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-slate-500">No bookings yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={bookingStatusDist} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {bookingStatusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-4">Tutor Credits Revenue (Last 30 Days)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={6} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
