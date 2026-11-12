import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RewardsProvider } from "@/components/RewardsProvider";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Jogaço — jogue grátis e ganhe recompensas",
  description: "Jogos grátis no navegador. Jogue, complete missões e troque moedas por recompensas.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#140a2e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RewardsProvider>
          <Header />
          <main className="container">{children}</main>
          <footer className="footer">
            Jogaço © {new Date().getFullYear()} · Moedas não têm valor monetário.
          </footer>
        </RewardsProvider>
      </body>
    </html>
  );
}
