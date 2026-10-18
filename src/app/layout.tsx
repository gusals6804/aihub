import type { Metadata } from "next";
import { Suspense } from "react";
import Hub from "@/components/hub";
import "./globals.css";
export const metadata: Metadata = {
  title: "Agent Hub · 함께 만드는 일의 여유",
  description: "업무는 더 효율적으로, 일상은 더 편리하게. 로그인 없이 실행하고 만들고 공유하세요.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Suspense fallback={<main className="loading">Agent Hub를 준비하고 있어요…</main>}>
          <Hub />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
