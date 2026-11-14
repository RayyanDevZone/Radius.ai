import type { Metadata } from "next";
import {
  Instrument_Serif,
  Inter,
  Noto_Sans_Devanagari,
  Tiro_Devanagari_Hindi,
} from "next/font/google";
import "./globals.css";

// Headings: elegant editorial serif. Body: clean, highly legible sans.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Hindi (Devanagari) companions: used automatically for Devanagari glyphs.
const tiroHindi = Tiro_Devanagari_Hindi({
  variable: "--font-tiro-hindi",
  subsets: ["devanagari"],
  weight: "400",
  preload: false,
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Radius.ai",
  description: "Radius.ai",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${tiroHindi.variable} ${notoSansDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
