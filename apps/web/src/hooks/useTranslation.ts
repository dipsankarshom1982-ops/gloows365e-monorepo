// PATH: apps/web/src/hooks/useTranslation.ts
//
// Translation hook — re-exports the safe t() wrapper from
// context/LanguageContext.tsx (built on react-i18next's useTranslation).
// Mirrors apps/mobile/context/LanguageContext.tsx's exact pattern (which
// re-exports `useTranslation as useAppTranslation` from react-i18next).
//
// Usage:
//   const { t } = useTranslation();
//   <Text>{t("wallet.balance")}</Text>
//   <Text>{t("wallet.balance", "Balance")}</Text>  // optional English fallback
//
// Note on naming: web's existing pages (app/(app)/home/page.tsx and the
// ai-guru/* pages) already call a hook named `useAppTranslation`, exported
// from context/LanguageContext.tsx — that name is preserved so those
// existing call sites keep working unchanged. This file is the new,
// spec-requested location/name; both resolve to the same underlying logic.

export { useAppTranslation as useTranslation } from "@/context/LanguageContext";
