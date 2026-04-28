import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数模Dashboard",
  description: "数学建模竞赛协作平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
