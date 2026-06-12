// lib/learnfun/missionData.ts
// 7 sample daily missions (class 6–12) + 4 fallback missions
// Indian context: ₹ amounts, Indian names, Indian school settings

import { DailyMission } from "./types";

// ─── CLASS 6 MISSIONS ────────────────────────────────────────

export const mission_c6_savings_jar: DailyMission = {
  id: "mission_c6_savings_jar_001",
  missionTitle: "Savings Jar Challenge",
  class: 6,
  skill: "Money Management",
  gameType: "budget_simulator",
  difficulty: "easy",
  storyIntro:
    "Priya has ₹100 given by her Nana for her birthday. She wants to buy stickers, a pen set AND save up for a bicycle. The bicycle costs ₹800. She needs to save ₹200 this month. Can she do it?",
  characterDialogue:
    "Hello! I am LifeBuddy 🤖. Did you know saving even ₹50 every week gets you ₹2,600 in a year? Let's help Priya save smart!",
  goal: "Choose items to buy from ₹100 but save at least ₹40 for the bicycle fund.",
  timerSeconds: 90,
  choicesOrItems: [
    { name: "Pen Set", price: 30, type: "need", emoji: "🖊️" },
    { name: "Notebook", price: 25, type: "need", emoji: "📓" },
    { name: "Fancy Stickers", price: 20, type: "want", emoji: "⭐" },
    { name: "Ice Cream", price: 15, type: "want", emoji: "🍦" },
    { name: "Bicycle Fund", price: 40, type: "saving", emoji: "🚲" },
  ],
  hints: [
    "Pen set and notebook help you in school — those are needs!",
    "Put money in the bicycle fund first, then spend the rest.",
    "Stickers are fun but not urgent. Can you wait?",
    "₹40 saved now = closer to your bicycle dream!",
  ],
  successFeedback:
    "Amazing! 🎉 Priya saved ₹40 for her bicycle AND bought her school supplies! You are a Savings Star! Keep it up!",
  tryAgainFeedback:
    "Oops! Priya didn't save enough. She needs ₹40 minimum for the bicycle. Try putting savings aside first, then spend the rest!",
  reward: { coins: 25, xp: 35 },
  parentInsight:
    "Your child learnt about goal-based saving today. Help them create a 'Dream Savings Jar' at home — label it with what they are saving for. Review progress weekly!",
  nextRecommendedSkill: "Time Management",
};

// ─── CLASS 7-8 MISSIONS ───────────────────────────────────────────────────────

export const mission_c7_exam_planner: DailyMission = {
  id: "mission_c7_exam_planner_001",
  missionTitle: "Exam Week Planner",
  class: 7,
  skill: "Time Management",
  gameType: "time_planner",
  difficulty: "medium",
  storyIntro:
    "Arjun's half-yearly exams start in 7 days. He has 5 subjects: Maths, Science, English, Hindi and Social Studies. He also has cricket practice on Tuesday and a family function on Saturday. Can you help him plan his study week?",
  characterDialogue:
    "Hi! I am LifeBuddy 🤖. A good study plan has balance: study + sleep + play = success! Give each subject enough time and don't forget rest!",
  goal: "Assign study time to all 5 subjects, keep 8 hrs sleep each night, and include at least 1 hr play daily.",
  timerSeconds: 180,
  choicesOrItems: [
    { name: "Maths Study", type: "task", emoji: "📐", duration: 90 },
    { name: "Science Study", type: "task", emoji: "🔬", duration: 60 },
    { name: "English Study", type: "task", emoji: "📖", duration: 45 },
    { name: "Hindi Study", type: "task", emoji: "✍️", duration: 45 },
    { name: "Social Studies", type: "task", emoji: "🌍", duration: 60 },
    { name: "Cricket Practice", type: "task", emoji: "🏏", duration: 60 },
    { name: "Play Time", type: "task", emoji: "⚽", duration: 60 },
    { name: "Sleep", type: "task", emoji: "😴", duration: 480 },
  ],
  hints: [
    "Start with your toughest subject when your mind is fresh!",
    "Break big subjects into 45-min chunks with 10-min breaks.",
    "Don't skip cricket on Tuesday — rest is important too!",
    "Revise each subject at least twice before the exam.",
  ],
  successFeedback:
    "Excellent planning! 🎉 Arjun covered all subjects and still had time to play and sleep well. You are a Time Wizard! Exams will be a breeze!",
  tryAgainFeedback:
    "Hmm, some subjects were skipped or sleep time was less than 8 hours. Balance is key! A tired brain cannot study well. Try again!",
  reward: { coins: 30, xp: 45, badge: "badge_time_wizard" },
  parentInsight:
    "Your child practised exam time planning today. Help them write a real study timetable for their upcoming exams. Pin it on the wall and check it daily together!",
  nextRecommendedSkill: "Goal Setting",
};

