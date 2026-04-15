/**
 * Utility function to conditionally join class names together.
 * Simple version for when clsx/tailwind-merge are not available.
 */
export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
