import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Repair Reference Demo",
  description: "Sample grievance form with AI generated repair reference flow"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
