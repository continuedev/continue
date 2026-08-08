import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import "./docs.css";

export const metadata: Metadata = {
  title: "Continue Docs",
  description:
    "Documentation for Continue — the open-source AI code assistant.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="x-app" content="app-docs" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div
            className={`fixed inset-0 flex flex-col bg-white dark:bg-[#0a0a0a] ${GeistSans.variable} ${GeistMono.variable}`}
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            <style>{`
              .font-mono {
                font-family: var(--font-geist-mono), ui-monospace, monospace !important;
              }
            `}</style>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
