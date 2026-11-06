import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yogue-se Yoga",
  description: "Plataforma do studio Yogue-se Yoga",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
