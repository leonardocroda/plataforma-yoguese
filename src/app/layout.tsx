import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

// Unica familia da marca (AD-041): Outfit, servida pelo next/font no
// subconjunto latino, com a pilha de fallback do guia em globals.css.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yogue-se Yoga",
  description: "Plataforma do studio Yogue-se Yoga",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={outfit.variable}>
      <body>
        {/* Sprite do pontilhado do pato experimental (guia: vagas) -
            definido uma vez, usado pelos VacancyDucks experimental */}
        <svg
          width="0"
          height="0"
          style={{ position: "absolute" }}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <pattern
              id="pontilhado"
              width="3.2"
              height="3.2"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1.6" cy="1.6" r=".75" fill="#F29A55" />
            </pattern>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
