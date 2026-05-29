import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Cuadre",
  description: "Control de inventario, ventas y reportes para pequenos negocios"
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