export const mission_c8_emergency_wallet: DailyMission = {
  id: "mission_c8_emergency_wallet_001",
  missionTitle: "Emergency Wallet Challenge",
  class: 8,
  skill: "Money Management",
  gameType: "budget_simulator",
  difficulty: "medium",
  storyIntro:
    "Vikram gets his weekly pocket money of ₹500. This week has a surprise: his bicycle tyre got punctured and needs repair! He also wants to buy a new game top-up. He must handle the emergency AND manage his remaining money smartly.",
  characterDialogue:
    "Hello! I am LifeBuddy 🤖. Emergencies happen! Smart people always keep an emergency fund. Let's see if Vikram can handle the puncture AND still manage his money well!",
  goal: "Handle the bicycle emergency (₹120) and save at least ₹150 from ₹500.",
  timerSeconds: 120,
  choicesOrItems: [
    { name: "Notebook Refill", price: 80, type: "need", emoji: "📓" },
    { name: "Tiffin Snacks (5 days)", price: 100, type: "need", emoji: "🍱" },
    { name: "Bicycle Tyre Repair", price: 120, type: "emergency", emoji: "🚲" },
    { name: "Game Top-Up", price: 150, type: "want", emoji: "🎮" },
    { name: "Monthly Savings", price: 150, type: "saving", emoji: "🐷" },
  ],
  hints: [
    "Emergency comes first! Fix the bicycle — you need it to go to school.",
    "Needs (notebook + tiffin) are important for school days.",
    "Can you skip or reduce the game top-up this week?",
    "Saving ₹150 each week = ₹600 saved by end of month!",
  ],
  successFeedback:
    "Brilliant! 🎉 Vikram handled the emergency, bought his essentials AND saved money! You are a Budget Boss! Real-life money skills unlocked!",
  tryAgainFeedback:
    "Oops! Either the emergency wasn't handled or savings target wasn't met. Remember: Emergency > Needs > Savings > Wants. Try again!",
  reward: { coins: 40, xp: 60, badge: "badge_money_saver" },
  parentInsight:
    "Your child learnt about emergency budgeting today. Discuss with them: Does our family have an emergency fund? What do we do when unexpected expenses come? This builds financial resilience!",
  nextRecommendedSkill: "Goal Setting",
};

// ─── CLASS 9-10 MISSIONS ─────────────────────────────────────────────────────

export const mission_c9_career_city: DailyMission = {
  id: "mission_c9_career_city_001",
  missionTitle: "Career City Explorer",
  class: 9,
  skill: "Career Awareness",
  gameType: "career_goal",
  difficulty: "medium",
  storyIntro:
    "Sneha is in Class 9 and wonders what she wants to be. Her parents say 'doctor or engineer' but she loves drawing and writing. In Career City, she can visit 5 zones: Medical, Engineering, Arts, Business and Sports. Help her explore and find her path!",
  characterDialogue:
    "Hi! I am LifeBuddy 🤖. There are 700+ careers out there! Doctor and engineer are great — but so are architect, animator, journalist, CA, designer and many more! Let's explore together!",
  goal: "Explore at least 3 career zones, match your top 2 skills to careers, and set 1 career goal for this year.",
  timerSeconds: 180,
  choicesOrItems: [
    { name: "Visit Medical Zone", type: "task", emoji: "🏥" },
    { name: "Visit Engineering Zone", type: "task", emoji: "⚙️" },
    { name: "Visit Arts & Design Zone", type: "task", emoji: "🎨" },
    { name: "Visit Business Zone", type: "task", emoji: "📊" },
    { name: "Visit Sports & Fitness Zone", type: "task", emoji: "🏅" },
    { name: "Match Skills to Career", type: "task", emoji: "🔗" },
    { name: "Set 1 Career Goal", type: "task", emoji: "🎯" },
  ],
  hints: [
    "Your hobbies are clues to your career! Drawing = Design, Architecture, Animation.",
    "Talk to people in careers you like — it gives real insights.",
    "A career goal for Class 9: 'Research 3 careers I might like by December.'",
    "Science + Art = Architecture, Game Design, Medical Illustration!",
  ],
  successFeedback:
    "Wonderful! 🎉 Sneha explored Career City and found her interests! Setting a career goal this early gives you 3+ years to prepare. You are a Career Explorer!",
  tryAgainFeedback:
    "Sneha needs to explore more zones and set at least one career goal. Career planning starts now — not in Class 12! Try again!",
  reward: { coins: 40, xp: 60, badge: "badge_career_explorer" },
  parentInsight:
    "Your child explored career options today. Have an open conversation about various career paths — including arts, design, sports management, journalism and entrepreneurship. Avoid limiting to just 'doctor or engineer'!",
  nextRecommendedSkill: "Goal Setting",
};

