"use client";

import type { ReactNode } from "react";

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", theta: "θ", lambda: "λ",
  mu: "μ", pi: "π", rho: "ρ", sigma: "σ", phi: "φ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Pi: "Π", Sigma: "Σ", Omega: "Ω",
  times: "×", cdot: "·", pm: "±", approx: "≈", neq: "≠", leq: "≤", geq: "≥",
  infty: "∞", partial: "∂", nabla: "∇",
};

function convertSimpleLatex(source: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let rest = source;
  let key = 0;
  const pushText = (s: string) => { if (s) parts.push(<span key={key++}>{s}</span>); };
  while (rest.length) {
    const frac = /^\\frac\{([^{}]+)\}\{([^{}]+)\}/.exec(rest);
    if (frac) {
      parts.push(<span className="math-fraction" key={key++}><span>{convertSimpleLatex(frac[1])}</span><span>{convertSimpleLatex(frac[2])}</span></span>);
      rest = rest.slice(frac[0].length);
      continue;
    }
    const script = /^([_^])\{([^{}]+)\}/.exec(rest);
    if (script) {
      const Tag = script[1] === "^" ? "sup" : "sub";
      parts.push(<Tag key={key++}>{convertSimpleLatex(script[2])}</Tag>);
      rest = rest.slice(script[0].length);
      continue;
    }
    const command = /^\\([A-Za-z]+)/.exec(rest);
    if (command) {
      const symbol = SYMBOLS[command[1]];
      if (symbol) pushText(symbol);
      else if (command[1] === "text" && rest[command[0].length] === "{") {
        const end = rest.indexOf("}", command[0].length + 1);
        if (end > -1) { pushText(rest.slice(command[0].length + 1, end)); rest = rest.slice(end + 1); continue; }
        pushText(command[0]);
      } else pushText(command[0]);
      rest = rest.slice(command[0].length);
      continue;
    }
    const digitScript = /^([_^])([A-Za-z0-9+-])/.exec(rest);
    if (digitScript) {
      const Tag = digitScript[1] === "^" ? "sup" : "sub";
      parts.push(<Tag key={key++}>{digitScript[2]}</Tag>);
      rest = rest.slice(digitScript[0].length);
      continue;
    }
    pushText(rest[0] === "{" || rest[0] === "}" ? "" : rest[0]);
    rest = rest.slice(1);
  }
  return parts;
}

export function MathExpression({ source, display = false }: { source: string; display?: boolean }) {
  const clean = source.trim().replace(/^\\\[|\\\]$/g, "").replace(/^\$\$?|\$\$?$/g, "").trim();
  return display
    ? <div className="math-expression math-expression-display" role="math">{convertSimpleLatex(clean)}</div>
    : <span className="math-expression" role="math">{convertSimpleLatex(clean)}</span>;
}
