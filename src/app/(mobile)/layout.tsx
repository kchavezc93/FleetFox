import ScrollToTopOnRoute from '@/components/scroll-to-top-on-route';
import { Suspense } from 'react';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background p-3">
      {/* Wrap components using useSearchParams/usePathname in Suspense per Next.js 15 */}
      <Suspense fallback={null}>
        <ScrollToTopOnRoute />
      </Suspense>
      {children}
    </div>
  );
}
