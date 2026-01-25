import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CampaignProvider } from "@/context/CampaignContext";
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Hirevoo - AI-Powered Cold Email for Job Seekers",
  description: "Skip the application black hole. Email hiring managers directly with AI-personalized outreach. 23% response rate vs 2% on job boards.",
  keywords: ["job search", "cold email", "career", "job hunting", "startup jobs", "AI email"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>

        <Providers>
          <CampaignProvider>

            {children}

          </CampaignProvider>
        </Providers>
      </body>
    </html>
  );
}
