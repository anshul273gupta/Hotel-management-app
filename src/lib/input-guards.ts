import type { KeyboardEvent } from "react";

/** Blocks digit keystrokes — for name-style fields that shouldn't contain numbers. */
export function blockDigitKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length === 1 && /[0-9]/.test(e.key)) e.preventDefault();
}

/** Blocks non-digit keystrokes — for mobile-number fields that should be digits only. */
export function blockNonDigitKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault();
}
