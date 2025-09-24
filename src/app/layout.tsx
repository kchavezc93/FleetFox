
import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
// Removed: import { GeistMono } from 'geist/font/mono'; // No longer used directly here
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ReactQueryProvider } from '@/components/react-query-provider';
import { ThemeProvider } from '@/contexts/theme-provider';

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Dos Robles";

export const metadata: Metadata = {
  title: `${companyName} - Gestión de Flota`,
  description: `Gestiona eficientemente tu flota con ${companyName}.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${GeistSans.variable}`} suppressHydrationWarning>
      <body className={`antialiased font-sans`}>
        <ThemeProvider defaultTheme="system" storageKey="dosrobles-theme">
          <ReactQueryProvider>
            {children}
            <Toaster />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
