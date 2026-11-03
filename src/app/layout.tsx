import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evolving Resume",
  description: "Turn an existing resume into a structured, ATS-safe resume."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">Evolving Resume</header>
        <main>{children}</main>
      </body>
    </html>
  );
}
