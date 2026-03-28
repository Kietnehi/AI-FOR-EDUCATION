import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "@/components/ui/tabs";

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");

  const createMotionComponent = (tag: keyof React.JSX.IntrinsicElements) => {
    return ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
      ({ children, ...props }, ref) => {
        const {
          animate: _animate,
          exit: _exit,
          initial: _initial,
          layoutId: _layoutId,
          transition: _transition,
          ...rest
        } = props as React.HTMLAttributes<HTMLElement> & Record<string, unknown>;

        return ReactModule.createElement(tag, { ...rest, ref }, children);
      }
    );
  };

  return {
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) => createMotionComponent(tag as keyof React.JSX.IntrinsicElements),
      }
    ),
  };
});

describe("Tabs", () => {
  it("hiển thị tab mặc định và render đúng nội dung", () => {
    render(
      <Tabs
        tabs={[
          { id: "overview", label: "Tổng quan" },
          { id: "detail", label: "Chi tiết" },
        ]}
        defaultTab="detail"
      >
        {(activeTab) => <div>Nội dung: {activeTab}</div>}
      </Tabs>
    );

    expect(screen.getByText("Nội dung: detail")).toBeInTheDocument();
  });

  it("đổi tab và gọi callback onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Tabs
        tabs={[
          { id: "overview", label: "Tổng quan" },
          { id: "detail", label: "Chi tiết" },
        ]}
        onChange={onChange}
      >
        {(activeTab) => <div>Nội dung: {activeTab}</div>}
      </Tabs>
    );

    await user.click(screen.getByRole("button", { name: "Chi tiết" }));

    expect(onChange).toHaveBeenCalledWith("detail");
    expect(screen.getByText("Nội dung: detail")).toBeInTheDocument();
  });
});
