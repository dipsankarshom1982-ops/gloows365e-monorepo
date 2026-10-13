"use strict";
// PATH: functions/src/index.ts
/**
 * admin-web/src/main.tsx — OPTIMIZED
 *
 * All 35 pages are now lazy-loaded with React.lazy() + Suspense.
 * Only the current route's code is downloaded on first visit.
 * Subsequent routes load in ~100ms from the Vite chunk cache.
 *
 * Also added vite.config optimization (see vite.config.ts output).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileRefundStatuses = exports.resolveRefundReconciliation = exports.processRefund = exports.onContestParticipantWrite = exports.getContestLesson = exports.removeAdmin = exports.getUserSubscriptionHistory = exports.createCoupon = exports.createComboPlan = exports.createAdmin = exports.approveContent = exports.recordAdEvent = exports.getAds = exports.claimAdReward = exports.aggregateAdAnalytics = exports.aiGuruPaymentSuccess = exports.aiGuruCreateSubscription = exports.aiGuruCheckoutPage = exports.voiceTutorAnswer = exports.generateExam = exports.evaluateExam = exports.photoSolve = exports.restartEducationAdvisor = exports.askAiGuruQuestion = exports.getPersonalizedDashboard = exports.dailyStreakQuizReminder = exports.applyForAmbassadorProgram = exports.submitDailyStreakQuizAnswer = exports.getTodaysStreakQuizQuestion = exports.autoFinalizeEndedContests = exports.finalizeContestRanking = exports.submitVidyastarContestQuiz = exports.deleteContest = exports.joinVidyastarContest = exports.claimSkillBattleReward = exports.creditWatchReward = exports.creditSignupBonus = exports.getVCoinBalance = exports.claimVCoinReward = exports.getReelsFeed = exports.getHomeFeed = exports.getLeaderboard = exports.seekhoUpdateRevisionQueue = exports.seekhoOnChapterComplete = exports.seekhoGetDailyStudyPlan = exports.seekhoDailyRevisionReminder = exports.seekhoCreateSubscription = exports.vidyaguruChat = exports.discoverTrending = exports.discoverSearch = void 0;
exports.followUp = exports.generateLesson = exports.onPostCreated = exports.updateSkillboard = exports.ensureStudentId = exports.adminEraseStudent = exports.eraseMyAccount = exports.exportMyData = exports.getReferralLeaderboard = exports.applyReferral = exports.markConversationRead = exports.sendTutorMessage = exports.replyToTutorReview = exports.hideTutorReview = exports.submitTutorReview = exports.reconcilePayoutStatuses = exports.updatePayoutConfig = exports.markPayoutPaid = exports.reviewPayoutRequest = exports.cancelPayoutRequest = exports.requestPayout = exports.saveTutorPayoutDetails = exports.tickInstantHelp = exports.endInstantHelpSession = exports.cancelInstantHelpRequest = exports.respondToInstantHelpRequest = exports.requestInstantHelp = exports.setInstantHelpOnlineStatus = exports.reconcileTutorCreditOrders = exports.tutorCreditPaymentSuccess = exports.createTutorCreditOrder = exports.syncTutorServiceMarketplace = exports.deleteService = exports.updateService = exports.createService = exports.createBookingPaymentOrder = exports.tickBookingReminders = exports.tickBookingCompletion = exports.cancelBooking = exports.respondToBooking = exports.requestBooking = exports.syncTutorMarketplaceProfile = exports.reviewTutorOnboarding = exports.submitTutorOnboarding = exports.reviewTutorVerification = exports.submitTutorVerification = exports.registerTutorAccount = exports.razorpayWebhook = exports.getPaymentDetail = exports.searchPaymentOrders = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const functionsV1 = require("firebase-functions/v1");
const firestore_1 = require("firebase-functions/v2/firestore");
const gemini_1 = require("./gemini");
const redish_1 = require("./redish");
const usageCheck_1 = require("./usageCheck");
const aiGuruCreditDebit_1 = require("./aiGuruCreditDebit");
const validateLesson_1 = require("./validateLesson");
admin.initializeApp();
const db = admin.firestore();
// ── Discover AI ────────────────────────────────────────────────────────────
var discover_1 = require("./discover");
Object.defineProperty(exports, "discoverSearch", { enumerable: true, get: function () { return discover_1.discoverSearch; } });
Object.defineProperty(exports, "discoverTrending", { enumerable: true, get: function () { return discover_1.discoverTrending; } });
// ── VidyaGuru AI Teacher ───────────────────────────────────────────────────
var vidyaguru_1 = require("./vidyaguru");
Object.defineProperty(exports, "vidyaguruChat", { enumerable: true, get: function () { return vidyaguru_1.vidyaguruChat; } });
// ── Seekho module ──────────────────────────────────────────────────────────
var seekho_1 = require("./seekho");
Object.defineProperty(exports, "seekhoCreateSubscription", { enumerable: true, get: function () { return seekho_1.seekhoCreateSubscription; } });
Object.defineProperty(exports, "seekhoDailyRevisionReminder", { enumerable: true, get: function () { return seekho_1.seekhoDailyRevisionReminder; } });
Object.defineProperty(exports, "seekhoGetDailyStudyPlan", { enumerable: true, get: function () { return seekho_1.seekhoGetDailyStudyPlan; } });
Object.defineProperty(exports, "seekhoOnChapterComplete", { enumerable: true, get: function () { return seekho_1.seekhoOnChapterComplete; } });
Object.defineProperty(exports, "seekhoUpdateRevisionQueue", { enumerable: true, get: function () { return seekho_1.seekhoUpdateRevisionQueue; } });
// ── Leaderboard ────────────────────────────────────────────────────────────
var leaderboard_1 = require("./leaderboard");
Object.defineProperty(exports, "getLeaderboard", { enumerable: true, get: function () { return leaderboard_1.getLeaderboard; } });
// ── Feed (home + reels) ────────────────────────────────────────────────────
var feed_1 = require("./feed");
Object.defineProperty(exports, "getHomeFeed", { enumerable: true, get: function () { return feed_1.getHomeFeed; } });
Object.defineProperty(exports, "getReelsFeed", { enumerable: true, get: function () { return feed_1.getReelsFeed; } });
// ── VCoins ─────────────────────────────────────────────────────────────────
var vcoins_1 = require("./vcoins");
Object.defineProperty(exports, "claimVCoinReward", { enumerable: true, get: function () { return vcoins_1.claimVCoinReward; } });
Object.defineProperty(exports, "getVCoinBalance", { enumerable: true, get: function () { return vcoins_1.getVCoinBalance; } });
var vcoins_2 = require("./vcoins");
Object.defineProperty(exports, "creditSignupBonus", { enumerable: true, get: function () { return vcoins_2.creditSignupBonus; } });
Object.defineProperty(exports, "creditWatchReward", { enumerable: true, get: function () { return vcoins_2.creditWatchReward; } });
Object.defineProperty(exports, "claimSkillBattleReward", { enumerable: true, get: function () { return vcoins_2.claimSkillBattleReward; } });
var vidyastarContest_1 = require("./vidyastarContest");
Object.defineProperty(exports, "joinVidyastarContest", { enumerable: true, get: function () { return vidyastarContest_1.joinVidyastarContest; } });
Object.defineProperty(exports, "deleteContest", { enumerable: true, get: function () { return vidyastarContest_1.deleteContest; } });
var submitVidyastarContestQuiz_1 = require("./submitVidyastarContestQuiz");
Object.defineProperty(exports, "submitVidyastarContestQuiz", { enumerable: true, get: function () { return submitVidyastarContestQuiz_1.submitVidyastarContestQuiz; } });
var contestLeaderboard_1 = require("./contestLeaderboard");
Object.defineProperty(exports, "finalizeContestRanking", { enumerable: true, get: function () { return contestLeaderboard_1.finalizeContestRanking; } });
Object.defineProperty(exports, "autoFinalizeEndedContests", { enumerable: true, get: function () { return contestLeaderboard_1.autoFinalizeEndedContests; } });
// ── Daily Streak Quiz ──────────────────────────────────────────────────────
var dailyStreakQuiz_1 = require("./dailyStreakQuiz");
Object.defineProperty(exports, "getTodaysStreakQuizQuestion", { enumerable: true, get: function () { return dailyStreakQuiz_1.getTodaysStreakQuizQuestion; } });
Object.defineProperty(exports, "submitDailyStreakQuizAnswer", { enumerable: true, get: function () { return dailyStreakQuiz_1.submitDailyStreakQuizAnswer; } });
Object.defineProperty(exports, "applyForAmbassadorProgram", { enumerable: true, get: function () { return dailyStreakQuiz_1.applyForAmbassadorProgram; } });
Object.defineProperty(exports, "dailyStreakQuizReminder", { enumerable: true, get: function () { return dailyStreakQuiz_1.dailyStreakQuizReminder; } });
// ── AI Personalized Dashboard ───────────────────────────────────────────────
var personalDashboard_1 = require("./personalDashboard");
Object.defineProperty(exports, "getPersonalizedDashboard", { enumerable: true, get: function () { return personalDashboard_1.getPersonalizedDashboard; } });
// ── Ask AI Guru (Sarvam AI) ─────────────────────────────────────────────────
var askAiGuru_1 = require("./askAiGuru");
Object.defineProperty(exports, "askAiGuruQuestion", { enumerable: true, get: function () { return askAiGuru_1.askAiGuruQuestion; } });
var restartEducationAdvisor_1 = require("./restartEducationAdvisor");
Object.defineProperty(exports, "restartEducationAdvisor", { enumerable: true, get: function () { return restartEducationAdvisor_1.restartEducationAdvisor; } });
// ── PhotoSolve AI ────────────────────────────────────────────────────────────
var photoSolve_1 = require("./photoSolve");
Object.defineProperty(exports, "photoSolve", { enumerable: true, get: function () { return photoSolve_1.photoSolve; } });
// ── Exam Simulator ───────────────────────────────────────────────────────────
var examSimulator_1 = require("./examSimulator");
Object.defineProperty(exports, "evaluateExam", { enumerable: true, get: function () { return examSimulator_1.evaluateExam; } });
Object.defineProperty(exports, "generateExam", { enumerable: true, get: function () { return examSimulator_1.generateExam; } });
// ── Voice Tutor ──────────────────────────────────────────────────────────────
var voiceTutor_1 = require("./voiceTutor");
Object.defineProperty(exports, "voiceTutorAnswer", { enumerable: true, get: function () { return voiceTutor_1.voiceTutorAnswer; } });
// ── AI Guru Subscription (Razorpay) ────────────────────────────────────────────
var aiGuruSubscription_1 = require("./aiGuruSubscription");
Object.defineProperty(exports, "aiGuruCheckoutPage", { enumerable: true, get: function () { return aiGuruSubscription_1.aiGuruCheckoutPage; } });
Object.defineProperty(exports, "aiGuruCreateSubscription", { enumerable: true, get: function () { return aiGuruSubscription_1.aiGuruCreateSubscription; } });
Object.defineProperty(exports, "aiGuruPaymentSuccess", { enumerable: true, get: function () { return aiGuruSubscription_1.aiGuruPaymentSuccess; } });
// ── AI Guru Credits — pay-as-you-go (Razorpay) — functions/src/aiGuruCredits.ts
// exists on disk but is NOT YET COMMITTED (see the Phase D.6/D.7 deployment-
// readiness audit); this export is removed for now so the predeploy build
// isn't blocked on an unresolved import. Re-add once that feature batch is
// reviewed and committed on its own. ─────────────────────────────────────────
// ── Unified Ads System ─────────────────────────────────────────────────────────
var ads_1 = require("./ads");
Object.defineProperty(exports, "aggregateAdAnalytics", { enumerable: true, get: function () { return ads_1.aggregateAdAnalytics; } });
Object.defineProperty(exports, "claimAdReward", { enumerable: true, get: function () { return ads_1.claimAdReward; } });
Object.defineProperty(exports, "getAds", { enumerable: true, get: function () { return ads_1.getAds; } });
Object.defineProperty(exports, "recordAdEvent", { enumerable: true, get: function () { return ads_1.recordAdEvent; } });
// ── Admin Management ───────────────────────────────────────────────────────────
var adminManagement_1 = require("./adminManagement");
Object.defineProperty(exports, "approveContent", { enumerable: true, get: function () { return adminManagement_1.approveContent; } });
Object.defineProperty(exports, "createAdmin", { enumerable: true, get: function () { return adminManagement_1.createAdmin; } });
Object.defineProperty(exports, "createComboPlan", { enumerable: true, get: function () { return adminManagement_1.createComboPlan; } });
Object.defineProperty(exports, "createCoupon", { enumerable: true, get: function () { return adminManagement_1.createCoupon; } });
Object.defineProperty(exports, "getUserSubscriptionHistory", { enumerable: true, get: function () { return adminManagement_1.getUserSubscriptionHistory; } });
Object.defineProperty(exports, "removeAdmin", { enumerable: true, get: function () { return adminManagement_1.removeAdmin; } });
// ── Contest Lesson Generation (lazy, per student language) ─────────────────────
var contestLesson_1 = require("./contestLesson");
Object.defineProperty(exports, "getContestLesson", { enumerable: true, get: function () { return contestLesson_1.getContestLesson; } });
// ── VidyaStar Board Aggregation ───────────────────────────────────────────────
var vidyastarBoard_1 = require("./vidyastarBoard");
Object.defineProperty(exports, "onContestParticipantWrite", { enumerable: true, get: function () { return vidyastarBoard_1.onContestParticipantWrite; } });
// ── Starboard period reset/payout — functions/src/starboardReset.ts and
// starboardPayouts.ts exist on disk but are NOT YET COMMITTED (see the
// Phase D.6/D.7 deployment-readiness audit); these exports are removed for
// now so the predeploy build isn't blocked on an unresolved import. Re-add
// once that feature batch is reviewed and committed on its own. ────────────
var refunds_1 = require("./refunds");
Object.defineProperty(exports, "processRefund", { enumerable: true, get: function () { return refunds_1.processRefund; } });
Object.defineProperty(exports, "resolveRefundReconciliation", { enumerable: true, get: function () { return refunds_1.resolveRefundReconciliation; } });
Object.defineProperty(exports, "reconcileRefundStatuses", { enumerable: true, get: function () { return refunds_1.reconcileRefundStatuses; } });
var refundSearch_1 = require("./refundSearch");
Object.defineProperty(exports, "searchPaymentOrders", { enumerable: true, get: function () { return refundSearch_1.searchPaymentOrders; } });
Object.defineProperty(exports, "getPaymentDetail", { enumerable: true, get: function () { return refundSearch_1.getPaymentDetail; } });
// ── Financial domain — Phase B: shared Razorpay webhook (verify + record
// only this phase; does not yet drive confirmation for any existing flow
// or any future booking payment — see razorpayWebhook.ts's header) ────────
var razorpayWebhook_1 = require("./razorpayWebhook");
Object.defineProperty(exports, "razorpayWebhook", { enumerable: true, get: function () { return razorpayWebhook_1.razorpayWebhook; } });
// ── Gloows Tutor — Phase 1a accounts/verification ──────────────────────────────
var tutorAccounts_1 = require("./tutorAccounts");
Object.defineProperty(exports, "registerTutorAccount", { enumerable: true, get: function () { return tutorAccounts_1.registerTutorAccount; } });
Object.defineProperty(exports, "submitTutorVerification", { enumerable: true, get: function () { return tutorAccounts_1.submitTutorVerification; } });
Object.defineProperty(exports, "reviewTutorVerification", { enumerable: true, get: function () { return tutorAccounts_1.reviewTutorVerification; } });
Object.defineProperty(exports, "submitTutorOnboarding", { enumerable: true, get: function () { return tutorAccounts_1.submitTutorOnboarding; } });
Object.defineProperty(exports, "reviewTutorOnboarding", { enumerable: true, get: function () { return tutorAccounts_1.reviewTutorOnboarding; } });
// ── ShikshaHub — public tutor marketplace mirror ────────────────────────────────
var tutorMarketplace_1 = require("./tutorMarketplace");
Object.defineProperty(exports, "syncTutorMarketplaceProfile", { enumerable: true, get: function () { return tutorMarketplace_1.syncTutorMarketplaceProfile; } });
// ── ShikshaHub — Phase 1 minimum viable tutor booking ───────────────────────────
var tutorBooking_1 = require("./tutorBooking");
Object.defineProperty(exports, "requestBooking", { enumerable: true, get: function () { return tutorBooking_1.requestBooking; } });
Object.defineProperty(exports, "respondToBooking", { enumerable: true, get: function () { return tutorBooking_1.respondToBooking; } });
Object.defineProperty(exports, "cancelBooking", { enumerable: true, get: function () { return tutorBooking_1.cancelBooking; } });
Object.defineProperty(exports, "tickBookingCompletion", { enumerable: true, get: function () { return tutorBooking_1.tickBookingCompletion; } });
Object.defineProperty(exports, "tickBookingReminders", { enumerable: true, get: function () { return tutorBooking_1.tickBookingReminders; } });
// ── Financial domain — Phase C+D: booking payment order creation. The
// matching confirmation logic (confirmBookingPaymentFromWebhook) is called
// from razorpayWebhook.ts, not exported as its own callable — the webhook
// is the only path that confirms a booking payment. ──────────────────────
var bookingPayment_1 = require("./bookingPayment");
Object.defineProperty(exports, "createBookingPaymentOrder", { enumerable: true, get: function () { return bookingPayment_1.createBookingPaymentOrder; } });
// ── ShikshaHub — Phase 3 tutor services (multi-service, online/offline,
// one-time/short-term/long-term, instant-help config-only) ─────────────────────
var tutorServices_1 = require("./tutorServices");
Object.defineProperty(exports, "createService", { enumerable: true, get: function () { return tutorServices_1.createService; } });
Object.defineProperty(exports, "updateService", { enumerable: true, get: function () { return tutorServices_1.updateService; } });
Object.defineProperty(exports, "deleteService", { enumerable: true, get: function () { return tutorServices_1.deleteService; } });
Object.defineProperty(exports, "syncTutorServiceMarketplace", { enumerable: true, get: function () { return tutorServices_1.syncTutorServiceMarketplace; } });
// ── ShikshaHub — Phase 4 Instant Help credits (pay-as-you-go, funds
// per-minute billing — see tutorCredits.ts) ─────────────────────────────────────
var tutorCredits_1 = require("./tutorCredits");
Object.defineProperty(exports, "createTutorCreditOrder", { enumerable: true, get: function () { return tutorCredits_1.createTutorCreditOrder; } });
Object.defineProperty(exports, "tutorCreditPaymentSuccess", { enumerable: true, get: function () { return tutorCredits_1.tutorCreditPaymentSuccess; } });
Object.defineProperty(exports, "reconcileTutorCreditOrders", { enumerable: true, get: function () { return tutorCredits_1.reconcileTutorCreditOrders; } });
// ── ShikshaHub — Phase 4 Instant Help real-time matching/session/billing ───────
var instantHelp_1 = require("./instantHelp");
Object.defineProperty(exports, "setInstantHelpOnlineStatus", { enumerable: true, get: function () { return instantHelp_1.setInstantHelpOnlineStatus; } });
Object.defineProperty(exports, "requestInstantHelp", { enumerable: true, get: function () { return instantHelp_1.requestInstantHelp; } });
Object.defineProperty(exports, "respondToInstantHelpRequest", { enumerable: true, get: function () { return instantHelp_1.respondToInstantHelpRequest; } });
Object.defineProperty(exports, "cancelInstantHelpRequest", { enumerable: true, get: function () { return instantHelp_1.cancelInstantHelpRequest; } });
Object.defineProperty(exports, "endInstantHelpSession", { enumerable: true, get: function () { return instantHelp_1.endInstantHelpSession; } });
Object.defineProperty(exports, "tickInstantHelp", { enumerable: true, get: function () { return instantHelp_1.tickInstantHelp; } });
// ── ShikshaHub — tutor earnings payout (Phase 5 manual flow, automated via
//    RazorpayX in the automated payouts phase — see markPayoutPaid) ────────
var tutorPayouts_1 = require("./tutorPayouts");
Object.defineProperty(exports, "saveTutorPayoutDetails", { enumerable: true, get: function () { return tutorPayouts_1.saveTutorPayoutDetails; } });
Object.defineProperty(exports, "requestPayout", { enumerable: true, get: function () { return tutorPayouts_1.requestPayout; } });
Object.defineProperty(exports, "cancelPayoutRequest", { enumerable: true, get: function () { return tutorPayouts_1.cancelPayoutRequest; } });
Object.defineProperty(exports, "reviewPayoutRequest", { enumerable: true, get: function () { return tutorPayouts_1.reviewPayoutRequest; } });
Object.defineProperty(exports, "markPayoutPaid", { enumerable: true, get: function () { return tutorPayouts_1.markPayoutPaid; } });
Object.defineProperty(exports, "updatePayoutConfig", { enumerable: true, get: function () { return tutorPayouts_1.updatePayoutConfig; } });
Object.defineProperty(exports, "reconcilePayoutStatuses", { enumerable: true, get: function () { return tutorPayouts_1.reconcilePayoutStatuses; } });
// ── ShikshaHub — Phase 6 tutor ratings & reviews (Instant Help sessions) ───────
var tutorReviews_1 = require("./tutorReviews");
Object.defineProperty(exports, "submitTutorReview", { enumerable: true, get: function () { return tutorReviews_1.submitTutorReview; } });
Object.defineProperty(exports, "hideTutorReview", { enumerable: true, get: function () { return tutorReviews_1.hideTutorReview; } });
Object.defineProperty(exports, "replyToTutorReview", { enumerable: true, get: function () { return tutorReviews_1.replyToTutorReview; } });
// ── ShikshaHub — tutor-student messaging phase ─────────────────────────────────
var tutorMessaging_1 = require("./tutorMessaging");
Object.defineProperty(exports, "sendTutorMessage", { enumerable: true, get: function () { return tutorMessaging_1.sendTutorMessage; } });
Object.defineProperty(exports, "markConversationRead", { enumerable: true, get: function () { return tutorMessaging_1.markConversationRead; } });
// ── Referral System ───────────────────────────────────────────────────────────  ← NEW
var referral_1 = require("./referral");
Object.defineProperty(exports, "applyReferral", { enumerable: true, get: function () { return referral_1.applyReferral; } });
Object.defineProperty(exports, "getReferralLeaderboard", { enumerable: true, get: function () { return referral_1.getReferralLeaderboard; } });
// ── Data Rights (DPDP Act 2023) ─────────────────────────────────────────────────
var dataRights_1 = require("./dataRights");
Object.defineProperty(exports, "exportMyData", { enumerable: true, get: function () { return dataRights_1.exportMyData; } });
Object.defineProperty(exports, "eraseMyAccount", { enumerable: true, get: function () { return dataRights_1.eraseMyAccount; } });
Object.defineProperty(exports, "adminEraseStudent", { enumerable: true, get: function () { return dataRights_1.adminEraseStudent; } });
// ── Student ID (auto-assigned, human-readable) ─────────────────────────────────
var studentId_1 = require("./studentId");
Object.defineProperty(exports, "ensureStudentId", { enumerable: true, get: function () { return studentId_1.ensureStudentId; } });
// ───────────────────────────────────────────────────────────
// FUNCTION 1: updateSkillboard
// Triggers on any post write — updates skillboard + ranks
// ───────────────────────────────────────────────────────────
exports.updateSkillboard = (0, firestore_1.onDocumentWritten)({ document: "posts/{postId}", secrets: ["REDIS_URL", "REDIS_TOKEN"] }, async (event) => {
    const change = event.data;
    if (!change)
        return null;
    const after = change.after.exists
        ? change.after.data()
        : null;
    // Only process skill battle reels
    if (!after || after.postType !== "reel" || !after.isSkillBattle) {
        return null;
    }
    const userId = after.userId;
    const month = after.month;
    const cls = after.class !== undefined ? String(after.class) : "";
    if (!userId || !month || !cls) {
        console.warn("⚠️ Missing userId, month or class — skipping");
        return null;
    }
    // ── Get location from post ────────────────────────────
    let city = after.location?.city ?? "";
    let district = after.location?.district ?? "";
    let state = after.location?.state ?? "";
    let pincode = after.location?.pincode ?? "";
    // ── Fallback: fetch location from students collection ─
    if (!district || !state || !pincode) {
        try {
            const studentSnap = await db
                .collection("students")
                .doc(userId)
                .get();
            if (studentSnap.exists) {
                const student = studentSnap.data();
                city = city || student.location?.city || "";
                district = district || student.location?.district || "";
                state = state || student.location?.state || "";
                pincode = pincode || student.location?.pincode || "";
                console.log(`📍 Location from students: ${pincode}/${district}/${state}`);
            }
        }
        catch (err) {
            console.error("❌ Failed to fetch student location:", err);
        }
    }
    // ── Aggregate all qualifying posts for this user+month ─
    const postsSnap = await db
        .collection("posts")
        .where("userId", "==", userId)
        .where("month", "==", month)
        .where("postType", "==", "reel")
        .where("isSkillBattle", "==", true)
        .get();
    let totalLikes = 0;
    let totalViews = 0;
    let totalWatchtime = 0;
    let totalShares = 0;
    let totalComments = 0;
    postsSnap.forEach((postDoc) => {
        const p = postDoc.data();
        totalLikes += p.likes ?? 0;
        totalViews += p.views ?? 0;
        totalWatchtime += p.watchTime ?? 0;
        totalShares += p.shares ?? 0;
        totalComments += p.comments ?? 0;
    });
    const totalScore = totalLikes * 5 +
        totalComments * 3 +
        totalShares * 4 +
        totalViews * 1 +
        totalWatchtime * 2;
    console.log(`📊 Score for ${userId}: ${totalScore} | ` +
        `likes=${totalLikes} comments=${totalComments} ` +
        `shares=${totalShares} views=${totalViews} watchtime=${totalWatchtime}`);
    const skillboardId = `${userId}_${cls}_${month}`;
    const skillboardRef = db.collection("skillboard").doc(skillboardId);
    const docData = {
        userId,
        name: after.name ?? "",
        profilePic: after.profilePic ?? "",
        school: after.school ?? "",
        class: cls,
        location: {
            city,
            district,
            state,
            pincode,
            country: "India",
        },
        month,
        totalLikes,
        totalViews,
        totalWatchtime,
        totalShares,
        totalComments,
        totalScore,
        ranks: {
            local: 0,
            district: 0,
            state: 0,
            india: 0,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await skillboardRef.set(docData);
    console.log(`✅ Skillboard doc written: ${skillboardId} | score: ${totalScore}`);
    await Promise.all([
        recalculateRank("india", { class: cls, month }),
        recalculateRank("state", { class: cls, month, "location.state": state }),
        recalculateRank("district", { class: cls, month, "location.district": district }),
        recalculateRank("local", { class: cls, month, "location.pincode": pincode }),
    ]);
    return null;
});
// ───────────────────────────────────────────────────────────
// FUNCTION 2: onPostCreated
// ───────────────────────────────────────────────────────────
exports.onPostCreated = (0, firestore_1.onDocumentWritten)({ document: "posts/{postId}", secrets: ["REDIS_URL", "REDIS_TOKEN"] }, async (event) => {
    const change = event.data;
    if (!change)
        return null;
    const wasCreated = !change.before.exists && change.after.exists;
    if (!wasCreated)
        return null;
    const post = change.after.data();
    if (!post?.battleId || !post?.isSkillBattle)
        return null;
    try {
        await db
            .collection("skillBattles")
            .doc(post.battleId)
            .update({
            participantCount: admin.firestore.FieldValue.increment(1),
        });
        console.log(`✅ participantCount incremented for battle: ${post.battleId}`);
    }
    catch (err) {
        console.error("❌ Failed to increment participantCount:", err);
    }
    const cls = post.class !== undefined ? String(post.class) : "all";
    (0, redish_1.getRedis)().del(redish_1.RK.homeFeed("all"), redish_1.RK.homeFeed(cls), redish_1.RK.reelsFeed("all"), redish_1.RK.reelsFeed(cls)).catch(() => { });
    return null;
});
// ───────────────────────────────────────────────────────────
// HELPER: verifyAuthToken
// ───────────────────────────────────────────────────────────
async function verifyAuthToken(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
        throw new Error("UNAUTHENTICATED");
    const decoded = await admin.auth().verifyIdToken(auth.split("Bearer ")[1]);
    return decoded.uid;
}
function setCorsHeaders(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
// Shared cache key for generateLesson, mirroring contestLesson.ts's per-
// (contest, language) cache: two requests for the identical board+class+
// subject+chapter+topic+language+difficulty+style(+pasted text) are the
// same lesson, so the second one should reuse the first's Gemini output
// instead of paying for it again. Values are trimmed/lowercased before
// hashing so incidental whitespace/casing differences still hit the cache.
function buildLessonCacheKey(params) {
    const norm = (s) => (s ?? "").trim().toLowerCase();
    const canonical = [
        norm(params.board), norm(params.classLevel), norm(params.subject),
        norm(params.chapter), norm(params.topic), norm(params.language),
        norm(params.difficulty), norm(params.lessonStyle), norm(params.inputText),
    ].join("|");
    return crypto.createHash("sha256").update(canonical).digest("hex");
}
function buildLessonPromptInline(body) {
    const { board, classLevel, subject, chapter, topic, language, difficulty, lessonStyle, inputText } = body;
    return `You are AI Guru, a friendly Indian AI teacher for school students.\nConvert the content into an interactive self-learning lesson.\nRules: Teach at Class ${classLevel} level, ${board} board. Use ${language}. Style: ${lessonStyle}. Difficulty: ${difficulty}.\nKeep each narration under 120 words. Use Indian examples. Return ONLY valid JSON, no markdown.\n\nBoard: ${board}, Class: ${classLevel}, Subject: ${subject}, Chapter: ${chapter}, Topic: ${topic ?? "Full Chapter"}\n\nStudent Content:\n${inputText || `Create a comprehensive lesson on "${chapter}" for Class ${classLevel} ${subject} (${board}).`}\n\nReturn exactly this JSON (populate ALL fields, minimum 5 scenes, 8 quiz, 8 flashcards, 5 keyConcepts):\n{"lessonTitle":"","shortIntro":"","estimatedDurationMinutes":0,"learningObjectives":[""],"prerequisites":[""],"storyHook":{"title":"","narration":"","studentMission":""},"scenes":[{"sceneNumber":1,"sceneTitle":"","visualType":"animation","visualDescription":"","narration":"","keyConcept":"","example":"","studentAction":"","checkQuestion":{"question":"","options":["","","",""],"correctAnswerIndex":0,"explanation":""}}],"keyConcepts":[{"term":"","simpleMeaning":"","realLifeExample":""}],"practicalActivity":{"title":"","instructions":[""],"expectedOutput":"","aiEvaluationCriteria":[""]},"flashcards":[{"front":"","back":""}],"quickRevisionNotes":[""],"quiz":[{"question":"","options":["","","",""],"correctAnswerIndex":0,"explanation":"","difficulty":"easy","concept":""}],"finalMission":{"title":"","task":"","successCriteria":[""],"rewardText":""},"commonMistakes":[{"mistake":"","correction":""}],"examTips":[""],"followUpPrompts":["Explain this chapter again in simpler way","Give me real-life examples","Take my test","Create revision notes"]}`;
}
exports.generateLesson = functionsV1
    .runWith({ timeoutSeconds: 300, memory: "512MB", secrets: ["GEMINI_API_KEY"] })
    .https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    let uid;
    let lessonId;
    let creditTxId = null;
    try {
        uid = await verifyAuthToken(req);
    }
    catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const quota = await (0, usageCheck_1.checkGenerationLimit)(uid, db);
        creditTxId = quota.creditTxId;
        const { board, classLevel, subject, chapter, topic = "", language, difficulty, lessonStyle, inputText = "", imageBase64, imageMimeType } = req.body;
        const inputType = imageBase64 ? "image" : inputText.trim() ? "text" : "topic";
        // An image upload is unique content every time, so only topic/text
        // requests are cacheable.
        const cacheKey = inputType === "image" ? null : buildLessonCacheKey({
            board, classLevel, subject, chapter, topic, language,
            difficulty, lessonStyle, inputText: inputType === "text" ? inputText : "",
        });
        const cacheRef = cacheKey ? db.doc(`aiGuruLessonCache/${cacheKey}`) : null;
        const cacheSnap = cacheRef ? await cacheRef.get() : null;
        const cachedData = cacheSnap?.exists && cacheSnap.data()?.status === "completed"
            ? cacheSnap.data()
            : null;
        const lessonRef = await db.collection("aiGuruLessons").add({
            uid, board, classLevel, subject, chapter, topic, language,
            difficulty, lessonStyle, inputType,
            inputText: inputType === "text" ? inputText : "",
            status: "generating", aiModel: "gemini-2.5-flash", progress: 0,
            cacheKey: cacheKey ?? null, cached: !!cachedData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        lessonId = lessonRef.id;
        let lessonJson;
        if (cachedData) {
            lessonJson = cachedData.lessonJson;
        }
        else {
            const prompt = buildLessonPromptInline(req.body);
            const rawResponse = imageBase64 && imageMimeType
                ? await (0, gemini_1.callGeminiWithImage)(prompt, imageBase64, imageMimeType)
                : await (0, gemini_1.callGeminiText)(prompt);
            lessonJson = (0, gemini_1.parseJsonFromResponse)(rawResponse);
            (0, validateLesson_1.validateLessonJson)(lessonJson);
            if (cacheRef) {
                await cacheRef.set({
                    lessonJson, status: "completed",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }
        await lessonRef.update({
            status: "completed", lessonJson, progress: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        if (cachedData) {
            // Reused an already-generated lesson — no Gemini call happened, so
            // don't burn the student's daily free slot and hand back any
            // credit that was already spent by checkGenerationLimit above.
            if (creditTxId)
                await (0, aiGuruCreditDebit_1.refundAiGuruCredit)(uid, creditTxId, "LESSON_GENERATION", db);
        }
        else {
            await (0, usageCheck_1.incrementGenerationUsage)(uid, db);
        }
        res.status(200).json({ lessonId, lessonJson, cached: !!cachedData });
    }
    catch (err) {
        const msg = err?.message ?? "Unknown error";
        console.error("generateLesson error:", msg);
        if (lessonId) {
            await db.doc(`aiGuruLessons/${lessonId}`).update({
                status: "failed", errorMessage: msg,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }).catch(() => { });
            // Only refund on a failure AFTER the credit was already spent —
            // lessonId only gets set once checkGenerationLimit (and therefore
            // any debit) already succeeded, so this is exactly that window.
            if (creditTxId)
                await (0, aiGuruCreditDebit_1.refundAiGuruCredit)(uid, creditTxId, "LESSON_GENERATION", db);
        }
        if (msg.startsWith("CREDITS_EXHAUSTED:")) {
            res.status(429).json({
                error: msg.replace("CREDITS_EXHAUSTED:", ""),
                code: "CREDITS_EXHAUSTED",
                creditBalance: err?.creditBalance ?? 0,
                creditsRequired: err?.creditsRequired ?? 1,
            });
        }
        else if (msg.startsWith("FREE_LIMIT_REACHED:")) {
            res.status(429).json({ error: msg.replace("FREE_LIMIT_REACHED:", ""), code: "FREE_LIMIT_REACHED" });
        }
        else if (msg.includes("GEMINI_API_KEY")) {
            res.status(500).json({ error: "AI service not configured. Contact support.", code: "CONFIG_ERROR" });
        }
        else if (msg.includes("quota") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
            res.status(429).json({ error: "AI is busy right now. Please wait a minute and try again.", code: "QUOTA_EXCEEDED" });
        }
        else if (msg.includes("Missing required field") || msg.includes("Expected at least")) {
            res.status(500).json({ error: "AI returned an incomplete lesson. Please try again.", code: "VALIDATION_ERROR" });
        }
        else {
            res.status(500).json({ error: msg });
        }
    }
});
exports.followUp = functionsV1
    .runWith({ timeoutSeconds: 120, memory: "256MB", secrets: ["GEMINI_API_KEY"] })
    .https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    let uid;
    let creditTxId = null;
    try {
        uid = await verifyAuthToken(req);
    }
    catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const quota = await (0, usageCheck_1.checkFollowUpLimit)(uid, db);
        creditTxId = quota.creditTxId;
        const { lessonId, question, language = "English", mode = "ask_doubt" } = req.body;
        if (!lessonId || !question) {
            // Validation failure, not an AI/system failure — refund rather
            // than charge a credit for a request that never actually ran.
            if (creditTxId)
                await (0, aiGuruCreditDebit_1.refundAiGuruCredit)(uid, creditTxId, "LESSON_FOLLOWUP", db);
            res.status(400).json({ error: "lessonId and question required" });
            return;
        }
        const lessonSnap = await db.doc(`aiGuruLessons/${lessonId}`).get();
        if (!lessonSnap.exists || lessonSnap.data()?.uid !== uid) {
            if (creditTxId)
                await (0, aiGuruCreditDebit_1.refundAiGuruCredit)(uid, creditTxId, "LESSON_FOLLOWUP", db);
            res.status(403).json({ error: "Lesson not found or access denied" });
            return;
        }
        const lesson = lessonSnap.data();
        const modeMap = {
            explain_simple: "Explain in the simplest possible way.",
            real_life_example: "Give 2-3 relatable real-life Indian examples.",
            translate: `Translate the explanation into ${language}.`,
            ask_doubt: "Answer the student's doubt clearly, step by step.",
            generate_more_questions: "Generate 3 new MCQ practice questions on this concept.",
            exam_focus: "Give exam tips and likely exam questions.",
            evaluate_practical: "Evaluate the student's practical activity and give feedback.",
        };
        const prompt = `You are AI Guru helping a Class ${lesson.classLevel} student about "${lesson.chapter}" (${lesson.subject}, ${lesson.board}).\nLanguage: ${language}. ${modeMap[mode] ?? "Answer helpfully."}\nStudent input: ${question}\nReturn ONLY this JSON (no markdown): {"answer":"","example":"","miniQuestion":"","miniQuestionAnswer":"","suggestedNextAction":""}`;
        const raw = await (0, gemini_1.callGeminiText)(prompt);
        const parsed = (0, gemini_1.parseJsonFromResponse)(raw);
        await (0, usageCheck_1.incrementFollowUpUsage)(uid, db);
        res.status(200).json(parsed);
    }
    catch (err) {
        console.error("followUp error:", err.message);
        if (err.message?.startsWith("CREDITS_EXHAUSTED:")) {
            res.status(429).json({
                error: err.message.replace("CREDITS_EXHAUSTED:", ""),
                code: "CREDITS_EXHAUSTED",
                creditBalance: err?.creditBalance ?? 0,
                creditsRequired: err?.creditsRequired ?? 1,
            });
        }
        else if (err.message?.startsWith("FREE_LIMIT_REACHED:")) {
            res.status(429).json({ error: err.message.replace("FREE_LIMIT_REACHED:", ""), code: "FREE_LIMIT_REACHED" });
        }
        else {
            // Reached only after checkFollowUpLimit already succeeded (a
            // CREDITS_EXHAUSTED/FREE_LIMIT_REACHED throw from that check is
            // handled above and never reaches here), so any credit spent for
            // this request was for a call that then failed — refund it.
            if (creditTxId)
                await (0, aiGuruCreditDebit_1.refundAiGuruCredit)(uid, creditTxId, "LESSON_FOLLOWUP", db);
            res.status(500).json({ error: "Failed to process your question." });
        }
    }
});
// ───────────────────────────────────────────────────────────
// HELPER: recalculateRank
// ───────────────────────────────────────────────────────────
async function recalculateRank(scopeKey, filters) {
    if (scopeKey !== "india") {
        const scopeFieldMap = {
            state: "location.state",
            district: "location.district",
            local: "location.pincode",
        };
        const scopeField = scopeFieldMap[scopeKey];
        const scopeValue = filters[scopeField] ?? "";
        if (!scopeValue) {
            console.warn(`⚠️ Skipping ${scopeKey} rank — scope value is empty`);
            return;
        }
    }
    try {
        let q = db.collection("skillboard");
        for (const [field, value] of Object.entries(filters)) {
            if (value && value.trim() !== "") {
                q = q.where(field, "==", value);
            }
        }
        const snap = await q
            .orderBy("totalScore", "desc")
            .limit(100)
            .get();
        if (snap.empty) {
            console.log(`ℹ️ No docs found for ${scopeKey} rank — skipping batch`);
            return;
        }
        const batch = db.batch();
        snap.docs.forEach((rankDoc, index) => {
            batch.update(rankDoc.ref, {
                [`ranks.${scopeKey}`]: index + 1,
            });
        });
        await batch.commit();
        if (scopeKey === "india") {
            const top50 = snap.docs.slice(0, 50).map((d) => ({ id: d.id, ...d.data() }));
            const cacheKey = redish_1.RK.leaderboard("india", filters.class ?? "", filters.month ?? "");
            (0, redish_1.getRedis)().set(cacheKey, top50, { ex: redish_1.TTL.leaderboard }).catch(() => { });
        }
        console.log(`✅ ${scopeKey} ranks updated for ${snap.size} students ` +
            `(class=${filters.class}, month=${filters.month})`);
    }
    catch (err) {
        console.error(`❌ recalculateRank(${scopeKey}) failed:`, err);
    }
}
//# sourceMappingURL=index.js.map