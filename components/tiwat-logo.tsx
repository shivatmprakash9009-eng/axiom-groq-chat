import { useId } from "react";

interface TiwatLogoProps {
  size?: number;
  className?: string;
}

/**
 * TIWAT brand mark: an indigo-to-violet disc with a bold "T" and a bright
 * accent dot. Self-contained (own background) so it reads on light and dark.
 */
export function TiwatLogo({ size = 28, className = "" }: TiwatLogoProps) {
  const gradientId = useId();
  const glowId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <radialGradient id={glowId} cx="0.3" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${gradientId})`} />
      <circle cx="32" cy="32" r="32" fill={`url(#${glowId})`} />
      <path d="M17 18h30v7.5H35.8V47h-7.6V25.5H17z" fill="#ffffff" />
      <circle cx="44.5" cy="44.5" r="4.2" fill="#fde68a" />
    </svg>
  );
}
