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
  /** Precio de catálogo. NULL mientras no se le haya fijado uno. */
  precio?: number | null
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

export interface Cliente {
  id: string
  nombre: string
  telefono?: string | null
  notas?: string | null
  created_at: string
}

export interface Fiado {
  id: string
  cliente_id: string
  venta_id?: string | null
  monto: number
  pagado: boolean
  fecha_registro: string
  fecha_pago?: string | null
  clientes?: Cliente
}

export type TipoFeedback = 'sugerencia' | 'problema' | 'elogio' | 'otro'

export interface Feedback {
  id: string
  user_id: string | null
  negocio_id: string | null
  tipo: TipoFeedback
  /** Nota de 1 a 5. Es opcional: hay comentarios que no vienen con puntaje. */
  calificacion: number | null
  mensaje: string
  /** Sección desde la que se envió, para ubicar el comentario en contexto. */
  pantalla: string | null
  atendido: boolean
  created_at: string
}

export type EstadoTicket = 'nuevo' | 'en_proceso' | 'resuelto' | 'descartado'

/**
 * Un problema del sistema, no una ocurrencia suya. La app lo crea sola cuando
 * captura un error; `veces` cuenta cuántas apariciones cayeron en esta misma
 * fila. Ver `lib/errores.ts` y la migracion 013.
 */
export interface Ticket {
  id: string
  /** Identidad del problema. Es lo que deduplica: es UNIQUE en la base. */
  huella: string
  titulo: string
  origen: 'render' | 'promesa' | 'javascript' | 'consola' | 'recurso' | 'manual'
  detalle: string | null
  pantalla: string | null
  ruta: string | null
  navegador: string | null
  estado: EstadoTicket
  nota: string | null
  veces: number
  primera_vez: string
  ultima_vez: string
  reportado_por: string | null
  negocio_id: string | null
}

export type Screen = 'dashboard' | 'semaforo' | 'venta' | 'fiados' | 'inventario' | 'analisis' | 'comentarios' | 'usuarios' | 'tickets'

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
