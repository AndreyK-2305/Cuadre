import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Isa Cream",
  description: "Inventario, ventas y reportes para Isa Cream"
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
