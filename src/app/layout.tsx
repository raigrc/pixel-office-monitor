import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Press_Start_2P, VT323, Inter } from "next/font/google";
import { COZY_CSS_VARIABLES } from "@/lib/cozy-theme";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pixel Office Monitor",
  description: "Real-time OpenCode automation studio monitor",
};

const cozyThemeStyle: CSSProperties & typeof COZY_CSS_VARIABLES = COZY_CSS_VARIABLES;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${vt323.variable} ${inter.variable} h-full antialiased dark`}
      style={cozyThemeStyle}
    >
      <body className="flex min-h-full flex-col bg-[var(--canvas)] text-[var(--text)]">
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
