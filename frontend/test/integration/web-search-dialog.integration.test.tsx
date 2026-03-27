import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WebSearchDialog } from "@/components/ui/web-search-dialog";

const webSearchMock = vi.fn();

vi.mock("@/lib/api", () => ({
  webSearch: (...args: unknown[]) => webSearchMock(...args),
}));

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
          whileHover: _whileHover,
          whileTap: _whileTap,
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

describe("WebSearchDialog integration", () => {
  beforeEach(() => {
    webSearchMock.mockReset();
  });

  it("gọi API tìm kiếm và đóng dialog khi thành công", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const result = { answer: "Kết quả" };

    webSearchMock.mockResolvedValue(result);

    render(
      <WebSearchDialog
        sessionId="session-1"
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Nhập câu hỏi của bạn..."), {
      target: { value: "AI là gì?" },
    });
    await user.click(screen.getByRole("button", { name: /tìm kiếm/i }));

    await waitFor(() => {
      expect(webSearchMock).toHaveBeenCalledWith("session-1", "AI là gì?", true);
    });

    expect(onSuccess).toHaveBeenCalledWith(result);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hiển thị lỗi khi người dùng bỏ trống câu hỏi", async () => {
    const user = userEvent.setup();

    render(
      <WebSearchDialog
        sessionId="session-1"
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: /tìm kiếm/i }));

    expect(await screen.findByText("Vui lòng nhập câu hỏi tìm kiếm")).toBeInTheDocument();
    expect(webSearchMock).not.toHaveBeenCalled();
  });

  it("cho phép chuyển sang Tavily trước khi gửi request", async () => {
    const user = userEvent.setup();

    webSearchMock.mockResolvedValue({ answer: "done" });

    render(
      <WebSearchDialog
        sessionId="session-2"
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    await user.click(screen.getByLabelText(/thử google search trước/i));
    fireEvent.change(screen.getByPlaceholderText("Nhập câu hỏi của bạn..."), {
      target: { value: "Machine learning" },
    });
    await user.click(screen.getByRole("button", { name: /tìm kiếm/i }));

    await waitFor(() => {
      expect(webSearchMock).toHaveBeenCalledWith("session-2", "Machine learning", false);
    });
  });
});
