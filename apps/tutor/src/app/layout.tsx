import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gloows Tutor",
  description: "Run your teaching business, all in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-slate-100 font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
