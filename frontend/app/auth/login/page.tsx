import { Suspense } from "react";

import { LoginPageContent } from "./login-page-content";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
