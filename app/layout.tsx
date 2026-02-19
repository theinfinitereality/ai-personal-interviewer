import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Personal Interviewer",
  description: "Conduct interactive AI-powered interviews",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

