import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle,
  X, Package, AlertTriangle, DollarSign, Scale,
} from 'lucide-react'
import { useVenta } from '../hooks/useVenta'
import { FotoProducto } from '../components/ui/FotoProducto'
import {
  esFraccionable, formatearCantidad, interpretarCantidad, reglaDe, subtotalDeLinea,
} from '../lib/unidades'
import type { Producto, CartItem } from '../types'

interface Props {
  onToast: (title: string, msg?: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

/** Fracciones que se piden en el mostrador, para no teclear en cada venta. */
const FRACCIONES = [0.25, 0.5, 0.75, 1]

const dinero = (n: number) => `L ${n.toFixed(2)}`

// ─── Modal Monto Libre ─────────────────────────────────────────────────────────

function MontoLibreModal({
  onConfirm, onClose, saving,
}: Readonly<{ onConfirm: (monto: number) => void; onClose: () => void; saving: boolean }>) {
  const [monto, setMonto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleGuardar = () => {
    const n = Number.parseFloat(monto.trim().replace(',', '.'))
    if (Number.isNaN(n)) { setError('Solo se permiten números'); return }
    if (n <= 0)          { setError('El monto debe ser mayor a 0'); return }
    if (n > 99999)       { setError('Monto demasiado alto'); return }
    setError(null)
    onConfirm(n)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      {/* El fondo es un boton de verdad: enfocable y activable con teclado. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full sm:max-w-lg glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center">
              <DollarSign size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Monto libre</h2>
              <p className="text-white/35 text-xs">Venta sin producto del catálogo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30"><X size={20} /></button>
        </div>

        <div>
          <label htmlFor="monto-libre" className="text-white/40 text-xs uppercase tracking-wider mb-2 block">
            Monto a registrar
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">L</span>
            <input
              id="monto-libre"
              ref={inputRef}
              type="number"
              value={monto}
              onChange={(e) => { setMonto(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGuardar() }}
              placeholder="0.00"
              className="input-field pl-9 text-2xl font-black text-white tracking-tight"
              min="0.01"
              step="0.5"
            />
          </div>
          {error && (
            <p className="mt-2 text-xs text-danger flex items-center gap-1.5">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-white/4 border border-white/8">
          <Package size={13} className="text-white/30 shrink-0 mt-0.5" />
          <p className="text-white/35 text-xs leading-relaxed">
            Se registra en el historial sin tocar el stock de ningún producto.
          </p>
        </div>

        <button
          onClick={handleGuardar}
          disabled={saving}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
            saving ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gradient-to-r from-accent to-brand text-white'
          }`}
        >
          {saving
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando…</>
            : <><CheckCircle size={16} /> Registrar</>}
        </button>
      </div>
    </div>
  )
}

// ─── Pedir el precio la primera vez ────────────────────────────────────────────

function ModalPrecio({
  producto, onConfirm, onClose,
}: Readonly<{ producto: Producto; onConfirm: (precio: number) => void; onClose: () => void }>) {
  const [precio, setPrecio] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { abreviatura } = reglaDe(producto.unidad)

  useEffect(() => { inputRef.current?.focus() }, [])

  const guardar = () => {
    const n = Number.parseFloat(precio.trim().replace(',', '.'))
    if (Number.isFinite(n) && n > 0) onConfirm(n)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full sm:max-w-sm glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up">
        <div className="flex items-center gap-3">
          <FotoProducto nombre={producto.nombre} url={producto.imagen_url} className="w-12 h-12 rounded-xl shrink-0" iconSize={20} />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{producto.nombre}</p>
            <p className="text-white/35 text-xs">
              Todavía no tiene precio{abreviatura && ` por ${abreviatura}`}
            </p>
          </div>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">L</span>
          <input
            id="precio-producto"
            ref={inputRef}
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') guardar() }}
            placeholder="0.00"
            className="input-field pl-9 text-2xl font-black tracking-tight"
            min="0.01"
            step="0.5"
          />
        </div>
        <p className="text-white/30 text-xs">
          Queda guardado en el catálogo: la próxima venta ya no lo va a pedir.
        </p>

        <button
          onClick={guardar}
          className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-brand to-brand-dark text-white active:scale-95 transition-all"
        >
          Agregar al carrito
        </button>
      </div>
    </div>
  )
}

// ─── Tarjeta del catálogo ──────────────────────────────────────────────────────

function TarjetaProducto({
  producto, precio, enCarrito, onAdd,
}: Readonly<{
  producto: Producto
  precio: number
  /** Cantidad ya cargada, para que se note de un vistazo. */
  enCarrito: number
  onAdd: () => void
}>) {
  const agotado = producto.stock_actual <= 0
  const poco = !agotado && producto.stock_actual <= 5
  const { abreviatura } = reglaDe(producto.unidad)

  return (
    <button
      onClick={onAdd}
      className={`group relative overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.97] ${
        enCarrito > 0
          ? 'border-brand/60 bg-brand/10 shadow-glow-brand'
          : 'border-white/[0.07] bg-surface-card/80 hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <FotoProducto
          nombre={producto.nombre}
          url={producto.imagen_url}
          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          iconSize={30}
        />

        {/* Degradado para que el texto de abajo se lea sobre cualquier foto. */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />

        {enCarrito > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-white shadow-glow-brand">
            {formatearCantidad(enCarrito, producto.unidad)}
          </span>
        )}

        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm ${
            agotado ? 'bg-danger/80 text-white'
              : poco ? 'bg-warning/80 text-black'
              : 'bg-black/50 text-white/80'
          }`}
        >
          {agotado ? 'Agotado' : formatearCantidad(producto.stock_actual, producto.unidad)}
        </span>

        {abreviatura && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/75 backdrop-blur-sm">
            <Scale size={9} /> {abreviatura}
          </span>
        )}
      </div>

      <div className="p-2.5">
        <p className="truncate text-[13px] font-semibold leading-tight text-white">{producto.nombre}</p>
        <p className={`mt-0.5 text-xs font-bold ${precio > 0 ? 'text-brand-light' : 'text-white/25'}`}>
          {precio > 0
            ? <>{dinero(precio)}{abreviatura && <span className="font-medium text-white/30">/{abreviatura}</span>}</>
            : 'Tocá para ponerle precio'}
        </p>
      </div>
    </button>
  )
}

// ─── Línea del carrito ─────────────────────────────────────────────────────────

function LineaDeCarrito({
  item, onAjustar, onCantidad, onPrecio, onQuitar,
}: Readonly<{
  item: CartItem
  onAjustar: (pasos: number) => void
  onCantidad: (cantidad: number) => void
  onPrecio: (precio: number) => void
  onQuitar: () => void
}>) {
  const [editandoCantidad, setEditandoCantidad] = useState(false)
  const [textoCantidad, setTextoCantidad] = useState('')
  const [editandoPrecio, setEditandoPrecio] = useState(false)
  const [textoPrecio, setTextoPrecio] = useState(String(item.precio_unitario))

  const porPeso = esFraccionable(item.producto.unidad)
  const { abreviatura } = reglaDe(item.producto.unidad)

  const confirmarCantidad = () => {
    const valor = interpretarCantidad(textoCantidad, item.producto.unidad)
    if (valor !== null) onCantidad(valor)
    setEditandoCantidad(false)
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5 animate-slide-up">
      <div className="flex items-start gap-2.5">
        <FotoProducto
          nombre={item.producto.nombre}
          url={item.producto.imagen_url}
          className="h-10 w-10 shrink-0 rounded-xl"
          iconSize={16}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white">{item.producto.nombre}</p>

          {editandoPrecio ? (
            <input
              type="number"
              value={textoPrecio}
              autoFocus
              aria-label="Precio unitario"
              onChange={(e) => setTextoPrecio(e.target.value)}
              onBlur={() => {
                const p = Number.parseFloat(textoPrecio.replace(',', '.'))
                if (Number.isFinite(p) && p > 0) onPrecio(p)
                setEditandoPrecio(false)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="input-field mt-0.5 h-7 w-24 py-1 text-xs"
              min="0"
              step="0.5"
            />
          ) : (
            <button
              onClick={() => { setTextoPrecio(String(item.precio_unitario)); setEditandoPrecio(true) }}
              className="mt-0.5 text-xs font-medium text-brand-light"
            >
              {dinero(item.precio_unitario)}{abreviatura && `/${abreviatura}`} ✎
            </button>
          )}
        </div>

        <button onClick={onQuitar} aria-label="Quitar del carrito" className="text-white/20 transition-colors hover:text-danger">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Atajos de fracción: lo que más se pide cuando algo se vende por peso. */}
      {porPeso && (
        <div className="mt-2 flex gap-1">
          {FRACCIONES.map((f) => (
            <button
              key={f}
              onClick={() => onCantidad(f)}
              className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition-all active:scale-95 ${
                item.cantidad === f
                  ? 'bg-brand text-white'
                  : 'bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              {f === 1 ? `1 ${abreviatura}` : `${f}`}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAjustar(-1)}
            aria-label="Quitar uno"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/8 transition-all active:scale-90"
          >
            <Minus size={12} strokeWidth={2.5} />
          </button>

          {editandoCantidad ? (
            <input
              type="text"
              inputMode="decimal"
              value={textoCantidad}
              autoFocus
              aria-label="Cantidad"
              onChange={(e) => setTextoCantidad(e.target.value)}
              onBlur={confirmarCantidad}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="input-field h-7 w-16 py-1 text-center text-xs font-bold"
            />
          ) : (
            <button
              onClick={() => { setTextoCantidad(String(item.cantidad)); setEditandoCantidad(true) }}
              // Escribir la cantidad directo importa cuando la balanza marca
              // 1.37: llegar ahí a puros toques de un cuarto es imposible.
              title="Tocá para escribir la cantidad exacta"
              className="min-w-[56px] rounded-lg px-1 text-center text-sm font-bold text-white hover:bg-white/5"
            >
              {formatearCantidad(item.cantidad, item.producto.unidad)}
            </button>
          )}

          <button
            onClick={() => onAjustar(1)}
            aria-label="Agregar uno"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20 transition-all active:scale-90"
          >
            <Plus size={12} strokeWidth={2.5} className="text-brand-light" />
          </button>
        </div>

        <p className="text-sm font-bold text-white">
          {dinero(subtotalDeLinea(item.cantidad, item.precio_unitario))}
        </p>
      </div>
    </div>
  )
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export function NuevaVenta({ onToast }: Readonly<Props>) {
  const {
    cart, total, saving,
    addToCart, updateCantidad, ajustarCantidad, updatePrecio, removeFromCart, clearCart,
    confirmarVenta, listarCatalogo, getPrecio, registrarMontoLibre,
  } = useVenta()

  const [catalogo, setCatalogo] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [query, setQuery] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showMontoLibre, setShowMontoLibre] = useState(false)
  const [pidiendoPrecio, setPidiendoPrecio] = useState<Producto | null>(null)

  useEffect(() => {
    listarCatalogo()
      .then(setCatalogo)
      .catch((e) => { console.error('Error cargando el catálogo:', e) })
      .finally(() => setCargando(false))
  }, [listarCatalogo])

  const categorias = useMemo(() => {
    const vistas = new Map<string, string>()
    for (const p of catalogo) {
      if (p.categorias) vistas.set(p.categorias.id, p.categorias.nombre)
    }
    return [...vistas].map(([id, nombre]) => ({ id, nombre }))
  }, [catalogo])

  // El filtrado es local: el catálogo entero ya está en memoria, así que
  // buscar no necesita ni ir a la red ni esperar un tiempo de gracia.
  const visibles = useMemo(() => {
    const texto = query.trim().toLowerCase()
    return catalogo.filter((p) => {
      if (categoria && p.categoria_id !== categoria) return false
      return !texto || p.nombre.toLowerCase().includes(texto)
    })
  }, [catalogo, query, categoria])

  const cantidadEnCarrito = useCallback(
    (id: string) => cart.find((i) => i.producto.id === id)?.cantidad ?? 0,
    [cart],
  )

  const agregar = useCallback((producto: Producto) => {
    const precio = getPrecio(producto)
    if (precio > 0) {
      addToCart(producto, precio)
      return
    }
    // Sin precio no se puede cobrar, así que se pide una vez y queda en el
    // catálogo en lugar de volver a preguntarlo en cada venta.
    setPidiendoPrecio(producto)
  }, [addToCart, getPrecio])

  const handleConfirmar = async () => {
    if (cart.length === 0) return
    const montoCobrado = total
    const ok = await confirmarVenta()
    if (ok) {
      setShowSuccess(true)
      setQuery('')
      onToast('¡Venta registrada!', `${dinero(montoCobrado)} guardado correctamente`, 'success')
      listarCatalogo().then(setCatalogo).catch(() => {})
      setTimeout(() => setShowSuccess(false), 2200)
    } else {
      onToast('Error al guardar', 'Revisá tu conexión e intentá de nuevo', 'error')
    }
  }

  const handleMontoLibre = async (monto: number) => {
    const ok = await registrarMontoLibre(monto)
    if (ok) {
      setShowMontoLibre(false)
      setShowSuccess(true)
      onToast('¡Venta registrada!', `${dinero(monto)} — monto libre`, 'success')
      setTimeout(() => setShowSuccess(false), 2200)
    } else {
      onToast('Error al guardar', 'Revisá tu conexión', 'error')
    }
  }

  if (showSuccess) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 pt-20 animate-fade-in">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-success/15">
          <CheckCircle size={48} className="text-success" />
        </div>
        <p className="text-xl font-bold text-white">¡Venta guardada!</p>
        <p className="text-sm text-white/40">El stock ya quedó actualizado</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">

      {/* ── Carrito ──────────────────────────────────────────────────────────
          En móvil va ARRIBA del catálogo: una barra fija chocaría con la
          navegación inferior, y dejarlo al fondo de una lista larga lo vuelve
          inalcanzable. En escritorio queda pegado a la derecha. */}
      <aside className="order-first space-y-2.5 lg:order-last lg:sticky lg:top-20">
        <div className="glass-card p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-brand-light" />
              <h3 className="text-sm font-bold text-white">
                Carrito {cart.length > 0 && <span className="text-white/35">({cart.length})</span>}
              </h3>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="flex items-center gap-1 text-xs text-white/30 transition-colors hover:text-danger">
                <X size={11} /> Limpiar
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="py-6 text-center text-xs text-white/25">
              Tocá un producto para empezar la venta
            </p>
          ) : (
            <>
              <div className="max-h-[42vh] space-y-2 overflow-y-auto lg:max-h-[48vh]">
                {cart.map((item) => (
                  <LineaDeCarrito
                    key={item.producto.id}
                    item={item}
                    onAjustar={(pasos) => ajustarCantidad(item.producto.id, pasos)}
                    onCantidad={(c) => updateCantidad(item.producto.id, c)}
                    onPrecio={(p) => updatePrecio(item.producto.id, p)}
                    onQuitar={() => removeFromCart(item.producto.id)}
                  />
                ))}
              </div>

              <div className="mt-3 border-t border-white/[0.07] pt-3">
                <div className="mb-2.5 flex items-end justify-between">
                  <span className="text-xs uppercase tracking-wider text-white/40">Total</span>
                  <span className="text-2xl font-black tracking-tight text-white">{dinero(total)}</span>
                </div>
                <button
                  onClick={handleConfirmar}
                  disabled={saving}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95 ${
                    saving
                      ? 'cursor-not-allowed bg-brand/40 text-white/50'
                      : 'bg-gradient-to-r from-brand to-brand-dark text-white shadow-glow-brand'
                  }`}
                >
                  {saving
                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Guardando…</>
                    : <><CheckCircle size={16} /> Cobrar</>}
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setShowMontoLibre(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-accent/25 bg-accent/10 py-2.5 text-xs font-semibold text-accent transition-all active:scale-95"
        >
          <DollarSign size={13} strokeWidth={2.5} /> Cobrar un monto libre
        </button>
      </aside>

      {/* ── Catálogo ───────────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-3">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">Nueva venta</h2>
          <p className="mt-0.5 text-sm text-white/40">
            {cargando ? 'Cargando el catálogo…' : `${catalogo.length} productos en tu inventario`}
          </p>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
            className="input-field pl-10"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {categorias.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoria(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                categoria === null ? 'bg-brand text-white' : 'bg-white/5 text-white/45 hover:text-white/70'
              }`}
            >
              Todos
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoria(c.id === categoria ? null : c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  categoria === c.id ? 'bg-brand text-white' : 'bg-white/5 text-white/45 hover:text-white/70'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}

        {(() => {
          if (cargando) {
            return (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            )
          }
          if (visibles.length === 0) {
            return (
              <div className="py-16 text-center">
                <Package size={36} className="mx-auto mb-3 text-white/10" />
                <p className="text-sm text-white/35">
                  {catalogo.length === 0
                    ? 'Todavía no tenés productos. Cargalos desde Inventario.'
                    : 'Ningún producto coincide con la búsqueda.'}
                </p>
              </div>
            )
          }
          return (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {visibles.map((p) => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  precio={getPrecio(p)}
                  enCarrito={cantidadEnCarrito(p.id)}
                  onAdd={() => agregar(p)}
                />
              ))}
            </div>
          )
        })()}
      </div>

      {showMontoLibre && (
        <MontoLibreModal
          onConfirm={handleMontoLibre}
          onClose={() => setShowMontoLibre(false)}
          saving={saving}
        />
      )}

      {pidiendoPrecio && (
        <ModalPrecio
          producto={pidiendoPrecio}
          onClose={() => setPidiendoPrecio(null)}
          onConfirm={(precio) => {
            addToCart(pidiendoPrecio, precio)
            setPidiendoPrecio(null)
          }}
        />
      )}
    </div>
  )
}
