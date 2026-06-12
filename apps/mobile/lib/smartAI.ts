// lib/smartAI.ts

// 🔥 RANDOM HELPERS
const getRandom = (arr: string[]) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

// 🔥 GREETINGS
const greetings = [
  "Great question!",
  "Nice, let's learn this step by step!",
  "Good thinking!",
];

// 🔥 EXTRACT TOPIC
const extractTopic = (q: string, keyword: string) => {
  return q.replace(keyword, "").trim() || "general topic";
};

// ==========================
// 📘 MATH ENGINE
// ==========================
const mathsEngine = (q: string) => {
  if (q.includes("trigonometry")) {
    return `📐 Trigonometry Basics:

• Deals with angles & triangles  
• Formula: sin²θ + cos²θ = 1  

👉 Tip: Practice identities daily`;
  }

  if (q.includes("algebra")) {
    return `🔢 Algebra:

2x + 3 = 7  
x = 2  

👉 Tip: Solve equations regularly`;
  }

  return "📘 Please specify Maths topic (Algebra, Trigonometry, etc.)";
};

// ==========================
// 🔬 SCIENCE ENGINE
// ==========================
const scienceEngine = (q: string) => {
  if (q.includes("photosynthesis")) {
    return `🌱 Photosynthesis:

CO₂ + H₂O → Glucose + O₂  

👉 Needs sunlight & chlorophyll`;
  }

  if (q.includes("force")) {
    return `⚡ Force:

Force = mass × acceleration  
Unit: Newton`;
  }

  return "🔬 Ask specific science topic.";
};

// ==========================
// 📖 ENGLISH ENGINE
// ==========================
const englishEngine = (q: string) => {
  if (q.includes("essay")) {
    return `✍️ Essay Structure:

1. Introduction  
2. Body  
3. Conclusion  

👉 Keep it simple & clear`;
  }

  if (q.includes("grammar")) {
    return `📖 Grammar Focus:

• Tense  
• Articles  
• Sentence structure`;
  }

  return "📖 Ask about grammar, essay, etc.";
};

// ==========================
// 🌍 GK ENGINE
// ==========================
const gkEngine = (q: string) => {
  if (q.includes("india")) {
    return `🇮🇳 India:

Capital: New Delhi  
PM: Narendra Modi`;
  }

  return "🌍 Ask GK like countries, history, civics.";
};

// ==========================
// 📝 QUIZ GENERATOR
// ==========================
const quizGenerator = (topic: string) => {
  return `📝 Quiz on ${topic}:

1. What is ${topic}?
A) Option A  
B) Option B  
C) Option C  
D) Option D  

2. Choose correct statement:
A) True  
B) False  

👉 Reply with your answers!`;
};

// ==========================
// 📘 NOTES GENERATOR
// ==========================
const notesGenerator = (topic: string) => {
  return `📘 Notes on ${topic}:

• Definition: ${topic} is an important concept  

• Key Points:
- Point 1  
- Point 2  
- Point 3  

👉 Tip: Revise daily`;
};

// ==========================
// 🎯 STUDY PLAN
// ==========================
const studyPlanEngine = (student: any) => {
  return `📅 Study Plan for ${student.name}:

Morning → Study (${student.weakSubjects?.join(", ") || "Maths"})  
Afternoon → Practice  
Evening → Revision + test`;
};

// ==========================
// 🧠 MAIN AI FUNCTION
// ==========================
export const smartAI = (text: string, student: any) => {
  const q = text.toLowerCase();

  let response = "";

  // 🔥 QUIZ
  if (q.includes("quiz") || q.includes("test")) {
    const topic = extractTopic(q, "quiz");
    response = quizGenerator(topic);
  }

  // 🔥 NOTES
  else if (q.includes("notes")) {
    const topic = extractTopic(q, "notes");
    response = notesGenerator(topic);
  }

  // 🔥 STUDY PLAN
  else if (q.includes("plan")) {
    response = studyPlanEngine(student);
  }

  // 🔥 SUBJECT ROUTING
  else if (q.includes("math") || q.includes("algebra") || q.includes("trigonometry")) {
    response = mathsEngine(q);
  }

  else if (q.includes("science") || q.includes("photosynthesis") || q.includes("force")) {
    response = scienceEngine(q);
  }

  else if (q.includes("english") || q.includes("essay") || q.includes("grammar")) {
    response = englishEngine(q);
  }

  else if (q.includes("gk") || q.includes("india") || q.includes("history")) {
    response = gkEngine(q);
  }

  else {
    response = `🤖 I can help with:

• Notes 📘  
• Quiz 📝  
• Study Plan 📅  
• Maths, Science, English, GK  

👉 Try: "Quiz on Algebra"`;
  }

  // 🔥 FINAL RESPONSE
  return `${getRandom(greetings)}

Hi ${student.name} 👋

${response}

📊 Focus: ${student.weakSubjects?.join(", ") || "Keep practicing!"}
`;
};