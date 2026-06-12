export interface LessonSetup {
  board: string;
  classLevel: string;
  subject: string;
  chapter: string;
  topic: string;
  language: string;
  difficulty: "Easy" | "Standard" | "Exam Level";
  lessonStyle: "Story Mode" | "Simple Explanation" | "Exam Preparation" | "Practical Mode" | "Fun Game Mode";
}

export interface CheckQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Scene {
  sceneNumber: number;
  sceneTitle: string;
  visualType: "animation" | "diagram" | "code" | "table" | "story" | "practical";
  visualDescription: string;
  narration: string;
  keyConcept: string;
  example: string;
  studentAction: string;
  checkQuestion: CheckQuestion;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  concept: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface KeyConcept {
  term: string;
  simpleMeaning: string;
  realLifeExample: string;
}

export interface PracticalActivity {
  title: string;
  instructions: string[];
  expectedOutput: string;
  aiEvaluationCriteria: string[];
}

export interface LessonJson {
  lessonTitle: string;
  shortIntro: string;
  estimatedDurationMinutes: number;
  learningObjectives: string[];
  prerequisites: string[];
  storyHook: { title: string; narration: string; studentMission: string };
  scenes: Scene[];
  keyConcepts: KeyConcept[];
  practicalActivity: PracticalActivity;
  flashcards: Flashcard[];
  quickRevisionNotes: string[];
  quiz: QuizQuestion[];
  finalMission: { title: string; task: string; successCriteria: string[]; rewardText: string };
  commonMistakes: { mistake: string; correction: string }[];
  examTips: string[];
  followUpPrompts: string[];
}

export interface AiGuruLesson {
  id: string;
  uid: string;
  board: string;
  classLevel: string;
  subject: string;
  chapter: string;
  topic: string;
  language: string;
  difficulty: string;
  lessonStyle: string;
  inputType: "text" | "image" | "topic";
  inputText?: string;
  imageUrl?: string;
  status: "generating" | "completed" | "failed";
  errorMessage?: string;
  aiModel: string;
  lessonJson?: LessonJson;
  progress: number;
  createdAt: any;
  updatedAt: any;
}

export interface QuizAttempt {
  id?: string;
  uid: string;
  score: number;
  totalQuestions: number;
  accuracy: number;
  answers: { questionIndex: number; selectedIndex: number; correct: boolean }[];
  weakConcepts: string[];
  xpEarned: number;
  createdAt: any;
}

export interface AiGuruUsage {
  generationsUsed: number;
  quizAttempts: number;
  lastGeneratedAt: any;
}

export interface FollowUpResponse {
  answer: string;
  example: string;
  miniQuestion: string;
  miniQuestionAnswer: string;
  suggestedNextAction: string;
}

export type FollowUpMode =
  | "explain_simple"
  | "real_life_example"
  | "translate"
  | "ask_doubt"
  | "generate_more_questions"
  | "exam_focus"
  | "evaluate_practical";
