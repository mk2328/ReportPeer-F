import type { Metadata } from "next";
import { Inter } from "next/font/google"; 
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css"; // Standard relative layout import

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ReportPeer AI",
  description: "Automated FYP Formatting Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}