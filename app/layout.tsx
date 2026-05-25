import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beach Paddle Admin",
  description: "Outil de gestion Beach Paddle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased font-sans bg-surface text-ink min-h-[100dvh]">
        {children}
      </body>
    </html>
  );
}
