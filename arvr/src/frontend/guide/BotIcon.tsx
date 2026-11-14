interface BotIconProps {
  className?: string
}

/** Robot glyph shared by the Cosmic Guide FAB and chat window header. */
export function BotIcon({ className }: BotIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 7.4V4.6" />
      <circle cx="12" cy="3.3" r="1.3" />
      <rect x="4" y="7.4" width="16" height="11.4" rx="3.6" />
      <circle cx="9.1" cy="12.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.9" cy="12.6" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9.3 16.1h5.4" />
      <path d="M2.6 12v3.2M21.4 12v3.2" />
    </svg>
  )
}
