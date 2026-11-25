import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tukutane Chimbo",
  description: "Meet people, make meaningful connections.",
  applicationName: "Tukutane Chimbo"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sw"><body>{children}</body></html>;
}