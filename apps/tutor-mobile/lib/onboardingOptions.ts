// apps/tutor-mobile/lib/onboardingOptions.ts
// Mirrors apps/tutor/src/lib/onboardingOptions.ts exactly — same
// reference-data lists, same tutors/{uid} field values on both
// platforms. Kept as a duplicate file rather than a shared package
// export deliberately: apps/tutor's onboarding flow is already deployed
// and validated, and refactoring its imports mid-flight to share this
// data risked destabilizing it for a same-session mobile port. Pure
// data/types, no JSX — keep the two files byte-for-byte identical when
// editing either one.
//
// Reference-data lists and this feature's UI copy are English-only for
// now — see this file's header on the web side for the full reasoning
// (i18next's fallbackLng keeps Hindi-selected tutors on a working
// screen, just in English for these specific lists).

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const SUBJECT_OPTIONS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English", "Bengali",
  "Hindi", "Computer Science", "Economics", "Accountancy",
  "Business Studies", "History", "Geography", "Political Science",
  "Psychology", "General Science", "Coding", "Spoken English",
] as const;

export type TutorTypeOption = { value: string; label: string; icon: string };
export const TUTOR_TYPE_OPTIONS: TutorTypeOption[] = [
  { value: "SCHOOL_TEACHER",   label: "School Teacher",         icon: "🏫" },
  { value: "PRIVATE_TUTOR",    label: "Private Tutor",          icon: "🧑‍🏫" },
  { value: "COLLEGE_FACULTY",  label: "College Faculty",        icon: "🎓" },
  { value: "SUBJECT_EXPERT",   label: "Subject Expert",         icon: "🧠" },
  { value: "EXAM_PREP_TUTOR",  label: "Exam Preparation Tutor", icon: "📝" },
  { value: "SKILL_INSTRUCTOR", label: "Skill Instructor",       icon: "🛠️" },
];

export type StudentLevelOption = { value: string; label: string; sub?: string };
export const STUDENT_LEVEL_OPTIONS: StudentLevelOption[] = [
  { value: "PRIMARY",           label: "Primary",           sub: "Classes 1-5" },
  { value: "MIDDLE",            label: "Middle",             sub: "Classes 6-8" },
  { value: "SECONDARY",         label: "Secondary",          sub: "Classes 9-10" },
  { value: "HIGHER_SECONDARY",  label: "Higher Secondary",   sub: "Classes 11-12" },
  { value: "COLLEGE",           label: "College" },
  { value: "COMPETITIVE_EXAMS", label: "Competitive Exams" },
  { value: "PROFESSIONAL_SKILL", label: "Professional / Skill Learning" },
];

// Curriculum board section only shows when one of these "school" levels
// is selected.
export const SCHOOL_STUDENT_LEVELS = ["PRIMARY", "MIDDLE", "SECONDARY", "HIGHER_SECONDARY"];

export const STREAM_OPTIONS = [
  { value: "SCIENCE",  label: "Science" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "ARTS",     label: "Arts" },
];

export const CURRICULUM_BOARD_OPTIONS = [
  { value: "CBSE",        label: "CBSE" },
  { value: "ICSE_ISC",    label: "ICSE / ISC" },
  { value: "STATE_BOARD", label: "State Board" },
  { value: "OTHER",       label: "Other" },
];

export const TEACHING_MODE_OPTIONS = [
  { value: "ONLINE",  label: "Online",  icon: "💻" },
  { value: "OFFLINE",  label: "Offline", icon: "📍" },
  { value: "BOTH",     label: "Both",    icon: "🔄" },
];

export const EXPERIENCE_OPTIONS = [
  { value: "FRESHER",     label: "Fresher" },
  { value: "LESS_THAN_1", label: "Less than 1 year" },
  { value: "ONE_TO_2",    label: "1-2 years" },
  { value: "THREE_TO_5",  label: "3-5 years" },
  { value: "FIVE_TO_10",  label: "5-10 years" },
  { value: "TEN_PLUS",    label: "10+ years" },
];

export const QUALIFICATION_OPTIONS = [
  { value: "HIGHER_SECONDARY",            label: "Higher Secondary" },
  { value: "DIPLOMA",                     label: "Diploma" },
  { value: "GRADUATE",                    label: "Graduate" },
  { value: "POSTGRADUATE",                label: "Postgraduate" },
  { value: "B_ED",                        label: "B.Ed" },
  { value: "M_ED",                        label: "M.Ed" },
  { value: "PHD",                         label: "PhD" },
  { value: "PROFESSIONAL_CERTIFICATION",  label: "Professional Certification" },
  { value: "OTHER",                       label: "Other" },
];

export const GENDER_OPTIONS = [
  { value: "male",              label: "Male" },
  { value: "female",            label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "other",             label: "Other" },
];

export const MIN_BIO_LENGTH = 100;
export const MAX_BIO_LENGTH = 500;
export const CURRENT_YEAR = new Date().getFullYear();
