"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ScrollToTopOnRoute() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname, searchParams?.toString()]);
  return null;
}
