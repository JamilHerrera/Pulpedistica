export interface Categoria {
  id: string
  nombre: string
  color_semaforo: string
}

export interface Producto {
  id: string
  nombre: string
  stock_actual: number
  categoria_id: string
  categorias?: Categoria
}

export interface Venta {
  id: string
  fecha_hora: string
  monto_total: number
  anulada?: boolean
  detalle_ventas?: DetalleVenta[]
}

export interface DetalleVenta {
  id: string
  venta_id: string
  producto_id: string
  cantidad: number
  subtotal: number
  productos?: Producto
}

export interface CartItem {
  producto: Producto
  cantidad: number
  precio_unitario: number
}

export type Screen = 'dashboard' | 'semaforo' | 'venta' | 'inventario' | 'analisis'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
}

export interface DashboardStats {
  ventasHoy: number
  montoHoy: number
  productosStockBajo: number
  totalProductos: number
  ventasEsta_semana: number[]
  topProductos: { nombre: string; cantidad: number }[]
  ventasRecientes: Venta[]
}
