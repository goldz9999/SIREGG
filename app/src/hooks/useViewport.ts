import { useEffect, useState } from 'react';

/** Window width, plus the prototype's breakpoints. */
export function useViewport() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return { w, isMobile: w < 760, isTablet: w < 1080, isWide: w >= 1100 };
}
