import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "たすくま Web - タスクシュート式タスク管理",
  description:
    "タスクシュート式のタスク・時間管理Webアプリ。AIによるタスク提案機能付き。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
