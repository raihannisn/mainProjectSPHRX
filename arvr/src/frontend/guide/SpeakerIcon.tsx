interface SpeakerIconProps {
  className?: string
}

/** Thin-line speaker glyph for the "read answers aloud" toggle (same stroke language as BotIcon). */
export function SpeakerIcon({ className }: SpeakerIconProps) {
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
      <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18 6.8a7.4 7.4 0 0 1 0 10.4" />
    </svg>
  )
}
