// All 22 constitutionally recognised Indian languages + English
// Strings not yet translated fall back to English via i18next fallbackLng

export type TranslationSet = {
  // ── Navigation (Drawer) ──────────────────────────────────
  home: string;
  leaderboard: string;
  wallet: string;
  settings: string;
  dashboard: string;
  aiGuru: string;
  skillBoard: string;
  logout: string;
  // ── Settings ─────────────────────────────────────────────
  profileSettings: string;
  language: string;
  changeLanguage: string;
  darkTheme: string;
  notifications: string;
  privacy: string;
  about: string;
  customizeExperience: string;
  // ── Common actions ────────────────────────────────────────
  save: string;
  cancel: string;
  edit: string;
  back: string;
  delete: string;
  loading: string;
  editProfile: string;
  saveChanges: string;
  verify: string;
  confirm: string;
  send: string;
  // ── Language screen ───────────────────────────────────────
  languageTitle: string;
  languageSubtitle: string;
  searchLanguage: string;
  scheduleNote: string;
  // ── Profile ───────────────────────────────────────────────
  basicInfo: string;
  academicDetails: string;
  location: string;
  interests: string;
  fullName: string;
  phoneNumber: string;
  dateOfBirth: string;
  age: string;
  school: string;
  preferredLanguage: string;
  pincode: string;
  class: string;
  board: string;
  // ── LearnFun screen ───────────────────────────────────────
  learnFunLoading: string;
  profileNotFound: string;
  profileSetupPrompt: string;
  dailyStreak: string;
  view: string;
  todaysMission: string;
  daily: string;
  noMissionToday: string;
  skillWorlds: string;
  bossBattle: string;
  yourGames: string;
  gamesLoading: string;
  yourBadges: string;
  viewAll: string;
  comingSoon: string;
  play: string;
  // ── Seekho screen ─────────────────────────────────────────
  searchVideos: string;
  featured: string;
  noVideosFound: string;
  clearFilters: string;
  allVideos: string;
  videosComingSoon: string;
  // ── SkillBattle screen ────────────────────────────────────
  loadingBattles: string;
  noActiveBattles: string;
  checkBackSoon: string;
  refresh: string;
  computingRanks: string;
  retry: string;
  notRankedYet: string;
  uploadReelPrompt: string;
  viewFullSkillboard: string;
  battleEnded: string;
  notEligible: string;
  uploadReel: string;
  // ── VidyaStar / Shikshastar screen ───────────────────────
  loginRequired: string;
  live: string;
  completed: string;
  prizePool: string;
  endingSoon: string;
  viewResult: string;
  joinNow: string;
  participate: string;
  reserveSpot: string;
  startsSoon: string;
  all: string;
  upcoming: string;
  // ── Home screen ────────────────────────────────────────────
  aiGuruSubtitle: string;
  askAnything: string;
  instantAnswers: string;
  studyHelp: string;
  startChatting: string;
  // ── AI Guru ────────────────────────────────────────────────
  premiumFeature: string;
  premiumUnlockMsg: string;
  maybeLater: string;
  upgrade: string;
  aiClassroom: string;
  freeLessonsLeft: string;
  unlimitedAccess: string;
  lessonSetup: string;
  continueBtn: string;
  fillRequiredFields: string;
  fillRequiredFieldsDesc: string;
  // ── VidyaGuru ──────────────────────────────────────────────
  vidyaGuruAI: string;
  personalAiTeacher: string;
  readyToHelp: string;
  thinking: string;
  speaking: string;
  listening: string;
  paywallTitle: string;
  paywallBody: string;
  upgradeToPremium: string;
  // ── Seekho ─────────────────────────────────────────────────
  seekhoSignIn: string;
  curriculumAligned: string;
  subjects: string;
  continueLearning: string;
  resumeLearning: string;
  revisionDue: string;
  revisionReady: string;
  unlockCurriculum: string;
  // ── Create Reels ───────────────────────────────────────────
  pendingReview: string;
  inReview: string;
  approved: string;
  rejected: string;
  limitReached: string;
  limitReachedDesc: string;
  // ── Home feed sections ────────────────────────────────────────
  seekhoPreviewTitle?: string;
  seekhoPreviewSub?: string;
  explore?: string;
  vidyaStarPreviewTitle?: string;
  vidyaStarPreviewSub?: string;
  couldNotLoadContests?: string;
  contestsComingSoon?: string;
  viewResults?: string;
  participateNow?: string;
  skillBattlePreviewTitle?: string;
  skillBattlePreviewSub?: string;
  couldNotLoadBattles?: string;
  battlesComingSoon?: string;
  poweredBy?: string;
  joinedCount?: string;
  knowledgeHubTitle?: string;
  knowledgeHubSub?: string;
  watchMore?: string;
  couldNotLoadVideos?: string;
  moreVideosSoon?: string;
  noVideosInCat?: string;
  shortLearningTitle?: string;
  noLearningVideos?: string;
  skillBattleShortsTitle?: string;
  noSkillBattleVideos?: string;
  battleBadge?: string;
  shikshaStarPreviewTitle?: string;
  shikshaStarPreviewSub?: string;
  viewStars?: string;
  couldNotLoadStars?: string;
  shikshaStarEmpty?: string;
  becomeShikshaStar?: string;
  discoverPreviewTitle?: string;
  discoverPreviewSub?: string;
  discoverTitle?: string;
  discoverSubtitle?: string;
  discoverCta?: string;
  // ── AI Guru home menu cards ───────────────────────────────────────
  aiGuruTagline?: string;
  menuAiDashboard?: string;
  menuAiDashboardSub?: string;
  menuDiscoverAI?: string;
  menuDiscoverAISub?: string;
  menuVidyaGuruCard?: string;
  menuVidyaGuruCardSub?: string;
  menuGenerateLesson?: string;
  menuGenerateLessonSub?: string;
  menuMyLessons?: string;
  menuMyLessonsSub?: string;
  menuRevisionReels?: string;
  menuRevisionReelsSub?: string;
  menuPracticeTests?: string;
  menuPracticeTestsSub?: string;
  menuAskAiGuruCard?: string;
  menuAskAiGuruCardSub?: string;
  // ── Ask AI Guru screen ────────────────────────────────────────────
  goodMorning?: string;
  goodAfternoon?: string;
  goodEvening?: string;
  helloGreet?: string;
  whatToLearnToday?: string;
  browseBySubject?: string;
  freeQuestionsRemaining?: string;
  freeQuestionsRemainingPlural?: string;
  askFollowUpPlaceholder?: string;
  askSyllabusPlaceholder?: string;
  thinkingLabel?: string;
  wantToGoDeeper?: string;
  generateLessonAction?: string;
  chatWithAIAction?: string;
  chatWithVidyaGuruAction?: string;
  askAnotherQuestion?: string;
  dailyLimitTitle?: string;
  dailyLimitMessage?: string;
  generateFullLessonAction?: string;
  somethingWentWrong?: string;
  tryAgainLabel?: string;
  leftLabel?: string;
  askAiGuruTitle?: string;
  // ── VidyaGuru screen ─────────────────────────────────────────────
  respondingIn?: string;
  voiceMessage?: string;
  askSomethingPlaceholder?: string;
  // ── Settings screen ───────────────────────────────────────────────
  themeDescDark?: string;
  themeDescLight?: string;
  notificationsDesc?: string;
  changePassword?: string;
  changePasswordDesc?: string;
  privacyDesc?: string;
  aboutDesc?: string;
  currentTheme?: string;
  themeDark?: string;
  themeLight?: string;
  goBack?: string;
  // ── Language settings screen ──────────────────────────────────────
  noLanguagesMatch?: string;
  languageInfoText?: string;
  backToSettings?: string;
  // ── New AI features (PhotoSolve, Exam Simulator, Voice Tutor, Notebook) ──────
  menuPhotoSolve?: string;
  menuPhotoSolveSub?: string;
  menuExamSimulator?: string;
  menuExamSimulatorSub?: string;
  menuVoiceTutor?: string;
  menuVoiceTutorSub?: string;
  menuAiNotebook?: string;
  menuAiNotebookSub?: string;
  // Ask AI mode chips
  modeExplain?: string;
  modeNotes?: string;
  modeExam?: string;
  modeDoubt?: string;
  modeSummarize?: string;
  modeTip?: string;
  modeLanguage?: string;
  // Notebook screen
  notebookTitle?: string;
  notebookEmpty?: string;
  notebookEmptyDesc?: string;
  savedToNotebook?: string;
  saveToNotebook?: string;
  viewNotebook?: string;
  pinned?: string;
  // PhotoSolve
  photoSolveTitle?: string;
  photoSolveSub?: string;
  snapQuestion?: string;
  solving?: string;
  stepBystep?: string;
  finalAnswer?: string;
  similarQuestions?: string;
  solveAnother?: string;
  // Exam simulator
  examSimTitle?: string;
  examSimSub?: string;
  generateExam?: string;
  submitExam?: string;
  examResults?: string;
  boardReadiness?: string;
  weakAreas?: string;
  strongAreas?: string;
  takeAnotherExam?: string;
  // Voice tutor
  voiceTutorTitle?: string;
  voiceTutorSub?: string;
  tapToSpeak?: string;
  recording?: string;
  speakYourDoubt?: string;
  explainInMyLanguage?: string;
  // ── Home / Drawer / Component UI strings ──────────────────────────
  poweredByAI?: string;
  onlineLabel?: string;
  yourSchool?: string;
  vCoinsLabel?: string;
  xpLabel?: string;
  levelLabel?: string;
  xpToNextLevel?: string;
  vCoinsRankLabel?: string;
  viewLabel?: string;
  giftClaimed?: string;
  surpriseGiftWaiting?: string;
  giftOnItsWay?: string;
  tapToClaimReward?: string;
  learnFunLabel?: string;
  referEarn?: string;
  referEarnSub?: string;
  viewAllLabel?: string;
  friendsJoined?: string;
  vCoinsEarned?: string;
  perReferral?: string;
  yourCode?: string;
  copyLabel?: string;
  copiedLabel?: string;
  referMoreFriends?: string;
  friendAlsoGets?: string;
  shortReelsTitle?: string;
  curatedByVidya?: string;
  seeAll?: string;
  watchAll?: string;
  topApprovedReels?: string;
  poweredByGemini?: string;
  activeLabel?: string;
  classLabel?: string;
  sponsoredBattle?: string;
  poweredBySponsor?: string;
  classSixToTwelve?: string;
  indiaPrizePool?: string;
  aiLessonReady?: string;
  viewFinalLeaderboard?: string;
  viewLiveStandings?: string;
  lessonBeingPrepared?: string;
  // ── Wallet & Leaderboard ───────────────────────────────────────────────────
  vCoinsBalance?: string;
  totalEarned?: string;
  totalSpent?: string;
  thisMonth?: string;
  earnVCoins?: string;
  transactionHistory?: string;
  noTransactionsYet?: string;
  noTransactionsSub?: string;
  walletLabel?: string;
  leaderboardLabel?: string;
  seeTop100?: string;
  showLess?: string;
  yourRank?: string;
  updatedDaily?: string;
  // ── Referral screen ────────────────────────────────────────────────────────
  referralTitle?: string;
  inviteFriendsEarn?: string;
  totalReferred?: string;
  completed?: string;
  yourReferralCode?: string;
  shareCode?: string;
  howItWorks?: string;
  referralHistory?: string;
  shareEarn?: string;
  pendingLabel?: string;
  joinedLabel?: string;
  stepLabel?: string;
  moreReferralsToUnlock?: string;
  nextReward?: string;
};

type Translations = Record<string, TranslationSet>;

