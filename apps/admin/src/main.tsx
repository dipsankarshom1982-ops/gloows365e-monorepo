// PATH: admin-web/src/main.tsx

import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./index.css";

const Dashboard            = lazy(() => import("./pages/Dashboard"));
const PlatformAnalytics    = lazy(() => import("./pages/PlatformAnalytics"));

const AdsList              = lazy(() => import("./pages/AdsList"));
const CreateAd             = lazy(() => import("./pages/CreateAd"));
const AffiliateProducts    = lazy(() => import("./pages/AffiliateProducts"));
const CrashReports         = lazy(() => import("./pages/CrashReports"));
const Analytics            = lazy(() => import("./pages/Analytics"));

const Banners              = lazy(() => import("./pages/Banners"));
const ShortReels           = lazy(() => import("./pages/ShortReels"));
const SeekhoVideos         = lazy(() => import("./pages/SeekhoVideos"));
const CreateSeekhoVideo    = lazy(() => import("./pages/CreateSeekhoVideo"));
const KnowledgeVideos      = lazy(() => import("./pages/KnowledgeVideos"));
const CreateKnowledgeVideo = lazy(() => import("./pages/CreateKnowledgeVideo"));
const Stories              = lazy(() => import("./pages/Stories"));
const Partners             = lazy(() => import("./pages/Partners"));

const Courses              = lazy(() => import("./pages/Courses"));
const CreateCourse         = lazy(() => import("./pages/CreateCourse"));
const Lessons              = lazy(() => import("./pages/Lessons"));
const Practice             = lazy(() => import("./pages/Practice"));

const Contests             = lazy(() => import("./pages/Contests"));
const CreateContest        = lazy(() => import("./pages/CreateContest"));
const VidyastarConfig      = lazy(() => import("./pages/VidyastarConfig"));
const Quizzes              = lazy(() => import("./pages/Quizzes"));
const CreateQuiz           = lazy(() => import("./pages/CreateQuiz"));
const QuizQuestions        = lazy(() => import("./pages/QuizQuestions"));
const SkillBattles         = lazy(() => import("./pages/SkillBattles"));
const LearnFun             = lazy(() => import("./pages/LearnFun"));
const BadgesAndStars       = lazy(() => import("./pages/BadgesAndStars"));

const AppModules           = lazy(() => import("./pages/AppModules"));
const FeatureControl       = lazy(() => import("./pages/FeatureControl"));
const Referrals            = lazy(() => import("./pages/Referrals"));
const SubscriptionPlans    = lazy(() => import("./pages/SubscriptionPlans"));
const Coupons              = lazy(() => import("./pages/Coupons"));
const VCoinRules           = lazy(() => import("./pages/VCoinRules"));
const VCoinLeaderboard     = lazy(() => import("./pages/VCoinLeaderboard"));

const Students             = lazy(() => import("./pages/Students"));
const Subscriptions        = lazy(() => import("./pages/Subscriptions"));
const AiUsage              = lazy(() => import("./pages/AiUsage"));
const RestartLeads         = lazy(() => import("./pages/RestartLeads")); // ← NEW

const Admins               = lazy(() => import("./pages/Admins"));
const Login                = lazy(() => import("./pages/Login"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Checking auth…</p>
      </div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                   element={<Dashboard />} />
          <Route path="/platform-analytics" element={<PlatformAnalytics />} />

          <Route path="/ads"       element={<AdsList />} />
          <Route path="/ads/new"   element={<CreateAd />} />
          <Route path="/ads/:id"   element={<CreateAd />} />
          <Route path="/affiliate-products"     element={<AffiliateProducts />} />
          <Route path="/crash-reports"          element={<CrashReports />} />
          <Route path="/analytics" element={<Analytics />} />

          <Route path="/banners"                    element={<Banners />} />
          <Route path="/short-reels"                element={<ShortReels />} />
          <Route path="/seekho-videos"              element={<SeekhoVideos />} />
          <Route path="/seekho-videos/new"          element={<CreateSeekhoVideo />} />
          <Route path="/seekho-videos/:id"          element={<CreateSeekhoVideo />} />
          <Route path="/knowledge-videos"           element={<KnowledgeVideos />} />
          <Route path="/knowledge-videos/new"       element={<CreateKnowledgeVideo />} />
          <Route path="/knowledge-videos/:id"       element={<CreateKnowledgeVideo />} />
          <Route path="/stories"                    element={<Stories />} />
          <Route path="/partners"                   element={<Partners />} />

          <Route path="/courses"                   element={<Courses />} />
          <Route path="/courses/new"               element={<CreateCourse />} />
          <Route path="/courses/:id"               element={<CreateCourse />} />
          <Route path="/courses/:courseId/lessons" element={<Lessons />} />
          <Route path="/practice"                  element={<Practice />} />

          <Route path="/contests"                  element={<Contests />} />
          <Route path="/contests/new"              element={<CreateContest />} />
          <Route path="/contests/:id"              element={<CreateContest />} />
          <Route path="/vidyastar-config"          element={<VidyastarConfig />} />
          <Route path="/quizzes"                   element={<Quizzes />} />
          <Route path="/quizzes/new"               element={<CreateQuiz />} />
          <Route path="/quizzes/:id"               element={<CreateQuiz />} />
          <Route path="/quizzes/:quizId/questions" element={<QuizQuestions />} />
          <Route path="/skill-battles"             element={<SkillBattles />} />
          <Route path="/learnfun"                  element={<LearnFun />} />
          <Route path="/badges"                    element={<BadgesAndStars />} />

          <Route path="/feature-control"    element={<FeatureControl />} />
          <Route path="/referrals"          element={<Referrals />} />
          <Route path="/modules"            element={<AppModules />} />
          <Route path="/subscription-plans" element={<SubscriptionPlans />} />
          <Route path="/coupons"            element={<Coupons />} />
          <Route path="/vcoin-rules"        element={<VCoinRules />} />
          <Route path="/vcoin-leaderboard"  element={<VCoinLeaderboard />} />

          <Route path="/students"        element={<Students />} />
          <Route path="/subscriptions"   element={<Subscriptions />} />
          <Route path="/ai-usage"        element={<AiUsage />} />
          <Route path="/restart-leads"   element={<RestartLeads />} /> {/* ← NEW */}

          <Route path="/admins" element={<Admins />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*"     element={<ProtectedRoutes />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
