import type { ReactNode } from "react";
export const metadata = { title: "VELORA" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en"><body style={{ background: "#0B0B0B", color: "#F5F0E6", fontFamily: "system-ui", padding: 40 }}>{children}</body></html>);
}
