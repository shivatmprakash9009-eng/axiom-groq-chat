"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard failure
    }
  };

  return (
    <div className="relative my-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--line)] bg-[var(--surface)] text-[var(--text-tertiary)] text-[11px]">
        <span className="uppercase tracking-wider font-semibold">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 py-0.5 px-2 rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors"
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[12px] leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}
