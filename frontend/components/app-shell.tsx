import Link from "next/link";
import { ReactNode } from "react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/materials/upload", label: "Upload" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="header">
        <h1>AI Learning Studio</h1>
        <nav>
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
