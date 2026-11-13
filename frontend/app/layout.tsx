import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { asset } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: "WasPrice", template: "%s · WasPrice" },
  description: "Bonded honest discounts: struck prices checked against archived captures by GenLayer validators.",
  icons: { icon: [{ url: asset("/favicon.svg"), type: "image/svg+xml" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