export const mission_c10_board_planner: DailyMission = {
  id: "mission_c10_board_planner_001",
  missionTitle: "90-Day Board Challenge",
  class: 10,
  skill: "Time Management",
  gameType: "time_planner",
  difficulty: "hard",
  storyIntro:
    "Riya is in Class 10. Board exams are exactly 90 days away. She has 6 subjects, tuition 3 days a week, and wants to complete 2 full revisions before D-Day. Her weak subjects are Maths and Science. Can you help her build the ultimate 90-day study plan?",
  characterDialogue:
    "Hello! I am LifeBuddy 🤖. 90 days = 1,080 hours total! If Riya uses them wisely, she can score 85%+. The secret? Consistent daily effort, not last-minute cramming!",
  goal: "Allocate daily study hours across 6 subjects with extra time for Maths & Science. Include 2 revision cycles and self-care time.",
  timerSeconds: 240,
  choicesOrItems: [
    { name: "Daily Maths Practice", type: "task", emoji: "📐", duration: 90 },
    { name: "Science Concepts", type: "task", emoji: "🔬", duration: 75 },
    { name: "English Reading + Writing", type: "task", emoji: "📖", duration: 45 },
    { name: "Hindi Literature", type: "task", emoji: "📜", duration: 45 },
    { name: "Social Studies", type: "task", emoji: "🌍", duration: 60 },
    { name: "Computer Science", type: "task", emoji: "💻", duration: 45 },
    { name: "Tuition (3 days/week)", type: "task", emoji: "🏫", duration: 90 },
    { name: "Revision Cycle 1 (Days 1-45)", type: "task", emoji: "🔄", duration: 60 },
    { name: "Revision Cycle 2 (Days 60-90)", type: "task", emoji: "🔁", duration: 90 },
    { name: "Sleep & Self Care", type: "task", emoji: "😴", duration: 480 },
    { name: "Play / Relaxation", type: "task", emoji: "⚽", duration: 60 },
  ],
  hints: [
    "Give 30% more time to your weak subjects (Maths & Science).",
    "Plan 2 full revisions: 1 at halfway, 1 in final 2 weeks.",
    "Board toppers sleep 8 hours — don't sacrifice sleep for study!",
    "Study in 45-min blocks with 10-min breaks for best retention.",
    "Weekend = catch up + practice papers!",
  ],
  successFeedback:
    "Outstanding! 🎉 Riya has a solid 90-day Board plan! With this level of planning, she will ace her exams. You are a Board Prep Champion! Share this plan with your real studies too!",
  tryAgainFeedback:
    "The plan needs work — either weak subjects aren't getting extra time or revision cycles are missing. Boards need smart planning! Try again!",
  reward: { coins: 60, xp: 90, badge: "badge_time_wizard" },
  parentInsight:
    "Your child built a 90-day Board exam study plan today. Help them create a real one on paper or Google Calendar. Check in weekly — celebrate small wins to keep motivation high!",
  nextRecommendedSkill: "Goal Setting",
};

// ─── CLASS 11-12 MISSIONS ─────────────────────────────────────────────────────

