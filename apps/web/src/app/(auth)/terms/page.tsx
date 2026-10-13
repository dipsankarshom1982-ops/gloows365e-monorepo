// PATH: apps/web/src/app/(auth)/terms/page.tsx
// Mirrors mobile app/terms.tsx — no Terms & Conditions page existed before.

const SECTIONS = [
  ["Acceptance of Terms", "By creating a Gloows365 account for your child, you agree to these Terms & Conditions. If you do not agree, please do not proceed with registration."],
  ["Eligibility & Parental Responsibility", "Gloows365 is built for school students, most of whom are minors. A parent or legal guardian must create and verify the account on the student's behalf, and remains responsible for the accuracy of the information provided and for supervising the student's use of the platform."],
  ["Acceptable Use", "The platform must be used only for lawful, educational purposes. Uploading harmful, abusive, or copyrighted content without rights, attempting to bypass moderation, or misusing rewards/referral systems may result in suspension or termination of the account."],
  ["User-Generated Content", "Content submitted by students (such as SkillBattle reels) is reviewed through our moderation pipeline before publication. By submitting content you confirm you own the rights to it or have permission to use it, and you grant Gloows365 a license to host and display it on the platform."],
  ["Payments & Refunds", "Paid features (such as tutor bookings or premium content) are processed through Razorpay. Refunds, where applicable, are handled per the policy shown at the time of purchase and may take a few business days to reflect."],
  ["Suspension & Termination", "We may suspend or terminate an account that violates these terms, misuses the platform, or poses a safety risk to other users. You may request account deletion at any time via Profile Settings or by contacting support."],
  ["Limitation of Liability", "Gloows365 is provided on an \"as is\" basis. While we take reasonable care to ensure accuracy and availability, we are not liable for indirect or incidental damages arising from use of the platform, to the extent permitted by law."],
  ["Changes to These Terms", "We may update these Terms from time to time. Material changes will be notified via in-app message or email. Continued use of the app after changes constitutes acceptance of the revised terms."],
];

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg, #020617, #1E1B4B, #312E81)", overflowY: "auto" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", color: "#e2e8f0" }}>
        <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800 }}>📜 Terms &amp; Conditions</h1>
        <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 20 }}>Last updated: 23 September 2026</p>
        {SECTIONS.map(([t, b]) => (
          <section key={t} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t}</h2>
            <p style={{ fontSize: 13, lineHeight: "21px", color: "#c7d2fe" }}>{b}</p>
          </section>
        ))}
        <p style={{ fontSize: 13, color: "#c7d2fe" }}>Questions? <a href="mailto:support@gloows365.in" style={{ color: "#FFD700" }}>support@gloows365.in</a></p>
      </div>
    </div>
  );
}
