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
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: () => {},
    writable: true,
    configurable: true,
  });
}

if (!("IntersectionObserver" in globalThis)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];

    disconnect(): void {}
    observe(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    unobserve(): void {}
  }

  globalThis.IntersectionObserver = MockIntersectionObserver;
}
