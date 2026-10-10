import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ResumeProvider } from "@/hooks/use-resume";
import { CommandPalette } from "@/components/ui/command-palette";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resume Builder · Precision Resume Engineering Platform",
  description:
    "Engineered for high-performing software, systems, and product leaders. Structured editing, LaTeX power, ATS diagnostics, and grounded AI assistance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#050505] text-[#EDEDED] selection:bg-amber-400/20 selection:text-amber-200">
        <ResumeProvider>
          <CommandPalette />
          {children}
        </ResumeProvider>
      </body>
    </html>
  );
}