export const mission_c11_productivity: DailyMission = {
  id: "mission_c11_productivity_001",
  missionTitle: "Productivity Planner",
  class: 11,
  skill: "Time Management",
  gameType: "time_planner",
  difficulty: "hard",
  storyIntro:
    "Akash is in Class 11 PCM. He wants to crack JEE but also needs to do well in boards. He has coaching 4 days a week, self-study at home and needs to maintain his health. Every day has exactly 24 hours — help him use them brilliantly!",
  characterDialogue:
    "Hi! I am LifeBuddy 🤖. JEE toppers study 6-8 hours daily with full focus — not 14 hours of distracted studying! Quality over quantity. Let's build Akash's power schedule!",
  goal: "Create a daily schedule with 6+ hrs focused study, 8 hrs sleep, coaching attendance and at least 45 mins health/exercise.",
  timerSeconds: 240,
  choicesOrItems: [
    { name: "Morning Focus Study (no phone)", type: "task", emoji: "🌅", duration: 120 },
    { name: "Coaching Class", type: "task", emoji: "🏫", duration: 120 },
    { name: "Coaching Homework & Revision", type: "task", emoji: "📝", duration: 90 },
    { name: "Board Syllabus Study", type: "task", emoji: "📚", duration: 90 },
    { name: "Practice Problems (JEE Level)", type: "task", emoji: "🔢", duration: 60 },
    { name: "Exercise / Sports", type: "task", emoji: "🏃", duration: 45 },
    { name: "Meals + Hygiene", type: "task", emoji: "🍽️", duration: 60 },
    { name: "Short Breaks (total)", type: "task", emoji: "☕", duration: 30 },
    { name: "Sleep", type: "task", emoji: "😴", duration: 480 },
    { name: "Evening Walk / Relaxation", type: "task", emoji: "🌙", duration: 30 },
  ],
  hints: [
    "Study your hardest subject (usually Maths) in the morning when your brain is sharpest.",
    "6 hrs of focused study beats 12 hrs of distracted sitting!",
    "Don't skip exercise — it improves memory and reduces exam stress.",
    "Use coaching homework time to also review class notes.",
    "Sleep 8 hours — memory consolidation happens during sleep!",
  ],
  successFeedback:
    "Superb! 🎉 Akash's schedule is balanced for JEE + Boards + Health! This kind of planning separates toppers from the rest. You are a Productivity Master!",
  tryAgainFeedback:
    "The schedule doesn't balance study, health and sleep optimally. JEE prep is a marathon not a sprint — burnout is the enemy! Try again!",
  reward: { coins: 60, xp: 90 },
  parentInsight:
    "Your child created a JEE/Board balanced study schedule today. Discuss with them: Are they getting enough sleep? Are they taking breaks? Burnout is real — support their mental health alongside academic performance!",
  nextRecommendedSkill: "Career Awareness",
};

export const mission_c12_interview: DailyMission = {
  id: "mission_c12_interview_001",
  missionTitle: "Interview Room",
  class: 12,
  skill: "Communication",
  gameType: "choice_story",
  difficulty: "boss",
  storyIntro:
    "Meera has cleared the written exam for her dream college — IIT Delhi! Now comes the personal interview. The panel consists of 3 professors. They will ask about her interests, strengths, weaknesses and future plans. How she responds will determine her admission!",
  characterDialogue:
    "Hi! I am LifeBuddy 🤖. In an interview, HOW you say something matters as much as WHAT you say. Be honest, confident and specific. Let's prepare Meera for the best interview of her life!",
  goal: "Choose the best responses in all 5 interview questions to score 80+ in the interview.",
  timerSeconds: 300,
  choicesOrItems: [
    { name: "Tell me about yourself (confident intro)", type: "task", emoji: "👤" },
    { name: "Why this college? (specific reasons)", type: "task", emoji: "🏛️" },
    { name: "Your biggest weakness (honest + improvement)", type: "task", emoji: "💪" },
    { name: "5-year plan (realistic + ambitious)", type: "task", emoji: "🎯" },
    { name: "Any questions for us? (thoughtful question)", type: "task", emoji: "❓" },
  ],
  hints: [
    "Start your intro with your name, school, and ONE achievement you are proud of.",
    "Research the college before the interview — mention specific labs, professors or courses.",
    "Weakness answer: be honest, then show how you are improving it.",
    "5-year plan: don't say 'I don't know' — give a thoughtful answer.",
    "Always ask at least 1 question — it shows you are genuinely interested!",
  ],
  successFeedback:
    "Extraordinary! 🎉 Meera aced her interview with confidence and clarity! You showed that preparation + honesty + confidence = success! Interview Champion unlocked!",
  tryAgainFeedback:
    "Meera's responses weren't strong enough. Remember: be specific, be honest and always show growth mindset. Practice makes perfect — try again!",
  reward: { coins: 100, xp: 150, badge: "badge_communicator" },
  parentInsight:
    "Your child practised college interview skills today. Do mock interviews with them at home — ask 'Why this stream?' and 'What are your goals?' Confident communication is a life skill!",
  nextRecommendedSkill: "Leadership",
};

// ─── FALLBACK MISSIONS (universal, any class) ─────────────────────────────────

