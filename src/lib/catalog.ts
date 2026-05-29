import type { Product } from "@/types/app"

export type SeedProduct = Pick<
  Product,
  "nombre" | "descripcion" | "tipo_item" | "precio" | "cantidad_stock" | "tipo_unidad" | "activo"
>

export const seedProducts: SeedProduct[] = [
  {
    nombre: "Maracumango Sencillo",
    descripcion: "Granizado de maracuya, mango, limon, pimienta, sal, miel y leche condensada.",
    tipo_item: "producto",
    precio: 6000,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Maracumango de la Casa",
    descripcion:
      "Granizado de maracuya, mango, limon, pimienta, sal, miel, leche condensada y helado.",
    tipo_item: "producto",
    precio: 8500,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Maracumango Mexicano 16 Oz",
    descripcion:
      "Granizado de maracuya, mango, manzana verde, limon, pimienta, sal, miel, leche condensada, tajin, gomitas y takis.",
    tipo_item: "producto",
    precio: 12000,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Michelada Frutos Verdes",
    descripcion: "Mango, manzana, sal, pimienta y limon.",
    tipo_item: "producto",
    precio: 10000,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Michelada Frutos Rojos",
    descripcion: "Fresa, cereza, bombon, limon, pimienta y sal.",
    tipo_item: "producto",
    precio: 10000,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Michelada Mexicana",
    descripcion: "Mango, manzana, sal, pimienta, tajin, limon y taquis.",
    tipo_item: "producto",
    precio: 13000,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Malteada 12 Oz",
    descripcion: "Malteada de 12 onzas.",
    tipo_item: "producto",
    precio: 10000,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Malteada 16 Oz",
    descripcion: "Malteada de 16 onzas.",
    tipo_item: "producto",
    precio: 12000,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Cono Pequeno",
    descripcion: "Helado en cono pequeno.",
    tipo_item: "producto",
    precio: 4000,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Cono Doble",
    descripcion: "Helado en cono doble.",
    tipo_item: "producto",
    precio: 7000,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Canasta ISA",
    descripcion: "Tres sabores de helado con chantilly y cereza.",
    tipo_item: "producto",
    precio: 12000,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Vaso Sencillo",
    descripcion: "Helado en vaso sencillo.",
    tipo_item: "producto",
    precio: 0,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Vaso Doble",
    descripcion: "Helado en vaso doble.",
    tipo_item: "producto",
    precio: 0,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Vaso Triple",
    descripcion: "Helado en vaso triple.",
    tipo_item: "producto",
    precio: 0,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Cerveza",
    descripcion: "Aguila, Coronita, Costena, Andina o Poker.",
    tipo_item: "producto",
    precio: 0,
    cantidad_stock: 0,
    tipo_unidad: "botella",
    activo: true
  },
  {
    nombre: "Ensalada de Frutas",
    descripcion:
      "Melon, papaya, manzana verde, fresa, sandia, banano, queso, leche condensada, cereza, chantilly y 2 sabores de helado.",
    tipo_item: "producto",
    precio: 15000,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Fresas con Crema 12 Oz",
    descripcion: "Fresas con crema.",
    tipo_item: "producto",
    precio: 10000,
    cantidad_stock: 0,
    tipo_unidad: "vaso",
    activo: true
  },
  {
    nombre: "Fresas Achocolatadas",
    descripcion: "Fresa, chocolate, galleta oreo, barquillo y cereza.",
    tipo_item: "producto",
    precio: 12000,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Fresas Ramo",
    descripcion: "Fresas, salsa de chocolate, chocoramo, galleta oreo y helado.",
    tipo_item: "producto",
    precio: 15000,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  },
  {
    nombre: "Banana Split",
    descripcion: "Tres sabores de helado, banano, crema chantilly, cereza y salsas.",
    tipo_item: "producto",
    precio: 15000,
    cantidad_stock: 0,
    tipo_unidad: "unidad",
    activo: true
  }
]
