import "./globals.css";

export const metadata = {
  title: "PB 제품개발 시트",
  description: "PB 제품개발 프로젝트 관리 시스템"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