export const fallback_money_basics: DailyMission = {
  id: "fallback_money_basics",
  missionTitle: "Money Basics",
  class: 0,
  skill: "Money Management",
  gameType: "budget_simulator",
  difficulty: "easy",
  storyIntro:
    "You have ₹200 to spend this week. You need stationery for school, lunch money, and you want to save for something special. Can you manage your money wisely?",
  characterDialogue:
    "Hi! I am LifeBuddy 🤖. Money management is one of the most important life skills. Let's learn to spend smart and save smart together!",
  goal: "Buy all needs and save at least ₹50 from ₹200.",
  timerSeconds: 120,
  choicesOrItems: [
    { name: "Stationery", price: 50, type: "need", emoji: "✏️" },
    { name: "Lunch (5 days)", price: 75, type: "need", emoji: "🍱" },
    { name: "Snacks", price: 30, type: "want", emoji: "🍟" },
    { name: "Game Credit", price: 50, type: "want", emoji: "🎮" },
    { name: "Savings", price: 50, type: "saving", emoji: "🐷" },
  ],
  hints: [
    "Needs come before wants!",
    "Save at least 25% of what you get.",
    "Think: will I regret buying this tomorrow?",
  ],
  successFeedback:
    "Well done! 🎉 You managed ₹200 wisely — bought your needs AND saved! That is real money management!",
  tryAgainFeedback:
    "Needs weren't covered or savings target missed. Remember: Needs > Savings > Wants. Try again!",
  reward: { coins: 20, xp: 30 },
  parentInsight:
    "Your child practised basic money management. Give them a small weekly allowance and encourage them to track their spending in a notebook!",
  nextRecommendedSkill: "Time Management",
};

export const fallback_time_basics: DailyMission = {
  id: "fallback_time_basics",
  missionTitle: "Time Management Basics",
  class: 0,
  skill: "Time Management",
  gameType: "time_planner",
  difficulty: "easy",
  storyIntro:
    "You have a regular school day tomorrow. Plan your day from morning to night — study, meals, play and sleep. Can you fit everything in 24 hours without rushing?",
  characterDialogue:
    "Hi! I am LifeBuddy 🤖. Time is the one resource everyone gets equally — 24 hours a day! The question is how you use it. Let's plan a great day!",
  goal: "Plan a day with at least 2 hrs study, 8 hrs sleep, and 1 hr of play/activity.",
  timerSeconds: 120,
  choicesOrItems: [
    { name: "Morning Routine (bath, breakfast)", type: "task", emoji: "🌅", duration: 60 },
    { name: "School", type: "task", emoji: "🏫", duration: 360 },
    { name: "Homework & Study", type: "task", emoji: "📚", duration: 120 },
    { name: "Play / Outdoor Activity", type: "task", emoji: "⚽", duration: 60 },
    { name: "Dinner & Family Time", type: "task", emoji: "🍽️", duration: 60 },
    { name: "Sleep", type: "task", emoji: "😴", duration: 480 },
  ],
  hints: [
    "A good routine reduces stress and improves grades!",
    "Study right after school while the lessons are fresh.",
    "Sleep 8-9 hours — your brain grows during sleep!",
  ],
  successFeedback:
    "Perfect day planned! 🎉 You have study, play and sleep all balanced. That is the secret of successful students!",
  tryAgainFeedback:
    "Study time or sleep time is not enough. Balance is key! Try again.",
  reward: { coins: 20, xp: 30 },
  parentInsight:
    "Your child practised daily time planning. Help them create a simple daily routine chart and stick to it for one week!",
  nextRecommendedSkill: "Digital Safety",
};

