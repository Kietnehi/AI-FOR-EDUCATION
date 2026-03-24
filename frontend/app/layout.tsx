import "./globals.css";
import { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "AI Learning Studio",
  description: "MVP platform to generate learning contents with AI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
