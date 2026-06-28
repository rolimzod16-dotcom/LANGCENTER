import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lang Center",
  description: "SaaS для языковых центров",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}