export const fallback_digital_basics: DailyMission = {
  id: "fallback_digital_basics",
  missionTitle: "Digital Safety Basics",
  class: 0,
  skill: "Digital Safety",
  gameType: "digital_safety",
  difficulty: "easy",
  storyIntro:
    "You are using your phone and computer today. Various messages, notifications and websites appear. Your job: identify which ones are SAFE and which are UNSAFE!",
  characterDialogue:
    "Hi! I am LifeBuddy 🤖. The internet is amazing — but it has dangers too! I will help you spot the tricks cybercriminals use. Stay safe online!",
  goal: "Correctly identify 8 out of 10 safe/unsafe digital situations.",
  timerSeconds: 120,
  choicesOrItems: [
    { name: "Message: 'You won ₹10 lakh! Click here!'", type: "distraction", emoji: "⚠️" },
    { name: "School portal login page", type: "need", emoji: "✅" },
    { name: "Unknown app asking your location", type: "distraction", emoji: "⚠️" },
    { name: "NCERT official website", type: "need", emoji: "✅" },
    { name: "Friend sharing game link from WhatsApp", type: "want", emoji: "🤔" },
    { name: "Email from 'bank' asking password", type: "distraction", emoji: "⚠️" },
    { name: "Google Maps for directions", type: "need", emoji: "✅" },
    { name: "Stranger asking your home address", type: "distraction", emoji: "⚠️" },
  ],
  hints: [
    "If it sounds too good to be true — it IS too good to be true!",
    "Never share your password, OTP or address with anyone online.",
    "Check the website URL — fake sites have slightly wrong spellings.",
    "When in doubt, ask a trusted adult before clicking!",
  ],
  successFeedback:
    "Excellent! 🎉 You spotted the digital dangers perfectly! You are now a Cyber Guardian! Stay safe online always!",
  tryAgainFeedback:
    "Some dangers were missed! Remember: unknown links, prize messages and strangers asking personal info are almost always scams. Try again!",
  reward: { coins: 20, xp: 30, badge: "badge_cyber_guard" },
  parentInsight:
    "Your child practised digital safety today. Discuss online safety rules at home: no sharing passwords, no clicking unknown links, always tell a parent if something feels wrong online!",
  nextRecommendedSkill: "Goal Setting",
};

export const fallback_goal_basics: DailyMission = {
  id: "fallback_goal_basics",
  missionTitle: "Goal Setting Basics",
  class: 0,
  skill: "Goal Setting",
  gameType: "career_goal",
  difficulty: "easy",
  storyIntro:
    "A new school term is starting! This is the perfect time to set goals. What do you want to achieve this term? Better marks? A new skill? A healthy habit? Let's set SMART goals together!",
  characterDialogue:
    "Hi! I am LifeBuddy 🤖. A SMART goal is: Specific, Measurable, Achievable, Relevant and Time-bound. 'Do better in Maths' is NOT a goal. 'Score 75+ in Maths by December exams' IS a SMART goal!",
  goal: "Set 3 SMART goals for this term and plan 2 action steps for each.",
  timerSeconds: 150,
  choicesOrItems: [
    { name: "Academic Goal (marks/subject)", type: "task", emoji: "📚" },
    { name: "Health Goal (exercise/food)", type: "task", emoji: "💪" },
    { name: "Skill Goal (hobby/talent)", type: "task", emoji: "🎨" },
    { name: "Action Step 1 for each goal", type: "task", emoji: "👣" },
    { name: "Action Step 2 for each goal", type: "task", emoji: "🚀" },
    { name: "Set a deadline for each goal", type: "task", emoji: "📅" },
  ],
  hints: [
    "Be specific: 'Score 80 in Science' not just 'do better in Science'.",
    "Break each goal into small weekly actions.",
    "Tell someone your goal — it makes you 65% more likely to achieve it!",
    "Review your goals every Sunday evening.",
  ],
  successFeedback:
    "Fantastic! 🎉 You set 3 SMART goals with clear action steps! Students who set goals score 20% better on average. You are a Goal Setter!",
  tryAgainFeedback:
    "Goals need to be specific and have action steps. Vague goals lead to vague results. Try again with clearer targets!",
  reward: { coins: 20, xp: 30, badge: "badge_goal_setter" },
  parentInsight:
    "Your child learnt SMART goal setting today. Help them write 3 goals for this term on paper. Put it somewhere visible — the kitchen or study table. Review weekly together!",
  nextRecommendedSkill: "Career Awareness",
};

// ─── EXPORTED COLLECTIONS ────────────────────────────────────────────────────
export const SAMPLE_MISSIONS: DailyMission[] = [
  mission_c6_savings_jar,
  mission_c7_exam_planner,
  mission_c8_emergency_wallet,
  mission_c9_career_city,
  mission_c10_board_planner,
  mission_c11_productivity,
  mission_c12_interview,
];

export const FALLBACK_MISSIONS: DailyMission[] = [
  fallback_money_basics,
  fallback_time_basics,
  fallback_digital_basics,
  fallback_goal_basics,
];

export function getMissionForClass(studentClass: number): DailyMission {
  const classMission = SAMPLE_MISSIONS.find((m) => m.class === studentClass);
  if (classMission) return classMission;

  // fallback by day of week
  const dayIndex = new Date().getDay();
  const fallbackIndex = dayIndex % FALLBACK_MISSIONS.length;
  return FALLBACK_MISSIONS[fallbackIndex];
}
