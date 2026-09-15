import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/lib/providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Insurance', template: '%s · Insurance' },
  description: 'Gestão e cotação para corretoras de seguros',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
