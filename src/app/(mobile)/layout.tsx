import ScrollToTopOnRoute from '@/components/scroll-to-top-on-route';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background p-3">
      <ScrollToTopOnRoute />
      {children}
    </div>
  );
}
