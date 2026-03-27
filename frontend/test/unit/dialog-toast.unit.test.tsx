import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");

  const createMotionComponent = (tag: keyof React.JSX.IntrinsicElements) => {
    return ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
      ({ children, ...props }, ref) => {
        const {
          animate: _animate,
          exit: _exit,
          initial: _initial,
          transition: _transition,
          ...rest
        } = props as React.HTMLAttributes<HTMLElement> & Record<string, unknown>;

        return ReactModule.createElement(tag, { ...rest, ref }, children);
      }
    );
  };

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) => createMotionComponent(tag as keyof React.JSX.IntrinsicElements),
      }
    ),
  };
});

describe("Dialog", () => {
  it("khóa scroll body khi mở dialog và khôi phục khi đóng", () => {
    const { rerender, unmount } = render(
      <Dialog open={true} onClose={() => {}} title="Hộp thoại">
        <div>Nội dung dialog</div>
      </Dialog>
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByText("Nội dung dialog")).toBeInTheDocument();

    rerender(
      <Dialog open={false} onClose={() => {}} title="Hộp thoại">
        <div>Nội dung dialog</div>
      </Dialog>
    );

    expect(document.body.style.overflow).toBe("");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("gọi onClose khi bấm nút đóng", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Dialog open={true} onClose={onClose} title="Hộp thoại">
        <div>Nội dung dialog</div>
      </Dialog>
    );

    await user.click(screen.getByRole("button"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tự đóng sau 6 giây khi có onClose", () => {
    const onClose = vi.fn();

    render(<Toast message="Lưu thành công" type="success" onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("render đúng nội dung và badge theo loại toast", () => {
    render(<Toast message="Có lỗi xảy ra" type="error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Lỗi")).toBeInTheDocument();
    expect(screen.getByText("Có lỗi xảy ra")).toBeInTheDocument();
  });
});
