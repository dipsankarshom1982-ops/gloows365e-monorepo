// lib/learnfun/types.ts

export type Skill =
  | "Money Management"
  | "Time Management"
  | "Digital Safety"
  | "Decision Making"
  | "Communication"
  | "Emotional Control"
  | "Career Awareness"
  | "Leadership"
  | "Health & Habits"
  | "Goal Setting";

export type GameType =
  | "budget_simulator"
  | "time_planner"
  | "choice_story"
  | "digital_safety"
  | "career_goal"
  | "boss_battle";

export type Difficulty = "easy" | "medium" | "hard" | "boss";

export interface LearnFunGame {
  id: string;
  title: string;
  classRange: number[];
  skill: Skill;
  gameType: GameType;
  difficulty: Difficulty;
  durationMinutes: number;
  description: string;
  emoji: string;
  gradientColors: [string, string];
  isActive: boolean;
  isComingSoon: boolean;
}

export interface DailyMission {
  id: string;
  missionTitle: string;
  class: number;
  skill: Skill;
  gameType: GameType;
  difficulty: Difficulty;
  storyIntro: string;
  characterDialogue: string;
  goal: string;
  timerSeconds: number;
  choicesOrItems: MissionItem[];
  hints: string[];
  successFeedback: string;
  tryAgainFeedback: string;
  reward: MissionReward;
  parentInsight: string;
  nextRecommendedSkill: Skill;
}

export interface MissionItem {
  name: string;
  price?: number;
  type: "need" | "want" | "emergency" | "saving" | "distraction" | "task";
  emoji?: string;
  duration?: number;
}

export interface MissionReward {
  coins: number;
  xp: number;
  badge?: string;
}

export interface StudentLearnFunProfile {
  name: string;
  class: number;
  level: number;
  xp: number;
  coins: number;
  streak: number;
  badges: string[];
  completedMissionIds: string[];
  weakSkill?: Skill;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  skill: Skill;
}

export interface SkillWorld {
  id: string;
  name: string;
  emoji: string;
  skill: Skill;
  gradientColors: [string, string];
  locked: boolean;
}
