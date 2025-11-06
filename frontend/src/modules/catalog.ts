export type CategoriaProducto = 'nuevos' | 'usados' | 'accesorios'

export type Producto = {
  id: number
  nombre: string
  precio: number
  categoria: CategoriaProducto
  descripcion: string
  imagenUrl?: string
  origin: 'base' | 'remote'
  createdAt?: string
}

export const PRODUCTOS_BASE: Producto[] = [
  {
    id: -1,
    nombre: 'iPhone 14 Pro',
    precio: 3000000,
    categoria: 'usados',
    descripcion: 'Usado, 512GB',
    imagenUrl: '/iphone14pro.png',
    origin: 'base',
  },
  {
    id: -2,
    nombre: 'Samsung Galaxy S23',
    precio: 1400000,
    categoria: 'nuevos',
    descripcion: 'Nuevo, 128GB',
    imagenUrl: '/samsungs23.png',
    origin: 'base',
  },
  {
    id: -3,
    nombre: 'iPhone 12',
    precio: 1500000,
    categoria: 'usados',
    descripcion: 'Usado, excelente estado',
    imagenUrl: '/i12.png',
    origin: 'base',
  },
  {
    id: -4,
    nombre: 'Xiaomi Redmi Note 12',
    precio: 500000,
    categoria: 'nuevos',
    descripcion: 'Nuevo, 128GB',
    imagenUrl: '/redmi12.png',
    origin: 'base',
  },
  {
    id: -5,
    nombre: 'AirPods Pro',
    precio: 650000,
    categoria: 'accesorios',
    descripcion: 'Originales Apple',
    origin: 'base',
  },
  {
    id: -6,
    nombre: 'Smartwatch Galaxy Watch 5',
    precio: 950000,
    categoria: 'accesorios',
    descripcion: 'Nuevo, con GPS',
    origin: 'base',
  },
  {
    id: -7,
    nombre: 'Cargador Inalambrico',
    precio: 85000,
    categoria: 'accesorios',
    descripcion: 'Carga rapida 15W',
    origin: 'base',
  },
  {
    id: -8,
    nombre: 'Funda Premium',
    precio: 35000,
    categoria: 'accesorios',
    descripcion: 'Antigolpes',
    origin: 'base',
  },
  {
    id: -9,
    nombre: 'iPhone 15',
    precio: 2700000,
    categoria: 'usados',
    descripcion: 'Usado, 128GB',
    imagenUrl: '/i15.png',
    origin: 'base',
  },
  {
    id: -10,
    nombre: 'iPhone 13',
    precio: 1450000,
    categoria: 'usados',
    descripcion: 'Usado, 128GB',
    imagenUrl: '/ip13.png',
    origin: 'base',
  },
  {
    id: -11,
    nombre: 'Cargador USB-C 20W',
    precio: 65000,
    categoria: 'accesorios',
    descripcion: 'Carga rapida',
    origin: 'base',
  },
  {
    id: -12,
    nombre: 'Protector de Pantalla 9H',
    precio: 30000,
    categoria: 'accesorios',
    descripcion: 'Templado',
    origin: 'base',
  },
  {
    id: -13,
    nombre: 'Samsung A16',
    precio: 530000,
    categoria: 'nuevos',
    descripcion: '128GB',
    imagenUrl: '/a16.png',
    origin: 'base',
  },
  {
    id: -14,
    nombre: 'iPhone 13 (Demo)',
    precio: 1630000,
    categoria: 'usados',
    descripcion: 'Usado, 128GB',
    imagenUrl: '/i13.png',
    origin: 'base',
  },
  {
    id: -15,
    nombre: 'Audifonos Bluetooth',
    precio: 90000,
    categoria: 'accesorios',
    descripcion: 'Bateria 30h',
    origin: 'base',
  },
  {
    id: -16,
    nombre: 'Cargador MagSafe',
    precio: 180000,
    categoria: 'accesorios',
    descripcion: 'Compatible iPhone',
    origin: 'base',
  },
]
