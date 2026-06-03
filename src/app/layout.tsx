import type { Metadata } from "next"
import "./globals.css"
import "./styles/components.css"
import "./styles/login.css"
import "./styles/home.css"
import "./styles/dashboard.css"

export const metadata: Metadata = {
  title: "Cuadre",
  description: "Control de inventario, ventas y reportes para pequenos negocios",
  icons: {
    icon: "/img/cuadreapp.png",
    shortcut: "/img/cuadreapp.png",
    apple: "/img/cuadreapp.png"
  }
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
