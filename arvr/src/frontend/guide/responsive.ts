import { useEffect, useState } from 'react'

/** Breakpoint where the guide stops floating and uses its own page instead. */
export const GUIDE_MOBILE_QUERY = '(max-width: 767px)'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches))

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** True when the floating window is allowed (desktop/tablet); false on phones. */
export function useFloatingGuideAllowed(): boolean {
  return !useMediaQuery(GUIDE_MOBILE_QUERY)
}
