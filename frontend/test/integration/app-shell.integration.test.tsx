import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/api", () => ({
  getUserPreferences: vi.fn().mockResolvedValue({ mascot_enabled: true }),
  updateUserPreferences: vi.fn().mockResolvedValue({}),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="floating-mascot">Mascot</div>,
}));

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({ collapsed }: { collapsed: boolean }) => (
    <div data-testid="sidebar">{collapsed ? "collapsed" : "expanded"}</div>
  ),
}));

vi.mock("@/components/layout/topbar", () => ({
  Topbar: ({ mascotEnabled, onToggleMascot }: { mascotEnabled: boolean; onToggleMascot: () => void }) => (
    <div>
      <span data-testid="mascot-state">{mascotEnabled ? "enabled" : "disabled"}</span>
      <button onClick={onToggleMascot}>toggle mascot</button>
    </div>
  ),
}));

describe("AppShell integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("render mascot sau idle callback khi đang bật", async () => {
    render(
      <AppShell>
        <div>Nội dung chính</div>
      </AppShell>
    );

    expect(screen.getByText("Nội dung chính")).toBeInTheDocument();
    expect(await screen.findByTestId("floating-mascot")).toBeInTheDocument();
    expect(screen.getByTestId("mascot-state")).toHaveTextContent("enabled");
  });

  it("không render mascot nếu localStorage đã tắt và cho phép bật lại", async () => {
    const user = userEvent.setup();
    localStorage.setItem("mascot-enabled", "false");

    render(
      <AppShell>
        <div>Nội dung chính</div>
      </AppShell>
    );

    expect(screen.queryByTestId("floating-mascot")).not.toBeInTheDocument();
    expect(screen.getByTestId("mascot-state")).toHaveTextContent("disabled");

    await user.click(screen.getByRole("button", { name: "toggle mascot" }));

    expect(await screen.findByTestId("floating-mascot")).toBeInTheDocument();
    expect(localStorage.getItem("mascot-enabled")).toBe("true");
  });
});
