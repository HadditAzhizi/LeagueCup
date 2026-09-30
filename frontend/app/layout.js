import Link from 'next/link';
import './globals.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f7a3d',
};

export const metadata = {
  title: 'LeagueCup — Manajemen Liga & Cup Sepak Bola',
  description: 'Buat dan kelola kompetisi liga dan cup sepak bola.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <header className="topbar">
          <div className="container">
            <Link href="/" className="brand">⚽ LeagueCup</Link>
            <nav className="nav">
              <Link href="/" className="hide-sm">Dashboard</Link>
              <Link href="/leagues/new">+ Liga</Link>
              <Link href="/cups/new">+ Cup</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
