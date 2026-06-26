// Minimal line icons (no emojis). Stroke uses currentColor so they inherit
// text color. 24x24 viewbox.

type P = { className?: string; size?: number; filled?: boolean };

function base(size = 24, className = "") {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
}

export function IconHome({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function IconUsers({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.2A3.2 3.2 0 0 1 16 11.4" />
      <path d="M17 15.2c2.3.5 4 2.4 4 4.8" />
    </svg>
  );
}

export function IconPoll({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 19V9" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
      <path d="M3.5 19.5h17" />
    </svg>
  );
}

export function IconGrid({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

export function IconUser({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-3.6 3.2-6 7.5-6s7.5 2.4 7.5 6" />
    </svg>
  );
}

export function IconPlus({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconHeart({ className, size, filled }: P) {
  return (
    <svg {...base(size, className)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20s-7-4.5-9.2-9C1.3 7.7 3 4.8 6 4.8c1.9 0 3.2 1.1 4 2.3.8-1.2 2.1-2.3 4-2.3 3 0 4.7 2.9 3.2 6.2C19 15.5 12 20 12 20Z" />
    </svg>
  );
}

export function IconComment({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" />
    </svg>
  );
}

export function IconClose({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconPencil({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export function IconDownload({ className, size }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 4v10" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M5 19h14" />
    </svg>
  );
}
