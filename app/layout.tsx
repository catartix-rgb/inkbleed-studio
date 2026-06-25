import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InkBleed Studio — Sketch-to-Vector Logo Tool",
  description:
    "Draw logo concepts with a pressure-sensitive ink brush and convert sketches into clean, production-ready vector graphics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
