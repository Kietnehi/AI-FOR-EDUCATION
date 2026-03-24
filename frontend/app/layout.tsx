import "./globals.css";
import { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "AI Learning Studio - Nền tảng AI tạo học liệu số",
  description:
    "Nền tảng tạo slide, podcast, minigame và chatbot hỏi đáp bằng AI. Tạo nội dung học tập thông minh từ tài liệu của bạn.",
  keywords: ["AI", "EdTech", "Learning", "Slide", "Podcast", "Minigame", "Chatbot"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