const translations: Translations = {
  // ─────────────────────────── English ──────────────────────────────
  en: {
    home: "Home", leaderboard: "Leaderboard", wallet: "Wallet",
    settings: "Settings", dashboard: "Dashboard", aiGuru: "AI Guru",
    skillBoard: "Skill Board", logout: "Logout",
    profileSettings: "Profile Settings", language: "Language",
    changeLanguage: "Change app & content language",
    darkTheme: "Dark Theme", notifications: "Notifications",
    privacy: "Privacy", about: "About",
    customizeExperience: "Customize your experience",
    save: "Save", cancel: "Cancel", edit: "Edit", back: "Back",
    delete: "Delete", loading: "Loading...", editProfile: "Edit Profile",
    saveChanges: "Save Changes", verify: "Verify", confirm: "Confirm", send: "Send",
    languageTitle: "Language", languageSubtitle: "All 22 constitutionally recognised Indian languages",
    searchLanguage: "Search language...", scheduleNote: "These are the 22 languages listed in the 8th Schedule of the Constitution of India.",
    basicInfo: "Basic Information", academicDetails: "Academic Details",
    location: "Location", interests: "Interests", fullName: "Full Name",
    phoneNumber: "Phone Number", dateOfBirth: "Date of Birth", age: "Age",
    school: "School / Institution", preferredLanguage: "Preferred Language",
    pincode: "Pincode", class: "Class / Grade", board: "Board",
    learnFunLoading: "Loading your LearnFun world...",
    profileNotFound: "Profile not found",
    profileSetupPrompt: "Please complete your profile setup to start playing!",
    dailyStreak: "Daily Streak", view: "View", todaysMission: "Today's Mission",
    daily: "Daily", noMissionToday: "No mission for today yet. Check back soon!",
    skillWorlds: "Skill Worlds", bossBattle: "Boss Battle",
    yourGames: "Your Games", gamesLoading: "Games loading... or try again later!",
    yourBadges: "Your Badges", viewAll: "View All", comingSoon: "Coming Soon", play: "Play",
    searchVideos: "Search videos, subjects, teachers...",
    featured: "Featured", noVideosFound: "No Videos Found",
    clearFilters: "Clear Filters", allVideos: "All Videos",
    videosComingSoon: "Videos coming soon!",
    loadingBattles: "Loading battles...", noActiveBattles: "No Active Battles",
    checkBackSoon: "Check back soon for new skill battles!",
    refresh: "Refresh", computingRanks: "Computing your ranks...",
    retry: "Retry", notRankedYet: "You're not ranked yet",
    uploadReelPrompt: "Upload a reel to enter the battle!",
    viewFullSkillboard: "View Full Skillboard",
    battleEnded: "Battle Ended", notEligible: "Not Eligible", uploadReel: "Upload Reel",
    loginRequired: "Login Required", live: "Live", completed: "Completed",
    prizePool: "Prize Pool", endingSoon: "Ending Soon", viewResult: "View Result",
    joinNow: "Join Now", participate: "Participate", reserveSpot: "Reserve Spot",
    startsSoon: "Starts Soon", all: "All", upcoming: "Upcoming",
    aiGuruSubtitle: "Your personal learning assistant", askAnything: "Ask Anything", instantAnswers: "Instant Answers", studyHelp: "Study Help", startChatting: "Start Chatting →",
    premiumFeature: "Premium Feature", premiumUnlockMsg: "Upgrade to AI Guru Premium to unlock this feature.", maybeLater: "Maybe Later", upgrade: "Upgrade",
    aiClassroom: "Your personal AI classroom\npowered by Gemini", freeLessonsLeft: "free lessons left today", unlimitedAccess: "Unlimited Premium Access Active",
    lessonSetup: "Lesson Setup", continueBtn: "Continue →", fillRequiredFields: "Fill Required Fields", fillRequiredFieldsDesc: "Please select a subject and enter chapter name.",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "Your personal AI teacher", readyToHelp: "Ready to help!", thinking: "Thinking...", speaking: "Speaking...", listening: "Listening...",
    paywallTitle: "Continue with VidyaGuru?", paywallBody: "You've used your free question for today. Upgrade to Premium for unlimited conversations!", upgradeToPremium: "Upgrade to Premium",
    seekhoSignIn: "Sign in to access Seekho", curriculumAligned: "Curriculum-aligned learning", subjects: "Subjects", continueLearning: "Continue Learning", resumeLearning: "Resume where you left off",
    revisionDue: "Revision Due!", revisionReady: "concepts ready for review", unlockCurriculum: "Unlock Full Curriculum",
    pendingReview: "Pending Review", inReview: "In Review", approved: "Approved", rejected: "Rejected", limitReached: "Limit Reached", limitReachedDesc: "You've reached the upload limit for this battle.",
    seekhoPreviewTitle: "📖 Seekho", seekhoPreviewSub: "Learn subjects, skills and creative activities", explore: "Explore →",
    vidyaStarPreviewTitle: "🌟 VidyaStar Contest", vidyaStarPreviewSub: "Showcase your talent and win prizes",
    couldNotLoadContests: "Could not load contests.", contestsComingSoon: "Exciting contests coming soon!", viewResults: "View Results →", participateNow: "Participate Now →",
    skillBattlePreviewTitle: "⚔️ SkillBattle Challenge", skillBattlePreviewSub: "Compete, rank higher, and win exciting prizes",
    couldNotLoadBattles: "Could not load battles.", battlesComingSoon: "New battles coming soon!", poweredBy: "Powered by {{name}}", joinedCount: "{{count}} joined",
    knowledgeHubTitle: "🌐 Knowledge Hub", knowledgeHubSub: "Videos for learning, growth and daily life", watchMore: "Watch More →",
    couldNotLoadVideos: "Could not load videos.", moreVideosSoon: "More videos coming soon!", noVideosInCat: "No \"{{cat}}\" videos yet.",
    shortLearningTitle: "Short Learning", noLearningVideos: "No learning videos yet",
    skillBattleShortsTitle: "🔥 Shorts", noSkillBattleVideos: "No skill battle videos yet", battleBadge: "⚡ Battle",
    shikshaStarPreviewTitle: "⭐ ShikshaStar", shikshaStarPreviewSub: "Celebrating talented students of Vidya", viewStars: "View Stars →",
    couldNotLoadStars: "Could not load stars.", shikshaStarEmpty: "Your talent can be featured here soon!", becomeShikshaStar: "Become a ShikshaStar",
    discoverPreviewTitle: "🧭 Discover AI", discoverPreviewSub: "AI-powered career, college & scholarship discovery",
    discoverTitle: "Vidya Discover AI", discoverSubtitle: "Find your perfect career, college & scholarships", discoverCta: "Explore Your Future →",
    aiGuruTagline: "India's Most Useful AI Guru",
    menuAiDashboard: "AI Dashboard", menuAiDashboardSub: "Your personalised AI learning hub",
    menuDiscoverAI: "Discover AI", menuDiscoverAISub: "Explore careers, colleges & scholarships",
    menuVidyaGuruCard: "VidyaGuru AI", menuVidyaGuruCardSub: "Chat with your personal AI teacher",
    menuGenerateLesson: "Generate Lesson", menuGenerateLessonSub: "AI creates a full lesson for you",
    menuMyLessons: "My AI Lessons", menuMyLessonsSub: "Resume or review past lessons",
    menuRevisionReels: "Revision Reels", menuRevisionReelsSub: "Short video revision sessions",
    menuPracticeTests: "Practice Tests", menuPracticeTestsSub: "Exam-style practice with analysis",
    menuAskAiGuruCard: "Ask AI Guru", menuAskAiGuruCardSub: "Ask any doubt, get instant answer",
    goodMorning: "Good morning", goodAfternoon: "Good afternoon", goodEvening: "Good evening", helloGreet: "Hello",
    whatToLearnToday: "What would you like to know today?",
    browseBySubject: "Browse by subject",
    freeQuestionsRemaining: "{{count}} free question remaining today · Resets at midnight IST",
    freeQuestionsRemainingPlural: "{{count}} free questions remaining today · Resets at midnight IST",
    askFollowUpPlaceholder: "Ask a follow-up question...",
    askSyllabusPlaceholder: "Ask anything about your syllabus...",
    thinkingLabel: "Thinking...",
    wantToGoDeeper: "Want to go deeper?",
    generateLessonAction: "✨ Generate Lesson", chatWithAIAction: "🤖 Chat with AI",
    chatWithVidyaGuruAction: "🤖 Chat with VidyaGuru instead",
    askAnotherQuestion: "Ask another question",
    dailyLimitTitle: "Daily limit reached",
    dailyLimitMessage: "You've used all {{count}} free questions for today. Come back tomorrow or upgrade to Premium.",
    generateFullLessonAction: "✨ Generate Full Lesson",
    somethingWentWrong: "Something went wrong", tryAgainLabel: "Try again",
    leftLabel: "left", askAiGuruTitle: "Ask AI Guru",
    respondingIn: "Responding in {{lang}}", voiceMessage: "🎤 Voice message",
    askSomethingPlaceholder: "Ask something...",
    themeDescDark: "Turn off for Light mode", themeDescLight: "Turn on for Dark mode",
    notificationsDesc: "Receive push notifications",
    changePassword: "Change Password", changePasswordDesc: "Update your account password",
    privacyDesc: "Manage your privacy settings",
    aboutDesc: "Learn more about GLOOWS365E",
    currentTheme: "Current Theme:", themeDark: "🌙 Dark", themeLight: "☀️ Light",
    goBack: "Go Back",
    noLanguagesMatch: "No languages match your search.",
    languageInfoText: "These are the 22 languages listed in the 8th Schedule of the Constitution of India. Your selected language will be used to personalise lessons and content across the app.",
    backToSettings: "Back to Settings",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "Snap a question, get instant solution",
    menuExamSimulator: "Exam Simulator", menuExamSimulatorSub: "AI board-pattern mock tests",
    menuVoiceTutor: "Voice Tutor", menuVoiceTutorSub: "Speak your doubt, AI answers",
    menuAiNotebook: "My AI Notebook", menuAiNotebookSub: "Saved AI conversations",
    modeExplain: "Explain a Concept", modeNotes: "Make Notes", modeExam: "Prepare for Exam",
    modeDoubt: "Solve My Doubt", modeSummarize: "Summarize Chapter", modeTip: "Daily Study Tip",
    modeLanguage: "Explain in My Language",
    notebookTitle: "My AI Notebook", notebookEmpty: "Notebook is empty",
    notebookEmptyDesc: "Save any AI answer by tapping \"Save to Notebook\"",
    savedToNotebook: "Saved to Notebook", saveToNotebook: "Save to Notebook",
    viewNotebook: "View Notebook", pinned: "Pinned",
    photoSolveTitle: "PhotoSolve AI", photoSolveSub: "Snap any question for instant solution",
    snapQuestion: "Snap a Question", solving: "Solving your question…",
    stepBystep: "Step-by-Step Solution", finalAnswer: "Final Answer",
    similarQuestions: "Practice These Too", solveAnother: "Solve Another Question",
    examSimTitle: "Exam Simulator", examSimSub: "Board-pattern mock tests · AI-evaluated",
    generateExam: "Generate Exam", submitExam: "Submit Exam",
    examResults: "Your Results", boardReadiness: "Board Exam Readiness",
    weakAreas: "Need More Practice", strongAreas: "Strong Areas",
    takeAnotherExam: "Take Another Exam",
    voiceTutorTitle: "Voice Tutor", voiceTutorSub: "Speak your doubt · Get instant answer",
    tapToSpeak: "Tap to speak your question", recording: "Recording… tap to stop",
    speakYourDoubt: "Speak your doubt", explainInMyLanguage: "Explain in My Language",
    poweredByAI: "Powered by AI", onlineLabel: "Online",
    yourSchool: "Your School", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "Level", xpToNextLevel: "XP to next level",
    vCoinsRankLabel: "V-Coins Rank", viewLabel: "View",
    giftClaimed: "Gift Claimed!", surpriseGiftWaiting: "Surprise Gift Waiting!",
    giftOnItsWay: "Your gift is on its way", tapToClaimReward: "Tap to claim your reward",
    learnFunLabel: "LearnFun",
    referEarn: "Refer & Earn", referEarnSub: "Earn VCoins for every friend who joins",
    viewAllLabel: "View all", friendsJoined: "Friends joined",
    vCoinsEarned: "VCoins earned", perReferral: "Per referral",
    yourCode: "Your code", copyLabel: "Copy", copiedLabel: "Copied!",
    referMoreFriends: "Refer More Friends", friendAlsoGets: "Friend also gets",
    shortReelsTitle: "Short Reels", curatedByVidya: "Curated by Vidya AI",
    seeAll: "See All", watchAll: "Watch All", topApprovedReels: "Top approved reels",
    poweredByGemini: "Powered by Gemini AI", activeLabel: "Active",
    classLabel: "Class", sponsoredBattle: "Sponsored Battle",
    poweredBySponsor: "Powered by", classSixToTwelve: "Class 6–12",
    indiaPrizePool: "India Prize Pool", aiLessonReady: "AI Lesson Ready",
    viewFinalLeaderboard: "View Final Leaderboard", viewLiveStandings: "View Live Standings",
    lessonBeingPrepared: "Lesson being prepared…",
    vCoinsBalance: "V-Coins Balance", totalEarned: "Total Earned",
    totalSpent: "Total Spent", thisMonth: "This Month",
    earnVCoins: "Earn V-Coins", transactionHistory: "Transaction History",
    noTransactionsYet: "No transactions yet",
    noTransactionsSub: "Start watching videos and learning to earn V-Coins!",
    walletLabel: "Wallet", leaderboardLabel: "Leaderboard",
    seeTop100: "See Top 100", showLess: "Show Less",
    yourRank: "Your Rank", updatedDaily: "Updated Daily",
    referralTitle: "Refer & Earn", inviteFriendsEarn: "Invite friends, earn VCoins!",
    totalReferred: "Total referred", completed: "Completed",
    yourReferralCode: "Your referral code", shareCode: "Share this code with friends. They enter it during signup.",
    howItWorks: "How it works", referralHistory: "Referral history",
    shareEarn: "Share & Earn", pendingLabel: "Pending", joinedLabel: "Joined",
    stepLabel: "Step", moreReferralsToUnlock: "more referrals to unlock",
    nextReward: "Next reward",
  },

  // ─────────────────────────── Hindi ────────────────────────────────
  hi: {
    home: "होम", leaderboard: "लीडरबोर्ड", wallet: "वॉलेट",
    settings: "सेटिंग्स", dashboard: "डैशबोर्ड", aiGuru: "AI गुरु",
    skillBoard: "स्किल बोर्ड", logout: "लॉगआउट",
    profileSettings: "प्रोफ़ाइल सेटिंग्स", language: "भाषा",
    changeLanguage: "ऐप और सामग्री की भाषा बदलें",
    darkTheme: "डार्क थीम", notifications: "सूचनाएं",
    privacy: "गोपनीयता", about: "परिचय",
    customizeExperience: "अपना अनुभव अनुकूलित करें",
    save: "सहेजें", cancel: "रद्द करें", edit: "संपादित करें", back: "वापस",
    delete: "हटाएं", loading: "लोड हो रहा है...", editProfile: "प्रोफ़ाइल संपादित करें",
    saveChanges: "बदलाव सहेजें", verify: "सत्यापित करें", confirm: "पुष्टि करें", send: "भेजें",
    languageTitle: "भाषा", languageSubtitle: "भारतीय संविधान की 8वीं अनुसूची की सभी 22 भाषाएँ",
    searchLanguage: "भाषा खोजें...", scheduleNote: "ये भारत के संविधान की 8वीं अनुसूची में सूचीबद्ध 22 भाषाएँ हैं।",
    basicInfo: "मूल जानकारी", academicDetails: "शैक्षणिक विवरण",
    location: "स्थान", interests: "रुचियाँ", fullName: "पूरा नाम",
    phoneNumber: "फ़ोन नंबर", dateOfBirth: "जन्म तिथि", age: "आयु",
    school: "स्कूल / संस्थान", preferredLanguage: "पसंदीदा भाषा",
    pincode: "पिनकोड", class: "कक्षा / ग्रेड", board: "बोर्ड",
    learnFunLoading: "LearnFun दुनिया लोड हो रही है...",
    profileNotFound: "प्रोफ़ाइल नहीं मिली",
    profileSetupPrompt: "खेलना शुरू करने के लिए अपनी प्रोफ़ाइल पूरी करें!",
    dailyStreak: "दैनिक स्ट्रीक", view: "देखें", todaysMission: "आज का मिशन",
    daily: "दैनिक", noMissionToday: "आज कोई मिशन नहीं। जल्द वापस आएं!",
    skillWorlds: "कौशल दुनिया", bossBattle: "बॉस बैटल",
    yourGames: "आपके खेल", gamesLoading: "खेल लोड हो रहे हैं...",
    yourBadges: "आपके बैज", viewAll: "सभी देखें", comingSoon: "जल्द आ रहा है", play: "खेलें",
    searchVideos: "वीडियो, विषय, शिक्षक खोजें...",
    featured: "विशेष", noVideosFound: "कोई वीडियो नहीं मिला",
    clearFilters: "फ़िल्टर साफ़ करें", allVideos: "सभी वीडियो",
    videosComingSoon: "वीडियो जल्द आएंगे!",
    loadingBattles: "बैटल लोड हो रहे हैं...", noActiveBattles: "कोई सक्रिय बैटल नहीं",
    checkBackSoon: "नई स्किल बैटल के लिए जल्द वापस आएं!",
    refresh: "ताज़ा करें", computingRanks: "रैंक गणना हो रही है...",
    retry: "पुनः प्रयास", notRankedYet: "आप अभी रैंक में नहीं हैं",
    uploadReelPrompt: "बैटल में शामिल होने के लिए रील अपलोड करें!",
    viewFullSkillboard: "पूरा स्किलबोर्ड देखें",
    battleEnded: "बैटल समाप्त", notEligible: "पात्र नहीं", uploadReel: "रील अपलोड करें",
    loginRequired: "लॉगिन आवश्यक है", live: "लाइव", completed: "पूर्ण",
    prizePool: "पुरस्कार राशि", endingSoon: "जल्द समाप्त होगा", viewResult: "परिणाम देखें",
    joinNow: "अभी जुड़ें", participate: "भाग लें", reserveSpot: "सीट बुक करें",
    startsSoon: "जल्द शुरू होगा", all: "सभी", upcoming: "आगामी",
    aiGuruSubtitle: "आपका व्यक्तिगत शिक्षण सहायक", askAnything: "कुछ भी पूछें", instantAnswers: "तत्काल उत्तर", studyHelp: "पढ़ाई में मदद", startChatting: "बात शुरू करें →",
    premiumFeature: "प्रीमियम फीचर", premiumUnlockMsg: "इस फीचर को अनलॉक करने के लिए AI Guru Premium अपग्रेड करें।", maybeLater: "बाद में", upgrade: "अपग्रेड करें",
    aiClassroom: "आपकी व्यक्तिगत AI क्लासरूम\nGemini द्वारा संचालित", freeLessonsLeft: "आज के मुफ़्त पाठ शेष", unlimitedAccess: "असीमित प्रीमियम एक्सेस सक्रिय",
    lessonSetup: "पाठ सेटअप", continueBtn: "जारी रखें →", fillRequiredFields: "आवश्यक फ़ील्ड भरें", fillRequiredFieldsDesc: "कृपया विषय चुनें और अध्याय का नाम दर्ज करें।",
    vidyaGuruAI: "विद्यागुरु AI", personalAiTeacher: "आपके व्यक्तिगत AI शिक्षक", readyToHelp: "मदद के लिए तैयार!", thinking: "सोच रहा हूँ...", speaking: "बोल रहा हूँ...", listening: "सुन रहा हूँ...",
    paywallTitle: "विद्यागुरु के साथ जारी रखें?", paywallBody: "आज का मुफ़्त प्रश्न समाप्त। असीमित बातचीत के लिए प्रीमियम अपग्रेड करें!", upgradeToPremium: "प्रीमियम में अपग्रेड करें",
    seekhoSignIn: "Seekho एक्सेस करने के लिए लॉगिन करें", curriculumAligned: "पाठ्यक्रम-आधारित शिक्षण", subjects: "विषय", continueLearning: "सीखना जारी रखें", resumeLearning: "जहाँ छोड़ा था वहाँ से शुरू करें",
    revisionDue: "रिवीजन करें!", revisionReady: "अवधारणाएं समीक्षा के लिए तैयार", unlockCurriculum: "पूरा पाठ्यक्रम अनलॉक करें",
    pendingReview: "समीक्षा प्रतीक्षित", inReview: "जांच में", approved: "स्वीकृत", rejected: "अस्वीकृत", limitReached: "सीमा पहुंच गई", limitReachedDesc: "आपने इस बैटल की अपलोड सीमा पार कर ली है।",
    seekhoPreviewTitle: "📖 सीखो", seekhoPreviewSub: "विषय, कौशल और रचनात्मक गतिविधियाँ सीखें", explore: "एक्सप्लोर करें →",
    vidyaStarPreviewTitle: "🌟 विद्यास्टार प्रतियोगिता", vidyaStarPreviewSub: "अपनी प्रतिभा दिखाएं और पुरस्कार जीतें",
    couldNotLoadContests: "प्रतियोगिताएं लोड नहीं हो सकीं।", contestsComingSoon: "रोमांचक प्रतियोगिताएं जल्द आ रही हैं!", viewResults: "परिणाम देखें →", participateNow: "अभी भाग लें →",
    skillBattlePreviewTitle: "⚔️ स्किलबैटल चैलेंज", skillBattlePreviewSub: "प्रतिस्पर्धा करें, रैंक बढ़ाएं और पुरस्कार जीतें",
    couldNotLoadBattles: "बैटल लोड नहीं हो सके।", battlesComingSoon: "नई बैटल जल्द आ रही हैं!", poweredBy: "{{name}} द्वारा संचालित", joinedCount: "{{count}} शामिल हुए",
    knowledgeHubTitle: "🌐 नॉलेज हब", knowledgeHubSub: "सीखने, विकास और दैनिक जीवन के लिए वीडियो", watchMore: "और देखें →",
    couldNotLoadVideos: "वीडियो लोड नहीं हो सके।", moreVideosSoon: "और वीडियो जल्द आएंगे!", noVideosInCat: "\"{{cat}}\" में अभी कोई वीडियो नहीं।",
    shortLearningTitle: "शॉर्ट लर्निंग", noLearningVideos: "अभी कोई लर्निंग वीडियो नहीं",
    skillBattleShortsTitle: "🔥 शॉर्ट्स", noSkillBattleVideos: "अभी कोई स्किल बैटल वीडियो नहीं", battleBadge: "⚡ बैटल",
    shikshaStarPreviewTitle: "⭐ शिक्षास्टार", shikshaStarPreviewSub: "विद्या के प्रतिभाशाली छात्रों का जश्न", viewStars: "स्टार देखें →",
    couldNotLoadStars: "स्टार लोड नहीं हो सके।", shikshaStarEmpty: "आपकी प्रतिभा यहाँ जल्द दिखाई जा सकती है!", becomeShikshaStar: "शिक्षास्टार बनें",
    discoverPreviewTitle: "🧭 डिस्कवर AI", discoverPreviewSub: "AI-संचालित करियर, कॉलेज और छात्रवृत्ति खोज",
    discoverTitle: "विद्या डिस्कवर AI", discoverSubtitle: "अपना सही करियर, कॉलेज और छात्रवृत्ति खोजें", discoverCta: "अपना भविष्य एक्सप्लोर करें →",
    aiGuruTagline: "भारत का सबसे उपयोगी AI गुरु",
    menuAiDashboard: "AI डैशबोर्ड", menuAiDashboardSub: "आपका व्यक्तिगत AI लर्निंग हब",
    menuDiscoverAI: "डिस्कवर AI", menuDiscoverAISub: "करियर, कॉलेज और छात्रवृत्ति खोजें",
    menuVidyaGuruCard: "विद्यागुरु AI", menuVidyaGuruCardSub: "अपने AI शिक्षक से बात करें",
    menuGenerateLesson: "पाठ बनाएं", menuGenerateLessonSub: "AI आपके लिए पूरा पाठ बनाता है",
    menuMyLessons: "मेरे AI पाठ", menuMyLessonsSub: "पिछले पाठ देखें या दोबारा पढ़ें",
    menuRevisionReels: "रिवीजन रील्स", menuRevisionReelsSub: "शॉर्ट वीडियो रिवीजन सेशन",
    menuPracticeTests: "प्रैक्टिस टेस्ट", menuPracticeTestsSub: "विश्लेषण के साथ परीक्षा-शैली अभ्यास",
    menuAskAiGuruCard: "AI गुरु से पूछें", menuAskAiGuruCardSub: "कोई भी सवाल पूछें, तुरंत जवाब पाएं",
    goodMorning: "सुप्रभात", goodAfternoon: "नमस्ते", goodEvening: "शुभ संध्या", helloGreet: "नमस्ते",
    whatToLearnToday: "आज आप क्या सीखना चाहते हैं?",
    browseBySubject: "विषय के अनुसार ब्राउज़ करें",
    freeQuestionsRemaining: "{{count}} मुफ़्त प्रश्न शेष आज · मध्यरात्रि IST पर रीसेट",
    freeQuestionsRemainingPlural: "{{count}} मुफ़्त प्रश्न शेष आज · मध्यरात्रि IST पर रीसेट",
    askFollowUpPlaceholder: "अनुवर्ती प्रश्न पूछें...",
    askSyllabusPlaceholder: "पाठ्यक्रम के बारे में कुछ भी पूछें...",
    thinkingLabel: "सोच रहा हूँ...",
    wantToGoDeeper: "और गहराई से सीखना चाहते हैं?",
    generateLessonAction: "✨ पाठ बनाएं", chatWithAIAction: "🤖 AI से बात करें",
    chatWithVidyaGuruAction: "🤖 विद्यागुरु से बात करें",
    askAnotherQuestion: "एक और प्रश्न पूछें",
    dailyLimitTitle: "दैनिक सीमा समाप्त",
    dailyLimitMessage: "आपने आज के सभी {{count}} मुफ़्त प्रश्न उपयोग कर लिए। कल वापस आएं या प्रीमियम अपग्रेड करें।",
    generateFullLessonAction: "✨ पूरा पाठ बनाएं",
    somethingWentWrong: "कुछ गड़बड़ हुई", tryAgainLabel: "फिर से कोशिश करें",
    leftLabel: "शेष", askAiGuruTitle: "AI गुरु से पूछें",
    respondingIn: "{{lang}} में जवाब दे रहा हूँ", voiceMessage: "🎤 वॉइस मेसेज",
    askSomethingPlaceholder: "कुछ पूछें...",
    themeDescDark: "लाइट मोड के लिए बंद करें", themeDescLight: "डार्क मोड के लिए चालू करें",
    notificationsDesc: "पुश नोटिफिकेशन प्राप्त करें",
    changePassword: "पासवर्ड बदलें", changePasswordDesc: "अपना अकाउंट पासवर्ड अपडेट करें",
    privacyDesc: "अपनी गोपनीयता सेटिंग्स प्रबंधित करें",
    aboutDesc: "GLOOWS365E के बारे में जानें",
    currentTheme: "वर्तमान थीम:", themeDark: "🌙 डार्क", themeLight: "☀️ लाइट",
    goBack: "वापस जाएं",
    noLanguagesMatch: "कोई भाषा नहीं मिली।",
    languageInfoText: "ये भारत के संविधान की 8वीं अनुसूची में सूचीबद्ध 22 भाषाएँ हैं। आपकी चुनी हुई भाषा पूरे ऐप में पाठ और सामग्री को व्यक्तिगत बनाने के लिए उपयोग की जाएगी।",
    backToSettings: "सेटिंग्स पर वापस",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "प्रश्न की फ़ोटो खींचें, तुरंत हल पाएं",
    menuExamSimulator: "परीक्षा सिमुलेटर", menuExamSimulatorSub: "AI बोर्ड-पैटर्न मॉक टेस्ट",
    menuVoiceTutor: "वॉइस ट्यूटर", menuVoiceTutorSub: "अपना संदेह बोलें, AI जवाब देगा",
    menuAiNotebook: "मेरी AI नोटबुक", menuAiNotebookSub: "सहेजी गई AI बातचीत",
    modeExplain: "अवधारणा समझाएं", modeNotes: "नोट्स बनाएं", modeExam: "परीक्षा तैयारी",
    modeDoubt: "संदेह हल करें", modeSummarize: "अध्याय सारांश", modeTip: "दैनिक अध्ययन टिप",
    modeLanguage: "अपनी भाषा में समझाएं",
    notebookTitle: "मेरी AI नोटबुक", notebookEmpty: "नोटबुक खाली है",
    notebookEmptyDesc: "\"नोटबुक में सहेजें\" दबाकर AI उत्तर सहेजें",
    savedToNotebook: "नोटबुक में सहेजा गया", saveToNotebook: "नोटबुक में सहेजें",
    viewNotebook: "नोटबुक देखें", pinned: "पिन किया गया",
    photoSolveTitle: "PhotoSolve AI", photoSolveSub: "किसी भी प्रश्न की फ़ोटो खींचें",
    snapQuestion: "प्रश्न की फ़ोटो खींचें", solving: "आपका प्रश्न हल हो रहा है…",
    stepBystep: "चरण-दर-चरण हल", finalAnswer: "अंतिम उत्तर",
    similarQuestions: "इन्हें भी हल करें", solveAnother: "दूसरा प्रश्न हल करें",
    examSimTitle: "परीक्षा सिमुलेटर", examSimSub: "बोर्ड-पैटर्न मॉक टेस्ट · AI मूल्यांकन",
    generateExam: "परीक्षा बनाएं", submitExam: "परीक्षा जमा करें",
    examResults: "आपके परिणाम", boardReadiness: "बोर्ड परीक्षा तैयारी",
    weakAreas: "और अभ्यास जरूरी", strongAreas: "मजबूत विषय",
    takeAnotherExam: "और परीक्षा दें",
    voiceTutorTitle: "वॉइस ट्यूटर", voiceTutorSub: "संदेह बोलें · तुरंत जवाब पाएं",
    tapToSpeak: "प्रश्न बोलने के लिए टैप करें", recording: "रिकॉर्डिंग… रोकने के लिए टैप करें",
    speakYourDoubt: "अपना संदेह बोलें", explainInMyLanguage: "अपनी भाषा में समझाएं",
    poweredByAI: "AI द्वारा संचालित", onlineLabel: "ऑनलाइन",
    yourSchool: "आपका स्कूल", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "लेवल", xpToNextLevel: "अगले लेवल तक XP",
    vCoinsRankLabel: "V-Coins रैंक", viewLabel: "देखें",
    giftClaimed: "गिफ्ट मिल गया!", surpriseGiftWaiting: "सरप्राइज गिफ्ट इंतजार कर रहा है!",
    giftOnItsWay: "आपका गिफ्ट रास्ते में है", tapToClaimReward: "इनाम लेने के लिए टैप करें",
    learnFunLabel: "LearnFun",
    referEarn: "रेफर करें और कमाएं", referEarnSub: "हर दोस्त के जुड़ने पर VCoins कमाएं",
    viewAllLabel: "सभी देखें", friendsJoined: "दोस्त जुड़े",
    vCoinsEarned: "VCoins कमाए", perReferral: "प्रति रेफरल",
    yourCode: "आपका कोड", copyLabel: "कॉपी करें", copiedLabel: "कॉपी हो गया!",
    referMoreFriends: "और दोस्तों को रेफर करें", friendAlsoGets: "दोस्त को भी मिलता है",
    shortReelsTitle: "शॉर्ट रील्स", curatedByVidya: "Vidya AI द्वारा चयनित",
    seeAll: "सब देखें", watchAll: "सब देखें", topApprovedReels: "शीर्ष स्वीकृत रील्स",
    poweredByGemini: "Gemini AI द्वारा संचालित", activeLabel: "सक्रिय",
    classLabel: "कक्षा", sponsoredBattle: "प्रायोजित बैटल",
    poweredBySponsor: "द्वारा संचालित", classSixToTwelve: "कक्षा 6–12",
    indiaPrizePool: "भारत पुरस्कार राशि", aiLessonReady: "AI पाठ तैयार है",
    viewFinalLeaderboard: "अंतिम लीडरबोर्ड देखें", viewLiveStandings: "लाइव स्टैंडिंग देखें",
    lessonBeingPrepared: "पाठ तैयार किया जा रहा है…",
    vCoinsBalance: "V-Coins बैलेंस", totalEarned: "कुल कमाए",
    totalSpent: "कुल खर्च", thisMonth: "इस महीने",
    earnVCoins: "V-Coins कमाएं", transactionHistory: "लेनदेन इतिहास",
    noTransactionsYet: "अभी कोई लेनदेन नहीं",
    noTransactionsSub: "V-Coins कमाने के लिए वीडियो देखें और सीखें!",
    walletLabel: "वॉलेट", leaderboardLabel: "लीडरबोर्ड",
    seeTop100: "टॉप 100 देखें", showLess: "कम दिखाएं",
    yourRank: "आपकी रैंक", updatedDaily: "रोज़ अपडेट",
    referralTitle: "रेफर करें और कमाएं", inviteFriendsEarn: "दोस्तों को आमंत्रित करें, VCoins कमाएं!",
    totalReferred: "कुल रेफर", completed: "पूर्ण",
    yourReferralCode: "आपका रेफरल कोड", shareCode: "यह कोड दोस्तों के साथ शेयर करें।",
    howItWorks: "यह कैसे काम करता है", referralHistory: "रेफरल इतिहास",
    shareEarn: "शेयर करें और कमाएं", pendingLabel: "लंबित", joinedLabel: "जुड़े",
    stepLabel: "चरण", moreReferralsToUnlock: "और रेफरल अनलॉक करने के लिए",
    nextReward: "अगला इनाम",
  },

  // ─────────────────────────── Bengali ──────────────────────────────
  bn: {
    home: "হোম", leaderboard: "লিডারবোর্ড", wallet: "ওয়ালেট",
    settings: "সেটিংস", dashboard: "ড্যাশবোর্ড", aiGuru: "AI গুরু",
    skillBoard: "স্কিল বোর্ড", logout: "লগআউট",
    profileSettings: "প্রোফাইল সেটিংস", language: "ভাষা",
    changeLanguage: "অ্যাপ ও কন্টেন্টের ভাষা পরিবর্তন করুন",
    darkTheme: "ডার্ক থিম", notifications: "বিজ্ঞপ্তি",
    privacy: "গোপনীয়তা", about: "সম্পর্কে",
    customizeExperience: "আপনার অভিজ্ঞতা কাস্টমাইজ করুন",
    save: "সংরক্ষণ করুন", cancel: "বাতিল", edit: "সম্পাদনা করুন", back: "ফিরে যান",
    delete: "মুছুন", loading: "লোড হচ্ছে...", editProfile: "প্রোফাইল সম্পাদনা করুন",
    saveChanges: "পরিবর্তন সংরক্ষণ করুন", verify: "যাচাই করুন", confirm: "নিশ্চিত করুন", send: "পাঠান",
    languageTitle: "ভাষা", languageSubtitle: "ভারতীয় সংবিধানের ৮ম তফসিলের সকল ২২টি ভাষা",
    searchLanguage: "ভাষা অনুসন্ধান করুন...", scheduleNote: "এগুলি ভারতের সংবিধানের ৮ম তফসিলে তালিকাভুক্ত ২২টি ভাষা।",
    basicInfo: "মূল তথ্য", academicDetails: "একাডেমিক বিবরণ",
    location: "অবস্থান", interests: "আগ্রহ", fullName: "পূর্ণ নাম",
    phoneNumber: "ফোন নম্বর", dateOfBirth: "জন্ম তারিখ", age: "বয়স",
    school: "স্কুল / প্রতিষ্ঠান", preferredLanguage: "পছন্দের ভাষা",
    pincode: "পিনকোড", class: "শ্রেণী / গ্রেড", board: "বোর্ড",
    learnFunLoading: "আপনার LearnFun জগৎ লোড হচ্ছে...",
    profileNotFound: "প্রোফাইল পাওয়া যায়নি",
    profileSetupPrompt: "খেলা শুরু করতে আপনার প্রোফাইল সম্পূর্ণ করুন!",
    dailyStreak: "দৈনিক স্ট্রিক", view: "দেখুন", todaysMission: "আজকের মিশন",
    daily: "দৈনিক", noMissionToday: "আজকে কোনো মিশন নেই। শীঘ্রই ফিরে আসুন!",
    skillWorlds: "দক্ষতার জগৎ", bossBattle: "বস ব্যাটেল",
    yourGames: "আপনার গেমস", gamesLoading: "গেমস লোড হচ্ছে...",
    yourBadges: "আপনার ব্যাজ", viewAll: "সব দেখুন", comingSoon: "শীঘ্রই আসছে", play: "খেলুন",
    searchVideos: "ভিডিও, বিষয়, শিক্ষক খুঁজুন...",
    featured: "বিশেষ", noVideosFound: "কোনো ভিডিও পাওয়া যায়নি",
    clearFilters: "ফিল্টার সাফ করুন", allVideos: "সব ভিডিও",
    videosComingSoon: "ভিডিও শীঘ্রই আসছে!",
    loadingBattles: "ব্যাটেল লোড হচ্ছে...", noActiveBattles: "কোনো সক্রিয় ব্যাটেল নেই",
    checkBackSoon: "নতুন স্কিল ব্যাটেলের জন্য শীঘ্রই ফিরে আসুন!",
    refresh: "রিফ্রেশ", computingRanks: "আপনার র‌্যাঙ্ক গণনা হচ্ছে...",
    retry: "পুনরায় চেষ্টা", notRankedYet: "আপনি এখনো র‌্যাংকড নন",
    uploadReelPrompt: "ব্যাটেলে অংশ নিতে রিল আপলোড করুন!",
    viewFullSkillboard: "পূর্ণ স্কিলবোর্ড দেখুন",
    battleEnded: "ব্যাটেল শেষ", notEligible: "যোগ্য নয়", uploadReel: "রিল আপলোড করুন",
    loginRequired: "লগইন প্রয়োজন", live: "লাইভ", completed: "সম্পন্ন",
    prizePool: "পুরস্কার পুল", endingSoon: "শীঘ্রই শেষ হবে", viewResult: "ফলাফল দেখুন",
    joinNow: "এখনই যোগ দিন", participate: "অংশগ্রহণ করুন", reserveSpot: "জায়গা বুক করুন",
    startsSoon: "শীঘ্রই শুরু হবে", all: "সব", upcoming: "আসন্ন",
    aiGuruSubtitle: "আপনার ব্যক্তিগত শিক্ষা সহায়ক", askAnything: "যেকোনো কিছু জিজ্ঞেস করুন", instantAnswers: "তাৎক্ষণিক উত্তর", studyHelp: "পড়াশুনায় সাহায্য", startChatting: "চ্যাট শুরু করুন →",
    premiumFeature: "প্রিমিয়াম ফিচার", premiumUnlockMsg: "এই ফিচার আনলক করতে AI Guru Premium আপগ্রেড করুন।", maybeLater: "পরে", upgrade: "আপগ্রেড",
    aiClassroom: "আপনার ব্যক্তিগত AI ক্লাসরুম\nGemini দ্বারা চালিত", freeLessonsLeft: "আজকের বিনামূল্যে পাঠ বাকি", unlimitedAccess: "সীমাহীন প্রিমিয়াম অ্যাক্সেস সক্রিয়",
    lessonSetup: "পাঠ সেটআপ", continueBtn: "চালিয়ে যান →", fillRequiredFields: "প্রয়োজনীয় তথ্য পূরণ করুন", fillRequiredFieldsDesc: "অনুগ্রহ করে বিষয় নির্বাচন করুন এবং অধ্যায়ের নাম লিখুন।",
    vidyaGuruAI: "বিদ্যাগুরু AI", personalAiTeacher: "আপনার ব্যক্তিগত AI শিক্ষক", readyToHelp: "সাহায্যের জন্য প্রস্তুত!", thinking: "ভাবছি...", speaking: "বলছি...", listening: "শুনছি...",
    paywallTitle: "বিদ্যাগুরুর সাথে চালিয়ে যান?", paywallBody: "আজকের বিনামূল্যে প্রশ্ন শেষ। সীমাহীন কথোপকথনের জন্য প্রিমিয়াম আপগ্রেড করুন!", upgradeToPremium: "প্রিমিয়ামে আপগ্রেড করুন",
    seekhoSignIn: "Seekho অ্যাক্সেস করতে লগইন করুন", curriculumAligned: "পাঠ্যক্রম-ভিত্তিক শিক্ষা", subjects: "বিষয়সমূহ", continueLearning: "শেখা চালিয়ে যান", resumeLearning: "যেখানে ছেড়েছিলেন সেখান থেকে শুরু করুন",
    revisionDue: "রিভিশন করুন!", revisionReady: "ধারণাসমূহ পুনরালোচনার জন্য প্রস্তুত", unlockCurriculum: "সম্পূর্ণ পাঠ্যক্রম আনলক করুন",
    pendingReview: "পর্যালোচনা বাকি", inReview: "পর্যালোচনায়", approved: "অনুমোদিত", rejected: "প্রত্যাখ্যাত", limitReached: "সীমা পৌঁছেছে", limitReachedDesc: "আপনি এই ব্যাটেলের আপলোড সীমায় পৌঁছে গেছেন।",
    seekhoPreviewTitle: "📖 শেখো", seekhoPreviewSub: "বিষয়, দক্ষতা ও সৃজনশীল কার্যক্রম শিখুন", explore: "এক্সপ্লোর করুন →",
    vidyaStarPreviewTitle: "🌟 বিদ্যাস্টার প্রতিযোগিতা", vidyaStarPreviewSub: "আপনার প্রতিভা দেখান এবং পুরস্কার জিতুন",
    couldNotLoadContests: "প্রতিযোগিতা লোড করা যায়নি।", contestsComingSoon: "রোমাঞ্চকর প্রতিযোগিতা শীঘ্রই আসছে!", viewResults: "ফলাফল দেখুন →", participateNow: "এখনই অংশগ্রহণ করুন →",
    skillBattlePreviewTitle: "⚔️ স্কিলব্যাটেল চ্যালেঞ্জ", skillBattlePreviewSub: "প্রতিযোগিতা করুন, র‌্যাংক বাড়ান এবং পুরস্কার জিতুন",
    couldNotLoadBattles: "ব্যাটেল লোড করা যায়নি।", battlesComingSoon: "নতুন ব্যাটেল শীঘ্রই আসছে!", poweredBy: "{{name}} দ্বারা চালিত", joinedCount: "{{count}} জন যোগ দিয়েছেন",
    knowledgeHubTitle: "🌐 নলেজ হাব", knowledgeHubSub: "শেখার, বিকাশের ও দৈনন্দিন জীবনের ভিডিও", watchMore: "আরও দেখুন →",
    couldNotLoadVideos: "ভিডিও লোড করা যায়নি।", moreVideosSoon: "আরও ভিডিও শীঘ্রই আসছে!", noVideosInCat: "\"{{cat}}\" এর কোনো ভিডিও নেই এখনো।",
    shortLearningTitle: "শর্ট লার্নিং", noLearningVideos: "এখনো কোনো লার্নিং ভিডিও নেই",
    skillBattleShortsTitle: "🔥 শর্টস", noSkillBattleVideos: "এখনো কোনো স্কিল ব্যাটেল ভিডিও নেই", battleBadge: "⚡ ব্যাটেল",
    shikshaStarPreviewTitle: "⭐ শিক্ষাস্টার", shikshaStarPreviewSub: "বিদ্যার প্রতিভাবান শিক্ষার্থীদের উদযাপন", viewStars: "স্টার দেখুন →",
    couldNotLoadStars: "স্টার লোড করা যায়নি।", shikshaStarEmpty: "আপনার প্রতিভা এখানে শীঘ্রই প্রদর্শিত হতে পারে!", becomeShikshaStar: "শিক্ষাস্টার হন",
    discoverPreviewTitle: "🧭 ডিসকভার AI", discoverPreviewSub: "AI-চালিত ক্যারিয়ার, কলেজ ও বৃত্তি আবিষ্কার",
    discoverTitle: "বিদ্যা ডিসকভার AI", discoverSubtitle: "আপনার সেরা ক্যারিয়ার, কলেজ ও বৃত্তি খুঁজুন", discoverCta: "আপনার ভবিষ্যৎ এক্সপ্লোর করুন →",
    aiGuruTagline: "ভারতের সবচেয়ে উপকারী AI গুরু",
    menuAiDashboard: "AI ড্যাশবোর্ড", menuAiDashboardSub: "আপনার ব্যক্তিগত AI লার্নিং হাব",
    menuDiscoverAI: "ডিসকভার AI", menuDiscoverAISub: "ক্যারিয়ার, কলেজ ও বৃত্তি আবিষ্কার করুন",
    menuVidyaGuruCard: "বিদ্যাগুরু AI", menuVidyaGuruCardSub: "আপনার AI শিক্ষকের সাথে কথা বলুন",
    menuGenerateLesson: "পাঠ তৈরি করুন", menuGenerateLessonSub: "AI আপনার জন্য সম্পূর্ণ পাঠ তৈরি করে",
    menuMyLessons: "আমার AI পাঠ", menuMyLessonsSub: "পূর্ববর্তী পাঠ পর্যালোচনা করুন",
    menuRevisionReels: "রিভিশন রিলস", menuRevisionReelsSub: "সংক্ষিপ্ত ভিডিও রিভিশন সেশন",
    menuPracticeTests: "প্র্যাকটিস টেস্ট", menuPracticeTestsSub: "বিশ্লেষণ সহ পরীক্ষা-শৈলী অনুশীলন",
    menuAskAiGuruCard: "AI গুরুকে জিজ্ঞেস করুন", menuAskAiGuruCardSub: "যেকোনো সন্দেহ জিজ্ঞেস করুন, তাৎক্ষণিক উত্তর পান",
    goodMorning: "সুপ্রভাত", goodAfternoon: "নমস্কার", goodEvening: "শুভ সন্ধ্যা", helloGreet: "হ্যালো",
    whatToLearnToday: "আজ আপনি কী জানতে চান?",
    browseBySubject: "বিষয় অনুযায়ী ব্রাউজ করুন",
    freeQuestionsRemaining: "{{count}} বিনামূল্যে প্রশ্ন বাকি আজ · IST মধ্যরাতে রিসেট",
    freeQuestionsRemainingPlural: "{{count}} বিনামূল্যে প্রশ্ন বাকি আজ · IST মধ্যরাতে রিসেট",
    askFollowUpPlaceholder: "অনুসরণমূলক প্রশ্ন করুন...",
    askSyllabusPlaceholder: "পাঠ্যক্রম সম্পর্কে যেকোনো কিছু জিজ্ঞেস করুন...",
    thinkingLabel: "ভাবছি...",
    wantToGoDeeper: "আরও গভীরে যেতে চান?",
    generateLessonAction: "✨ পাঠ তৈরি করুন", chatWithAIAction: "🤖 AI-এর সাথে কথা বলুন",
    chatWithVidyaGuruAction: "🤖 বিদ্যাগুরুর সাথে কথা বলুন",
    askAnotherQuestion: "আরেকটি প্রশ্ন করুন",
    dailyLimitTitle: "দৈনিক সীমা শেষ",
    dailyLimitMessage: "আজকের সব {{count}} বিনামূল্যে প্রশ্ন ব্যবহার হয়ে গেছে। কাল ফিরে আসুন বা প্রিমিয়াম আপগ্রেড করুন।",
    generateFullLessonAction: "✨ সম্পূর্ণ পাঠ তৈরি করুন",
    somethingWentWrong: "কিছু ভুল হয়েছে", tryAgainLabel: "আবার চেষ্টা করুন",
    leftLabel: "বাকি", askAiGuruTitle: "AI গুরুকে জিজ্ঞেস করুন",
    respondingIn: "{{lang}}-এ উত্তর দিচ্ছি", voiceMessage: "🎤 ভয়েস বার্তা",
    askSomethingPlaceholder: "কিছু জিজ্ঞেস করুন...",
    themeDescDark: "লাইট মোডের জন্য বন্ধ করুন", themeDescLight: "ডার্ক মোডের জন্য চালু করুন",
    notificationsDesc: "পুশ নোটিফিকেশন পান",
    changePassword: "পাসওয়ার্ড পরিবর্তন করুন", changePasswordDesc: "আপনার অ্যাকাউন্ট পাসওয়ার্ড আপডেট করুন",
    privacyDesc: "আপনার গোপনীয়তা সেটিংস পরিচালনা করুন",
    aboutDesc: "GLOOWS365E সম্পর্কে জানুন",
    currentTheme: "বর্তমান থিম:", themeDark: "🌙 ডার্ক", themeLight: "☀️ লাইট",
    goBack: "ফিরে যান",
    noLanguagesMatch: "কোনো ভাষা পাওয়া যায়নি।",
    languageInfoText: "এগুলি ভারতের সংবিধানের ৮ম তফসিলে তালিকাভুক্ত ২২টি ভাষা। আপনার নির্বাচিত ভাষা সমগ্র অ্যাপে পাঠ এবং বিষয়বস্তু ব্যক্তিগতকৃত করতে ব্যবহৃত হবে।",
    backToSettings: "সেটিংসে ফিরুন",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "প্রশ্নের ছবি তুলুন, তাৎক্ষণিক সমাধান পান",
    menuExamSimulator: "পরীক্ষা সিমুলেটর", menuExamSimulatorSub: "AI বোর্ড-প্যাটার্ন মক টেস্ট",
    menuVoiceTutor: "ভয়েস টিউটর", menuVoiceTutorSub: "সন্দেহ বলুন, AI উত্তর দেবে",
    menuAiNotebook: "আমার AI নোটবুক", menuAiNotebookSub: "সংরক্ষিত AI কথোপকথন",
    modeExplain: "ধারণা বুঝুন", modeNotes: "নোট তৈরি করুন", modeExam: "পরীক্ষার প্রস্তুতি",
    modeDoubt: "সন্দেহ দূর করুন", modeSummarize: "অধ্যায় সারাংশ", modeTip: "দৈনিক পড়ার টিপস",
    modeLanguage: "আমার ভাষায় বুঝিয়ে দিন",
    notebookTitle: "আমার AI নোটবুক", notebookEmpty: "নোটবুক খালি",
    notebookEmptyDesc: "\"নোটবুকে সংরক্ষণ করুন\" চাপ দিয়ে AI উত্তর সংরক্ষণ করুন",
    savedToNotebook: "নোটবুকে সংরক্ষিত", saveToNotebook: "নোটবুকে সংরক্ষণ করুন",
    viewNotebook: "নোটবুক দেখুন", pinned: "পিন করা",
    photoSolveTitle: "PhotoSolve AI", photoSolveSub: "যেকোনো প্রশ্নের ছবি তুলুন",
    snapQuestion: "প্রশ্নের ছবি তুলুন", solving: "আপনার প্রশ্ন সমাধান হচ্ছে…",
    stepBystep: "ধাপে ধাপে সমাধান", finalAnswer: "চূড়ান্ত উত্তর",
    similarQuestions: "এগুলোও অনুশীলন করুন", solveAnother: "আরেকটি প্রশ্ন সমাধান করুন",
    examSimTitle: "পরীক্ষা সিমুলেটর", examSimSub: "বোর্ড-প্যাটার্ন মক টেস্ট · AI মূল্যায়ন",
    generateExam: "পরীক্ষা তৈরি করুন", submitExam: "পরীক্ষা জমা দিন",
    examResults: "আপনার ফলাফল", boardReadiness: "বোর্ড পরীক্ষার প্রস্তুতি",
    weakAreas: "আরও অনুশীলন দরকার", strongAreas: "শক্তিশালী বিষয়",
    takeAnotherExam: "আরেকটি পরীক্ষা দিন",
    voiceTutorTitle: "ভয়েস টিউটর", voiceTutorSub: "সন্দেহ বলুন · তাৎক্ষণিক উত্তর পান",
    tapToSpeak: "প্রশ্ন বলতে ট্যাপ করুন", recording: "রেকর্ডিং… থামাতে ট্যাপ করুন",
    speakYourDoubt: "আপনার সন্দেহ বলুন", explainInMyLanguage: "আমার ভাষায় বুঝিয়ে দিন",
    poweredByAI: "AI দ্বারা চালিত", onlineLabel: "অনলাইন",
    yourSchool: "আপনার স্কুল", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "লেভেল", xpToNextLevel: "পরবর্তী লেভেলে XP",
    vCoinsRankLabel: "V-Coins র‌্যাংক", viewLabel: "দেখুন",
    giftClaimed: "উপহার পাওয়া গেছে!", surpriseGiftWaiting: "সারপ্রাইজ উপহার অপেক্ষায়!",
    giftOnItsWay: "আপনার উপহার আসছে", tapToClaimReward: "পুরস্কার নিতে ট্যাপ করুন",
    learnFunLabel: "LearnFun",
    referEarn: "রেফার করুন ও উপার্জন করুন", referEarnSub: "প্রতিটি বন্ধুর যোগ দেওয়ায় VCoins উপার্জন করুন",
    viewAllLabel: "সব দেখুন", friendsJoined: "বন্ধুরা যোগ দিয়েছে",
    vCoinsEarned: "VCoins উপার্জিত", perReferral: "প্রতি রেফারেলে",
    yourCode: "আপনার কোড", copyLabel: "কপি করুন", copiedLabel: "কপি হয়েছে!",
    referMoreFriends: "আরও বন্ধুদের রেফার করুন", friendAlsoGets: "বন্ধুও পাচ্ছে",
    shortReelsTitle: "শর্ট রিলস", curatedByVidya: "Vidya AI কর্তৃক সংকলিত",
    seeAll: "সব দেখুন", watchAll: "সব দেখুন", topApprovedReels: "শীর্ষ অনুমোদিত রিলস",
    poweredByGemini: "Gemini AI দ্বারা চালিত", activeLabel: "সক্রিয়",
    classLabel: "শ্রেণী", sponsoredBattle: "স্পনসরড ব্যাটেল",
    poweredBySponsor: "দ্বারা সমর্থিত", classSixToTwelve: "শ্রেণী ৬–১২",
    indiaPrizePool: "ভারত পুরস্কার তহবিল", aiLessonReady: "AI পাঠ প্রস্তুত",
    viewFinalLeaderboard: "চূড়ান্ত লিডারবোর্ড দেখুন", viewLiveStandings: "লাইভ স্ট্যান্ডিং দেখুন",
    lessonBeingPrepared: "পাঠ প্রস্তুত হচ্ছে…",
    vCoinsBalance: "V-Coins ব্যালেন্স", totalEarned: "মোট উপার্জন",
    totalSpent: "মোট খরচ", thisMonth: "এই মাসে",
    earnVCoins: "V-Coins উপার্জন করো", transactionHistory: "লেনদেন ইতিহাস",
    noTransactionsYet: "এখনো কোনো লেনদেন নেই",
    noTransactionsSub: "V-Coins উপার্জনের জন্য ভিডিও দেখো!",
    walletLabel: "ওয়ালেট", leaderboardLabel: "লিডারবোর্ড",
    seeTop100: "টপ ১০০ দেখো", showLess: "কম দেখাও",
    yourRank: "তোমার র‌্যাংক", updatedDaily: "দৈনিক আপডেট",
    referralTitle: "রেফার করো & আয় করো", inviteFriendsEarn: "বন্ধুদের আমন্ত্রণ করো, VCoins আয় করো!",
    totalReferred: "মোট রেফার", completed: "সম্পন্ন",
    yourReferralCode: "তোমার রেফারেল কোড", shareCode: "এই কোড বন্ধুদের সাথে শেয়ার করো।",
    howItWorks: "এটি কীভাবে কাজ করে", referralHistory: "রেফারেল ইতিহাস",
    shareEarn: "শেয়ার করো & আয় করো", pendingLabel: "অপেক্ষমান", joinedLabel: "যোগ দিয়েছে",
    stepLabel: "ধাপ", moreReferralsToUnlock: "আরো রেফারেল আনলক করতে",
    nextReward: "পরবর্তী পুরস্কার",
    vCoinsBalance: "V-Coins ব্যালেন্স", totalEarned: "মোট উপার্জন",
    totalSpent: "মোট খরচ", thisMonth: "এই মাসে",
    earnVCoins: "V-Coins উপার্জন করুন", transactionHistory: "লেনদেন ইতিহাস",
    noTransactionsYet: "এখনো কোনো লেনদেন নেই",
    noTransactionsSub: "V-Coins উপার্জনের জন্য ভিডিও দেখুন এবং শিখুন!",
    walletLabel: "ওয়ালেট", leaderboardLabel: "লিডারবোর্ড",
    seeTop100: "টপ ১০০ দেখুন", showLess: "কম দেখান",
    yourRank: "আপনার র‌্যাংক", updatedDaily: "দৈনিক আপডেট",
    referralTitle: "রেফার করুন ও উপার্জন করুন", inviteFriendsEarn: "বন্ধুদের আমন্ত্রণ জানান, VCoins উপার্জন করুন!",
    totalReferred: "মোট রেফার", completed: "সম্পন্ন",
    yourReferralCode: "আপনার রেফারেল কোড", shareCode: "এই কোড বন্ধুদের সাথে শেয়ার করুন।",
    howItWorks: "এটি কীভাবে কাজ করে", referralHistory: "রেফারেল ইতিহাস",
    shareEarn: "শেয়ার করুন ও উপার্জন করুন", pendingLabel: "অপেক্ষমান", joinedLabel: "যোগ দিয়েছে",
    stepLabel: "ধাপ", moreReferralsToUnlock: "আরো রেফারেল আনলক করতে",
    nextReward: "পরবর্তী পুরস্কার",
  },

  // ─────────────────────────── Tamil ────────────────────────────────
  ta: {
    home: "முகப்பு", leaderboard: "லீடர்போர்ட்", wallet: "வாலட்",
    settings: "அமைப்புகள்", dashboard: "டாஷ்போர்ட்", aiGuru: "AI குரு",
    skillBoard: "திறன் பலகை", logout: "வெளியேறு",
    profileSettings: "சுயவிவர அமைப்புகள்", language: "மொழி",
    changeLanguage: "பயன்பாடு மற்றும் உள்ளடக்க மொழியை மாற்றுக",
    darkTheme: "இருண்ட தீம்", notifications: "அறிவிப்புகள்",
    privacy: "தனியுரிமை", about: "பற்றி",
    customizeExperience: "உங்கள் அனுபவத்தை தனிப்பயனாக்குங்கள்",
    save: "சேமி", cancel: "ரத்து செய்", edit: "திருத்து", back: "திரும்பு",
    delete: "நீக்கு", loading: "ஏற்றுகிறது...", editProfile: "சுயவிவரம் திருத்து",
    saveChanges: "மாற்றங்களை சேமி", verify: "சரிபார்", confirm: "உறுதிப்படுத்து", send: "அனுப்பு",
    languageTitle: "மொழி", languageSubtitle: "இந்திய அரசியலமைப்பின் 8ஆம் அட்டவணையின் அனைத்து 22 மொழிகளும்",
    searchLanguage: "மொழி தேடு...", scheduleNote: "இவை இந்தியா அரசியலமைப்பின் 8ஆம் அட்டவணையில் பட்டியலிடப்பட்ட 22 மொழிகள்.",
    basicInfo: "அடிப்படை தகவல்", academicDetails: "கல்வி விவரங்கள்",
    location: "இடம்", interests: "ஆர்வங்கள்", fullName: "முழு பெயர்",
    phoneNumber: "தொலைபேசி எண்", dateOfBirth: "பிறந்த தேதி", age: "வயது",
    school: "பள்ளி / நிறுவனம்", preferredLanguage: "விருப்பமான மொழி",
    pincode: "பின்கோட்", class: "வகுப்பு / தரம்", board: "வாரியம்",
    learnFunLoading: "உங்கள் LearnFun உலகம் ஏற்றப்படுகிறது...",
    profileNotFound: "சுயவிவரம் கிடைக்கவில்லை",
    profileSetupPrompt: "விளையாடத் தொடங்க உங்கள் சுயவிவரத்தை முடிக்கவும்!",
    dailyStreak: "தினசரி தொடர்", view: "பார்", todaysMission: "இன்றைய பணி",
    daily: "தினசரி", noMissionToday: "இன்று பணி இல்லை. சீக்கிரம் திரும்பி வாருங்கள்!",
    skillWorlds: "திறன் உலகங்கள்", bossBattle: "பாஸ் போர்",
    yourGames: "உங்கள் விளையாட்டுகள்", gamesLoading: "விளையாட்டுகள் ஏற்றப்படுகின்றன...",
    yourBadges: "உங்கள் பதக்கங்கள்", viewAll: "அனைத்தும் பார்", comingSoon: "விரைவில் வருகிறது", play: "விளையாடு",
    searchVideos: "வீடியோ, பாடம், ஆசிரியர் தேடு...",
    featured: "சிறப்பு", noVideosFound: "வீடியோக்கள் இல்லை",
    clearFilters: "வடிகட்டிகளை அழி", allVideos: "அனைத்து வீடியோக்கள்",
    videosComingSoon: "வீடியோக்கள் விரைவில்!",
    loadingBattles: "போர்கள் ஏற்றப்படுகின்றன...", noActiveBattles: "செயலில் போர்கள் இல்லை",
    checkBackSoon: "புதிய திறன் போர்களுக்கு விரைவில் திரும்பவும்!",
    refresh: "புதுப்பி", computingRanks: "உங்கள் தரவரிசை கணக்கிடப்படுகிறது...",
    retry: "மீண்டும் முயற்சி", notRankedYet: "நீங்கள் இன்னும் தரவரிசையில் இல்லீர்கள்",
    uploadReelPrompt: "போரில் பங்கேற்க ரீல் பதிவேற்றவும்!",
    viewFullSkillboard: "முழு திறன் பலகையை பார்",
    battleEnded: "போர் முடிந்தது", notEligible: "தகுதியில்லை", uploadReel: "ரீல் பதிவேற்று",
    loginRequired: "உள்நுழைவு தேவை", live: "நேரடி", completed: "முடிந்தது",
    prizePool: "பரிசு தொகை", endingSoon: "விரைவில் முடியும்", viewResult: "முடிவை பார்",
    joinNow: "இப்போது சேர்", participate: "பங்கேற்கவும்", reserveSpot: "இடம் முதல்",
    startsSoon: "விரைவில் தொடங்கும்", all: "அனைத்தும்", upcoming: "வரவிருக்கும்",
    aiGuruSubtitle: "உங்கள் தனிப்பட்ட கற்றல் உதவியாளர்", askAnything: "எதையும் கேளுங்கள்", instantAnswers: "உடனடி பதில்கள்", studyHelp: "படிப்பு உதவி", startChatting: "பேசத் தொடங்கு →",
    premiumFeature: "பிரீமியம் அம்சம்", premiumUnlockMsg: "இந்த அம்சத்தை திறக்க AI Guru Premium க்கு மேம்படுத்துங்கள்.", maybeLater: "பிறகு பார்க்கலாம்", upgrade: "மேம்படுத்து",
    aiClassroom: "உங்கள் தனிப்பட்ட AI வகுப்பறை\nGemini ஆல் இயக்கப்படுகிறது", freeLessonsLeft: "இன்று இலவச பாடங்கள் மீதம்", unlimitedAccess: "வரம்பற்ற பிரீமியம் அணுகல் செயலில்",
    lessonSetup: "பாட அமைப்பு", continueBtn: "தொடரவும் →", fillRequiredFields: "தேவையான தகவல்களை நிரப்பவும்", fillRequiredFieldsDesc: "பாடத்தை தேர்வு செய்து அத்தியாயம் பெயர் உள்ளிடவும்.",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "உங்கள் தனிப்பட்ட AI ஆசிரியர்", readyToHelp: "உதவ தயாராக இருக்கிறேன்!", thinking: "யோசிக்கிறேன்...", speaking: "பேசுகிறேன்...", listening: "கேட்கிறேன்...",
    paywallTitle: "VidyaGuru உடன் தொடரவும்?", paywallBody: "இன்றைய இலவச கேள்வி முடிந்தது. வரம்பற்ற உரையாடலுக்கு பிரீமியம் மேம்படுத்துங்கள்!", upgradeToPremium: "பிரீமியத்திற்கு மேம்படுத்து",
    seekhoSignIn: "Seekho அணுக உள்நுழையவும்", curriculumAligned: "பாடத்திட்டம் சார்ந்த கற்றல்", subjects: "பாடங்கள்", continueLearning: "கற்றலை தொடரவும்", resumeLearning: "நிறுத்திய இடத்திலிருந்து தொடர்",
    revisionDue: "மீட்டுரைவு தேவை!", revisionReady: "கருத்துகள் மதிப்பாய்விற்கு தயார்", unlockCurriculum: "முழு பாடத்திட்டத்தை திறக்கவும்",
    pendingReview: "மதிப்பாய்வு நிலுவையில்", inReview: "மதிப்பாய்வில்", approved: "அனுமதிக்கப்பட்டது", rejected: "நிராகரிக்கப்பட்டது", limitReached: "வரம்பை அடைந்தது", limitReachedDesc: "இந்த போரில் உங்கள் பதிவேற்ற வரம்பை அடைந்தீர்கள்.",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "கேள்வி புகைப்படம் எடு, உடனடி தீர்வு பெறு",
    menuExamSimulator: "தேர்வு சிமுலேட்டர்", menuExamSimulatorSub: "AI வாரியம்-முறை மாதிரி தேர்வுகள்",
    menuVoiceTutor: "குரல் ஆசிரியர்", menuVoiceTutorSub: "சந்தேகம் சொல், AI பதில் தரும்",
    menuAiNotebook: "என் AI நோட்புக்", menuAiNotebookSub: "சேமிக்கப்பட்ட AI உரையாடல்கள்",
    modeExplain: "கருத்தை விளக்கு", modeNotes: "குறிப்புகள் எழுது", modeExam: "தேர்வு தயாரிப்பு",
    modeDoubt: "சந்தேகம் தீர்", modeSummarize: "அத்தியாயம் சுருக்கம்", modeTip: "தினசரி படிப்பு குறிப்பு",
    modeLanguage: "என் மொழியில் விளக்கு",
    notebookTitle: "என் AI நோட்புக்", notebookEmpty: "நோட்புக் காலியாக உள்ளது",
    savedToNotebook: "நோட்புக்கில் சேமிக்கப்பட்டது", saveToNotebook: "நோட்புக்கில் சேமி",
    viewNotebook: "நோட்புக் பார்", pinned: "பின் செய்யப்பட்டது",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "கேள்வி புகைப்படம் எடு", solving: "உங்கள் கேள்வி தீர்க்கப்படுகிறது…",
    stepBystep: "படி-படியாக தீர்வு", finalAnswer: "இறுதி விடை",
    similarQuestions: "இவற்றையும் பயிற்சி செய்", solveAnother: "மற்றொரு கேள்வி தீர்",
    examSimTitle: "தேர்வு சிமுலேட்டர்", generateExam: "தேர்வு உருவாக்கு", submitExam: "தேர்வு சமர்ப்பி",
    examResults: "உங்கள் முடிவுகள்", boardReadiness: "வாரியம் தேர்வு தயார்நிலை",
    weakAreas: "மேலும் பயிற்சி தேவை", strongAreas: "வலுவான பகுதிகள்", takeAnotherExam: "மற்றொரு தேர்வு எழுது",
    voiceTutorTitle: "குரல் ஆசிரியர்", tapToSpeak: "கேள்வி சொல்ல தட்டு", recording: "பதிவு செய்கிறது… நிறுத்த தட்டு",
    speakYourDoubt: "உங்கள் சந்தேகம் சொல்லுங்கள்", explainInMyLanguage: "என் மொழியில் விளக்கு",
    seekhoPreviewTitle: "📖 சீக்கோ", seekhoPreviewSub: "பாடங்கள், திறன்கள் மற்றும் படைப்பு செயல்கள் கற்கவும்", explore: "ஆராய்க →",
    vidyaStarPreviewTitle: "🌟 விதியாஸ்டார் போட்டி", vidyaStarPreviewSub: "உங்கள் திறமையை காட்டுங்கள் பரிசு வெல்லுங்கள்",
    couldNotLoadContests: "போட்டிகளை ஏற்ற முடியவில்லை.", contestsComingSoon: "உற்சாகமான போட்டிகள் விரைவில்!", viewResults: "முடிவுகளை பார் →", participateNow: "இப்போது பங்கேற்கவும் →",
    skillBattlePreviewTitle: "⚔️ திறன் சவால்", skillBattlePreviewSub: "போட்டியிடுங்கள், தரவரிசை அதிகரிக்கவும், பரிசுகள் வெல்லுங்கள்",
    couldNotLoadBattles: "போர்களை ஏற்ற முடியவில்லை.", battlesComingSoon: "புதிய போர்கள் விரைவில்!", poweredBy: "{{name}} மூலம்", joinedCount: "{{count}} சேர்ந்தனர்",
    knowledgeHubTitle: "🌐 அறிவு மையம்", knowledgeHubSub: "கற்றல், வளர்ச்சி மற்றும் அன்றாட வாழ்க்கைக்கான வீடியோக்கள்", watchMore: "மேலும் பார் →",
    couldNotLoadVideos: "வீடியோக்களை ஏற்ற முடியவில்லை.", moreVideosSoon: "மேலும் வீடியோக்கள் விரைவில்!", noVideosInCat: "\"{{cat}}\" வீடியோக்கள் இல்லை இன்னும்.",
    shortLearningTitle: "குறுகிய கற்றல்", noLearningVideos: "இன்னும் கற்றல் வீடியோக்கள் இல்லை",
    skillBattleShortsTitle: "🔥 ஷார்ட்ஸ்", noSkillBattleVideos: "இன்னும் திறன் போர் வீடியோக்கள் இல்லை", battleBadge: "⚡ போர்",
    shikshaStarPreviewTitle: "⭐ சிக்ஷாஸ்டார்", shikshaStarPreviewSub: "விதியாவின் திறமையான மாணவர்களை கொண்டாடுகிறோம்", viewStars: "நட்சத்திரங்களை பார் →",
    couldNotLoadStars: "நட்சத்திரங்களை ஏற்ற முடியவில்லை.", shikshaStarEmpty: "உங்கள் திறமை விரைவில் இங்கே சேர்க்கப்படலாம்!", becomeShikshaStar: "சிக்ஷாஸ்டார் ஆகுங்கள்",
    discoverPreviewTitle: "🧭 டிஸ்கவர் AI", discoverPreviewSub: "AI-ஆல் இயக்கப்படும் தொழில், கல்லூரி மற்றும் உதவித்தொகை கண்டுபிடிப்பு",
    discoverTitle: "விதியா டிஸ்கவர் AI", discoverSubtitle: "உங்கள் சிறந்த தொழில், கல்லூரி மற்றும் உதவித்தொகை கண்டுபிடிக்கவும்", discoverCta: "உங்கள் எதிர்காலத்தை ஆராயுங்கள் →",
    poweredByAI: "AI ஆல் இயங்குகிறது", onlineLabel: "ஆன்லைன்",
    yourSchool: "உங்கள் பள்ளி", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "நிலை", xpToNextLevel: "அடுத்த நிலைக்கு XP",
    vCoinsRankLabel: "V-Coins தரவரிசை", viewLabel: "பார்",
    giftClaimed: "பரிசு கிடைத்தது!", surpriseGiftWaiting: "சர்ப்ரைஸ் பரிசு காத்திருக்கிறது!",
    giftOnItsWay: "உங்கள் பரிசு வரும்", tapToClaimReward: "பரிசை பெற தட்டுங்கள்",
    learnFunLabel: "LearnFun",
    referEarn: "பரிந்துரை செய் & சம்பாதி", referEarnSub: "ஒவ்வொரு நண்பரும் சேரும்போது VCoins சம்பாதி",
    viewAllLabel: "அனைத்தும் பார்", friendsJoined: "நண்பர்கள் சேர்ந்தனர்",
    vCoinsEarned: "VCoins சம்பாதித்தது", perReferral: "ஒவ்வொரு பரிந்துரைக்கும்",
    yourCode: "உங்கள் குறியீடு", copyLabel: "நகல் எடு", copiedLabel: "நகல் எடுக்கப்பட்டது!",
    referMoreFriends: "மேலும் நண்பர்களை பரிந்துரை செய்", friendAlsoGets: "நண்பருக்கும் கிடைக்கும்",
    shortReelsTitle: "குட்டி வீடியோ", curatedByVidya: "Vidya AI தேர்ந்தெடுத்தது",
    seeAll: "அனைத்தும் பார்", watchAll: "அனைத்தும் பார்", topApprovedReels: "சிறந்த அனுமதிக்கப்பட்ட வீடியோக்கள்",
    poweredByGemini: "Gemini AI ஆல் இயங்குகிறது", activeLabel: "செயலில்",
    classLabel: "வகுப்பு", sponsoredBattle: "ஸ்பான்சர் போட்டி",
    poweredBySponsor: "ஆல் இயக்கப்படுகிறது", classSixToTwelve: "வகுப்பு 6–12",
    indiaPrizePool: "இந்தியா பரிசு நிதி", aiLessonReady: "AI பாடம் தயார்",
    viewFinalLeaderboard: "இறுதி தரவரிசை பார்", viewLiveStandings: "நேரடி நிலவரம் பார்",
    lessonBeingPrepared: "பாடம் தயாராகிறது…",
    vCoinsBalance: "V-Coins இருப்பு", totalEarned: "மொத்த சம்பாதித்தது",
    totalSpent: "மொத்த செலவிட்டது", thisMonth: "இந்த மாதம்",
    earnVCoins: "V-Coins சம்பாதிக்கவும்", transactionHistory: "பரிவர்த்தனை வரலாறு",
    noTransactionsYet: "இன்னும் பரிவர்த்தனைகள் இல்லை",
    noTransactionsSub: "V-Coins சம்பாதிக்க வீடியோக்கள் பாருங்கள்!",
    walletLabel: "வாலெட்", leaderboardLabel: "தரவரிசை",
    seeTop100: "டாப் 100 பாருங்கள்", showLess: "குறைவாக காட்டுங்கள்",
    yourRank: "உங்கள் தரவரிசை", updatedDaily: "தினமும் புதுப்பிக்கப்படும்",
    referralTitle: "பரிந்துரை செய் & சம்பாதி", inviteFriendsEarn: "நண்பர்களை அழையுங்கள், VCoins சம்பாதியுங்கள்!",
    totalReferred: "மொத்த பரிந்துரை", completed: "முடிந்தது",
    yourReferralCode: "உங்கள் பரிந்துரை குறியீடு", shareCode: "இந்த குறியீட்டை நண்பர்களுடன் பகிரவும்.",
    howItWorks: "இது எப்படி வேலை செய்கிறது", referralHistory: "பரிந்துரை வரலாறு",
    shareEarn: "பகிர் & சம்பாதி", pendingLabel: "நிலுவையில்", joinedLabel: "சேர்ந்தனர்",
    stepLabel: "படி", moreReferralsToUnlock: "மேலும் பரிந்துரைகள் தேவை",
    nextReward: "அடுத்த பரிசு",
  },

  // ─────────────────────────── Telugu ───────────────────────────────
  te: {
    home: "హోమ్", leaderboard: "లీడర్‌బోర్డ్", wallet: "వాలెట్",
    settings: "సెట్టింగులు", dashboard: "డాష్‌బోర్డ్", aiGuru: "AI గురు",
    skillBoard: "స్కిల్ బోర్డ్", logout: "లాగ్అవుట్",
    profileSettings: "ప్రొఫైల్ సెట్టింగులు", language: "భాష",
    changeLanguage: "యాప్ మరియు కంటెంట్ భాషను మార్చండి",
    darkTheme: "డార్క్ థీమ్", notifications: "నోటిఫికేషన్లు",
    privacy: "గోప్యత", about: "గురించి",
    customizeExperience: "మీ అనుభవాన్ని అనుకూలీకరించండి",
    save: "సేవ్ చేయండి", cancel: "రద్దు చేయండి", edit: "సవరించండి", back: "వెనుకకు",
    delete: "తొలగించు", loading: "లోడ్ అవుతోంది...", editProfile: "ప్రొఫైల్ సవరించండి",
    saveChanges: "మార్పులు సేవ్ చేయండి", verify: "ధృవీకరించండి", confirm: "నిర్ధారించండి", send: "పంపండి",
    languageTitle: "భాష", languageSubtitle: "భారత రాజ్యాంగం 8వ షెడ్యూల్‌లోని అన్ని 22 భాషలు",
    searchLanguage: "భాష వెతకండి...", scheduleNote: "ఇవి భారత రాజ్యాంగం యొక్క 8వ షెడ్యూల్‌లో జాబితా చేయబడిన 22 భాషలు.",
    basicInfo: "ప్రాథమిక సమాచారం", academicDetails: "విద్యా వివరాలు",
    location: "స్థానం", interests: "ఆసక్తులు", fullName: "పూర్తి పేరు",
    phoneNumber: "ఫోన్ నంబర్", dateOfBirth: "పుట్టిన తేదీ", age: "వయసు",
    school: "పాఠశాల / సంస్థ", preferredLanguage: "ఇష్టమైన భాష",
    pincode: "పిన్‌కోడ్", class: "తరగతి / గ్రేడ్", board: "బోర్డ్",
    learnFunLoading: "మీ LearnFun ప్రపంచం లోడ్ అవుతోంది...",
    profileNotFound: "ప్రొఫైల్ కనుగొనబడలేదు",
    profileSetupPrompt: "ఆడటం ప్రారంభించడానికి మీ ప్రొఫైల్ పూర్తి చేయండి!",
    dailyStreak: "రోజువారీ స్ట్రీక్", view: "చూడండి", todaysMission: "నేటి మిషన్",
    daily: "రోజువారీ", noMissionToday: "నేడు మిషన్ లేదు. త్వరలో తిరిగి రండి!",
    skillWorlds: "నైపుణ్య ప్రపంచాలు", bossBattle: "బాస్ బ్యాటిల్",
    yourGames: "మీ గేమ్‌లు", gamesLoading: "గేమ్‌లు లోడ్ అవుతున్నాయి...",
    yourBadges: "మీ బ్యాడ్జ్‌లు", viewAll: "అన్నీ చూడండి", comingSoon: "త్వరలో వస్తోంది", play: "ఆడండి",
    searchVideos: "వీడియోలు, విషయాలు, ఉపాధ్యాయులను వెతకండి...",
    featured: "విశేష", noVideosFound: "వీడియోలు కనుగొనబడలేదు",
    clearFilters: "ఫిల్టర్‌లు క్లియర్ చేయండి", allVideos: "అన్ని వీడియోలు",
    videosComingSoon: "వీడియోలు త్వరలో!",
    loadingBattles: "బ్యాటిల్‌లు లోడ్ అవుతున్నాయి...", noActiveBattles: "చురుకైన బ్యాటిల్‌లు లేవు",
    checkBackSoon: "కొత్త స్కిల్ బ్యాటిల్‌ల కోసం త్వరలో తిరిగి రండి!",
    refresh: "రిఫ్రెష్", computingRanks: "మీ ర్యాంకులు లెక్కిస్తున్నారు...",
    retry: "మళ్లీ ప్రయత్నించండి", notRankedYet: "మీరు ఇంకా ర్యాంక్ పొందలేదు",
    uploadReelPrompt: "బ్యాటిల్‌లో చేరడానికి రీల్ అప్‌లోడ్ చేయండి!",
    viewFullSkillboard: "పూర్తి స్కిల్‌బోర్డ్ చూడండి",
    battleEnded: "బ్యాటిల్ ముగిసింది", notEligible: "అర్హత లేదు", uploadReel: "రీల్ అప్‌లోడ్ చేయండి",
    loginRequired: "లాగిన్ అవసరం", live: "లైవ్", completed: "పూర్తయింది",
    prizePool: "బహుమతి నిధి", endingSoon: "త్వరలో ముగుస్తుంది", viewResult: "ఫలితం చూడండి",
    joinNow: "ఇప్పుడే చేరండి", participate: "పాల్గొనండి", reserveSpot: "సీటు బుక్ చేయండి",
    startsSoon: "త్వరలో ప్రారంభమవుతుంది", all: "అన్నీ", upcoming: "రాబోయే",
    aiGuruSubtitle: "మీ వ్యక్తిగత అభ్యాస సహాయకుడు", askAnything: "ఏదైనా అడగండి", instantAnswers: "తక్షణ సమాధానాలు", studyHelp: "చదువులో సహాయం", startChatting: "చాటింగ్ ప్రారంభించండి →",
    premiumFeature: "ప్రీమియం ఫీచర్", premiumUnlockMsg: "ఈ ఫీచర్ అన్‌లాక్ చేయడానికి AI Guru Premium కి అప్‌గ్రేడ్ చేయండి.", maybeLater: "తర్వాత", upgrade: "అప్‌గ్రేడ్",
    aiClassroom: "మీ వ్యక్తిగత AI తరగతిగది\nGemini ద్వారా నడుపబడింది", freeLessonsLeft: "ఈరోజు ఉచిత పాఠాలు మిగిలాయి", unlimitedAccess: "అపరిమిత ప్రీమియం యాక్సెస్ సక్రియంగా ఉంది",
    lessonSetup: "పాఠం సెటప్", continueBtn: "కొనసాగించండి →", fillRequiredFields: "అవసరమైన ఫీల్డ్‌లు పూరించండి", fillRequiredFieldsDesc: "దయచేసి సబ్జెక్ట్ ఎంచుకుని అధ్యాయం పేరు నమోదు చేయండి.",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "మీ వ్యక్తిగత AI ఉపాధ్యాయుడు", readyToHelp: "సహాయానికి సిద్ధంగా ఉన్నాను!", thinking: "ఆలోచిస్తున్నాను...", speaking: "మాట్లాడుతున్నాను...", listening: "వింటున్నాను...",
    paywallTitle: "VidyaGuru తో కొనసాగించాలా?", paywallBody: "ఈరోజు ఉచిత ప్రశ్న ఉపయోగించారు. అపరిమిత సంభాషణల కోసం ప్రీమియం కి అప్‌గ్రేడ్ చేయండి!", upgradeToPremium: "ప్రీమియం కి అప్‌గ్రేడ్ చేయండి",
    seekhoSignIn: "Seekho యాక్సెస్ చేయడానికి లాగిన్ అవ్వండి", curriculumAligned: "పాఠ్యప్రణాళిక-ఆధారిత అభ్యాసం", subjects: "విషయాలు", continueLearning: "నేర్చుకోవడం కొనసాగించండి", resumeLearning: "మీరు ఆగిన చోట నుండి కొనసాగించండి",
    revisionDue: "సమీక్ష అవసరం!", revisionReady: "భావనలు సమీక్షకు సిద్ధంగా ఉన్నాయి", unlockCurriculum: "పూర్తి పాఠ్యప్రణాళికను అన్‌లాక్ చేయండి",
    pendingReview: "సమీక్ష నిలబడ్డది", inReview: "సమీక్షలో", approved: "ఆమోదించబడింది", rejected: "తిరస్కరించబడింది", limitReached: "పరిమితి చేరుకుంది", limitReachedDesc: "ఈ బ్యాటిల్ కోసం అప్‌లోడ్ పరిమితిని చేరుకున్నారు.",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "ప్రశ్న ఫోటో తీయండి, వెంటనే పరిష్కారం పొందండి",
    menuExamSimulator: "పరీక్ష సిమ్యులేటర్", menuExamSimulatorSub: "AI బోర్డు-నమూనా మాక్ పరీక్షలు",
    menuVoiceTutor: "వాయిస్ ట్యూటర్", menuVoiceTutorSub: "సందేహం చెప్పండి, AI సమాధానమిస్తుంది",
    menuAiNotebook: "నా AI నోట్‌బుక్", menuAiNotebookSub: "సేవ్ చేసిన AI సంభాషణలు",
    modeExplain: "భావన వివరించండి", modeNotes: "నోట్స్ తయారు చేయండి", modeExam: "పరీక్ష సన్నాహం",
    modeDoubt: "సందేహం నివృత్తి", modeSummarize: "అధ్యాయ సారాంశం", modeTip: "రోజువారీ చదువు చిట్కా",
    modeLanguage: "నా భాషలో వివరించండి",
    notebookTitle: "నా AI నోట్‌బుక్", notebookEmpty: "నోట్‌బుక్ ఖాళీగా ఉంది",
    savedToNotebook: "నోట్‌బుక్‌లో సేవ్ అయింది", saveToNotebook: "నోట్‌బుక్‌లో సేవ్ చేయండి",
    viewNotebook: "నోట్‌బుక్ చూడండి", pinned: "పిన్ చేయబడింది",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "ప్రశ్న ఫోటో తీయండి", solving: "మీ ప్రశ్న పరిష్కరిస్తున్నాం…",
    stepBystep: "దశల వారీ పరిష్కారం", finalAnswer: "చివరి సమాధానం",
    similarQuestions: "వీటిని కూడా సాధన చేయండి", solveAnother: "మరో ప్రశ్న పరిష్కరించండి",
    examSimTitle: "పరీక్ష సిమ్యులేటర్", generateExam: "పరీక్ష రూపొందించండి", submitExam: "పరీక్ష సమర్పించండి",
    examResults: "మీ ఫలితాలు", boardReadiness: "బోర్డు పరీక్ష సన్నద్ధత",
    weakAreas: "మరింత సాధన అవసరం", strongAreas: "బలమైన అంశాలు", takeAnotherExam: "మరో పరీక్ష రాయండి",
    voiceTutorTitle: "వాయిస్ ట్యూటర్", tapToSpeak: "ప్రశ్న చెప్పడానికి నొక్కండి", recording: "రికార్డింగ్… ఆపడానికి నొక్కండి",
    speakYourDoubt: "మీ సందేహం చెప్పండి", explainInMyLanguage: "నా భాషలో వివరించండి",
    seekhoPreviewTitle: "📖 సీఖో", seekhoPreviewSub: "సబ్జెక్ట్‌లు, నైపుణ్యాలు మరియు సృజనాత్మక కార్యకలాపాలు నేర్చుకోండి", explore: "అన్వేషించండి →",
    vidyaStarPreviewTitle: "🌟 విద్యాస్టార్ పోటీ", vidyaStarPreviewSub: "మీ ప్రతిభ చూపించి బహుమతులు గెలుచుకోండి",
    couldNotLoadContests: "పోటీలు లోడ్ కాలేదు.", contestsComingSoon: "ఉత్తేజకరమైన పోటీలు త్వరలో!", viewResults: "ఫలితాలు చూడండి →", participateNow: "ఇప్పుడే పాల్గొనండి →",
    skillBattlePreviewTitle: "⚔️ స్కిల్‌బ్యాటిల్ చాలెంజ్", skillBattlePreviewSub: "పోటీపడండి, ర్యాంక్ పెంచుకోండి మరియు బహుమతులు గెలుచుకోండి",
    couldNotLoadBattles: "బ్యాటిల్‌లు లోడ్ కాలేదు.", battlesComingSoon: "కొత్త బ్యాటిల్‌లు త్వరలో!", poweredBy: "{{name}} ద్వారా", joinedCount: "{{count}} మంది చేరారు",
    knowledgeHubTitle: "🌐 నాలెడ్జ్ హబ్", knowledgeHubSub: "నేర్చుకోవడానికి, వికాసానికి మరియు రోజువారీ జీవితానికి వీడియోలు", watchMore: "మరిన్ని చూడండి →",
    couldNotLoadVideos: "వీడియోలు లోడ్ కాలేదు.", moreVideosSoon: "మరిన్ని వీడియోలు త్వరలో!", noVideosInCat: "\"{{cat}}\" వీడియోలు ఇంకా లేవు.",
    shortLearningTitle: "షార్ట్ లర్నింగ్", noLearningVideos: "ఇంకా నేర్చుకునే వీడియోలు లేవు",
    skillBattleShortsTitle: "🔥 షార్ట్స్", noSkillBattleVideos: "ఇంకా స్కిల్ బ్యాటిల్ వీడియోలు లేవు", battleBadge: "⚡ బ్యాటిల్",
    shikshaStarPreviewTitle: "⭐ శిక్షాస్టార్", shikshaStarPreviewSub: "విద్యా ప్రతిభావంతులైన విద్యార్థులను వేడుక చేసుకుంటున్నాం", viewStars: "స్టార్‌లను చూడండి →",
    couldNotLoadStars: "స్టార్‌లు లోడ్ కాలేదు.", shikshaStarEmpty: "మీ ప్రతిభ త్వరలో ఇక్కడ ప్రదర్శించబడవచ్చు!", becomeShikshaStar: "శిక్షాస్టార్ అవ్వండి",
    discoverPreviewTitle: "🧭 డిస్కవర్ AI", discoverPreviewSub: "AI-ఆధారిత కెరీర్, కళాశాల & స్కాలర్‌షిప్ ఆవిష్కరణ",
    discoverTitle: "విద్యా డిస్కవర్ AI", discoverSubtitle: "మీ సరైన కెరీర్, కళాశాల & స్కాలర్‌షిప్ కనుగొనండి", discoverCta: "మీ భవిష్యత్తును అన్వేషించండి →",
    poweredByAI: "AI ద్వారా నడుపబడుతోంది", onlineLabel: "ఆన్‌లైన్",
    yourSchool: "మీ పాఠశాల", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "స్థాయి", xpToNextLevel: "తదుపరి స్థాయికి XP",
    vCoinsRankLabel: "V-Coins ర్యాంక్", viewLabel: "చూడండి",
    giftClaimed: "బహుమతి వచ్చింది!", surpriseGiftWaiting: "సర్‌ప్రైజ్ బహుమతి వేచి ఉంది!",
    giftOnItsWay: "మీ బహుమతి వస్తోంది", tapToClaimReward: "బహుమతి పొందడానికి నొక్కండి",
    learnFunLabel: "LearnFun",
    referEarn: "రెఫర్ చేయండి & సంపాదించండి", referEarnSub: "ప్రతి స్నేహితుడు చేరినప్పుడు VCoins సంపాదించండి",
    viewAllLabel: "అన్నీ చూడండి", friendsJoined: "స్నేహితులు చేరారు",
    vCoinsEarned: "VCoins సంపాదించారు", perReferral: "ప్రతి రెఫరల్‌కు",
    yourCode: "మీ కోడ్", copyLabel: "కాపీ చేయండి", copiedLabel: "కాపీ అయింది!",
    referMoreFriends: "మరిన్ని స్నేహితులను రెఫర్ చేయండి", friendAlsoGets: "స్నేహితుడికి కూడా లభిస్తుంది",
    shortReelsTitle: "షార్ట్ రీల్స్", curatedByVidya: "Vidya AI ద్వారా ఎంచుకోబడింది",
    seeAll: "అన్నీ చూడండి", watchAll: "అన్నీ చూడండి", topApprovedReels: "అగ్ర ఆమోదిత రీల్స్",
    poweredByGemini: "Gemini AI ద్వారా నడుపబడుతోంది", activeLabel: "చురుకుగా ఉంది",
    classLabel: "తరగతి", sponsoredBattle: "స్పాన్సర్ బ్యాటిల్",
    poweredBySponsor: "ద్వారా నడుపబడుతోంది", classSixToTwelve: "తరగతి 6–12",
    indiaPrizePool: "భారత్ బహుమతి నిధి", aiLessonReady: "AI పాఠ్యం సిద్ధం",
    viewFinalLeaderboard: "ఫైనల్ లీడర్‌బోర్డ్ చూడండి", viewLiveStandings: "లైవ్ స్టాండింగ్స్ చూడండి",
    lessonBeingPrepared: "పాఠ్యం సిద్ధమవుతోంది…",
    vCoinsBalance: "V-Coins బ్యాలెన్స్", totalEarned: "మొత్తం సంపాదించారు",
    totalSpent: "మొత్తం ఖర్చు", thisMonth: "ఈ నెల",
    earnVCoins: "V-Coins సంపాదించండి", transactionHistory: "లావాదేవీ చరిత్ర",
    noTransactionsYet: "ఇంకా లావాదేవీలు లేవు",
    noTransactionsSub: "V-Coins సంపాదించడానికి వీడియోలు చూడండి!",
    walletLabel: "వాలెట్", leaderboardLabel: "లీడర్‌బోర్డ్",
    seeTop100: "టాప్ 100 చూడండి", showLess: "తక్కువ చూపించు",
    yourRank: "మీ ర్యాంక్", updatedDaily: "రోజూ అప్‌డేట్",
    referralTitle: "రెఫర్ చేయండి & సంపాదించండి", inviteFriendsEarn: "స్నేహితులను ఆహ్వానించండి, VCoins సంపాదించండి!",
    totalReferred: "మొత్తం రెఫర్", completed: "పూర్తయింది",
    yourReferralCode: "మీ రెఫరల్ కోడ్", shareCode: "ఈ కోడ్‌ని స్నేహితులతో పంచుకోండి.",
    howItWorks: "ఇది ఎలా పని చేస్తుంది", referralHistory: "రెఫరల్ చరిత్ర",
    shareEarn: "షేర్ చేయండి & సంపాదించండి", pendingLabel: "పెండింగ్", joinedLabel: "చేరారు",
    stepLabel: "దశ", moreReferralsToUnlock: "మరిన్ని రెఫరల్‌లు అన్‌లాక్ చేయడానికి",
    nextReward: "తదుపరి బహుమతి",
  },

  // ─────────────────────────── Kannada ──────────────────────────────
  kn: {
    home: "ಮನೆ", leaderboard: "ಲೀಡರ್‌ಬೋರ್ಡ್", wallet: "ವ್ಯಾಲೆಟ್",
    settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು", dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", aiGuru: "AI ಗುರು",
    skillBoard: "ಕೌಶಲ ಬೋರ್ಡ್", logout: "ಲಾಗ್‌ಔಟ್",
    profileSettings: "ಪ್ರೊಫೈಲ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳು", language: "ಭಾಷೆ",
    changeLanguage: "ಅಪ್ಲಿಕೇಶನ್ ಮತ್ತು ವಿಷಯದ ಭಾಷೆ ಬದಲಾಯಿಸಿ",
    darkTheme: "ಡಾರ್ಕ್ ಥೀಮ್", notifications: "ಅಧಿಸೂಚನೆಗಳು",
    privacy: "ಗೌಪ್ಯತೆ", about: "ಕುರಿತು",
    customizeExperience: "ನಿಮ್ಮ ಅನುಭವವನ್ನು ಕಸ್ಟಮೈಸ್ ಮಾಡಿ",
    save: "ಉಳಿಸಿ", cancel: "ರದ್ದು ಮಾಡಿ", edit: "ಸಂಪಾದಿಸಿ", back: "ಹಿಂತಿರುಗಿ",
    delete: "ಅಳಿಸಿ", loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ...", editProfile: "ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ",
    saveChanges: "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ", verify: "ಪರಿಶೀಲಿಸಿ", confirm: "ದೃಢೀಕರಿಸಿ", send: "ಕಳುಹಿಸಿ",
    languageTitle: "ಭಾಷೆ", languageSubtitle: "ಭಾರತದ ಸಂವಿಧಾನದ 8ನೇ ಶೆಡ್ಯೂಲ್‌ನ ಎಲ್ಲಾ 22 ಭಾಷೆಗಳು",
    searchLanguage: "ಭಾಷೆ ಹುಡುಕಿ...", scheduleNote: "ಇವು ಭಾರತದ ಸಂವಿಧಾನದ 8ನೇ ಶೆಡ್ಯೂಲ್‌ನಲ್ಲಿ ಪಟ್ಟಿ ಮಾಡಲಾದ 22 ಭಾಷೆಗಳಾಗಿವೆ.",
    basicInfo: "ಮೂಲ ಮಾಹಿತಿ", academicDetails: "ಶೈಕ್ಷಣಿಕ ವಿವರಗಳು",
    location: "ಸ್ಥಳ", interests: "ಆಸಕ್ತಿಗಳು", fullName: "ಪೂರ್ಣ ಹೆಸರು",
    phoneNumber: "ಫೋನ್ ನಂಬರ್", dateOfBirth: "ಹುಟ್ಟಿದ ದಿನಾಂಕ", age: "ವಯಸ್ಸು",
    school: "ಶಾಲೆ / ಸಂಸ್ಥೆ", preferredLanguage: "ಆದ್ಯತೆಯ ಭಾಷೆ",
    pincode: "ಪಿನ್‌ಕೋಡ್", class: "ತರಗತಿ / ಗ್ರೇಡ್", board: "ಬೋರ್ಡ್",
    learnFunLoading: "ನಿಮ್ಮ LearnFun ಪ್ರಪಂಚ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    profileNotFound: "ಪ್ರೊಫೈಲ್ ಕಂಡುಬಂದಿಲ್ಲ",
    profileSetupPrompt: "ಆಡಲು ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ!",
    dailyStreak: "ದೈನಂದಿನ ಸ್ಟ್ರೀಕ್", view: "ನೋಡಿ", todaysMission: "ಇಂದಿನ ಮಿಷನ್",
    daily: "ದೈನಂದಿನ", noMissionToday: "ಇಂದು ಮಿಷನ್ ಇಲ್ಲ. ಶೀಘ್ರದಲ್ಲೇ ಮರಳಿ ಬನ್ನಿ!",
    skillWorlds: "ಕೌಶಲ ಪ್ರಪಂಚಗಳು", bossBattle: "ಬಾಸ್ ಯುದ್ಧ",
    yourGames: "ನಿಮ್ಮ ಆಟಗಳು", gamesLoading: "ಆಟಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...",
    yourBadges: "ನಿಮ್ಮ ಬ್ಯಾಡ್ಜ್‌ಗಳು", viewAll: "ಎಲ್ಲವನ್ನೂ ನೋಡಿ", comingSoon: "ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ", play: "ಆಡಿ",
    searchVideos: "ವೀಡಿಯೋ, ವಿಷಯ, ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕಿ...",
    featured: "ವಿಶೇಷ", noVideosFound: "ಯಾವುದೇ ವೀಡಿಯೋ ಕಂಡುಬಂದಿಲ್ಲ",
    clearFilters: "ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಅಳಿಸಿ", allVideos: "ಎಲ್ಲಾ ವೀಡಿಯೋಗಳು",
    videosComingSoon: "ವೀಡಿಯೋಗಳು ಶೀಘ್ರದಲ್ಲೇ!",
    loadingBattles: "ಯುದ್ಧಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...", noActiveBattles: "ಯಾವುದೇ ಸಕ್ರಿಯ ಯುದ್ಧಗಳಿಲ್ಲ",
    checkBackSoon: "ಹೊಸ ಕೌಶಲ ಯುದ್ಧಗಳಿಗಾಗಿ ಶೀಘ್ರದಲ್ಲೇ ಮರಳಿ ಬನ್ನಿ!",
    refresh: "ರಿಫ್ರೆಶ್", computingRanks: "ನಿಮ್ಮ ಶ್ರೇಣಿಗಳನ್ನು ಲೆಕ್ಕಿಸಲಾಗುತ್ತಿದೆ...",
    retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", notRankedYet: "ನೀವು ಇನ್ನೂ ಶ್ರೇಣಿ ಪಡೆದಿಲ್ಲ",
    uploadReelPrompt: "ಯುದ್ಧದಲ್ಲಿ ಭಾಗಿಯಾಗಲು ರೀಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ!",
    viewFullSkillboard: "ಪೂರ್ಣ ಸ್ಕಿಲ್‌ಬೋರ್ಡ್ ನೋಡಿ",
    battleEnded: "ಯುದ್ಧ ಮುಗಿದಿದೆ", notEligible: "ಅರ್ಹತೆ ಇಲ್ಲ", uploadReel: "ರೀಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    loginRequired: "ಲಾಗಿನ್ ಅಗತ್ಯ", live: "ಲೈವ್", completed: "ಪೂರ್ಣಗೊಂಡಿದೆ",
    prizePool: "ಬಹುಮಾನ ನಿಧಿ", endingSoon: "ಶೀಘ್ರದಲ್ಲೇ ಮುಗಿಯಲಿದೆ", viewResult: "ಫಲಿತಾಂಶ ನೋಡಿ",
    joinNow: "ಈಗ ಸೇರಿ", participate: "ಭಾಗವಹಿಸಿ", reserveSpot: "ಸ್ಥಾನ ಕಾಯ್ದಿರಿಸಿ",
    startsSoon: "ಶೀಘ್ರದಲ್ಲೇ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ", all: "ಎಲ್ಲಾ", upcoming: "ಮುಂಬರುವ",
    aiGuruSubtitle: "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಕಲಿಕೆ ಸಹಾಯಕ", askAnything: "ಯಾವುದನ್ನಾದರೂ ಕೇಳಿ", instantAnswers: "ತಕ್ಷಣದ ಉತ್ತರಗಳು", studyHelp: "ಅಧ್ಯಯನ ಸಹಾಯ", startChatting: "ಚಾಟ್ ಪ್ರಾರಂಭಿಸಿ →",
    premiumFeature: "ಪ್ರೀಮಿಯಂ ವೈಶಿಷ್ಟ್ಯ", premiumUnlockMsg: "ಈ ವೈಶಿಷ್ಟ್ಯ ಅನ್‌ಲಾಕ್ ಮಾಡಲು AI Guru Premium ಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.", maybeLater: "ನಂತರ", upgrade: "ಅಪ್‌ಗ್ರೇಡ್",
    aiClassroom: "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ AI ತರಗತಿ\nGemini ಮೂಲಕ ನಡೆಸಲ್ಪಡುತ್ತಿದೆ", freeLessonsLeft: "ಇಂದು ಉಚಿತ ಪಾಠಗಳು ಉಳಿದಿವೆ", unlimitedAccess: "ಅಮಿತ ಪ್ರೀಮಿಯಂ ಪ್ರವೇಶ ಸಕ್ರಿಯ",
    lessonSetup: "ಪಾಠ ಸೆಟಪ್", continueBtn: "ಮುಂದುವರಿಸಿ →", fillRequiredFields: "ಅಗತ್ಯ ಮಾಹಿತಿ ತುಂಬಿ", fillRequiredFieldsDesc: "ದಯವಿಟ್ಟು ವಿಷಯ ಆಯ್ಕೆ ಮಾಡಿ ಮತ್ತು ಅಧ್ಯಾಯ ಹೆಸರು ನಮೂದಿಸಿ.",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ AI ಶಿಕ್ಷಕ", readyToHelp: "ಸಹಾಯ ಮಾಡಲು ಸಿದ್ಧ!", thinking: "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ...", speaking: "ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ...", listening: "ಕೇಳುತ್ತಿದ್ದೇನೆ...",
    paywallTitle: "VidyaGuru ಜೊತೆ ಮುಂದುವರಿಯಬೇಕೆ?", paywallBody: "ಇಂದಿನ ಉಚಿತ ಪ್ರಶ್ನೆ ಬಳಸಿದ್ದೀರಿ. ಅಮಿತ ಸಂಭಾಷಣೆಗೆ ಪ್ರೀಮಿಯಂ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ!", upgradeToPremium: "ಪ್ರೀಮಿಯಂ ಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ",
    seekhoSignIn: "Seekho ಪ್ರವೇಶಿಸಲು ಲಾಗಿನ್ ಮಾಡಿ", curriculumAligned: "ಪಠ್ಯಕ್ರಮ-ಆಧಾರಿತ ಕಲಿಕೆ", subjects: "ವಿಷಯಗಳು", continueLearning: "ಕಲಿಕೆ ಮುಂದುವರಿಸಿ", resumeLearning: "ನಿಲ್ಲಿಸಿದ ಕಡೆಯಿಂದ ಪ್ರಾರಂಭಿಸಿ",
    revisionDue: "ಪುನರಾವರ್ತನೆ ಬೇಕು!", revisionReady: "ಪರಿಕಲ್ಪನೆಗಳು ಮರು ಪರಿಶೀಲನೆಗೆ ಸಿದ್ಧ", unlockCurriculum: "ಸಂಪೂರ್ಣ ಪಠ್ಯಕ್ರಮ ಅನ್‌ಲಾಕ್ ಮಾಡಿ",
    pendingReview: "ಪರಿಶೀಲನೆ ಬಾಕಿ", inReview: "ಪರಿಶೀಲನೆಯಲ್ಲಿ", approved: "ಅನುಮೋದಿಸಲಾಗಿದೆ", rejected: "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ", limitReached: "ಮಿತಿ ತಲುಪಿದೆ", limitReachedDesc: "ಈ ಬ್ಯಾಟಲ್‌ಗೆ ಅಪ್‌ಲೋಡ್ ಮಿತಿ ತಲುಪಿದ್ದೀರಿ.",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "ಪ್ರಶ್ನೆಯ ಫೋಟೋ ತೆಗೆಯಿರಿ, ತಕ್ಷಣ ಪರಿಹಾರ ಪಡೆಯಿರಿ",
    menuExamSimulator: "ಪರೀಕ್ಷಾ ಸಿಮ್ಯುಲೇಟರ್", menuExamSimulatorSub: "AI ಬೋರ್ಡ್-ಮಾದರಿ ಮಾಕ್ ಪರೀಕ್ಷೆಗಳು",
    menuVoiceTutor: "ವಾಯ್ಸ್ ಟ್ಯೂಟರ್", menuVoiceTutorSub: "ಸಂಶಯ ಹೇಳಿ, AI ಉತ್ತರ ನೀಡುತ್ತದೆ",
    menuAiNotebook: "ನನ್ನ AI ನೋಟ್‌ಬುಕ್", menuAiNotebookSub: "ಉಳಿಸಿದ AI ಸಂಭಾಷಣೆಗಳು",
    modeExplain: "ಪರಿಕಲ್ಪನೆ ವಿವರಿಸಿ", modeNotes: "ಟಿಪ್ಪಣಿಗಳು ಮಾಡಿ", modeExam: "ಪರೀಕ್ಷಾ ತಯಾರಿ",
    modeDoubt: "ಸಂಶಯ ನಿವಾರಣೆ", modeSummarize: "ಅಧ್ಯಾಯ ಸಾರಾಂಶ", modeTip: "ದೈನಂದಿನ ಅಧ್ಯಯನ ಸಲಹೆ",
    modeLanguage: "ನನ್ನ ಭಾಷೆಯಲ್ಲಿ ವಿವರಿಸಿ",
    notebookTitle: "ನನ್ನ AI ನೋಟ್‌ಬುಕ್", notebookEmpty: "ನೋಟ್‌ಬುಕ್ ಖಾಲಿಯಾಗಿದೆ",
    savedToNotebook: "ನೋಟ್‌ಬುಕ್‌ಗೆ ಉಳಿಸಲಾಗಿದೆ", saveToNotebook: "ನೋಟ್‌ಬುಕ್‌ಗೆ ಉಳಿಸಿ",
    viewNotebook: "ನೋಟ್‌ಬುಕ್ ನೋಡಿ", pinned: "ಪಿನ್ ಮಾಡಲಾಗಿದೆ",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "ಪ್ರಶ್ನೆಯ ಫೋಟೋ ತೆಗೆಯಿರಿ", solving: "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಪರಿಹರಿಸಲಾಗುತ್ತಿದೆ…",
    stepBystep: "ಹಂತ ಹಂತದ ಪರಿಹಾರ", finalAnswer: "ಅಂತಿಮ ಉತ್ತರ",
    similarQuestions: "ಇವನ್ನೂ ಅಭ್ಯಾಸ ಮಾಡಿ", solveAnother: "ಇನ್ನೊಂದು ಪ್ರಶ್ನೆ ಪರಿಹರಿಸಿ",
    examSimTitle: "ಪರೀಕ್ಷಾ ಸಿಮ್ಯುಲೇಟರ್", generateExam: "ಪರೀಕ್ಷೆ ರಚಿಸಿ", submitExam: "ಪರೀಕ್ಷೆ ಸಲ್ಲಿಸಿ",
    examResults: "ನಿಮ್ಮ ಫಲಿತಾಂಶಗಳು", boardReadiness: "ಬೋರ್ಡ್ ಪರೀಕ್ಷಾ ಸಿದ್ಧತೆ",
    weakAreas: "ಹೆಚ್ಚು ಅಭ್ಯಾಸ ಬೇಕು", strongAreas: "ಬಲವಾದ ವಿಷಯಗಳು", takeAnotherExam: "ಇನ್ನೊಂದು ಪರೀಕ್ಷೆ ತೆಗೆದುಕೊಳ್ಳಿ",
    voiceTutorTitle: "ವಾಯ್ಸ್ ಟ್ಯೂಟರ್", tapToSpeak: "ಪ್ರಶ್ನೆ ಹೇಳಲು ಟ್ಯಾಪ್ ಮಾಡಿ", recording: "ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ… ನಿಲ್ಲಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ",
    speakYourDoubt: "ನಿಮ್ಮ ಸಂಶಯ ಹೇಳಿ", explainInMyLanguage: "ನನ್ನ ಭಾಷೆಯಲ್ಲಿ ವಿವರಿಸಿ",
    seekhoPreviewTitle: "📖 ಸೀಖೋ", seekhoPreviewSub: "ವಿಷಯಗಳು, ಕೌಶಲ್ಯ ಮತ್ತು ಸೃಜನಶೀಲ ಚಟುವಟಿಕೆಗಳನ್ನು ಕಲಿಯಿರಿ", explore: "ಅನ್ವೇಷಿಸಿ →",
    vidyaStarPreviewTitle: "🌟 ವಿದ್ಯಾಸ್ಟಾರ್ ಸ್ಪರ್ಧೆ", vidyaStarPreviewSub: "ನಿಮ್ಮ ಪ್ರತಿಭೆ ತೋರಿಸಿ ಬಹುಮಾನ ಗೆಲ್ಲಿ",
    couldNotLoadContests: "ಸ್ಪರ್ಧೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.", contestsComingSoon: "ರೋಮಾಂಚಕ ಸ್ಪರ್ಧೆಗಳು ಶೀಘ್ರದಲ್ಲೇ!", viewResults: "ಫಲಿತಾಂಶ ನೋಡಿ →", participateNow: "ಈಗ ಭಾಗವಹಿಸಿ →",
    skillBattlePreviewTitle: "⚔️ ಸ್ಕಿಲ್‌ಬ್ಯಾಟಲ್ ಚಾಲೆಂಜ್", skillBattlePreviewSub: "ಸ್ಪರ್ಧಿಸಿ, ಶ್ರೇಣಿ ಹೆಚ್ಚಿಸಿ ಮತ್ತು ಬಹುಮಾನ ಗೆಲ್ಲಿ",
    couldNotLoadBattles: "ಬ್ಯಾಟಲ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.", battlesComingSoon: "ಹೊಸ ಬ್ಯಾಟಲ್‌ಗಳು ಶೀಘ್ರದಲ್ಲೇ!", poweredBy: "{{name}} ಮೂಲಕ", joinedCount: "{{count}} ಸೇರಿದ್ದಾರೆ",
    knowledgeHubTitle: "🌐 ನಾಲೆಡ್ಜ್ ಹಬ್", knowledgeHubSub: "ಕಲಿಕೆ, ಬೆಳವಣಿಗೆ ಮತ್ತು ದೈನಂದಿನ ಜೀವನಕ್ಕೆ ವೀಡಿಯೋಗಳು", watchMore: "ಇನ್ನಷ್ಟು ನೋಡಿ →",
    couldNotLoadVideos: "ವೀಡಿಯೋಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.", moreVideosSoon: "ಇನ್ನಷ್ಟು ವೀಡಿಯೋಗಳು ಶೀಘ್ರದಲ್ಲೇ!", noVideosInCat: "\"{{cat}}\" ವೀಡಿಯೋಗಳು ಇನ್ನೂ ಇಲ್ಲ.",
    shortLearningTitle: "ಶಾರ್ಟ್ ಲರ್ನಿಂಗ್", noLearningVideos: "ಇನ್ನೂ ಯಾವುದೇ ಕಲಿಕೆ ವೀಡಿಯೋಗಳಿಲ್ಲ",
    skillBattleShortsTitle: "🔥 ಶಾರ್ಟ್ಸ್", noSkillBattleVideos: "ಇನ್ನೂ ಯಾವುದೇ ಸ್ಕಿಲ್ ಬ್ಯಾಟಲ್ ವೀಡಿಯೋಗಳಿಲ್ಲ", battleBadge: "⚡ ಬ್ಯಾಟಲ್",
    shikshaStarPreviewTitle: "⭐ ಶಿಕ್ಷಾಸ್ಟಾರ್", shikshaStarPreviewSub: "ವಿದ್ಯಾದ ಪ್ರತಿಭಾಶಾಲಿ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಆಚರಿಸುತ್ತಿದ್ದೇವೆ", viewStars: "ಸ್ಟಾರ್‌ಗಳ ನೋಡಿ →",
    couldNotLoadStars: "ಸ್ಟಾರ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.", shikshaStarEmpty: "ನಿಮ್ಮ ಪ್ರತಿಭೆ ಶೀಘ್ರದಲ್ಲೇ ಇಲ್ಲಿ ತೋರಿಸಬಹುದು!", becomeShikshaStar: "ಶಿಕ್ಷಾಸ್ಟಾರ್ ಆಗಿ",
    discoverPreviewTitle: "🧭 ಡಿಸ್ಕವರ್ AI", discoverPreviewSub: "AI-ಚಾಲಿತ ವೃತ್ತಿ, ಕಾಲೇಜು & ವಿದ್ಯಾರ್ಥಿವೇತನ ಸಂಶೋಧನೆ",
    discoverTitle: "ವಿದ್ಯಾ ಡಿಸ್ಕವರ್ AI", discoverSubtitle: "ನಿಮ್ಮ ಸರಿಯಾದ ವೃತ್ತಿ, ಕಾಲೇಜು & ವಿದ್ಯಾರ್ಥಿವೇತನ ಹುಡುಕಿ", discoverCta: "ನಿಮ್ಮ ಭವಿಷ್ಯ ಅನ್ವೇಷಿಸಿ →",
    poweredByAI: "AI ಮೂಲಕ ಚಾಲಿತ", onlineLabel: "ಆನ್‌ಲೈನ್",
    yourSchool: "ನಿಮ್ಮ ಶಾಲೆ", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "ಹಂತ", xpToNextLevel: "ಮುಂದಿನ ಹಂತಕ್ಕೆ XP",
    vCoinsRankLabel: "V-Coins ಶ್ರೇಯಾಂಕ", viewLabel: "ನೋಡಿ",
    giftClaimed: "ಉಡುಗೊರೆ ಸಿಕ್ಕಿದೆ!", surpriseGiftWaiting: "ಸರ್‌ಪ್ರೈಸ್ ಉಡುಗೊರೆ ಕಾಯುತ್ತಿದೆ!",
    giftOnItsWay: "ನಿಮ್ಮ ಉಡುಗೊರೆ ಬರುತ್ತಿದೆ", tapToClaimReward: "ಬಹುಮಾನ ಪಡೆಯಲು ಟ್ಯಾಪ್ ಮಾಡಿ",
    learnFunLabel: "LearnFun",
    referEarn: "ಉಲ್ಲೇಖಿಸಿ & ಗಳಿಸಿ", referEarnSub: "ಪ್ರತಿ ಗೆಳೆಯ ಸೇರಿದಾಗ VCoins ಗಳಿಸಿ",
    viewAllLabel: "ಎಲ್ಲ ನೋಡಿ", friendsJoined: "ಸ್ನೇಹಿತರು ಸೇರಿದ್ದಾರೆ",
    vCoinsEarned: "VCoins ಗಳಿಸಿದ್ದೀರಿ", perReferral: "ಪ್ರತಿ ಉಲ್ಲೇಖಕ್ಕೆ",
    yourCode: "ನಿಮ್ಮ ಕೋಡ್", copyLabel: "ನಕಲಿಸಿ", copiedLabel: "ನಕಲಿಸಲಾಗಿದೆ!",
    referMoreFriends: "ಹೆಚ್ಚು ಸ್ನೇಹಿತರನ್ನು ಉಲ್ಲೇಖಿಸಿ", friendAlsoGets: "ಸ್ನೇಹಿತನಿಗೂ ಸಿಗುತ್ತದೆ",
    shortReelsTitle: "ಶಾರ್ಟ್ ರೀಲ್ಸ್", curatedByVidya: "Vidya AI ಆಯ್ಕೆ ಮಾಡಿದೆ",
    seeAll: "ಎಲ್ಲ ನೋಡಿ", watchAll: "ಎಲ್ಲ ನೋಡಿ", topApprovedReels: "ಅಗ್ರ ಅನುಮೋದಿತ ರೀಲ್ಸ್",
    poweredByGemini: "Gemini AI ಮೂಲಕ ಚಾಲಿತ", activeLabel: "ಸಕ್ರಿಯ",
    classLabel: "ತರಗತಿ", sponsoredBattle: "ಪ್ರಾಯೋಜಿತ ಬ್ಯಾಟಲ್",
    poweredBySponsor: "ಮೂಲಕ ಚಾಲಿತ", classSixToTwelve: "ತರಗತಿ 6–12",
    indiaPrizePool: "ಭಾರತ ಬಹುಮಾನ ನಿಧಿ", aiLessonReady: "AI ಪಾಠ ಸಿದ್ಧ",
    viewFinalLeaderboard: "ಅಂತಿಮ ಲೀಡರ್‌ಬೋರ್ಡ್ ನೋಡಿ", viewLiveStandings: "ಲೈವ್ ಸ್ಟ್ಯಾಂಡಿಂಗ್ ನೋಡಿ",
    lessonBeingPrepared: "ಪಾಠ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ…",
    vCoinsBalance: "V-Coins ಬ್ಯಾಲೆನ್ಸ್", totalEarned: "ಒಟ್ಟು ಗಳಿಸಿದ್ದೀರಿ",
    totalSpent: "ಒಟ್ಟು ಖರ್ಚು", thisMonth: "ಈ ತಿಂಗಳು",
    earnVCoins: "V-Coins ಗಳಿಸಿ", transactionHistory: "ವ್ಯವಹಾರ ಇತಿಹಾಸ",
    noTransactionsYet: "ಇನ್ನೂ ವ್ಯವಹಾರಗಳಿಲ್ಲ",
    noTransactionsSub: "V-Coins ಗಳಿಸಲು ವೀಡಿಯೊಗಳನ್ನು ನೋಡಿ!",
    walletLabel: "ವ್ಯಾಲೆಟ್", leaderboardLabel: "ಲೀಡರ್‌ಬೋರ್ಡ್",
    seeTop100: "ಟಾಪ್ 100 ನೋಡಿ", showLess: "ಕಡಿಮೆ ತೋರಿಸಿ",
    yourRank: "ನಿಮ್ಮ ಶ್ರೇಯಾಂಕ", updatedDaily: "ದೈನಂದಿನ ನವೀಕರಣ",
    referralTitle: "ಉಲ್ಲೇಖಿಸಿ & ಗಳಿಸಿ", inviteFriendsEarn: "ಸ್ನೇಹಿತರನ್ನು ಆಹ್ವಾನಿಸಿ, VCoins ಗಳಿಸಿ!",
    totalReferred: "ಒಟ್ಟು ಉಲ್ಲೇಖ", completed: "ಪೂರ್ಣಗೊಂಡಿದೆ",
    yourReferralCode: "ನಿಮ್ಮ ರೆಫರಲ್ ಕೋಡ್", shareCode: "ಈ ಕೋಡ್ ಅನ್ನು ಸ್ನೇಹಿತರೊಂದಿಗೆ ಹಂಚಿ.",
    howItWorks: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ", referralHistory: "ರೆಫರಲ್ ಇತಿಹಾಸ",
    shareEarn: "ಹಂಚಿ & ಗಳಿಸಿ", pendingLabel: "ಬಾಕಿ", joinedLabel: "ಸೇರಿದ್ದಾರೆ",
    stepLabel: "ಹಂತ", moreReferralsToUnlock: "ಇನ್ನಷ್ಟು ರೆಫರಲ್ ಅನ್‌ಲಾಕ್ ಮಾಡಲು",
    nextReward: "ಮುಂದಿನ ಉಡುಗೊರೆ",
  },

  // ─────────────────────────── Malayalam ────────────────────────────
  ml: {
    home: "ഹോം", leaderboard: "ലീഡർബോർഡ്", wallet: "വാലറ്റ്",
    settings: "ക്രമീകരണങ്ങൾ", dashboard: "ഡാഷ്‌ബോർഡ്", aiGuru: "AI ഗുരു",
    skillBoard: "സ്കിൽ ബോർഡ്", logout: "ലോഗ്ഔട്ട്",
    profileSettings: "പ്രൊഫൈൽ ക്രമീകരണങ്ങൾ", language: "ഭാഷ",
    changeLanguage: "ആപ്പ് & ഉള്ളടക്ക ഭാഷ മാറ്റുക",
    darkTheme: "ഡാർക്ക് തീം", notifications: "അറിയിപ്പുകൾ",
    privacy: "സ്വകാര്യത", about: "കുറിച്ച്",
    customizeExperience: "നിങ്ങളുടെ അനുഭവം ഇഷ്ടാനുസൃതമാക്കുക",
    save: "സേവ് ചെയ്യുക", cancel: "റദ്ദാക്കുക", edit: "എഡിറ്റ് ചെയ്യുക", back: "തിരിച്ചു പോകുക",
    delete: "ഇല്ലാതാക്കുക", loading: "ലോഡ് ചെയ്യുന്നു...", editProfile: "പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക",
    saveChanges: "മാറ്റങ്ങൾ സേവ് ചെയ്യുക", verify: "സ്ഥിരീകരിക്കുക", confirm: "ഉറപ്പിക്കുക", send: "അയക്കുക",
    languageTitle: "ഭാഷ", languageSubtitle: "ഭാരത ഭരണഘടനയുടെ 8-ാം ഷെഡ്യൂളിലെ 22 ഭാഷകൾ",
    searchLanguage: "ഭാഷ തിരയുക...", scheduleNote: "ഇവ ഭാരതത്തിന്റെ ഭരണഘടനയുടെ 8-ാം ഷെഡ്യൂളിൽ പട്ടികപ്പെടുത്തിയ 22 ഭാഷകളാണ്.",
    basicInfo: "അടിസ്ഥാന വിവരങ്ങൾ", academicDetails: "അക്കാദമിക് വിശദാംശങ്ങൾ",
    location: "സ്ഥലം", interests: "താൽപ്പര്യങ്ങൾ", fullName: "പൂർണ്ണ നാമം",
    phoneNumber: "ഫോൺ നമ്പർ", dateOfBirth: "ജനനതീയതി", age: "പ്രായം",
    school: "സ്കൂൾ / സ്ഥാപനം", preferredLanguage: "ഇഷ്ടഭാഷ",
    pincode: "പിൻകോഡ്", class: "ക്ലാസ് / ഗ്രേഡ്", board: "ബോർഡ്",
    learnFunLoading: "നിങ്ങളുടെ LearnFun ലോകം ലോഡ് ആകുന്നു...",
    profileNotFound: "പ്രൊഫൈൽ കണ്ടെത്തിയില്ല",
    profileSetupPrompt: "കളിക്കാൻ തുടങ്ങാൻ നിങ്ങളുടെ പ്രൊഫൈൽ പൂർത്തിയാക്കുക!",
    dailyStreak: "ദൈനംദിന സ്ട്രീക്", view: "കാണുക", todaysMission: "ഇന്നത്തെ ദൗത്യം",
    daily: "ദൈനംദിന", noMissionToday: "ഇന്ന് ദൗത്യമില്ല. ഉടൻ തിരിച്ചുവരൂ!",
    skillWorlds: "കഴിവ് ലോകങ്ങൾ", bossBattle: "ബോസ് യുദ്ധം",
    yourGames: "നിങ്ങളുടെ ഗെയിമുകൾ", gamesLoading: "ഗെയിമുകൾ ലോഡ് ആകുന്നു...",
    yourBadges: "നിങ്ങളുടെ ബാഡ്ജുകൾ", viewAll: "എല്ലാം കാണുക", comingSoon: "ഉടൻ വരുന്നു", play: "കളിക്കുക",
    searchVideos: "വീഡിയോ, വിഷയം, അധ്യാപകൻ തിരയുക...",
    featured: "പ്രത്യേകം", noVideosFound: "വീഡിയോകൾ കണ്ടെത്തിയില്ല",
    clearFilters: "ഫിൽട്ടറുകൾ മായ്ക്കുക", allVideos: "എല്ലാ വീഡിയോകളും",
    videosComingSoon: "വീഡിയോകൾ ഉടൻ!",
    loadingBattles: "യുദ്ധങ്ങൾ ലോഡ് ആകുന്നു...", noActiveBattles: "സജീവ യുദ്ധങ്ങൾ ഇല്ല",
    checkBackSoon: "പുതിയ സ്കിൽ യുദ്ധങ്ങൾക്കായി ഉടൻ തിരിച്ചുവരൂ!",
    refresh: "പുതുക്കുക", computingRanks: "നിങ്ങളുടെ റാങ്കുകൾ കണക്കാക്കുന്നു...",
    retry: "വീണ്ടും ശ്രമിക്കുക", notRankedYet: "നിങ്ങൾ ഇതുവരെ റാങ്ക് ചെയ്തിട്ടില്ല",
    uploadReelPrompt: "യുദ്ധത്തിൽ ചേരാൻ റീൽ അപ്‌ലോഡ് ചെയ്യുക!",
    viewFullSkillboard: "പൂർണ്ണ സ്കിൽ‌ബോർഡ് കാണുക",
    battleEnded: "യുദ്ധം അവസാനിച്ചു", notEligible: "യോഗ്യതയില്ല", uploadReel: "റീൽ അപ്‌ലോഡ് ചെയ്യുക",
    loginRequired: "ലോഗിൻ ആവശ്യം", live: "തൽസമയം", completed: "പൂർത്തിയായി",
    prizePool: "സമ്മാനക്കലവറ", endingSoon: "ഉടൻ അവസാനിക്കും", viewResult: "ഫലം കാണുക",
    joinNow: "ഇപ്പോൾ ചേരുക", participate: "പങ്കെടുക്കുക", reserveSpot: "സ്ഥലം ബുക്ക് ചെയ്യുക",
    startsSoon: "ഉടൻ ആരംഭിക്കും", all: "എല്ലാം", upcoming: "വരാനിരിക്കുന്നത്",
    aiGuruSubtitle: "നിങ്ങളുടെ വ്യക്തിഗത പഠന സഹായി", askAnything: "എന്തും ചോദിക്കൂ", instantAnswers: "തൽക്ഷണ ഉത്തരങ്ങൾ", studyHelp: "പഠന സഹായം", startChatting: "ചാറ്റ് ആരംഭിക്കൂ →",
    premiumFeature: "പ്രീമിയം ഫീച്ചർ", premiumUnlockMsg: "ഈ ഫീച്ചർ അൺലോക്ക് ചെയ്യാൻ AI Guru Premium ലേക്ക് അപ്‌ഗ്രേഡ് ചെയ്യൂ.", maybeLater: "പിന്നീട്", upgrade: "അപ്‌ഗ്രേഡ്",
    aiClassroom: "നിങ്ങളുടെ വ്യക്തിഗത AI ക്ലാസ്‌റൂം\nGemini ഉപയോഗിച്ച് പ്രവർത്തിക്കുന്നു", freeLessonsLeft: "ഇന്ന് ഉള്ള സൗജന്യ പാഠങ്ങൾ ബാക്കി", unlimitedAccess: "പരിധിയില്ലാത്ത പ്രീമിയം ആക്‌സസ് സജീവം",
    lessonSetup: "പാഠ സജ്ജീകരണം", continueBtn: "തുടരുക →", fillRequiredFields: "ആവശ്യമായ ഫീൽഡുകൾ പൂരിപ്പിക്കൂ", fillRequiredFieldsDesc: "ദയവായി വിഷയം തിരഞ്ഞെടുക്കുക, അദ്ധ്യായ നാമം നൽകുക.",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "നിങ്ങളുടെ വ്യക്തിഗത AI അദ്ധ്യാപകൻ", readyToHelp: "സഹായിക്കാൻ തയ്യാർ!", thinking: "ആലോചിക്കുന്നു...", speaking: "സംസാരിക്കുന്നു...", listening: "ശ്രദ്ധിക്കുന്നു...",
    paywallTitle: "VidyaGuru ഉപയോഗിച്ച് തുടരണോ?", paywallBody: "ഇന്നത്തെ സൗജന്യ ചോദ്യം ഉപയോഗിച്ചു. പരിധിയില്ലാത്ത സംഭാഷണത്തിന് പ്രീമിയം അപ്‌ഗ്രേഡ് ചെയ്യൂ!", upgradeToPremium: "പ്രീമിയത്തിലേക്ക് അപ്‌ഗ്രേഡ് ചെയ്യൂ",
    seekhoSignIn: "Seekho ആക്‌സസ് ചെയ്യാൻ ലോഗിൻ ചെയ്യൂ", curriculumAligned: "പാഠ്യക്രമ-അടിസ്ഥാനിത പഠനം", subjects: "വിഷയങ്ങൾ", continueLearning: "പഠിക്കൽ തുടരൂ", resumeLearning: "നിർത്തിയ ഇടത്ത് നിന്ന് തുടരുക",
    revisionDue: "റിവിഷൻ വേണം!", revisionReady: "ആശയങ്ങൾ അവലോകനത്തിന് തയ്യാർ", unlockCurriculum: "പൂർണ്ണ പാഠ്യക്രമം അൺലോക്ക് ചെയ്യൂ",
    pendingReview: "അവലോകനം ബാക്കി", inReview: "അവലോകനത്തിൽ", approved: "അംഗീകരിച്ചു", rejected: "നിരസിച്ചു", limitReached: "പരിധി എത്തി", limitReachedDesc: "ഈ ബാറ്റിലിനായുള്ള അപ്‌ലോഡ് പരിധി കഴിഞ്ഞു.",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "ചോദ്യം ഫോട്ടോ എടുക്കൂ, ഉടനടി ഉത്തരം നേടൂ",
    menuExamSimulator: "പരീക്ഷ സിമുലേറ്റർ", menuExamSimulatorSub: "AI ബോർഡ്-പാറ്റേൺ മോക്ക് പരീക്ഷകൾ",
    menuVoiceTutor: "വോയ്‌സ് ട്യൂട്ടർ", menuVoiceTutorSub: "സംശയം പറയൂ, AI ഉത്തരം നൽകും",
    menuAiNotebook: "എന്റെ AI നോട്ട്ബുക്ക്", menuAiNotebookSub: "സേവ് ചെയ്ത AI സംഭാഷണങ്ങൾ",
    modeExplain: "ആശയം വിശദീകരിക്കൂ", modeNotes: "നോട്ടുകൾ ഉണ്ടാക്കൂ", modeExam: "പരീക്ഷ തയ്യാറെടുക്കൽ",
    modeDoubt: "സംശയം തീർക്കൂ", modeSummarize: "അധ്യായ സംഗ്രഹം", modeTip: "ദൈനന്ദിന പഠന ടിപ്",
    modeLanguage: "എന്റെ ഭാഷയിൽ വിശദീകരിക്കൂ",
    notebookTitle: "എന്റെ AI നോട്ട്ബുക്ക്", notebookEmpty: "നോട്ട്ബുക്ക് ശൂന്യം",
    savedToNotebook: "നോട്ട്ബുക്കിൽ സേവ് ചെയ്തു", saveToNotebook: "നോട്ട്ബുക്കിൽ സേവ് ചെയ്യൂ",
    viewNotebook: "നോട്ട്ബുക്ക് കാണൂ", pinned: "പിൻ ചെയ്തു",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "ചോദ്യം ഫോട്ടോ എടുക്കൂ", solving: "നിങ്ങളുടെ ചോദ്യം പരിഹരിക്കുന്നു…",
    stepBystep: "ഘട്ടം ഘട്ടമായ പരിഹാരം", finalAnswer: "അന്തിമ ഉത്തരം",
    similarQuestions: "ഇവ കൂടി പരിശീലിക്കൂ", solveAnother: "മറ്റൊരു ചോദ്യം പരിഹരിക്കൂ",
    examSimTitle: "പരീക്ഷ സിമുലേറ്റർ", generateExam: "പരീക്ഷ ഉണ്ടാക്കൂ", submitExam: "പരീക്ഷ സമർപ്പിക്കൂ",
    examResults: "നിങ്ങളുടെ ഫലങ്ങൾ", boardReadiness: "ബോർഡ് പരീക്ഷ തയ്യാറെടുപ്പ്",
    weakAreas: "കൂടുതൽ പരിശീലനം ആവശ്യം", strongAreas: "ശക്തമായ വിഷയങ്ങൾ", takeAnotherExam: "മറ്റൊരു പരീക്ഷ എഴുതൂ",
    voiceTutorTitle: "വോയ്‌സ് ട്യൂട്ടർ", tapToSpeak: "ചോദ്യം പറയാൻ ടാപ്പ് ചെയ്യൂ", recording: "റെക്കോർഡ് ചെയ്യുന്നു… നിർത്താൻ ടാപ്പ് ചെയ്യൂ",
    speakYourDoubt: "നിങ്ങളുടെ സംശയം പറയൂ", explainInMyLanguage: "എന്റെ ഭാഷയിൽ വിശദീകരിക്കൂ",
    poweredByAI: "AI ഉപയോഗിച്ച് പ്രവർത്തിക്കുന്നു", onlineLabel: "ഓൺലൈൻ",
    yourSchool: "നിങ്ങളുടെ സ്കൂൾ", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "ലെവൽ", xpToNextLevel: "അടുത്ത ലെവലിലേക്ക് XP",
    vCoinsRankLabel: "V-Coins റാങ്ക്", viewLabel: "കാണൂ",
    giftClaimed: "സമ്മാനം കിട്ടി!", surpriseGiftWaiting: "സർപ്രൈസ് സമ്മാനം കാത്തിരിക്കുന്നു!",
    giftOnItsWay: "നിങ്ങളുടെ സമ്മാനം വരുന്നു", tapToClaimReward: "സമ്മാനം നേടാൻ ടാപ്പ് ചെയ്യൂ",
    learnFunLabel: "LearnFun",
    referEarn: "റഫർ ചെയ്ത് നേടൂ", referEarnSub: "ഓരോ സുഹൃത്ത് ചേരുമ്പോഴും VCoins നേടൂ",
    viewAllLabel: "എല്ലാം കാണൂ", friendsJoined: "സുഹൃത്തുക്കൾ ചേർന്നു",
    vCoinsEarned: "VCoins നേടി", perReferral: "ഓരോ റഫറലിനും",
    yourCode: "നിങ്ങളുടെ കോഡ്", copyLabel: "കോപ്പി ചെയ്യൂ", copiedLabel: "കോപ്പി ആയി!",
    referMoreFriends: "കൂടുതൽ സുഹൃത്തുക്കളെ റഫർ ചെയ്യൂ", friendAlsoGets: "സുഹൃത്തിനും ലഭിക്കും",
    shortReelsTitle: "ഷോർട്ട് റീൽസ്", curatedByVidya: "Vidya AI തിരഞ്ഞെടുത്തത്",
    seeAll: "എല്ലാം കാണൂ", watchAll: "എല്ലാം കാണൂ", topApprovedReels: "മികച്ച അംഗീകൃത റീൽസ്",
    poweredByGemini: "Gemini AI ഉപയോഗിച്ച് പ്രവർത്തിക്കുന്നു", activeLabel: "സജീവം",
    classLabel: "ക്ലാസ്", sponsoredBattle: "സ്പോൺസർ ബാറ്റിൽ",
    poweredBySponsor: "പ്രവർത്തിക്കുന്നത്", classSixToTwelve: "ക്ലാസ് 6–12",
    indiaPrizePool: "ഇന്ത്യ സമ്മാന നിധി", aiLessonReady: "AI പാഠം തയ്യാർ",
    viewFinalLeaderboard: "ഫൈനൽ ലീഡർബോർഡ് കാണൂ", viewLiveStandings: "ലൈവ് സ്റ്റാൻഡിംഗ് കാണൂ",
    lessonBeingPrepared: "പാഠം തയ്യാറാകുന്നു…",
    vCoinsBalance: "V-Coins ബ്യാലൻസ്", totalEarned: "ആകെ സമ്പാദിച്ചത്",
    totalSpent: "ആകെ ചെലവ്", thisMonth: "ഈ മാസം",
    earnVCoins: "V-Coins നേടൂ", transactionHistory: "ഇടപാട് ചരിത്രം",
    noTransactionsYet: "ഇതുവരെ ഇടപാടുകൾ ഇല്ല",
    noTransactionsSub: "V-Coins നേടാൻ വീഡിയോകൾ കാണൂ!",
    walletLabel: "വാലറ്റ്", leaderboardLabel: "ലീഡർബോർഡ്",
    seeTop100: "ടോപ്പ് 100 കാണൂ", showLess: "കുറവ് കാണൂ",
    yourRank: "നിങ്ങളുടെ റാങ്ക്", updatedDaily: "ദൈനംദിന അപ്‌ഡേറ്റ്",
    referralTitle: "റഫർ ചെയ്ത് നേടൂ", inviteFriendsEarn: "സുഹൃത്തുക്കളെ ക്ഷണിക്കൂ, VCoins നേടൂ!",
    totalReferred: "ആകെ റഫർ", completed: "പൂർത്തിയായി",
    yourReferralCode: "നിങ്ങളുടെ റഫറൽ കോഡ്", shareCode: "ഈ കോഡ് സുഹൃത്തുക്കളുമായി പങ്കിടൂ.",
    howItWorks: "ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നു", referralHistory: "റഫറൽ ചരിത്രം",
    shareEarn: "ഷെയർ ചെയ്ത് നേടൂ", pendingLabel: "കാത്തിരിക്കുന്നു", joinedLabel: "ചേർന്നു",
    stepLabel: "ഘട്ടം", moreReferralsToUnlock: "കൂടുതൽ റഫറലുകൾ അൺലോക്ക് ചെയ്യാൻ",
    nextReward: "അടുത്ത സമ്മാനം",
  },

  // ─────────────────────────── Marathi ──────────────────────────────
  mr: {
    home: "मुख्यपृष्ठ", leaderboard: "लीडरबोर्ड", wallet: "पाकीट",
    settings: "सेटिंग्ज", dashboard: "डॅशबोर्ड", aiGuru: "AI गुरू",
    skillBoard: "कौशल्य बोर्ड", logout: "लॉगआउट",
    profileSettings: "प्रोफाईल सेटिंग्ज", language: "भाषा",
    changeLanguage: "अॅप आणि सामग्रीची भाषा बदला",
    darkTheme: "डार्क थीम", notifications: "सूचना",
    privacy: "गोपनीयता", about: "माहिती",
    customizeExperience: "तुमचा अनुभव सानुकूलित करा",
    save: "जतन करा", cancel: "रद्द करा", edit: "संपादित करा", back: "मागे जा",
    delete: "हटवा", loading: "लोड होत आहे...", editProfile: "प्रोफाईल संपादित करा",
    saveChanges: "बदल जतन करा", verify: "सत्यापित करा", confirm: "पुष्टी करा", send: "पाठवा",
    languageTitle: "भाषा", languageSubtitle: "भारतीय संविधानाच्या 8व्या अनुसूचीतील सर्व 22 भाषा",
    searchLanguage: "भाषा शोधा...", scheduleNote: "या भारताच्या संविधानाच्या 8व्या अनुसूचीत सूचीबद्ध 22 भाषा आहेत.",
    basicInfo: "मूलभूत माहिती", academicDetails: "शैक्षणिक तपशील",
    location: "स्थान", interests: "आवडी", fullName: "पूर्ण नाव",
    phoneNumber: "फोन नंबर", dateOfBirth: "जन्मतारीख", age: "वय",
    school: "शाळा / संस्था", preferredLanguage: "पसंतीची भाषा",
    pincode: "पिनकोड", class: "वर्ग / श्रेणी", board: "मंडळ",
    learnFunLoading: "तुमचे LearnFun जग लोड होत आहे...",
    profileNotFound: "प्रोफाइल आढळले नाही",
    profileSetupPrompt: "खेळणे सुरू करण्यासाठी तुमचे प्रोफाइल पूर्ण करा!",
    dailyStreak: "दैनिक स्ट्रीक", view: "पहा", todaysMission: "आजचे मिशन",
    daily: "दैनिक", noMissionToday: "आज मिशन नाही. लवकरच परत या!",
    skillWorlds: "कौशल्य जगत", bossBattle: "बॉस बॅटल",
    yourGames: "तुमचे गेम्स", gamesLoading: "गेम्स लोड होत आहेत...",
    yourBadges: "तुमचे बॅज", viewAll: "सर्व पहा", comingSoon: "लवकरच येत आहे", play: "खेळा",
    searchVideos: "व्हिडिओ, विषय, शिक्षक शोधा...",
    featured: "विशेष", noVideosFound: "कोणते व्हिडिओ सापडले नाहीत",
    clearFilters: "फिल्टर साफ करा", allVideos: "सर्व व्हिडिओ",
    videosComingSoon: "व्हिडिओ लवकरच!",
    loadingBattles: "बॅटल्स लोड होत आहेत...", noActiveBattles: "कोणतेही सक्रिय बॅटल नाहीत",
    checkBackSoon: "नवीन कौशल्य बॅटलसाठी लवकरच परत या!",
    refresh: "रिफ्रेश करा", computingRanks: "तुमचे रँक मोजले जात आहेत...",
    retry: "पुन्हा प्रयत्न करा", notRankedYet: "तुम्ही अजून रँक केले नाहीत",
    uploadReelPrompt: "बॅटलमध्ये सहभागी होण्यासाठी रील अपलोड करा!",
    viewFullSkillboard: "संपूर्ण स्किलबोर्ड पहा",
    battleEnded: "बॅटल संपली", notEligible: "पात्र नाही", uploadReel: "रील अपलोड करा",
    loginRequired: "लॉगिन आवश्यक", live: "लाइव्ह", completed: "पूर्ण",
    prizePool: "पारितोषिक निधी", endingSoon: "लवकरच संपेल", viewResult: "निकाल पहा",
    joinNow: "आत्ता सामील व्हा", participate: "भाग घ्या", reserveSpot: "जागा राखून ठेवा",
    startsSoon: "लवकरच सुरू होईल", all: "सर्व", upcoming: "येणारे",
    aiGuruSubtitle: "तुमचा वैयक्तिक शिक्षण सहाय्यक", askAnything: "काहीही विचारा", instantAnswers: "तत्काळ उत्तरे", studyHelp: "अभ्यासात मदत", startChatting: "चॅट सुरू करा →",
    premiumFeature: "प्रीमियम वैशिष्ट्य", premiumUnlockMsg: "हे वैशिष्ट्य अनलॉक करण्यासाठी AI Guru Premium अपग्रेड करा.", maybeLater: "नंतर", upgrade: "अपग्रेड करा",
    aiClassroom: "तुमचा वैयक्तिक AI वर्गखोली\nGemini द्वारे चालवले", freeLessonsLeft: "आजचे मोफत धडे बाकी", unlimitedAccess: "असीमित प्रीमियम ऍक्सेस सक्रिय",
    lessonSetup: "धडा सेटअप", continueBtn: "पुढे जा →", fillRequiredFields: "आवश्यक माहिती भरा", fillRequiredFieldsDesc: "कृपया विषय निवडा आणि अध्यायाचे नाव टाका.",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "तुमचे वैयक्तिक AI शिक्षक", readyToHelp: "मदत करण्यासाठी तयार!", thinking: "विचार करतोय...", speaking: "बोलतोय...", listening: "ऐकतोय...",
    paywallTitle: "VidyaGuru सोबत चालू ठेवायचे?", paywallBody: "आजचा मोफत प्रश्न वापरला. असीमित संभाषणासाठी प्रीमियम अपग्रेड करा!", upgradeToPremium: "प्रीमियमवर अपग्रेड करा",
    seekhoSignIn: "Seekho ऍक्सेस करण्यासाठी लॉगिन करा", curriculumAligned: "अभ्यासक्रम-आधारित शिक्षण", subjects: "विषय", continueLearning: "शिकणे चालू ठेवा", resumeLearning: "सोडलेल्या ठिकाणाहून सुरू करा",
    revisionDue: "उजळणी करा!", revisionReady: "संकल्पना पुनरावलोकनासाठी तयार", unlockCurriculum: "पूर्ण अभ्यासक्रम अनलॉक करा",
    pendingReview: "पुनरावलोकन प्रतीक्षेत", inReview: "पुनरावलोकनात", approved: "मंजूर", rejected: "नाकारले", limitReached: "मर्यादा पोहोचली", limitReachedDesc: "तुम्ही या बॅटलची अपलोड मर्यादा गाठली आहे.",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "प्रश्नाचा फोटो काढा, लगेच उत्तर मिळवा",
    menuExamSimulator: "परीक्षा सिम्युलेटर", menuExamSimulatorSub: "AI बोर्ड-पॅटर्न मॉक परीक्षा",
    menuVoiceTutor: "व्हॉइस ट्यूटर", menuVoiceTutorSub: "शंका सांगा, AI उत्तर देईल",
    menuAiNotebook: "माझी AI नोटबुक", menuAiNotebookSub: "जतन केलेल्या AI गप्पा",
    modeExplain: "संकल्पना समजावा", modeNotes: "नोट्स तयार करा", modeExam: "परीक्षेची तयारी",
    modeDoubt: "शंका निरसन", modeSummarize: "प्रकरण सारांश", modeTip: "दैनंदिन अभ्यास टिप",
    modeLanguage: "माझ्या भाषेत समजावा",
    notebookTitle: "माझी AI नोटबुक", notebookEmpty: "नोटबुक रिकामी आहे",
    savedToNotebook: "नोटबुकमध्ये जतन केले", saveToNotebook: "नोटबुकमध्ये जतन करा",
    viewNotebook: "नोटबुक पहा", pinned: "पिन केलेले",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "प्रश्नाचा फोटो काढा", solving: "तुमचा प्रश्न सोडवला जात आहे…",
    stepBystep: "टप्याटप्याने उत्तर", finalAnswer: "अंतिम उत्तर",
    similarQuestions: "हेही सराव करा", solveAnother: "आणखी एक प्रश्न सोडवा",
    examSimTitle: "परीक्षा सिम्युलेटर", generateExam: "परीक्षा तयार करा", submitExam: "परीक्षा सादर करा",
    examResults: "तुमचे निकाल", boardReadiness: "बोर्ड परीक्षा सज्जता",
    weakAreas: "अधिक सराव आवश्यक", strongAreas: "मजबूत विषय", takeAnotherExam: "आणखी एक परीक्षा द्या",
    voiceTutorTitle: "व्हॉइस ट्यूटर", tapToSpeak: "प्रश्न सांगण्यासाठी टॅप करा", recording: "रेकॉर्डिंग… थांबण्यासाठी टॅप करा",
    speakYourDoubt: "तुमची शंका सांगा", explainInMyLanguage: "माझ्या भाषेत समजावा",
    poweredByAI: "AI द्वारे चालित", onlineLabel: "ऑनलाईन",
    yourSchool: "तुमची शाळा", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "स्तर", xpToNextLevel: "पुढील स्तरापर्यंत XP",
    vCoinsRankLabel: "V-Coins रँक", viewLabel: "पाहा",
    giftClaimed: "भेट मिळाली!", surpriseGiftWaiting: "सरप्राइज भेट प्रतीक्षेत!",
    giftOnItsWay: "तुमची भेट येत आहे", tapToClaimReward: "बक्षीस घेण्यासाठी टॅप करा",
    learnFunLabel: "LearnFun",
    referEarn: "रेफर करा & कमवा", referEarnSub: "प्रत्येक मित्र जोडल्यावर VCoins कमवा",
    viewAllLabel: "सर्व पाहा", friendsJoined: "मित्र जोडले",
    vCoinsEarned: "VCoins कमवले", perReferral: "प्रत्येक रेफरलसाठी",
    yourCode: "तुमचा कोड", copyLabel: "कॉपी करा", copiedLabel: "कॉपी झाले!",
    referMoreFriends: "अधिक मित्रांना रेफर करा", friendAlsoGets: "मित्राला पण मिळते",
    shortReelsTitle: "शॉर्ट रील्स", curatedByVidya: "Vidya AI द्वारे निवडलेले",
    seeAll: "सर्व पाहा", watchAll: "सर्व पाहा", topApprovedReels: "शीर्ष मंजूर रील्स",
    poweredByGemini: "Gemini AI द्वारे चालित", activeLabel: "सक्रिय",
    classLabel: "इयत्ता", sponsoredBattle: "प्रायोजित बॅटल",
    poweredBySponsor: "द्वारे चालित", classSixToTwelve: "इयत्ता 6–12",
    indiaPrizePool: "भारत बक्षीस निधी", aiLessonReady: "AI धडा तयार",
    viewFinalLeaderboard: "अंतिम लीडरबोर्ड पाहा", viewLiveStandings: "लाइव्ह स्टँडिंग पाहा",
    lessonBeingPrepared: "धडा तयार होत आहे…",
    vCoinsBalance: "V-Coins शिल्लक", totalEarned: "एकूण कमवलेले",
    totalSpent: "एकूण खर्च", thisMonth: "या महिन्यात",
    earnVCoins: "V-Coins कमवा", transactionHistory: "व्यवहार इतिहास",
    noTransactionsYet: "अजून कोणताही व्यवहार नाही",
    noTransactionsSub: "V-Coins कमवण्यासाठी व्हिडिओ पाहा!",
    walletLabel: "वॉलेट", leaderboardLabel: "लीडरबोर्ड",
    seeTop100: "टॉप 100 पाहा", showLess: "कमी दाखवा",
    yourRank: "तुमची रँक", updatedDaily: "दररोज अपडेट",
    referralTitle: "रेफर करा & कमवा", inviteFriendsEarn: "मित्रांना आमंत्रित करा, VCoins कमवा!",
    totalReferred: "एकूण रेफर", completed: "पूर्ण",
    yourReferralCode: "तुमचा रेफरल कोड", shareCode: "हा कोड मित्रांसोबत शेअर करा.",
    howItWorks: "हे कसे काम करते", referralHistory: "रेफरल इतिहास",
    shareEarn: "शेअर करा & कमवा", pendingLabel: "प्रलंबित", joinedLabel: "जोडले",
    stepLabel: "पायरी", moreReferralsToUnlock: "आणखी रेफरल अनलॉक करण्यासाठी",
    nextReward: "पुढील बक्षीस",
  },

  // ─────────────────────────── Gujarati ─────────────────────────────
  gu: {
    home: "હોમ", leaderboard: "લીડરબોર્ડ", wallet: "વૉલેટ",
    settings: "સેટિંગ્સ", dashboard: "ડૅશબોર્ડ", aiGuru: "AI ગુરુ",
    skillBoard: "કૌશલ્ય બોર્ડ", logout: "લૉગઆઉટ",
    profileSettings: "પ્રોફાઇલ સેટિંગ્સ", language: "ભાષા",
    changeLanguage: "એપ અને સામગ્રીની ભાષા બદલો",
    darkTheme: "ડાર્ક થીમ", notifications: "સૂચનાઓ",
    privacy: "ગોપનીયતા", about: "વિશે",
    customizeExperience: "તમારો અનુભવ કસ્ટમાઇઝ કરો",
    save: "સાચવો", cancel: "રદ કરો", edit: "સંપાદિત કરો", back: "પાછળ",
    delete: "કાઢી નાખો", loading: "લોડ થઈ રહ્યું છે...", editProfile: "પ્રોફાઇલ સંપાદિત કરો",
    saveChanges: "ફેરફારો સાચવો", verify: "ચકાસો", confirm: "પુષ્ટિ કરો", send: "મોકલો",
    languageTitle: "ભાષા", languageSubtitle: "ભારતીય બંધારણની 8મી અનુસૂચિની તમામ 22 ભાષાઓ",
    searchLanguage: "ભાષા શોધો...", scheduleNote: "આ ભારતના બંધારણની 8મી અનુસૂચિમાં સૂચિબદ્ધ 22 ભાષાઓ છે.",
    basicInfo: "મૂળ માહિતી", academicDetails: "શૈક્ષણિક વિગતો",
    location: "સ્થાન", interests: "રુચિઓ", fullName: "પૂર્ણ નામ",
    phoneNumber: "ફોન નંબર", dateOfBirth: "જન્મ તારીખ", age: "ઉંમર",
    school: "શાળા / સંસ્થા", preferredLanguage: "પ્રિય ભાષા",
    pincode: "પિનકોડ", class: "વર્ગ / ગ્રેડ", board: "બોર્ડ",
    learnFunLoading: "તમારી LearnFun દુનિયા લોડ થઈ રહી છે...",
    profileNotFound: "પ્રોફાઇલ મળ્યું નહીં",
    profileSetupPrompt: "રમવું શરૂ કરવા માટે તમારી પ્રોફાઇલ પૂર્ણ કરો!",
    dailyStreak: "દૈનિક સ્ટ્રીક", view: "જુઓ", todaysMission: "આજનું મિશન",
    daily: "દૈનિક", noMissionToday: "આજે કોઈ મિશન નથી. ટૂંક સમયમાં પાછા આવો!",
    skillWorlds: "કૌશલ્ય દુનિયા", bossBattle: "બૉસ બૅટલ",
    yourGames: "તમારી રમતો", gamesLoading: "રમતો લોડ થઈ રહી છે...",
    yourBadges: "તમારા બૅજ", viewAll: "બધું જુઓ", comingSoon: "ટૂંક સમયમાં આવે છે", play: "રમો",
    searchVideos: "વિડિઓ, વિષય, શિક્ષક શોધો...",
    featured: "વિશેષ", noVideosFound: "કોઈ વિડિઓ મળ્યા નહીં",
    clearFilters: "ફિલ્ટર સાફ કરો", allVideos: "બધા વિડિઓ",
    videosComingSoon: "વિડિઓ ટૂંક સમયમાં!",
    loadingBattles: "બૅટલ લોડ થઈ રહ્યા છે...", noActiveBattles: "કોઈ સક્રિય બૅટલ નથી",
    checkBackSoon: "નવી સ્કિલ બૅટલ માટે ટૂંક સમયમાં પાછા આવો!",
    refresh: "રિફ્રૅશ", computingRanks: "તમારી રેન્ક ગણવામાં આવી રહી છે...",
    retry: "ફરી પ્રયાસ", notRankedYet: "તમે હજી રેન્ક્ડ નથી",
    uploadReelPrompt: "બૅટલમાં ભાગ લેવા રીલ અપલોડ કરો!",
    viewFullSkillboard: "સંપૂર્ણ સ્કિલ બોર્ડ જુઓ",
    battleEnded: "બૅટલ સમાપ્ત", notEligible: "પાત્ર નથી", uploadReel: "રીલ અપલોડ કરો",
    loginRequired: "લૉગિન જરૂરી", live: "લાઇવ", completed: "પૂર્ણ",
    prizePool: "ઇનામ ભંડોળ", endingSoon: "ટૂંક સમયમાં સમાપ્ત", viewResult: "પરિણામ જુઓ",
    joinNow: "હવે જોડાઓ", participate: "ભાગ લો", reserveSpot: "સ્થાન અનામત કરો",
    startsSoon: "ટૂંક સમયમાં શરૂ", all: "બધા", upcoming: "આગામી",
    aiGuruSubtitle: "તમારો વ્યક્તિગત શિક્ષણ સહાયક", askAnything: "ગમે તે પૂછો", instantAnswers: "તત્કાળ જવાબો", studyHelp: "અભ્યાસ સહાય", startChatting: "ચેટ શરૂ કરો →",
    premiumFeature: "પ્રીમિયમ સુવિધા", premiumUnlockMsg: "આ સુવિધા અનલૉક કરવા AI Guru Premium અપગ્રેડ કરો.", maybeLater: "પછી", upgrade: "અપગ્રેડ",
    aiClassroom: "તમારો વ્યક્તિગત AI ક્લાસ\nGemini દ્વારા સંચાલિત", freeLessonsLeft: "આજના મફત પાઠ બાકી", unlimitedAccess: "અમર્યાદિત પ્રીમિયમ ઍક્સેસ સક્રિય",
    lessonSetup: "પાઠ સેટઅપ", continueBtn: "ચાલુ રાખો →", fillRequiredFields: "જરૂરી માહિતી ભરો", fillRequiredFieldsDesc: "કૃપા કરીને વિષય પસંદ કરો અને અધ્યાયનું નામ દાખલ કરો.",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "તમારા વ્યક્તિગત AI શિક્ષક", readyToHelp: "મદદ માટે તૈયાર!", thinking: "વિચારી રહ્યો છું...", speaking: "બોલી રહ્યો છું...", listening: "સાંભળી રહ્યો છું...",
    paywallTitle: "VidyaGuru સાથે ચાલુ રાખો?", paywallBody: "આજનો મફત પ્રશ્ન વાપર્યો. અમર્યાદિત વાર્તાલાપ માટે પ્રીમિયમ અપગ્રેડ કરો!", upgradeToPremium: "પ્રીમિયમ પર અપગ્રેડ કરો",
    seekhoSignIn: "Seekho ઍક્સેસ કરવા લૉગિન કરો", curriculumAligned: "અભ્યાસક્રમ-આધારિત શિક્ષણ", subjects: "વિષયો", continueLearning: "શીખવાનું ચાલુ રાખો", resumeLearning: "છોડ્યા ત્યાંથી ચાલુ કરો",
    revisionDue: "પુનઃ અભ્યાસ કરો!", revisionReady: "ખ્યાલો સમીક્ષા માટે તૈયાર", unlockCurriculum: "સંપૂર્ણ અભ્યાસક્રમ અનલૉક કરો",
    pendingReview: "સમીક્ષા બાકી", inReview: "સમીક્ષામાં", approved: "મંજૂર", rejected: "નામંજૂર", limitReached: "મર્યાદા પહોંચી", limitReachedDesc: "તમે આ બૅટલ માટે અપલોડ મર્યાદા પૂરી કરી દીધી.",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "સવાલનો ફોટો પાડો, તરત ઉકેલ મેળવો",
    menuExamSimulator: "પરીક્ષા સિમ્યુલેટર", menuExamSimulatorSub: "AI બોર્ડ-પેટર્ન મોક ટેસ્ટ",
    menuVoiceTutor: "વૉઇસ ટ્યૂટર", menuVoiceTutorSub: "શંકા બોલો, AI જવાબ આપશે",
    menuAiNotebook: "મારી AI નોટબુક", menuAiNotebookSub: "સેવ કરેલ AI વાતચીત",
    modeExplain: "વિભાવના સમજાવો", modeNotes: "નોટ્સ બનાવો", modeExam: "પરીક્ષાની તૈયારી",
    modeDoubt: "શંકા દૂર કરો", modeSummarize: "પ્રકરણ સારાંશ", modeTip: "રોજ નો અભ્યાસ ટિપ",
    modeLanguage: "મારી ભાષામાં સમજાવો",
    notebookTitle: "મારી AI નોટબુક", notebookEmpty: "નોટબુક ખાલી છે",
    savedToNotebook: "નોટબુકમાં સેવ થઈ ગયું", saveToNotebook: "નોટબુકમાં સેવ કરો",
    viewNotebook: "નોટબુક જુઓ", pinned: "પિન કર્યું",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "સવાલનો ફોટો પાડો", solving: "તમારો સવાલ ઉકેલાઈ રહ્યો છે…",
    stepBystep: "પગલે-પગલે ઉકેલ", finalAnswer: "અંતિમ જવાબ",
    similarQuestions: "આ પણ પ્રેક્ટિસ કરો", solveAnother: "બીજો સવાલ ઉકેલો",
    examSimTitle: "પરીક્ષા સિમ્યુલેટર", generateExam: "પરીક્ષા બનાવો", submitExam: "પરીક્ષા સ‌SubmitApp કરો",
    examResults: "તમારા પરિણામો", boardReadiness: "બોર્ડ પરીક્ષા સજ્જતા",
    weakAreas: "વધુ પ્રેક્ટિસ જરૂરી", strongAreas: "મજ‌બૂત વિષયો", takeAnotherExam: "બીજી પરીક્ષા આપો",
    voiceTutorTitle: "વૉઇસ ટ્યૂટર", tapToSpeak: "સવાલ બોલવા ટૅપ કરો", recording: "રેકૉર્ડ થઈ રહ્યું છે… અટકાવવા ટૅપ કરો",
    speakYourDoubt: "તમારી શંકા બોલો", explainInMyLanguage: "મારી ભાષામાં સમજાવો",
    poweredByAI: "AI દ્વારા સંચાલિત", onlineLabel: "ઓનલાઈન",
    yourSchool: "તમારી શાળા", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "સ્તર", xpToNextLevel: "આગળના સ્તર સુધી XP",
    vCoinsRankLabel: "V-Coins ક્રમ", viewLabel: "જુઓ",
    giftClaimed: "ભેટ મળી ગઈ!", surpriseGiftWaiting: "સરપ્રાઈઝ ભેટ રાહ જોઈ રહી છે!",
    giftOnItsWay: "તમારી ભેટ આવી રહી છે", tapToClaimReward: "ઈનામ મેળવવા ટૅપ કરો",
    learnFunLabel: "LearnFun",
    referEarn: "રેફર કરો & કમાઓ", referEarnSub: "દરેક મિત્ર જોડાય ત્યારે VCoins કમાઓ",
    viewAllLabel: "બધું જુઓ", friendsJoined: "મિત્રો જોડાયા",
    vCoinsEarned: "VCoins કમાયા", perReferral: "દરેક રેફરલ માટે",
    yourCode: "તમારો કોડ", copyLabel: "કૉપિ કરો", copiedLabel: "કૉપિ થઈ ગયું!",
    referMoreFriends: "વધુ મિત્રોને રેફર કરો", friendAlsoGets: "મિત્રને પણ મળે છે",
    shortReelsTitle: "શૉર્ટ રીલ્સ", curatedByVidya: "Vidya AI દ્વારા ચૂંટેલ",
    seeAll: "બધું જુઓ", watchAll: "બધું જુઓ", topApprovedReels: "ટૉપ મંજૂર રીલ્સ",
    poweredByGemini: "Gemini AI દ્વારા સંચાલિત", activeLabel: "સક્રિય",
    classLabel: "ધોરણ", sponsoredBattle: "સ્પૉન્સર્ડ બૅટલ",
    poweredBySponsor: "દ્વારા સંચાલિત", classSixToTwelve: "ધોરણ 6–12",
    indiaPrizePool: "ભારત ઈનામ ભંડોળ", aiLessonReady: "AI પાઠ તૈયાર",
    viewFinalLeaderboard: "ફાઈનલ લીડરબૉર્ડ જુઓ", viewLiveStandings: "લાઈવ સ્ટૅન્ડિંગ જુઓ",
    lessonBeingPrepared: "પાઠ તૈયાર થઈ રહ્યો છે…",
    vCoinsBalance: "V-Coins બૅલૅન્સ", totalEarned: "કુલ કમાયા",
    totalSpent: "કુલ ખર્ચ", thisMonth: "આ મહિને",
    earnVCoins: "V-Coins કમાઓ", transactionHistory: "વ્યવહાર ઇતિહાસ",
    noTransactionsYet: "હજી કોઈ વ્યવહાર નથી",
    noTransactionsSub: "V-Coins કમાવા વીડિયો જુઓ!",
    walletLabel: "વૉલેટ", leaderboardLabel: "લીડરબૉર્ડ",
    seeTop100: "ટૉપ 100 જુઓ", showLess: "ઓછું દેખાડો",
    yourRank: "તમારો ક્રમ", updatedDaily: "રોજ અપડેટ",
    referralTitle: "રેફર કરો & કમાઓ", inviteFriendsEarn: "મિત્રોને આમંત્રિત કરો, VCoins કમાઓ!",
    totalReferred: "કુલ રેફર", completed: "પૂર્ણ",
    yourReferralCode: "તમારો રેફરલ કોડ", shareCode: "આ કોડ મિત્રો સાથે શૅર કરો.",
    howItWorks: "આ કેવી રીતે કામ કરે છે", referralHistory: "રેફરલ ઇતિહાસ",
    shareEarn: "શૅર કરો & કમાઓ", pendingLabel: "પ્રતીક્ષામાં", joinedLabel: "જોડાયા",
    stepLabel: "પગલું", moreReferralsToUnlock: "વધુ રેફરલ અનલૉક કરવા",
    nextReward: "આગળની ભેટ",
  },

  // ─────────────────────────── Punjabi ──────────────────────────────
  pa: {
    home: "ਘਰ", leaderboard: "ਲੀਡਰਬੋਰਡ", wallet: "ਵਾਲਿਟ",
    settings: "ਸੈਟਿੰਗਾਂ", dashboard: "ਡੈਸ਼ਬੋਰਡ", aiGuru: "AI ਗੁਰੂ",
    skillBoard: "ਕੌਸ਼ਲ ਬੋਰਡ", logout: "ਲੌਗਆਉਟ",
    profileSettings: "ਪ੍ਰੋਫਾਈਲ ਸੈਟਿੰਗਾਂ", language: "ਭਾਸ਼ਾ",
    changeLanguage: "ਐਪ ਅਤੇ ਸਮੱਗਰੀ ਦੀ ਭਾਸ਼ਾ ਬਦਲੋ",
    darkTheme: "ਡਾਰਕ ਥੀਮ", notifications: "ਸੂਚਨਾਵਾਂ",
    privacy: "ਗੋਪਨੀਯਤਾ", about: "ਬਾਰੇ",
    customizeExperience: "ਆਪਣਾ ਅਨੁਭਵ ਅਨੁਕੂਲਿਤ ਕਰੋ",
    save: "ਸੁਰੱਖਿਅਤ ਕਰੋ", cancel: "ਰੱਦ ਕਰੋ", edit: "ਸੋਧੋ", back: "ਵਾਪਸ",
    delete: "ਮਿਟਾਓ", loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...", editProfile: "ਪ੍ਰੋਫਾਈਲ ਸੋਧੋ",
    saveChanges: "ਬਦਲਾਅ ਸੁਰੱਖਿਅਤ ਕਰੋ", verify: "ਤਸਦੀਕ ਕਰੋ", confirm: "ਪੁਸ਼ਟੀ ਕਰੋ", send: "ਭੇਜੋ",
    languageTitle: "ਭਾਸ਼ਾ", languageSubtitle: "ਭਾਰਤੀ ਸੰਵਿਧਾਨ ਦੀ 8ਵੀਂ ਅਨੁਸੂਚੀ ਦੀਆਂ ਸਾਰੀਆਂ 22 ਭਾਸ਼ਾਵਾਂ",
    searchLanguage: "ਭਾਸ਼ਾ ਖੋਜੋ...", scheduleNote: "ਇਹ ਭਾਰਤ ਦੇ ਸੰਵਿਧਾਨ ਦੀ 8ਵੀਂ ਅਨੁਸੂਚੀ ਵਿੱਚ ਸੂਚੀਬੱਧ 22 ਭਾਸ਼ਾਵਾਂ ਹਨ।",
    basicInfo: "ਮੂਲ ਜਾਣਕਾਰੀ", academicDetails: "ਅਕਾਦਮਿਕ ਵੇਰਵੇ",
    location: "ਸਥਾਨ", interests: "ਰੁਚੀਆਂ", fullName: "ਪੂਰਾ ਨਾਮ",
    phoneNumber: "ਫ਼ੋਨ ਨੰਬਰ", dateOfBirth: "ਜਨਮ ਤਾਰੀਖ", age: "ਉਮਰ",
    school: "ਸਕੂਲ / ਸੰਸਥਾ", preferredLanguage: "ਪਸੰਦੀਦਾ ਭਾਸ਼ਾ",
    pincode: "ਪਿਨਕੋਡ", class: "ਕਲਾਸ / ਗ੍ਰੇਡ", board: "ਬੋਰਡ",
    learnFunLoading: "ਤੁਹਾਡੀ LearnFun ਦੁਨੀਆ ਲੋਡ ਹੋ ਰਹੀ ਹੈ...",
    profileNotFound: "ਪ੍ਰੋਫਾਈਲ ਨਹੀਂ ਮਿਲਿਆ",
    profileSetupPrompt: "ਖੇਡਣਾ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਪੂਰੀ ਕਰੋ!",
    dailyStreak: "ਰੋਜ਼ਾਨਾ ਸਟ੍ਰੀਕ", view: "ਦੇਖੋ", todaysMission: "ਅੱਜ ਦਾ ਮਿਸ਼ਨ",
    daily: "ਰੋਜ਼ਾਨਾ", noMissionToday: "ਅੱਜ ਕੋਈ ਮਿਸ਼ਨ ਨਹੀਂ। ਜਲਦੀ ਵਾਪਸ ਆਓ!",
    skillWorlds: "ਕੌਸ਼ਲ ਦੁਨੀਆ", bossBattle: "ਬੌਸ ਬੈਟਲ",
    yourGames: "ਤੁਹਾਡੀਆਂ ਖੇਡਾਂ", gamesLoading: "ਖੇਡਾਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ...",
    yourBadges: "ਤੁਹਾਡੇ ਬੈਜ", viewAll: "ਸਾਰੇ ਦੇਖੋ", comingSoon: "ਜਲਦੀ ਆਉਣ ਵਾਲਾ", play: "ਖੇਡੋ",
    searchVideos: "ਵੀਡੀਓ, ਵਿਸ਼ੇ, ਅਧਿਆਪਕ ਖੋਜੋ...",
    featured: "ਵਿਸ਼ੇਸ਼", noVideosFound: "ਕੋਈ ਵੀਡੀਓ ਨਹੀਂ ਮਿਲੇ",
    clearFilters: "ਫਿਲਟਰ ਸਾਫ਼ ਕਰੋ", allVideos: "ਸਾਰੇ ਵੀਡੀਓ",
    videosComingSoon: "ਵੀਡੀਓ ਜਲਦੀ ਆਉਣਗੇ!",
    loadingBattles: "ਬੈਟਲ ਲੋਡ ਹੋ ਰਹੇ ਹਨ...", noActiveBattles: "ਕੋਈ ਸਰਗਰਮ ਬੈਟਲ ਨਹੀਂ",
    checkBackSoon: "ਨਵੇਂ ਸਕਿੱਲ ਬੈਟਲਾਂ ਲਈ ਜਲਦੀ ਵਾਪਸ ਆਓ!",
    refresh: "ਤਾਜ਼ਾ ਕਰੋ", computingRanks: "ਤੁਹਾਡੀ ਰੈਂਕਿੰਗ ਗਿਣੀ ਜਾ ਰਹੀ ਹੈ...",
    retry: "ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼", notRankedYet: "ਤੁਸੀਂ ਹਾਲੇ ਰੈਂਕ ਨਹੀਂ ਕੀਤੇ",
    uploadReelPrompt: "ਬੈਟਲ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਣ ਲਈ ਰੀਲ ਅਪਲੋਡ ਕਰੋ!",
    viewFullSkillboard: "ਪੂਰਾ ਸਕਿੱਲਬੋਰਡ ਦੇਖੋ",
    battleEnded: "ਬੈਟਲ ਸਮਾਪਤ", notEligible: "ਯੋਗ ਨਹੀਂ", uploadReel: "ਰੀਲ ਅਪਲੋਡ ਕਰੋ",
    loginRequired: "ਲੌਗਿਨ ਜ਼ਰੂਰੀ ਹੈ", live: "ਲਾਈਵ", completed: "ਪੂਰਾ",
    prizePool: "ਇਨਾਮ ਫੰਡ", endingSoon: "ਜਲਦੀ ਖਤਮ", viewResult: "ਨਤੀਜਾ ਦੇਖੋ",
    joinNow: "ਹੁਣੇ ਸ਼ਾਮਲ ਹੋਵੋ", participate: "ਭਾਗ ਲਵੋ", reserveSpot: "ਜਗ੍ਹਾ ਰਾਖਵੀਂ ਕਰੋ",
    startsSoon: "ਜਲਦੀ ਸ਼ੁਰੂ", all: "ਸਾਰੇ", upcoming: "ਆਉਣ ਵਾਲੇ",
    aiGuruSubtitle: "ਤੁਹਾਡਾ ਨਿੱਜੀ ਸਿੱਖਣ ਸਹਾਇਕ", askAnything: "ਕੁਝ ਵੀ ਪੁੱਛੋ", instantAnswers: "ਤੁਰੰਤ ਜਵਾਬ", studyHelp: "ਪੜ੍ਹਾਈ ਵਿੱਚ ਮਦਦ", startChatting: "ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰੋ →",
    premiumFeature: "ਪ੍ਰੀਮਿਅਮ ਸੁਵਿਧਾ", premiumUnlockMsg: "ਇਹ ਸੁਵਿਧਾ ਅਨਲਾਕ ਕਰਨ ਲਈ AI Guru Premium ਅਪਗ੍ਰੇਡ ਕਰੋ।", maybeLater: "ਬਾਅਦ ਵਿੱਚ", upgrade: "ਅਪਗ੍ਰੇਡ",
    aiClassroom: "ਤੁਹਾਡੀ ਨਿੱਜੀ AI ਕਲਾਸਰੂਮ\nGemini ਦੁਆਰਾ ਸੰਚਾਲਿਤ", freeLessonsLeft: "ਅੱਜ ਮੁਫ਼ਤ ਪਾਠ ਬਾਕੀ", unlimitedAccess: "ਅਸੀਮਿਤ ਪ੍ਰੀਮਿਅਮ ਐਕਸੈੱਸ ਸਕਿਰਿਅ",
    lessonSetup: "ਪਾਠ ਸੈੱਟਅੱਪ", continueBtn: "ਜਾਰੀ ਰੱਖੋ →", fillRequiredFields: "ਲੋੜੀਂਦੀ ਜਾਣਕਾਰੀ ਭਰੋ", fillRequiredFieldsDesc: "ਕਿਰਪਾ ਕਰਕੇ ਵਿਸ਼ਾ ਚੁਣੋ ਅਤੇ ਅਧਿਆਏ ਦਾ ਨਾਮ ਦਾਖਲ ਕਰੋ।",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "ਤੁਹਾਡੇ ਨਿੱਜੀ AI ਅਧਿਆਪਕ", readyToHelp: "ਮਦਦ ਲਈ ਤਿਆਰ!", thinking: "ਸੋਚ ਰਿਹਾ ਹਾਂ...", speaking: "ਬੋਲ ਰਿਹਾ ਹਾਂ...", listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ...",
    paywallTitle: "VidyaGuru ਨਾਲ ਜਾਰੀ ਰੱਖਣਾ ਹੈ?", paywallBody: "ਅੱਜ ਦਾ ਮੁਫ਼ਤ ਸਵਾਲ ਵਰਤਿਆ। ਅਸੀਮਿਤ ਗੱਲਬਾਤ ਲਈ ਪ੍ਰੀਮਿਅਮ ਅਪਗ੍ਰੇਡ ਕਰੋ!", upgradeToPremium: "ਪ੍ਰੀਮਿਅਮ ਤੇ ਅਪਗ੍ਰੇਡ ਕਰੋ",
    seekhoSignIn: "Seekho ਐਕਸੈੱਸ ਕਰਨ ਲਈ ਲੌਗਇਨ ਕਰੋ", curriculumAligned: "ਪਾਠਕ੍ਰਮ-ਆਧਾਰਿਤ ਸਿੱਖਿਆ", subjects: "ਵਿਸ਼ੇ", continueLearning: "ਸਿੱਖਣਾ ਜਾਰੀ ਰੱਖੋ", resumeLearning: "ਜਿੱਥੇ ਛੱਡਿਆ ਸੀ ਉੱਥੋਂ ਸ਼ੁਰੂ ਕਰੋ",
    revisionDue: "ਦੁਹਰਾਓ!", revisionReady: "ਸੰਕਲਪ ਸਮੀਖਿਆ ਲਈ ਤਿਆਰ", unlockCurriculum: "ਪੂਰਾ ਪਾਠਕ੍ਰਮ ਅਨਲਾਕ ਕਰੋ",
    pendingReview: "ਸਮੀਖਿਆ ਬਾਕੀ", inReview: "ਸਮੀਖਿਆ ਵਿੱਚ", approved: "ਮਨਜ਼ੂਰ", rejected: "ਰੱਦ", limitReached: "ਸੀਮਾ ਪਹੁੰਚ ਗਈ", limitReachedDesc: "ਤੁਸੀਂ ਇਸ ਬੈਟਲ ਦੀ ਅਪਲੋਡ ਸੀਮਾ ਤੇ ਪਹੁੰਚ ਗਏ ਹੋ।",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "ਸਵਾਲ ਦੀ ਫੋਟੋ ਖਿੱਚੋ, ਤੁਰੰਤ ਹੱਲ ਪਾਓ",
    menuExamSimulator: "ਪ੍ਰੀਖਿਆ ਸਿਮੂਲੇਟਰ", menuExamSimulatorSub: "AI ਬੋਰਡ-ਪੈਟਰਨ ਮੌਕ ਟੈਸਟ",
    menuVoiceTutor: "ਵਾਇਸ ਟਿਊਟਰ", menuVoiceTutorSub: "ਸ਼ੱਕ ਦੱਸੋ, AI ਜਵਾਬ ਦੇਵੇਗਾ",
    menuAiNotebook: "ਮੇਰੀ AI ਨੋਟਬੁੱਕ", menuAiNotebookSub: "ਸੇਵ ਕੀਤੀਆਂ AI ਗੱਲਾਂਬਾਤਾਂ",
    modeExplain: "ਧਾਰਨਾ ਸਮਝਾਓ", modeNotes: "ਨੋਟਸ ਬਣਾਓ", modeExam: "ਪ੍ਰੀਖਿਆ ਤਿਆਰੀ",
    modeDoubt: "ਸ਼ੱਕ ਦੂਰ ਕਰੋ", modeSummarize: "ਅਧਿਆਇ ਸਾਰ", modeTip: "ਰੋਜ਼ਾਨਾ ਪੜ੍ਹਾਈ ਟਿਪ",
    modeLanguage: "ਮੇਰੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸਮਝਾਓ",
    notebookTitle: "ਮੇਰੀ AI ਨੋਟਬੁੱਕ", notebookEmpty: "ਨੋਟਬੁੱਕ ਖਾਲੀ ਹੈ",
    savedToNotebook: "ਨੋਟਬੁੱਕ ਵਿੱਚ ਸੇਵ ਹੋ ਗਿਆ", saveToNotebook: "ਨੋਟਬੁੱਕ ਵਿੱਚ ਸੇਵ ਕਰੋ",
    viewNotebook: "ਨੋਟਬੁੱਕ ਦੇਖੋ", pinned: "ਪਿੰਨ ਕੀਤਾ",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "ਸਵਾਲ ਦੀ ਫੋਟੋ ਖਿੱਚੋ", solving: "ਤੁਹਾਡਾ ਸਵਾਲ ਹੱਲ ਹੋ ਰਿਹਾ ਹੈ…",
    stepBystep: "ਕਦਮ-ਦਰ-ਕਦਮ ਹੱਲ", finalAnswer: "ਅੰਤਿਮ ਜਵਾਬ",
    similarQuestions: "ਇਹ ਵੀ ਅਭਿਆਸ ਕਰੋ", solveAnother: "ਹੋਰ ਸਵਾਲ ਹੱਲ ਕਰੋ",
    examSimTitle: "ਪ੍ਰੀਖਿਆ ਸਿਮੂਲੇਟਰ", generateExam: "ਪ੍ਰੀਖਿਆ ਬਣਾਓ", submitExam: "ਪ੍ਰੀਖਿਆ ਜਮ੍ਹਾਂ ਕਰੋ",
    examResults: "ਤੁਹਾਡੇ ਨਤੀਜੇ", boardReadiness: "ਬੋਰਡ ਪ੍ਰੀਖਿਆ ਤਿਆਰੀ",
    weakAreas: "ਹੋਰ ਅਭਿਆਸ ਚਾਹੀਦਾ", strongAreas: "ਮਜ਼ਬੂਤ ਵਿਸ਼ੇ", takeAnotherExam: "ਹੋਰ ਪ੍ਰੀਖਿਆ ਦਿਓ",
    voiceTutorTitle: "ਵਾਇਸ ਟਿਊਟਰ", tapToSpeak: "ਸਵਾਲ ਦੱਸਣ ਲਈ ਟੈਪ ਕਰੋ", recording: "ਰਿਕਾਰਡ ਹੋ ਰਿਹਾ ਹੈ… ਰੋਕਣ ਲਈ ਟੈਪ ਕਰੋ",
    speakYourDoubt: "ਆਪਣਾ ਸ਼ੱਕ ਦੱਸੋ", explainInMyLanguage: "ਮੇਰੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸਮਝਾਓ",
    poweredByAI: "AI ਦੁਆਰਾ ਚਲਾਇਆ ਜਾਂਦਾ", onlineLabel: "ਔਨਲਾਈਨ",
    yourSchool: "ਤੁਹਾਡਾ ਸਕੂਲ", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "ਪੱਧਰ", xpToNextLevel: "ਅਗਲੇ ਪੱਧਰ ਤੱਕ XP",
    vCoinsRankLabel: "V-Coins ਦਰਜਾ", viewLabel: "ਦੇਖੋ",
    giftClaimed: "ਤੋਹਫ਼ਾ ਮਿਲਿਆ!", surpriseGiftWaiting: "ਸਰਪ੍ਰਾਈਜ਼ ਤੋਹਫ਼ਾ ਉਡੀਕ ਕਰ ਰਿਹਾ ਹੈ!",
    giftOnItsWay: "ਤੁਹਾਡਾ ਤੋਹਫ਼ਾ ਆ ਰਿਹਾ ਹੈ", tapToClaimReward: "ਇਨਾਮ ਲੈਣ ਲਈ ਟੈਪ ਕਰੋ",
    learnFunLabel: "LearnFun",
    referEarn: "ਰੈਫਰ ਕਰੋ & ਕਮਾਓ", referEarnSub: "ਹਰ ਦੋਸਤ ਦੇ ਜੁੜਨ ਤੇ VCoins ਕਮਾਓ",
    viewAllLabel: "ਸਭ ਦੇਖੋ", friendsJoined: "ਦੋਸਤ ਜੁੜੇ",
    vCoinsEarned: "VCoins ਕਮਾਏ", perReferral: "ਹਰ ਰੈਫਰਲ ਤੇ",
    yourCode: "ਤੁਹਾਡਾ ਕੋਡ", copyLabel: "ਕਾਪੀ ਕਰੋ", copiedLabel: "ਕਾਪੀ ਹੋ ਗਿਆ!",
    referMoreFriends: "ਹੋਰ ਦੋਸਤਾਂ ਨੂੰ ਰੈਫਰ ਕਰੋ", friendAlsoGets: "ਦੋਸਤ ਨੂੰ ਵੀ ਮਿਲੇਗਾ",
    shortReelsTitle: "ਸ਼ੌਰਟ ਰੀਲਸ", curatedByVidya: "Vidya AI ਦੁਆਰਾ ਚੁਣੇ",
    seeAll: "ਸਭ ਦੇਖੋ", watchAll: "ਸਭ ਦੇਖੋ", topApprovedReels: "ਚੋਟੀ ਦੇ ਮਨਜ਼ੂਰ ਰੀਲਸ",
    poweredByGemini: "Gemini AI ਦੁਆਰਾ ਚਲਾਇਆ ਜਾਂਦਾ", activeLabel: "ਸਰਗਰਮ",
    classLabel: "ਜਮਾਤ", sponsoredBattle: "ਸਪਾਂਸਰਡ ਬੈਟਲ",
    poweredBySponsor: "ਦੁਆਰਾ ਚਲਾਇਆ", classSixToTwelve: "ਜਮਾਤ 6–12",
    indiaPrizePool: "ਭਾਰਤ ਇਨਾਮ ਫੰਡ", aiLessonReady: "AI ਪਾਠ ਤਿਆਰ",
    viewFinalLeaderboard: "ਅੰਤਮ ਲੀਡਰਬੋਰਡ ਦੇਖੋ", viewLiveStandings: "ਲਾਈਵ ਸਟੈਂਡਿੰਗ ਦੇਖੋ",
    lessonBeingPrepared: "ਪਾਠ ਤਿਆਰ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ…",
    vCoinsBalance: "V-Coins ਬੈਲੇਂਸ", totalEarned: "ਕੁੱਲ ਕਮਾਏ",
    totalSpent: "ਕੁੱਲ ਖਰਚ", thisMonth: "ਇਸ ਮਹੀਨੇ",
    earnVCoins: "V-Coins ਕਮਾਓ", transactionHistory: "ਲੈਣ-ਦੇਣ ਇਤਿਹਾਸ",
    noTransactionsYet: "ਅਜੇ ਕੋਈ ਲੈਣ-ਦੇਣ ਨਹੀਂ",
    noTransactionsSub: "V-Coins ਕਮਾਉਣ ਲਈ ਵੀਡੀਓ ਦੇਖੋ!",
    walletLabel: "ਵਾਲੇਟ", leaderboardLabel: "ਲੀਡਰਬੋਰਡ",
    seeTop100: "ਟਾਪ 100 ਦੇਖੋ", showLess: "ਘੱਟ ਦਿਖਾਓ",
    yourRank: "ਤੁਹਾਡੀ ਰੈਂਕ", updatedDaily: "ਰੋਜ਼ ਅਪਡੇਟ",
    referralTitle: "ਰੈਫਰ ਕਰੋ & ਕਮਾਓ", inviteFriendsEarn: "ਦੋਸਤਾਂ ਨੂੰ ਬੁਲਾਓ, VCoins ਕਮਾਓ!",
    totalReferred: "ਕੁੱਲ ਰੈਫਰ", completed: "ਪੂਰਾ",
    yourReferralCode: "ਤੁਹਾਡਾ ਰੈਫਰਲ ਕੋਡ", shareCode: "ਇਹ ਕੋਡ ਦੋਸਤਾਂ ਨਾਲ ਸਾਂਝਾ ਕਰੋ।",
    howItWorks: "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ", referralHistory: "ਰੈਫਰਲ ਇਤਿਹਾਸ",
    shareEarn: "ਸਾਂਝਾ ਕਰੋ & ਕਮਾਓ", pendingLabel: "ਬਾਕੀ", joinedLabel: "ਜੁੜੇ",
    stepLabel: "ਕਦਮ", moreReferralsToUnlock: "ਹੋਰ ਰੈਫਰਲ ਅਨਲਾਕ ਕਰਨ ਲਈ",
    nextReward: "ਅਗਲਾ ਇਨਾਮ",
  },

  // ─────────────────────────── Odia ─────────────────────────────────
  or: {
    home: "ହୋମ", leaderboard: "ଲିଡ଼ରବୋର୍ଡ", wallet: "ୱାଲେଟ",
    settings: "ସେଟିଂ", dashboard: "ଡ୍ୟାଶ୍‌ବୋର୍ଡ", aiGuru: "AI ଗୁରୁ",
    skillBoard: "ଦକ୍ଷତା ବୋର୍ଡ", logout: "ଲଗ୍‌ଆଉଟ",
    profileSettings: "ପ୍ରୋଫାଇଲ ସେଟିଂ", language: "ଭାଷା",
    changeLanguage: "ଆପ ଏବଂ ବିଷୟ ଭାଷା ପରିବର୍ତ୍ତନ କରନ୍ତୁ",
    darkTheme: "ଡାର୍କ ଥିମ", notifications: "ବିଜ୍ଞପ୍ତି",
    privacy: "ଗୋପନୀୟତା", about: "ବିଷୟରେ",
    customizeExperience: "ଆପଣଙ୍କ ଅଭିଜ୍ଞତା କଷ୍ଟୋମାଇଜ କରନ୍ତୁ",
    save: "ସଞ୍ଚୟ କରନ୍ତୁ", cancel: "ବାତିଲ", edit: "ସମ୍ପାଦନା", back: "ଫେରନ୍ତୁ",
    delete: "ଡିଲିଟ", loading: "ଲୋଡ ହେଉଛି...", editProfile: "ପ୍ରୋଫାଇଲ ସମ୍ପାଦନ",
    saveChanges: "ପରିବର୍ତ୍ତନ ସଞ୍ଚୟ କରନ୍ତୁ", verify: "ଯାଞ୍ଚ କରନ୍ତୁ", confirm: "ନିଶ୍ଚିତ କରନ୍ତୁ", send: "ପଠାନ୍ତୁ",
    languageTitle: "ଭାଷା", languageSubtitle: "ଭାରତୀୟ ସମ୍ବିଧାନ 8ମ ଅନୁଚ୍ଛେଦ 22 ଭାଷା",
    searchLanguage: "ଭାଷା ଖୋଜନ୍ତୁ...", scheduleNote: "ଏଗୁଡ଼ିକ ଭାରତ ସମ୍ବିଧାନ 8ମ ଅନୁଚ୍ଛେଦ 22 ଭାଷା।",
    basicInfo: "ମୂଳ ସୂଚନା", academicDetails: "ଶୈକ୍ଷଣିକ ବିବରଣ",
    location: "ଅବସ୍ଥାନ", interests: "ଆଗ୍ରହ", fullName: "ପୂର୍ଣ ନାମ",
    phoneNumber: "ଫୋନ ନମ୍ବର", dateOfBirth: "ଜନ୍ମ ତାରିଖ", age: "ବୟସ",
    school: "ବିଦ୍ୟାଳୟ / ଅନୁଷ୍ଠାନ", preferredLanguage: "ପସନ୍ଦର ଭାଷା",
    pincode: "ପିନ୍‌କୋଡ", class: "ଶ୍ରେଣୀ / ଗ୍ରେଡ", board: "ବୋର୍ଡ",
    learnFunLoading: "ଆପଣଙ୍କ LearnFun ଦୁନିଆ ଲୋଡ ହେଉଛି...",
    profileNotFound: "ପ୍ରୋଫାଇଲ ମିଳିଲା ନାହିଁ",
    profileSetupPrompt: "ଖେଳ ଆରମ୍ଭ କରିବା ପାଇଁ ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ ସମ୍ପୂର୍ଣ କରନ୍ତୁ!",
    dailyStreak: "ଦୈନିକ ସ୍ଟ୍ରୀକ", view: "ଦେଖନ୍ତୁ", todaysMission: "ଆଜିର ମିଶନ",
    daily: "ଦୈନିକ", noMissionToday: "ଆଜି କୌଣସି ମିଶନ ନାହିଁ। ଶୀଘ୍ର ଫେରନ୍ତୁ!",
    skillWorlds: "ଦକ୍ଷତା ଦୁନିଆ", bossBattle: "ବସ ଯୁଦ୍ଧ",
    yourGames: "ଆପଣଙ୍କ ଖେଳ", gamesLoading: "ଖେଳ ଲୋଡ ହେଉଛି...",
    yourBadges: "ଆପଣଙ୍କ ବ୍ୟାଜ", viewAll: "ସବୁ ଦେଖନ୍ତୁ", comingSoon: "ଶୀଘ୍ର ଆସୁଛି", play: "ଖେଳ",
    searchVideos: "ଭିଡ଼ିଓ, ବିଷୟ, ଶିକ୍ଷକ ଖୋଜନ୍ତୁ...",
    featured: "ବିଶେଷ", noVideosFound: "କୌଣସି ଭିଡ଼ିଓ ମିଳିଲା ନାହିଁ",
    clearFilters: "ଫିଲ୍ଟର ସଫା କରନ୍ତୁ", allVideos: "ସବୁ ଭିଡ଼ିଓ",
    videosComingSoon: "ଭିଡ଼ିଓ ଶୀଘ୍ର ଆସୁଛି!",
    loadingBattles: "ଯୁଦ୍ଧ ଲୋଡ ହେଉଛି...", noActiveBattles: "କୌଣସି ସକ୍ରିୟ ଯୁଦ୍ଧ ନାହିଁ",
    checkBackSoon: "ନୂଆ ଦକ୍ଷତା ଯୁଦ୍ଧ ପାଇଁ ଶୀଘ୍ର ଫେରନ୍ତୁ!",
    refresh: "ରିଫ୍ରେଶ", computingRanks: "ଆପଣଙ୍କ ରୌ‌ଁ‍କ ଗଣନା ହେଉଛି...",
    retry: "ପୁଣି ଚେଷ୍ଟା", notRankedYet: "ଆପଣ ଏପର୍ଯ୍ୟନ୍ତ ରୌ‌ଁ‍କ ପାଇ ନାହାଁନ୍ତି",
    uploadReelPrompt: "ଯୁଦ୍ଧରେ ଭାଗ ନେବା ପାଇଁ ରୀଲ ଅପଲୋଡ କରନ୍ତୁ!",
    viewFullSkillboard: "ସମ୍ପୂର୍ଣ ସ୍କିଲ୍‌ବୋର୍ଡ ଦେଖନ୍ତୁ",
    battleEnded: "ଯୁଦ୍ଧ ସମାପ୍ତ", notEligible: "ଯୋଗ୍ୟ ନୁହଁ", uploadReel: "ରୀଲ ଅପଲୋଡ",
    loginRequired: "ଲଗଇନ ଆବଶ୍ୟକ", live: "ଲାଇଭ", completed: "ସମ୍ପୂର୍ଣ",
    prizePool: "ପୁରସ୍କାର ନିଧି", endingSoon: "ଶୀଘ୍ର ଶେଷ", viewResult: "ଫଳ ଦେଖନ୍ତୁ",
    joinNow: "ଏବେ ଯୋଗ ଦିଅନ୍ତୁ", participate: "ଭାଗ ନିଅନ୍ତୁ", reserveSpot: "ସ୍ଥାନ ସଂରକ୍ଷଣ",
    startsSoon: "ଶୀଘ୍ର ଆରମ୍ଭ", all: "ସବୁ", upcoming: "ଆସୁଥିବା",
    aiGuruSubtitle: "ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ ଶିକ୍ଷଣ ସହାୟକ", askAnything: "ଯାହା ଇଚ୍ଛା ପଚାର", instantAnswers: "ତୁରନ୍ତ ଉତ୍ତର", studyHelp: "ପଢ଼ାରେ ସାହାଯ୍ୟ", startChatting: "ଚ୍ୟାଟ ଆରମ୍ଭ କରନ୍ତୁ →",
    premiumFeature: "ପ୍ରିମିଅମ ବୈଶିଷ୍ଟ୍ୟ", premiumUnlockMsg: "ଏହି ବୈଶିଷ୍ଟ୍ୟ ଅନ୍‌ଲକ ପାଇଁ AI Guru Premium ଅପଗ୍ରେଡ କରନ୍ତୁ।", maybeLater: "ପରେ", upgrade: "ଅପଗ୍ରେଡ",
    aiClassroom: "ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ AI ଶ୍ରେଣୀ\nGemini ଦ୍ୱାରା ପରିଚାଳିତ", freeLessonsLeft: "ଆଜି ମୁଫ୍ ପାଠ ବାକି", unlimitedAccess: "ଅସୀମ ପ୍ରିମିଅମ ପ୍ରବେଶ ସକ୍ରିୟ",
    lessonSetup: "ପାଠ ସେଟଅପ", continueBtn: "ଜାରି ରଖନ୍ତୁ →", fillRequiredFields: "ଆବଶ୍ୟକ ତଥ୍ୟ ପୂରଣ କରନ୍ତୁ", fillRequiredFieldsDesc: "ଦୟାକରି ବିଷୟ ଚୟନ କରନ୍ତୁ ଓ ଅଧ୍ୟାୟ ନାମ ଦିଅନ୍ତୁ।",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ AI ଶିକ୍ଷକ", readyToHelp: "ସାହାଯ୍ୟ ପାଇଁ ପ୍ରସ୍ତୁତ!", thinking: "ଚିନ୍ତା କରୁଛି...", speaking: "କଥା କହୁଛି...", listening: "ଶୁଣୁଛି...",
    paywallTitle: "VidyaGuru ସହ ଜାରି ରଖନ୍ତୁ?", paywallBody: "ଆଜିର ମୁଫ ପ୍ରଶ୍ନ ଶେଷ। ଅସୀମ ବାର୍ତ୍ତା ପାଇଁ ପ୍ରିମିଅମ ଅପଗ୍ରେଡ କରନ୍ତୁ!", upgradeToPremium: "ପ୍ରିମିଅମକୁ ଅପଗ୍ରେଡ",
    seekhoSignIn: "Seekho ପ୍ରବେଶ ପାଇଁ ଲଗଇନ", curriculumAligned: "ପାଠ୍ୟକ୍ରମ-ଆଧାରିତ ଶିକ୍ଷଣ", subjects: "ବିଷୟ", continueLearning: "ଶିଖିବା ଜାରି ରଖନ୍ତୁ", resumeLearning: "ଯେଉଁ ଠାରେ ଛାଡ଼ିଥିଲେ ସେଠୁ ଆରମ୍ଭ",
    revisionDue: "ପୁନଃ ଅଧ୍ୟୟନ କରନ୍ତୁ!", revisionReady: "ଧାରଣା ସମୀକ୍ଷା ପାଇଁ ପ୍ରସ୍ତୁତ", unlockCurriculum: "ସମ୍ପୂର୍ଣ ପାଠ୍ୟକ୍ରମ ଅନ୍‌ଲକ",
    pendingReview: "ସମୀକ୍ଷା ଅପେକ୍ଷା", inReview: "ସମୀକ୍ଷାଧୀନ", approved: "ଅନୁମୋଦିତ", rejected: "ପ୍ରତ୍ୟାଖ୍ୟାନ", limitReached: "ସୀମା ସ୍ପର୍ଶ", limitReachedDesc: "ଆପଣ ଏହି ଯୁଦ୍ଧ ପାଇଁ ଅପଲୋଡ ସୀମା ଛୁଇଁ ଗଲେ।",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "ପ୍ରଶ୍ନର ଫୋଟୋ ତୋଳନ୍ତୁ, ତୁରନ୍ତ ସମାଧାନ ପାଆନ୍ତୁ",
    menuExamSimulator: "ପରୀକ୍ଷା ସିମ୍ୟୁଲେଟର", menuExamSimulatorSub: "AI ବୋର୍ଡ-ପ୍ୟାଟର୍ନ ମକ ପରୀକ୍ଷା",
    menuVoiceTutor: "ଭଏସ ଟ୍ୟୁଟର", menuVoiceTutorSub: "ସନ୍ଦେହ କୁହନ୍ତୁ, AI ଉତ୍ତର ଦେବ",
    menuAiNotebook: "ମୋ AI ନୋଟବୁକ", menuAiNotebookSub: "ସଞ୍ଚୟ ହୋଇଥିବା AI ବାର୍ତ୍ତାଳାପ",
    modeExplain: "ଧାରଣା ବୁଝାନ୍ତୁ", modeNotes: "ନୋଟ ତିଆରି କରନ୍ତୁ", modeExam: "ପରୀକ୍ଷା ପ୍ରସ୍ତୁତି",
    modeDoubt: "ସନ୍ଦେହ ଦୂର କରନ୍ତୁ", modeSummarize: "ଅଧ୍ୟାୟ ସାରାଂଶ", modeTip: "ଦୈନିକ ପଢ଼ା ଟିପ",
    modeLanguage: "ମୋ ଭାଷାରେ ବୁଝାନ୍ତୁ",
    notebookTitle: "ମୋ AI ନୋଟବୁକ", notebookEmpty: "ନୋଟବୁକ ଖାଲି",
    savedToNotebook: "ନୋଟବୁକରେ ସଞ୍ଚୟ ହୋଇଗଲା", saveToNotebook: "ନୋଟବୁକରେ ସଞ୍ଚୟ କରନ୍ତୁ",
    viewNotebook: "ନୋଟବୁକ ଦେଖନ୍ତୁ", pinned: "ପିନ ହୋଇଛି",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "ପ୍ରଶ୍ନର ଫୋଟୋ ତୋଳନ୍ତୁ", solving: "ଆପଣଙ୍କ ପ୍ରଶ୍ନ ସମାଧାନ ହେଉଛି…",
    stepBystep: "ଧାପ-ଧାପ ସମାଧାନ", finalAnswer: "ଚୂଡ଼ାନ୍ତ ଉତ୍ତର",
    similarQuestions: "ଏଗୁଡ଼ିକ ମଧ୍ୟ ଅଭ୍ୟାସ କରନ୍ତୁ", solveAnother: "ଆଉ ଏକ ପ୍ରଶ୍ନ ସମାଧାନ",
    examSimTitle: "ପରୀକ୍ଷା ସିମ୍ୟୁଲେଟର", generateExam: "ପରୀକ୍ଷା ତିଆରି କରନ୍ତୁ", submitExam: "ପରୀକ୍ଷା ଜମା କରନ୍ତୁ",
    examResults: "ଆପଣଙ୍କ ଫଳ", boardReadiness: "ବୋର୍ଡ ପରୀକ୍ଷା ପ୍ରସ୍ତୁତି",
    weakAreas: "ଅଧିକ ଅଭ୍ୟାସ ଦରକାର", strongAreas: "ଶକ୍ତିଶାଳୀ ବିଷୟ", takeAnotherExam: "ଆଉ ଏକ ପରୀକ୍ଷା ଦିଅନ୍ତୁ",
    voiceTutorTitle: "ଭଏସ ଟ୍ୟୁଟର", tapToSpeak: "ପ୍ରଶ୍ନ କହିବା ପାଇଁ ଟ୍ୟାପ କରନ୍ତୁ", recording: "ରେକର୍ଡ ହେଉଛି… ବନ୍ଦ କରିବା ପାଇଁ ଟ୍ୟାପ",
    speakYourDoubt: "ଆପଣଙ୍କ ସନ୍ଦେହ କୁହନ୍ତୁ", explainInMyLanguage: "ମୋ ଭାଷାରେ ବୁଝାନ୍ତୁ",
    poweredByAI: "AI ଦ୍ୱାରା ପରିଚାଳିତ", onlineLabel: "ଅନ୍‌ଲାଇନ",
    yourSchool: "ଆପଣଙ୍କ ବିଦ୍ୟାଳୟ", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "ସ୍ତର", xpToNextLevel: "ପରବର୍ତ୍ତୀ ସ୍ତର ପର୍ଯ୍ୟନ୍ତ XP",
    vCoinsRankLabel: "V-Coins ରୌ‌ଁ‍କ", viewLabel: "ଦେଖନ୍ତୁ",
    giftClaimed: "ଉପହାର ମିଳିଗଲା!", surpriseGiftWaiting: "ସରପ୍ରାଇଜ ଉପହାର ଅପେକ୍ଷା କରୁଛି!",
    giftOnItsWay: "ଆପଣଙ୍କ ଉପହାର ଆସୁଛି", tapToClaimReward: "ପୁରସ୍କାର ନେବା ପାଇଁ ଟ୍ୟାପ କରନ୍ତୁ",
    learnFunLabel: "LearnFun",
    referEarn: "ରେଫର କରନ୍ତୁ ଏବଂ ଅର୍ଜନ କରନ୍ତୁ", referEarnSub: "ପ୍ରତ୍ୟେକ ବନ୍ଧୁ ଯୋଗ ଦେଲେ VCoins ପାଆନ୍ତୁ",
    viewAllLabel: "ସବୁ ଦେଖନ୍ତୁ", friendsJoined: "ବନ୍ଧୁ ଯୋଗ ଦେଲେ",
    vCoinsEarned: "VCoins ଅର୍ଜନ", perReferral: "ପ୍ରତ୍ୟେକ ରେଫରଲ ପାଇଁ",
    yourCode: "ଆପଣଙ୍କ କୋଡ", copyLabel: "କପି କରନ୍ତୁ", copiedLabel: "କପି ହୋଇଗଲା!",
    referMoreFriends: "ଆଉ ବନ୍ଧୁ ରେଫର କରନ୍ତୁ", friendAlsoGets: "ବନ୍ଧୁ ମଧ୍ୟ ପାଇବ",
    shortReelsTitle: "ଶୋର୍ଟ ରୀଲ", curatedByVidya: "Vidya AI ଦ୍ୱାରା ଚୟନ",
    seeAll: "ସବୁ ଦେଖନ୍ତୁ", watchAll: "ସବୁ ଦେଖନ୍ତୁ", topApprovedReels: "ଶ୍ରେଷ୍ଠ ଅନୁମୋଦିତ ରୀଲ",
    poweredByGemini: "Gemini AI ଦ୍ୱାରା ପରିଚାଳିତ", activeLabel: "ସକ୍ରିୟ",
    classLabel: "ଶ୍ରେଣୀ", sponsoredBattle: "ପ୍ରାୟୋଜିତ ଯୁଦ୍ଧ",
    poweredBySponsor: "ଦ୍ୱାରା ପରିଚାଳିତ", classSixToTwelve: "ଶ୍ରେଣୀ 6–12",
    indiaPrizePool: "ଭାରତ ପୁରସ୍କାର ନିଧି", aiLessonReady: "AI ପାଠ ପ୍ରସ୍ତୁତ",
    viewFinalLeaderboard: "ଅନ୍ତିମ ଲୀଡ଼ରବୋର୍ଡ ଦେଖନ୍ତୁ", viewLiveStandings: "ଲାଇଭ ସ୍ଟ୍ୟାଣ୍ଡିଂ ଦେଖନ୍ତୁ",
    lessonBeingPrepared: "ପାଠ ପ୍ରସ୍ତୁତ ହୋଉଛି…",
    vCoinsBalance: "V-Coins ବ୍ୟାଲେନ୍ସ", totalEarned: "ମୋଟ ଅର୍ଜନ",
    totalSpent: "ମୋଟ ଖର୍ଚ", thisMonth: "ଏହି ମାସ",
    earnVCoins: "V-Coins ଅର୍ଜନ କରନ୍ତୁ", transactionHistory: "ଲେଣଦେଣ ଇତିହାସ",
    noTransactionsYet: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଲେଣଦେଣ ନାହିଁ",
    noTransactionsSub: "V-Coins ଅର୍ଜନ ପାଇଁ ଭିଡ଼ିଓ ଦେଖନ୍ତୁ!",
    walletLabel: "ୱାଲେଟ", leaderboardLabel: "ଲୀଡ଼ରବୋର୍ଡ",
    seeTop100: "ଟପ 100 ଦେଖନ୍ତୁ", showLess: "କମ ଦେଖାନ୍ତୁ",
    yourRank: "ଆପଣଙ୍କ ରୌ‌ଁ‍କ", updatedDaily: "ଦୈନିକ ଅପଡ଼େଟ",
    referralTitle: "ରେଫର ଏବଂ ଅର୍ଜନ", inviteFriendsEarn: "ବନ୍ଧୁ ଆମନ୍ତ୍ରଣ, VCoins ଅର୍ଜନ!",
    totalReferred: "ମୋଟ ରେଫର", completed: "ସମ୍ପୂର୍ଣ",
    yourReferralCode: "ଆପଣଙ୍କ ରେଫରଲ କୋଡ", shareCode: "ଏହି କୋଡ ବନ୍ଧୁମାନଙ୍କ ସହ ଶେୟାର କରନ୍ତୁ।",
    howItWorks: "ଏହା କିପରି କାର୍ଯ୍ୟ କରେ", referralHistory: "ରେଫରଲ ଇତିହାସ",
    shareEarn: "ଶେୟାର ଏବଂ ଅର୍ଜନ", pendingLabel: "ଅପେକ୍ଷାରତ", joinedLabel: "ଯୋଗ ଦେଲେ",
    stepLabel: "ଧାପ", moreReferralsToUnlock: "ଆଉ ରେଫରଲ ଅନଲକ ପାଇଁ",
    nextReward: "ପରବର୍ତ୍ତୀ ପୁରସ୍କାର",
  },

  // ─────────────────────────── Urdu ─────────────────────────────────
  ur: {
    home: "ہوم", leaderboard: "لیڈربورڈ", wallet: "والیٹ",
    settings: "ترتیبات", dashboard: "ڈیش بورڈ", aiGuru: "AI گرو",
    skillBoard: "مہارت بورڈ", logout: "لاگ آؤٹ",
    profileSettings: "پروفائل ترتیبات", language: "زبان",
    changeLanguage: "ایپ اور مواد کی زبان تبدیل کریں",
    darkTheme: "ڈارک تھیم", notifications: "اطلاعات",
    privacy: "رازداری", about: "کے بارے میں",
    customizeExperience: "اپنا تجربہ حسب ضرورت بنائیں",
    save: "محفوظ کریں", cancel: "منسوخ کریں", edit: "ترمیم کریں", back: "واپس",
    delete: "حذف کریں", loading: "لوڈ ہو رہا ہے...", editProfile: "پروفائل ترمیم کریں",
    saveChanges: "تبدیلیاں محفوظ کریں", verify: "تصدیق کریں", confirm: "تائید کریں", send: "بھیجیں",
    languageTitle: "زبان", languageSubtitle: "بھارتی آئین کے 8ویں شیڈول کی تمام 22 زبانیں",
    searchLanguage: "زبان تلاش کریں...", scheduleNote: "یہ ہندوستان کے آئین کے 8ویں شیڈول میں درج 22 زبانیں ہیں۔",
    basicInfo: "بنیادی معلومات", academicDetails: "تعلیمی تفصیلات",
    location: "مقام", interests: "دلچسپیاں", fullName: "پورا نام",
    phoneNumber: "فون نمبر", dateOfBirth: "تاریخ پیدائش", age: "عمر",
    school: "اسکول / ادارہ", preferredLanguage: "ترجیحی زبان",
    pincode: "پن کوڈ", class: "جماعت / گریڈ", board: "بورڈ",
    learnFunLoading: "آپ کی LearnFun دنیا لوڈ ہو رہی ہے...",
    profileNotFound: "پروفائل نہیں ملا",
    profileSetupPrompt: "کھیلنا شروع کرنے کے لیے اپنا پروفائل مکمل کریں!",
    dailyStreak: "روزانہ سٹریک", view: "دیکھیں", todaysMission: "آج کا مشن",
    daily: "روزانہ", noMissionToday: "آج کوئی مشن نہیں۔ جلد واپس آئیں!",
    skillWorlds: "مہارت کی دنیا", bossBattle: "بوس بیٹل",
    yourGames: "آپ کے کھیل", gamesLoading: "کھیل لوڈ ہو رہے ہیں...",
    yourBadges: "آپ کے بیجز", viewAll: "سب دیکھیں", comingSoon: "جلد آ رہا ہے", play: "کھیلیں",
    searchVideos: "ویڈیو، موضوع، استاد تلاش کریں...",
    featured: "خاص", noVideosFound: "کوئی ویڈیو نہیں ملا",
    clearFilters: "فلٹر صاف کریں", allVideos: "تمام ویڈیو",
    videosComingSoon: "ویڈیو جلد آئیں گے!",
    loadingBattles: "لڑائیاں لوڈ ہو رہی ہیں...", noActiveBattles: "کوئی فعال لڑائی نہیں",
    checkBackSoon: "نئی سکل بیٹل کے لیے جلد واپس آئیں!",
    refresh: "تازہ کریں", computingRanks: "آپ کی رینک شمار ہو رہی ہے...",
    retry: "دوبارہ کوشش", notRankedYet: "آپ ابھی رینک میں نہیں ہیں",
    uploadReelPrompt: "لڑائی میں شامل ہونے کے لیے ریل اپلوڈ کریں!",
    viewFullSkillboard: "پورا اسکل بورڈ دیکھیں",
    battleEnded: "لڑائی ختم", notEligible: "اہل نہیں", uploadReel: "ریل اپلوڈ کریں",
    loginRequired: "لاگ ان ضروری ہے", live: "لائیو", completed: "مکمل",
    prizePool: "انعامی رقم", endingSoon: "جلد ختم ہوگی", viewResult: "نتیجہ دیکھیں",
    joinNow: "ابھی شامل ہوں", participate: "حصہ لیں", reserveSpot: "جگہ محفوظ کریں",
    startsSoon: "جلد شروع", all: "تمام", upcoming: "آنے والے",
    aiGuruSubtitle: "آپ کا ذاتی سیکھنے کا معاون", askAnything: "کچھ بھی پوچھیں", instantAnswers: "فوری جوابات", studyHelp: "تعلیمی مدد", startChatting: "چیٹ شروع کریں →",
    premiumFeature: "پریمیئم فیچر", premiumUnlockMsg: "یہ فیچر کھولنے کے لیے AI Guru Premium اپگریڈ کریں۔", maybeLater: "بعد میں", upgrade: "اپگریڈ",
    aiClassroom: "آپ کی ذاتی AI کلاس روم\nGemini کے ذریعے چلائی جاتی ہے", freeLessonsLeft: "آج کے مفت اسباق باقی", unlimitedAccess: "لامحدود پریمیئم رسائی فعال",
    lessonSetup: "سبق کا اعداد و شمار", continueBtn: "جاری رکھیں →", fillRequiredFields: "ضروری فیلڈز بھریں", fillRequiredFieldsDesc: "براہ کرم موضوع منتخب کریں اور باب کا نام درج کریں۔",
    vidyaGuruAI: "VidyaGuru AI", personalAiTeacher: "آپ کا ذاتی AI استاد", readyToHelp: "مدد کے لیے تیار!", thinking: "سوچ رہا ہوں...", speaking: "بول رہا ہوں...", listening: "سن رہا ہوں...",
    paywallTitle: "VidyaGuru کے ساتھ جاری رکھیں؟", paywallBody: "آج کا مفت سوال استعمال ہو گیا۔ لامحدود گفتگو کے لیے پریمیئم اپگریڈ کریں!", upgradeToPremium: "پریمیئم پر اپگریڈ کریں",
    seekhoSignIn: "Seekho تک رسائی کے لیے لاگ ان کریں", curriculumAligned: "نصاب پر مبنی تعلیم", subjects: "مضامین", continueLearning: "سیکھنا جاری رکھیں", resumeLearning: "جہاں چھوڑا تھا وہاں سے شروع کریں",
    revisionDue: "مراجعت کریں!", revisionReady: "تصورات مراجعت کے لیے تیار", unlockCurriculum: "مکمل نصاب کھولیں",
    pendingReview: "جائزہ باقی", inReview: "جائزے میں", approved: "منظور", rejected: "مسترد", limitReached: "حد تک پہنچ گئے", limitReachedDesc: "آپ اس مقابلے کی اپلوڈ حد تک پہنچ گئے ہیں۔",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "سوال کی فوٹو لیں، فوری حل پائیں",
    menuExamSimulator: "امتحان سمیولیٹر", menuExamSimulatorSub: "AI بورڈ-پیٹرن موک ٹیسٹ",
    menuVoiceTutor: "وائس ٹیوٹر", menuVoiceTutorSub: "شک بتائیں، AI جواب دے گا",
    menuAiNotebook: "میری AI نوٹ بک", menuAiNotebookSub: "محفوظ AI گفتگو",
    modeExplain: "تصور سمجھائیں", modeNotes: "نوٹس بنائیں", modeExam: "امتحان کی تیاری",
    modeDoubt: "شک دور کریں", modeSummarize: "باب خلاصہ", modeTip: "روزانہ پڑھائی ٹپ",
    modeLanguage: "میری زبان میں سمجھائیں",
    notebookTitle: "میری AI نوٹ بک", notebookEmpty: "نوٹ بک خالی ہے",
    savedToNotebook: "نوٹ بک میں محفوظ ہوگیا", saveToNotebook: "نوٹ بک میں محفوظ کریں",
    viewNotebook: "نوٹ بک دیکھیں", pinned: "پن کیا گیا",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "سوال کی فوٹو لیں", solving: "آپ کا سوال حل ہو رہا ہے…",
    stepBystep: "قدم بقدم حل", finalAnswer: "حتمی جواب",
    similarQuestions: "یہ بھی پریکٹس کریں", solveAnother: "ایک اور سوال حل کریں",
    examSimTitle: "امتحان سمیولیٹر", generateExam: "امتحان بنائیں", submitExam: "امتحان جمع کریں",
    examResults: "آپ کے نتائج", boardReadiness: "بورڈ امتحان تیاری",
    weakAreas: "مزید مشق ضروری", strongAreas: "مضبوط مضامین", takeAnotherExam: "ایک اور امتحان دیں",
    voiceTutorTitle: "وائس ٹیوٹر", tapToSpeak: "سوال بتانے کے لیے ٹیپ کریں", recording: "ریکارڈنگ… روکنے کے لیے ٹیپ کریں",
    speakYourDoubt: "اپنا شک بتائیں", explainInMyLanguage: "میری زبان میں سمجھائیں",
    poweredByAI: "AI سے چلنے والا", onlineLabel: "آن لائن",
    yourSchool: "آپ کا اسکول", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "سطح", xpToNextLevel: "اگلی سطح تک XP",
    vCoinsRankLabel: "V-Coins درجہ", viewLabel: "دیکھیں",
    giftClaimed: "تحفہ مل گیا!", surpriseGiftWaiting: "سرپرائز تحفہ منتظر ہے!",
    giftOnItsWay: "آپ کا تحفہ آ رہا ہے", tapToClaimReward: "انعام لینے کے لیے ٹیپ کریں",
    learnFunLabel: "LearnFun",
    referEarn: "ریفر کریں اور کمائیں", referEarnSub: "ہر دوست کے شامل ہونے پر VCoins کمائیں",
    viewAllLabel: "سب دیکھیں", friendsJoined: "دوست شامل ہوئے",
    vCoinsEarned: "VCoins کمائے", perReferral: "ہر ریفرل پر",
    yourCode: "آپ کا کوڈ", copyLabel: "کاپی کریں", copiedLabel: "کاپی ہو گیا!",
    referMoreFriends: "مزید دوستوں کو ریفر کریں", friendAlsoGets: "دوست کو بھی ملے گا",
    shortReelsTitle: "شارٹ ریلز", curatedByVidya: "Vidya AI کا انتخاب",
    seeAll: "سب دیکھیں", watchAll: "سب دیکھیں", topApprovedReels: "بہترین منظور شدہ ریلز",
    poweredByGemini: "Gemini AI سے چلنے والا", activeLabel: "فعال",
    classLabel: "جماعت", sponsoredBattle: "اسپانسرڈ مقابلہ",
    poweredBySponsor: "کی طرف سے", classSixToTwelve: "جماعت 6–12",
    indiaPrizePool: "ہندوستان انعامی فنڈ", aiLessonReady: "AI سبق تیار",
    viewFinalLeaderboard: "آخری لیڈربورڈ دیکھیں", viewLiveStandings: "لائیو اسٹینڈنگ دیکھیں",
    lessonBeingPrepared: "سبق تیار کیا جا رہا ہے…",
    vCoinsBalance: "V-Coins بیلنس", totalEarned: "کل کمائے",
    totalSpent: "کل خرچ", thisMonth: "اس مہینے",
    earnVCoins: "V-Coins کمائیں", transactionHistory: "لین دین کی تاریخ",
    noTransactionsYet: "ابھی کوئی لین دین نہیں",
    noTransactionsSub: "V-Coins کمانے کے لیے ویڈیو دیکھیں!",
    walletLabel: "والیٹ", leaderboardLabel: "لیڈربورڈ",
    seeTop100: "ٹاپ 100 دیکھیں", showLess: "کم دکھائیں",
    yourRank: "آپ کی رینک", updatedDaily: "روزانہ اپڈیٹ",
    referralTitle: "ریفر کریں اور کمائیں", inviteFriendsEarn: "دوستوں کو مدعو کریں، VCoins کمائیں!",
    totalReferred: "کل ریفر", completed: "مکمل",
    yourReferralCode: "آپ کا ریفرل کوڈ", shareCode: "یہ کوڈ دوستوں کے ساتھ شیئر کریں۔",
    howItWorks: "یہ کیسے کام کرتا ہے", referralHistory: "ریفرل کی تاریخ",
    shareEarn: "شیئر کریں اور کمائیں", pendingLabel: "زیر التواء", joinedLabel: "شامل ہوئے",
    stepLabel: "مرحلہ", moreReferralsToUnlock: "مزید ریفرل غیر مقفل کرنے کے لیے",
    nextReward: "اگلا انعام",
  },

  // ─────────────────────────── Assamese ────────────────────────────
  as: {
    home: "হোম", leaderboard: "লিডাৰবৰ্ড", wallet: "ৱালেট",
    settings: "ছেটিংছ", dashboard: "ডেচবৰ্ড", aiGuru: "AI গুৰু",
    skillBoard: "দক্ষতা বৰ্ড", logout: "লগআউট",
    profileSettings: "প্ৰ'ফাইল ছেটিংছ", language: "ভাষা",
    changeLanguage: "এপ আৰু সমলৰ ভাষা সলনি কৰক",
    darkTheme: "ডাৰ্ক থিম", notifications: "জাননী",
    privacy: "গোপনীয়তা", about: "বিষয়ে",
    customizeExperience: "আপোনাৰ অভিজ্ঞতা কাস্টমাইজ কৰক",
    save: "সংৰক্ষণ কৰক", cancel: "বাতিল", edit: "সম্পাদনা", back: "উভতি যাওক",
    delete: "মচি পেলাওক", loading: "লোড হৈ আছে...", editProfile: "প্ৰ'ফাইল সম্পাদনা কৰক",
    saveChanges: "পৰিৱৰ্তন সংৰক্ষণ কৰক", verify: "প্ৰমাণিত কৰক", confirm: "নিশ্চিত কৰক", send: "পঠাওক",
    languageTitle: "ভাষা", languageSubtitle: "ভাৰতীয় সংবিধানৰ অষ্টম অনুসূচিৰ সকলো ২২টা ভাষা",
    searchLanguage: "ভাষা বিচাৰক...", scheduleNote: "এইবোৰ ভাৰতৰ সংবিধানৰ অষ্টম অনুসূচিত তালিকাভুক্ত ২২টা ভাষা।",
    basicInfo: "মূল তথ্য", academicDetails: "শৈক্ষণিক বিৱৰণ",
    location: "স্থান", interests: "আগ্ৰহ", fullName: "সম্পূৰ্ণ নাম",
    phoneNumber: "ফোন নম্বৰ", dateOfBirth: "জন্ম তাৰিখ", age: "বয়স",
    school: "বিদ্যালয় / প্ৰতিষ্ঠান", preferredLanguage: "পছন্দৰ ভাষা",
    pincode: "পিনক'ড", class: "শ্ৰেণী / গ্ৰেড", board: "ব'ৰ্ড",
    learnFunLoading: "আপোনাৰ LearnFun জগত লোড হৈ আছে...",
    profileNotFound: "প্ৰ'ফাইল পোৱা নগ'ল",
    profileSetupPrompt: "খেলিবলৈ আৰম্ভ কৰিবলৈ আপোনাৰ প্ৰ'ফাইল সম্পূৰ্ণ কৰক!",
    dailyStreak: "দৈনিক ষ্ট্ৰীক", view: "চাওক", todaysMission: "আজিৰ মিছন",
    daily: "দৈনিক", noMissionToday: "আজি কোনো মিছন নাই। সোনকালে উভতি আহক!",
    skillWorlds: "দক্ষতাৰ জগত", bossBattle: "বছ বেটেল",
    yourGames: "আপোনাৰ খেল", gamesLoading: "খেলসমূহ লোড হৈ আছে...",
    yourBadges: "আপোনাৰ বেজ", viewAll: "সকলো চাওক", comingSoon: "সোনকালে আহিব", play: "খেলক",
    searchVideos: "ভিডিঅ', বিষয়, শিক্ষক বিচাৰক...",
    featured: "বিশেষ", noVideosFound: "কোনো ভিডিঅ' পোৱা নগ'ল",
    clearFilters: "ফিল্টাৰ পৰিষ্কাৰ কৰক", allVideos: "সকলো ভিডিঅ'",
    videosComingSoon: "ভিডিঅ' সোনকালে আহিব!",
    loadingBattles: "বেটেলসমূহ লোড হৈ আছে...", noActiveBattles: "কোনো সক্ৰিয় বেটেল নাই",
    checkBackSoon: "নতুন দক্ষতা বেটেলৰ বাবে সোনকালে উভতি আহক!",
    refresh: "ৰিফ্ৰেছ", computingRanks: "আপোনাৰ ৰেংক গণনা হৈ আছে...",
    retry: "পুনৰ চেষ্টা", notRankedYet: "আপুনি এতিয়ালৈ ৰেংক পোৱা নাই",
    uploadReelPrompt: "বেটেলত অংশ লবলৈ ৰিল আপলোড কৰক!",
    viewFullSkillboard: "সম্পূৰ্ণ স্কিলবৰ্ড চাওক",
    battleEnded: "বেটেল সমাপ্ত", notEligible: "যোগ্য নহয়", uploadReel: "ৰিল আপলোড কৰক",
    loginRequired: "লগইন আৱশ্যক", live: "লাইভ", completed: "সম্পূৰ্ণ",
    prizePool: "পুৰস্কাৰ নিধি", endingSoon: "সোনকালে শেষ হ'ব", viewResult: "ফলাফল চাওক",
    joinNow: "এতিয়াই যোগ দিয়ক", participate: "অংশ লওক", reserveSpot: "ঠাই সংৰক্ষণ",
    startsSoon: "সোনকালে আৰম্ভ হ'ব", all: "সকলো", upcoming: "আহিবলগীয়া",
    aiGuruSubtitle: "আপোনাৰ ব্যক্তিগত শিক্ষণ সহায়ক", askAnything: "যিকোনো কথা সুধিব", instantAnswers: "তৎক্ষণাৎ উত্তৰ", studyHelp: "পঢ়াত সহায়", startChatting: "চেট আৰম্ভ কৰক →",
    premiumFeature: "প্ৰিমিয়াম ফিচাৰ", premiumUnlockMsg: "এই ফিচাৰটো আনলক কৰিবলৈ AI Guru Premium আপগ্ৰেড কৰক।", maybeLater: "পিছত", upgrade: "আপগ্ৰেড",
    aiClassroom: "আপোনাৰ ব্যক্তিগত AI ক্লাছৰুম\nGemini দ্বাৰা পৰিচালিত", freeLessonsLeft: "আজি বিনামূলীয়া পাঠ বাকী", unlimitedAccess: "অসীমিত প্ৰিমিয়াম এক্সেছ সক্ৰিয়",
    lessonSetup: "পাঠ ছেটআপ", continueBtn: "অব্যাহত ৰাখক →", fillRequiredFields: "প্ৰয়োজনীয় তথ্য পূৰণ কৰক", fillRequiredFieldsDesc: "অনুগ্ৰহ কৰি বিষয় বাছক আৰু অধ্যায়ৰ নাম দিয়ক।",
    vidyaGuruAI: "বিদ্যাগুৰু AI", personalAiTeacher: "আপোনাৰ ব্যক্তিগত AI শিক্ষক", readyToHelp: "সহায় কৰিবলৈ সাজু!", thinking: "ভাবি আছো...", speaking: "কৈ আছো...", listening: "শুনি আছো...",
    paywallTitle: "বিদ্যাগুৰুৰ সৈতে অব্যাহত ৰাখিবনে?", paywallBody: "আজিৰ বিনামূলীয়া প্ৰশ্ন শেষ। অসীমিত কথোপকথনৰ বাবে প্ৰিমিয়াম আপগ্ৰেড কৰক!", upgradeToPremium: "প্ৰিমিয়ামলৈ আপগ্ৰেড কৰক",
    seekhoSignIn: "Seekho এক্সেছ কৰিবলৈ লগইন কৰক", curriculumAligned: "পাঠ্যক্ৰম-আধাৰিত শিক্ষণ", subjects: "বিষয়সমূহ", continueLearning: "শিকাটো অব্যাহত ৰাখক", resumeLearning: "য'ত এৰিছিল তাৰপৰা আৰম্ভ কৰক",
    revisionDue: "পুনৰালোচনা কৰক!", revisionReady: "ধাৰণাসমূহ পুনৰালোচনাৰ বাবে সাজু", unlockCurriculum: "সম্পূৰ্ণ পাঠ্যক্ৰম আনলক কৰক",
    pendingReview: "পৰ্যালোচনা বাকী", inReview: "পৰ্যালোচনাত", approved: "অনুমোদিত", rejected: "প্ৰত্যাখ্যাত", limitReached: "সীমা পাইছে", limitReachedDesc: "আপুনি এই বেটেলৰ আপলোড সীমাত পাইছে।",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "প্ৰশ্নৰ ফটো তোলক, তৎক্ষণাত সমাধান পাওক",
    menuExamSimulator: "পৰীক্ষা চিমুলেটৰ", menuExamSimulatorSub: "AI বোৰ্ড-পেটাৰ্ণ মক পৰীক্ষা",
    menuVoiceTutor: "ভয়েছ টিউটৰ", menuVoiceTutorSub: "সন্দেহ কওক, AI উত্তৰ দিব",
    menuAiNotebook: "মোৰ AI নোটবুক", menuAiNotebookSub: "সংৰক্ষিত AI কথোপকথন",
    modeExplain: "ধাৰণা বুজাওক", modeNotes: "নোট তৈয়াৰ কৰক", modeExam: "পৰীক্ষাৰ প্ৰস্তুতি",
    modeDoubt: "সন্দেহ দূৰ কৰক", modeSummarize: "অধ্যায় সাৰাংশ", modeTip: "দৈনিক পঢ়া টিপ",
    modeLanguage: "মোৰ ভাষাত বুজাওক",
    notebookTitle: "মোৰ AI নোটবুক", notebookEmpty: "নোটবুক খালী",
    savedToNotebook: "নোটবুকত সংৰক্ষণ হ'ল", saveToNotebook: "নোটবুকত সংৰক্ষণ কৰক",
    viewNotebook: "নোটবুক চাওক", pinned: "পিন কৰা হৈছে",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "প্ৰশ্নৰ ফটো তোলক", solving: "আপোনাৰ প্ৰশ্ন সমাধান হৈছে…",
    stepBystep: "খোজ-খোজকৈ সমাধান", finalAnswer: "চূড়ান্ত উত্তৰ",
    similarQuestions: "এইবোৰো অভ্যাস কৰক", solveAnother: "আন এটা প্ৰশ্ন সমাধান কৰক",
    examSimTitle: "পৰীক্ষা চিমুলেটৰ", generateExam: "পৰীক্ষা তৈয়াৰ কৰক", submitExam: "পৰীক্ষা জমা দিয়ক",
    examResults: "আপোনাৰ ফলাফল", boardReadiness: "বোৰ্ড পৰীক্ষাৰ সজ্জতা",
    weakAreas: "অধিক অভ্যাস লাগিব", strongAreas: "শক্তিশালী বিষয়", takeAnotherExam: "আন এটা পৰীক্ষা দিয়ক",
    voiceTutorTitle: "ভয়েছ টিউটৰ", tapToSpeak: "প্ৰশ্ন কওঁতে টেপ কৰক", recording: "ৰেকৰ্ড হৈছে… বন্ধ কৰিবলৈ টেপ কৰক",
    speakYourDoubt: "আপোনাৰ সন্দেহ কওক", explainInMyLanguage: "মোৰ ভাষাত বুজাওক",
    poweredByAI: "AI দ্বাৰা চালিত", onlineLabel: "অনলাইন",
    yourSchool: "আপোনাৰ বিদ্যালয়", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "স্তৰ", xpToNextLevel: "পৰৱৰ্তী স্তৰলৈ XP",
    vCoinsRankLabel: "V-Coins ৰেংক", viewLabel: "চাওক",
    giftClaimed: "উপহাৰ পোৱা গ'ল!", surpriseGiftWaiting: "চাৰপ্ৰাইজ উপহাৰ অপেক্ষা কৰি আছে!",
    giftOnItsWay: "আপোনাৰ উপহাৰ আহি আছে", tapToClaimReward: "পুৰস্কাৰ লবলৈ টেপ কৰক",
    learnFunLabel: "LearnFun",
    referEarn: "ৰেফাৰ কৰক আৰু উপাৰ্জন কৰক", referEarnSub: "প্ৰতিটো বন্ধু যোগ দিলে VCoins উপাৰ্জন কৰক",
    viewAllLabel: "সকলো চাওক", friendsJoined: "বন্ধু যোগ দিলে",
    vCoinsEarned: "VCoins উপাৰ্জন", perReferral: "প্ৰতিটো ৰেফাৰেলৰ বাবে",
    yourCode: "আপোনাৰ ক'ড", copyLabel: "কপি কৰক", copiedLabel: "কপি হ'ল!",
    referMoreFriends: "আৰু বন্ধু ৰেফাৰ কৰক", friendAlsoGets: "বন্ধুৱেও পাব",
    shortReelsTitle: "শ্বৰ্ট ৰীল", curatedByVidya: "Vidya AI দ্বাৰা নিৰ্বাচিত",
    seeAll: "সকলো চাওক", watchAll: "সকলো চাওক", topApprovedReels: "শীৰ্ষ অনুমোদিত ৰীল",
    poweredByGemini: "Gemini AI দ্বাৰা চালিত", activeLabel: "সক্ৰিয়",
    classLabel: "শ্ৰেণী", sponsoredBattle: "স্পন্সৰড যুদ্ধ",
    poweredBySponsor: "দ্বাৰা চালিত", classSixToTwelve: "শ্ৰেণী 6–12",
    indiaPrizePool: "ভাৰত পুৰস্কাৰ নিধি", aiLessonReady: "AI পাঠ্য প্ৰস্তুত",
    viewFinalLeaderboard: "চূড়ান্ত লিডাৰবৰ্ড চাওক", viewLiveStandings: "লাইভ স্টেণ্ডিং চাওক",
    lessonBeingPrepared: "পাঠ্য প্ৰস্তুত হৈছে…",
    vCoinsBalance: "V-Coins বেলেঞ্চ", totalEarned: "মুঠ উপাৰ্জন",
    totalSpent: "মুঠ খৰচ", thisMonth: "এই মাহত",
    earnVCoins: "V-Coins উপাৰ্জন কৰক", transactionHistory: "লেনদেন ইতিহাস",
    noTransactionsYet: "এতিয়ালৈ কোনো লেনদেন নাই",
    noTransactionsSub: "V-Coins উপাৰ্জনৰ বাবে ভিডিঅ চাওক!",
    walletLabel: "ৱালেট", leaderboardLabel: "লিডাৰবৰ্ড",
    seeTop100: "টপ 100 চাওক", showLess: "কম দেখুৱাওক",
    yourRank: "আপোনাৰ ৰেংক", updatedDaily: "দৈনিক আপডেট",
    referralTitle: "ৰেফাৰ কৰক আৰু উপাৰ্জন কৰক", inviteFriendsEarn: "বন্ধু আমন্ত্ৰণ, VCoins উপাৰ্জন!",
    totalReferred: "মুঠ ৰেফাৰ", completed: "সম্পূৰ্ণ",
    yourReferralCode: "আপোনাৰ ৰেফাৰেল ক'ড", shareCode: "এই ক'ড বন্ধুসকলৰ সৈতে শ্বেয়াৰ কৰক।",
    howItWorks: "এয়া কেনেকৈ কাম কৰে", referralHistory: "ৰেফাৰেল ইতিহাস",
    shareEarn: "শ্বেয়াৰ কৰক আৰু উপাৰ্জন কৰক", pendingLabel: "বিচাৰাধীন", joinedLabel: "যোগ দিলে",
    stepLabel: "পদক্ষেপ", moreReferralsToUnlock: "আৰু ৰেফাৰেল আনলক কৰিবলৈ",
    nextReward: "পৰৱৰ্তী পুৰস্কাৰ",
  },

  // ─────────────────────────── Manipuri ─────────────────────────────
  mni: {
    home: "হোম", leaderboard: "লিডারবোর্ড", wallet: "ওয়ালেট",
    settings: "সেটিং", dashboard: "ড্যাশবোর্ড", aiGuru: "AI গুরু",
    skillBoard: "স্কিল বোর্ড", logout: "লগআউট",
    profileSettings: "প্রোফাইল সেটিং", language: "মাতৃভাষা",
    changeLanguage: "অ্যাপ ও বিষয়বস্তুর ভাষা পরিবর্তন করুন",
    darkTheme: "ডার্ক থিম", notifications: "বিজ্ঞপ্তি",
    privacy: "গোপনীয়তা", about: "পরিচয়",
    customizeExperience: "নিজস্ব অভিজ্ঞতা সাজান",
    save: "লৌশিনবিউ", cancel: "থম্বিউ", edit: "হেন্না থম্বিউ", back: "ওইনবিউ",
    delete: "পানবিউ", loading: "লোড হচ্ছে...", editProfile: "প্রোফাইল এডিট করুন",
    saveChanges: "চেঞ্জ সেভ করুন", verify: "ভেরিফাই করুন", confirm: "কনফার্ম করুন", send: "পাঠান",
    languageTitle: "মাতৃভাষা", languageSubtitle: "ভারতীয় সংবিধানের ৮ম তফসিলের ২২টি ভাষা",
    searchLanguage: "ভাষা খুঁজুন...", scheduleNote: "এগুলো ভারতের সংবিধানের ৮ম তফসিলে তালিকাভুক্ত ২২টি ভাষা।",
    basicInfo: "মূল তথ্য", academicDetails: "পড়াশুনার তথ্য",
    location: "জায়গা", interests: "আগ্রহ", fullName: "পুরো নাম",
    phoneNumber: "ফোন নম্বর", dateOfBirth: "জন্মতারিখ", age: "বয়স",
    school: "স্কুল / প্রতিষ্ঠান", preferredLanguage: "পছন্দের ভাষা",
    pincode: "পিনকোড", class: "ক্লাস / গ্রেড", board: "বোর্ড",
    learnFunLoading: "তোমার LearnFun দুনিয়া লোড হচ্ছে...",
    profileNotFound: "প্রোফাইল পাওয়া যায়নি",
    profileSetupPrompt: "খেলা শুরু করতে প্রোফাইল সম্পূর্ণ করুন!",
    dailyStreak: "প্রতিদিনের স্ট্রিক", view: "দেখুন", todaysMission: "আজকের মিশন",
    daily: "প্রতিদিন", noMissionToday: "আজ মিশন নেই। শীঘ্রই ফিরুন!",
    skillWorlds: "দক্ষতার জগৎ", bossBattle: "বস ব্যাটেল",
    yourGames: "তোমার গেমস", gamesLoading: "গেমস লোড হচ্ছে...",
    yourBadges: "তোমার ব্যাজ", viewAll: "সব দেখুন", comingSoon: "শীঘ্রই আসছে", play: "খেলুন",
    searchVideos: "ভিডিও, বিষয়, শিক্ষক খুঁজুন...",
    featured: "বিশেষ", noVideosFound: "কোনো ভিডিও পাওয়া যায়নি",
    clearFilters: "ফিল্টার পরিষ্কার করুন", allVideos: "সব ভিডিও",
    videosComingSoon: "ভিডিও শীঘ্রই!",
    loadingBattles: "ব্যাটেল লোড হচ্ছে...", noActiveBattles: "কোনো সক্রিয় ব্যাটেল নেই",
    checkBackSoon: "নতুন স্কিল ব্যাটেলের জন্য শীঘ্রই ফিরুন!",
    refresh: "রিফ্রেশ", computingRanks: "র‌্যাঙ্ক গণনা হচ্ছে...",
    retry: "আবার চেষ্টা", notRankedYet: "এখনো র‌্যাংকড নও",
    uploadReelPrompt: "ব্যাটেলে অংশ নিতে রিল আপলোড করো!",
    viewFullSkillboard: "পুরো স্কিলবোর্ড দেখুন",
    battleEnded: "ব্যাটেল শেষ", notEligible: "যোগ্য নয়", uploadReel: "রিল আপলোড করুন",
    loginRequired: "লগইন দরকার", live: "লাইভ", completed: "সম্পন্ন",
    prizePool: "পুরস্কার তহবিল", endingSoon: "শীঘ্রই শেষ", viewResult: "ফলাফল দেখুন",
    joinNow: "এখনই যোগ দিন", participate: "অংশগ্রহণ করুন", reserveSpot: "জায়গা বুক করুন",
    startsSoon: "শীঘ্রই শুরু", all: "সব", upcoming: "আসন্ন",
    aiGuruSubtitle: "তোমার ব্যক্তিগত শিক্ষণ সহায়ক", askAnything: "যা ইচ্ছা জিজ্ঞেস করো", instantAnswers: "তাৎক্ষণিক উত্তর", studyHelp: "পড়ায় সাহায্য", startChatting: "চ্যাট শুরু করো →",
    premiumFeature: "প্রিমিয়াম ফিচার", premiumUnlockMsg: "এই ফিচার আনলক করতে AI Guru Premium আপগ্রেড করো।", maybeLater: "পরে", upgrade: "আপগ্রেড",
    aiClassroom: "তোমার ব্যক্তিগত AI ক্লাসরুম\nGemini দ্বারা পরিচালিত", freeLessonsLeft: "আজকের বিনামূল্যে পাঠ বাকি", unlimitedAccess: "সীমাহীন প্রিমিয়াম অ্যাক্সেস সক্রিয়",
    lessonSetup: "পাঠ সেটআপ", continueBtn: "চালিয়ে যাও →", fillRequiredFields: "প্রয়োজনীয় তথ্য পূরণ করো", fillRequiredFieldsDesc: "অনুগ্রহ করে বিষয় বেছে নাও এবং অধ্যায়ের নাম লেখো।",
    vidyaGuruAI: "বিদ্যাগুরু AI", personalAiTeacher: "তোমার ব্যক্তিগত AI শিক্ষক", readyToHelp: "সাহায্যের জন্য প্রস্তুত!", thinking: "ভাবছি...", speaking: "বলছি...", listening: "শুনছি...",
    paywallTitle: "বিদ্যাগুরুর সাথে চালিয়ে যাবে?", paywallBody: "আজকের বিনামূল্যে প্রশ্ন শেষ। সীমাহীন কথোপকথনের জন্য প্রিমিয়াম আপগ্রেড করো!", upgradeToPremium: "প্রিমিয়ামে আপগ্রেড করো",
    seekhoSignIn: "Seekho অ্যাক্সেস করতে লগইন করো", curriculumAligned: "পাঠ্যক্রম-ভিত্তিক শিক্ষা", subjects: "বিষয়সমূহ", continueLearning: "শেখা চালিয়ে যাও", resumeLearning: "যেখানে ছেড়েছিলে সেখান থেকে শুরু করো",
    revisionDue: "রিভিশন করো!", revisionReady: "ধারণাগুলো পুনরালোচনার জন্য প্রস্তুত", unlockCurriculum: "সম্পূর্ণ পাঠ্যক্রম আনলক করো",
    pendingReview: "পর্যালোচনা বাকি", inReview: "পর্যালোচনায়", approved: "অনুমোদিত", rejected: "প্রত্যাখ্যাত", limitReached: "সীমা পৌঁছেছে", limitReachedDesc: "তুমি এই ব্যাটেলের আপলোড সীমায় পৌঁছে গেছ।",
    menuPhotoSolve: "PhotoSolve AI", menuPhotoSolveSub: "প্রশ্নের ছবি তোলো, তাৎক্ষণিক সমাধান পাও",
    menuExamSimulator: "পরীক্ষা সিমুলেটর", menuExamSimulatorSub: "AI বোর্ড-প্যাটার্ন মক টেস্ট",
    menuVoiceTutor: "ভয়েস টিউটর", menuVoiceTutorSub: "সন্দেহ বলো, AI উত্তর দেবে",
    menuAiNotebook: "আমার AI নোটবুক", menuAiNotebookSub: "সংরক্ষিত AI কথোপকথন",
    modeExplain: "ধারণা বোঝো", modeNotes: "নোট তৈরি করো", modeExam: "পরীক্ষার প্রস্তুতি",
    modeDoubt: "সন্দেহ দূর করো", modeSummarize: "অধ্যায় সারাংশ", modeTip: "দৈনিক পড়ার টিপস",
    modeLanguage: "আমার ভাষায় বুঝিয়ে দাও",
    notebookTitle: "আমার AI নোটবুক", notebookEmpty: "নোটবুক খালি",
    savedToNotebook: "নোটবুকে সংরক্ষিত", saveToNotebook: "নোটবুকে সংরক্ষণ করো",
    viewNotebook: "নোটবুক দেখো", pinned: "পিন করা",
    photoSolveTitle: "PhotoSolve AI", snapQuestion: "প্রশ্নের ছবি তোলো", solving: "তোমার প্রশ্ন সমাধান হচ্ছে…",
    stepBystep: "ধাপে ধাপে সমাধান", finalAnswer: "চূড়ান্ত উত্তর",
    similarQuestions: "এগুলোও অনুশীলন করো", solveAnother: "আরেকটি প্রশ্ন সমাধান করো",
    examSimTitle: "পরীক্ষা সিমুলেটর", generateExam: "পরীক্ষা তৈরি করো", submitExam: "পরীক্ষা জমা দাও",
    examResults: "তোমার ফলাফল", boardReadiness: "বোর্ড পরীক্ষার প্রস্তুতি",
    weakAreas: "আরও অনুশীলন দরকার", strongAreas: "শক্তিশালী বিষয়", takeAnotherExam: "আরেকটি পরীক্ষা দাও",
    voiceTutorTitle: "ভয়েস টিউটর", tapToSpeak: "প্রশ্ন বলতে ট্যাপ করো", recording: "রেকর্ডিং… থামাতে ট্যাপ করো",
    speakYourDoubt: "তোমার সন্দেহ বলো", explainInMyLanguage: "আমার ভাষায় বুঝিয়ে দাও",
    poweredByAI: "AI দ্বারা চালিত", onlineLabel: "অনলাইন",
    yourSchool: "তোমার স্কুল", vCoinsLabel: "V-Coins", xpLabel: "XP",
    levelLabel: "লেভেল", xpToNextLevel: "পরবর্তী লেভেলে XP",
    vCoinsRankLabel: "V-Coins র‌্যাংক", viewLabel: "দেখো",
    giftClaimed: "গিফট পেয়েছি!", surpriseGiftWaiting: "সারপ্রাইজ গিফট অপেক্ষায়!",
    giftOnItsWay: "তোমার গিফট আসছে", tapToClaimReward: "পুরস্কার নিতে ট্যাপ করো",
    learnFunLabel: "LearnFun",
    referEarn: "রেফার করো & আয় করো", referEarnSub: "প্রতিটি বন্ধু যোগ দিলে VCoins পাও",
    viewAllLabel: "সব দেখো", friendsJoined: "বন্ধুরা যোগ দিয়েছে",
    vCoinsEarned: "VCoins উপার্জিত", perReferral: "প্রতি রেফারেলে",
    yourCode: "তোমার কোড", copyLabel: "কপি করো", copiedLabel: "কপি হয়েছে!",
    referMoreFriends: "আরও বন্ধু রেফার করো", friendAlsoGets: "বন্ধুও পাবে",
    shortReelsTitle: "শর্ট রিলস", curatedByVidya: "Vidya AI কর্তৃক নির্বাচিত",
    seeAll: "সব দেখো", watchAll: "সব দেখো", topApprovedReels: "শীর্ষ অনুমোদিত রিলস",
    poweredByGemini: "Gemini AI দ্বারা চালিত", activeLabel: "সক্রিয়",
    classLabel: "শ্রেণী", sponsoredBattle: "স্পনসর্ড ব্যাটেল",
    poweredBySponsor: "দ্বারা সমর্থিত", classSixToTwelve: "শ্রেণী 6–12",
    indiaPrizePool: "ভারত পুরস্কার তহবিল", aiLessonReady: "AI পাঠ প্রস্তুত",
    viewFinalLeaderboard: "চূড়ান্ত লিডারবোর্ড দেখো", viewLiveStandings: "লাইভ স্ট্যান্ডিং দেখো",
    lessonBeingPrepared: "পাঠ প্রস্তুত হচ্ছে…",
  },

  // ─── Remaining 9 languages fall back to English ───────────────────
  // Bodo (brx), Dogri (doi), Kashmiri (ks), Konkani (gom),
  // Maithili (mai), Nepali (ne), Sanskrit (sa), Santali (sat), Sindhi (sd)
};

export default translations;

// Language name → i18next language code map
export const LANGUAGE_CODE_MAP: Record<string, string> = {
  English:   "en",
  Assamese:  "as",  Bengali:  "bn",  Bodo:    "brx", Dogri:    "doi",
  Gujarati:  "gu",  Hindi:    "hi",  Kannada: "kn",  Kashmiri: "ks",
  Konkani:   "gom", Maithili: "mai", Malayalam:"ml", Manipuri: "mni",
  Marathi:   "mr",  Nepali:   "ne",  Odia:    "or",  Punjabi:  "pa",
  Sanskrit:  "sa",  Santali:  "sat", Sindhi:  "sd",  Tamil:    "ta",
  Telugu:    "te",  Urdu:     "ur",
};
