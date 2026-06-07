import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex Quant Trader",
  description: "Private signal access and local MT5 execution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
