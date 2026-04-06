import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NexaRadius Technician',
  description: 'Technician Field Portal',
  manifest: '/manifest.json', // Allows it to be installed as a PWA
  themeColor: '#06b6d4', // cyan-500
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0', // Prevent zooming on mobile
};

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased selection:bg-cyan-500/30 min-h-[100dvh]`}>
        <main className="w-full max-w-md mx-auto min-h-[100dvh] bg-card relative shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
