import "@testing-library/jest-dom/vitest";

if (!("requestIdleCallback" in globalThis)) {
  globalThis.requestIdleCallback = ((callback: IdleRequestCallback) => {
    return window.setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => 0,
      });
    }, 0);
  }) as typeof requestIdleCallback;
}

if (!("cancelIdleCallback" in globalThis)) {
  globalThis.cancelIdleCallback = ((id: number) => {
    window.clearTimeout(id);
  }) as typeof cancelIdleCallback;
}

if (!("scrollIntoView" in Element.prototype)) {
  Element.prototype.scrollIntoView = () => {};
}
