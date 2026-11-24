import { useEffect, useState } from 'react';

export interface ViewportMode {
  width: number;
  height: number;
  /** True on phones, small tablets, or landscape phones with short vertical height */
  isCompact: boolean;
  /** True on narrow portrait phone screens where landscape rotation is recommended */
  isPortraitPhone: boolean;
  /** True on short landscape viewports (e.g. mobile landscape 844x390) */
  isShortLandscape: boolean;
  /** Coarse pointer detection for expanded touch hitboxes */
  isTouchDevice: boolean;
}

function readViewport(): ViewportMode {
  if (typeof window === 'undefined') {
    return {
      width: 1440,
      height: 900,
      isCompact: false,
      isPortraitPhone: false,
      isShortLandscape: false,
      isTouchDevice: false,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isShortLandscape = width > height && height <= 540;
  const isCompact = width < 1024 || isShortLandscape;
  const isPortraitPhone = width < height && width < 768;
  const isTouchDevice =
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0;

  return {
    width,
    height,
    isCompact,
    isPortraitPhone,
    isShortLandscape,
    isTouchDevice,
  };
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(readViewport);

  useEffect(() => {
    const update = () => setMode(readViewport());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return mode;
}
