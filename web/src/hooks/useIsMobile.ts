import { useEffect, useState } from 'react';

const DEFAULT_MAX = 767;

/**
 * True when viewport width is at most `maxWidth` (default 767 → matches Tailwind &lt;768px).
 */
export function useIsMobile(maxWidth = DEFAULT_MAX) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [maxWidth]);

  return isMobile;
}
