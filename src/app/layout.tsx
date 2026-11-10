import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Checkout · CityPay Elements',
  description: 'A sandbox checkout demonstrating CityPay Elements in Next.js.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
