// utils/contestUtils.ts

export const getToday = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
};

// ✅ Normalize date
export const normalizeDate = (date: any) => {
  if (!date) return "";
  if (typeof date === "string") return date.slice(0, 10);
  if (date.seconds) return new Date(date.seconds * 1000).toISOString().slice(0, 10);
  return "";
};

// ✅ FILTERS
export const filterContests = (contests: any[]) => {
  const today = getToday();

  const live: any[] = [];
  const upcoming: any[] = [];
  const completed: any[] = [];

  contests.forEach((c) => {
    const contestDate = normalizeDate(c.date);

    if (contestDate === today && c.status === "active") {
      live.push(c);
    } 
    else if (contestDate > today) {
      upcoming.push(c);
    } 
    else {
      completed.push(c);
    }
  });

  return { live, upcoming, completed };
};