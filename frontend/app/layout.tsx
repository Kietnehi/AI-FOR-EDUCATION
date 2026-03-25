import "./globals.css";
import { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "AI Learning Studio - Nền tảng AI tạo học liệu số",
  description:
    "Nền tảng tạo slide, podcast, minigame và chatbot hỏi đáp bằng AI. Tạo nội dung học tập thông minh từ tài liệu của bạn.",
  keywords: ["AI", "EdTech", "Learning", "Slide", "Podcast", "Minigame", "Chatbot"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <body className="antialiased font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
