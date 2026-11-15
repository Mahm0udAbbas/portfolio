"use client";

import { useState } from "react";

export function CopyEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
      aria-live="polite"
    >
      {state === "copied" ? "copied ✓" : state === "failed" ? "copy failed" : "copy"}
    </button>
  );
}
