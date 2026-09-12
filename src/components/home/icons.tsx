/**
 * Brand icons that Lucide does not ship (§4: don't mix icon libraries — these
 * are the "official SVG" fallback the plan allows). Drawn to visually match
 * Lucide's 24-grid / 1.75 stroke style.
 */

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function InstagramIcon({ size = 24, className = '', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 24, className = '', strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M9.2 8.6c.3-.7.6-.7 1-.7h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7a7.3 7.3 0 0 0 3.3 2.9c.3.1.5.1.7-.1l.6-.7c.2-.2.4-.2.6-.1l2 .9c.4.2.5.4.5.6a2 2 0 0 1-1.5 1.9c-.6.1-1.3.2-3.4-.7a10.4 10.4 0 0 1-4.5-4.4c-.8-1.6-.8-2.9-.6-3.5z" />
    </svg>
  );
}
