"use client";

import { isValidElement, memo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/code-block";

/** Words appear this often while the reveal is caught up with the stream. */
const REVEAL_INTERVAL_MS = 24;
/** When the reveal falls behind, it clears the backlog in roughly this many ticks. */
const CATCH_UP_TICKS = 20;

const remarkPlugins = [remarkGfm];
const highlightPlugins = [rehypeHighlight];
const noPlugins: never[] = [];

/** Syntax highlighting turns code into nested elements, so flatten back to plain text. */
function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children);
  return "";
}

const markdownComponents: Components = {
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = textFromNode(children).replace(/\n$/, "");
    if (match || codeString.includes("\n")) {
      return <CodeBlock language={match?.[1] || "code"}>{codeString}</CodeBlock>;
    }
    return <code className={className}>{children}</code>;
  },
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface MarkdownContentProps {
  content: string;
  /** Highlighting is skipped while a reply is still being typed out, to keep each frame cheap. */
  highlight?: boolean;
}

/** The single markdown renderer for assistant replies, used both while typing and once finished. */
export const MarkdownContent = memo(function MarkdownContent({
  content,
  highlight = true,
}: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={highlight ? highlightPlugins : noPlugins}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
});

interface TypewriterMarkdownProps {
  content: string;
  /** True while the reply is still arriving from the model. */
  isStreaming: boolean;
  onComplete: () => void;
}

/**
 * Reveals a reply word by word, rendering real markdown at every step so headings, lists,
 * tables and code blocks take shape as they type and nothing jumps when the reply ends.
 */
export function TypewriterMarkdown({ content, isStreaming, onComplete }: TypewriterMarkdownProps) {
  const words = useMemo(() => content.match(/\S+\s*/g) ?? [], [content]);
  const total = words.length;
  // A reply that already finished (for example when reopening a chat) is shown at once.
  const [visible, setVisible] = useState(() => (isStreaming ? 0 : total));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (visible >= total) return;

    // Nobody is watching, or the reader asked for less motion: skip the animation.
    if (prefersReducedMotion() || document.hidden) {
      setVisible(total);
      return;
    }

    // Speed up in proportion to the backlog so long replies never lag far behind the stream.
    const timer = window.setTimeout(() => {
      setVisible((count) =>
        Math.min(total, count + Math.max(1, Math.ceil((total - count) / CATCH_UP_TICKS)))
      );
    }, REVEAL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [visible, total]);

  const caughtUp = visible >= total;

  useEffect(() => {
    if (caughtUp && !isStreaming) onCompleteRef.current();
  }, [caughtUp, isStreaming]);

  const shown = useMemo(
    () => (caughtUp ? content : words.slice(0, visible).join("")),
    [caughtUp, content, words, visible]
  );
  const isTyping = !caughtUp || isStreaming;

  return (
    <div
      className={`markdown-body typewriter-response${isTyping ? " is-typing" : ""}`}
      aria-live="off"
      aria-busy={isTyping}
    >
      <MarkdownContent content={shown} highlight={!isTyping} />
    </div>
  );
}
