import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle,
  X, Package, AlertTriangle, Zap, DollarSign,
} from 'lucide-react'
import { useVenta } from '../hooks/useVenta'
import type { Producto } from '../types'

interface Props {
  onToast: (title: string, msg?: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

// ─── Botón de acceso rápido (producto frecuente) ───────────────────────────────

function ProductoRapidoBtn({
  producto, cachedPrice, onAdd,
}: { producto: Producto; cachedPrice: number; onAdd: (p: Producto, price: number) => void }) {
  const [showInput, setShowInput] = useState(false)
  const [price, setPrice]         = useState(cachedPrice > 0 ? cachedPrice.toString() : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  if (showInput) {
    return (
      <div className="flex items-center gap-1.5 shrink-0 bg-white/8 rounded-2xl px-3 py-2 border border-brand/40">
        <span className="text-white/60 text-xs truncate max-w-[70px]">{producto.nombre}</span>
        <span className="text-white/30 text-xs">L</span>
        <input
          ref={inputRef}
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const p = parseFloat(price)
              if (p > 0) { onAdd(producto, p); setShowInput(false) }
            }
            if (e.key === 'Escape') setShowInput(false)
          }}
          className="w-16 bg-transparent text-white text-xs font-bold outline-none"
          min="0"
          step="0.5"
          placeholder="0.00"
        />
        <button
          onClick={() => {
            const p = parseFloat(price)
            if (p > 0) { onAdd(producto, p); setShowInput(false) }
          }}
          className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center shrink-0"
        >
          <Plus size={12} strokeWidth={3} className="text-white" />
        </button>
        <button onClick={() => setShowInput(false)} className="text-white/30">
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => {
        if (cachedPrice > 0) onAdd(producto, cachedPrice)
        else setShowInput(true)
      }}
      className="shrink-0 flex flex-col items-start gap-0.5 px-3 py-2 rounded-2xl bg-white/5 border border-white/8 active:scale-95 transition-all active:bg-brand/20 active:border-brand/40"
    >
      <span className="text-white text-xs font-semibold max-w-[90px] truncate">{producto.nombre}</span>
      <span className={`text-[10px] font-medium ${cachedPrice > 0 ? 'text-brand-light' : 'text-white/30'}`}>
        {cachedPrice > 0 ? `L ${cachedPrice.toFixed(2)}` : 'Toca para precio'}
      </span>
    </button>
  )
}

// ─── Modal Monto Libre ─────────────────────────────────────────────────────────

function MontoLibreModal({
  onConfirm, onClose, saving,
}: { onConfirm: (monto: number) => void; onClose: () => void; saving: boolean }) {
  const [monto, setMonto]   = useState('')
  const [error, setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleGuardar = () => {
    const raw = monto.trim()
    if (!raw) { setError('Ingresa un monto'); return }

    const n = parseFloat(raw)
    if (isNaN(n))  { setError('Solo se permiten números'); return }
    if (n <= 0)    { setError('El monto debe ser mayor a 0'); return }
    if (n > 99999) { setError('Monto demasiado alto'); return }

    setError(null)
    onConfirm(n)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center">
              <DollarSign size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Monto Libre</h2>
              <p className="text-white/35 text-xs">Venta genérica sin producto</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30"><X size={20} /></button>
        </div>

        {/* Input */}
        <div>
          <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">
            Monto a registrar
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">L</span>
            <input
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

        {/* Info */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-white/4 border border-white/8">
          <Package size={13} className="text-white/30 shrink-0 mt-0.5" />
          <p className="text-white/35 text-xs leading-relaxed">
            Esta venta se registra en el historial sin afectar el stock de ningún producto. Útil para productos fraccionados o no catalogados.
          </p>
        </div>

        {/* Botón */}
        <button
          onClick={handleGuardar}
          disabled={saving}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
            saving
              ? 'bg-white/10 text-white/30 cursor-not-allowed'
              : 'bg-gradient-to-r from-accent to-brand text-white'
          }`}
        >
          {saving
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
            : <><CheckCircle size={16} /> Registrar L {parseFloat(monto) > 0 ? parseFloat(monto).toFixed(2) : '0.00'}</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Resultado de búsqueda ─────────────────────────────────────────────────────

function ProductSearchResult({
  producto, onAdd, cachedPrice,
}: { producto: Producto; onAdd: (p: Producto, price: number) => void; cachedPrice: number }) {
  const [price, setPrice] = useState(cachedPrice > 0 ? cachedPrice.toString() : '')
  const isLowStock  = producto.stock_actual <= 5
  const outOfStock  = producto.stock_actual === 0

  return (
    <div className="glass-card p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
        <Package size={18} className="text-brand-light" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{producto.nombre}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-medium ${outOfStock ? 'text-danger' : isLowStock ? 'text-warning' : 'text-white/40'}`}>
            Stock: {producto.stock_actual}
          </span>
          {producto.categorias && (
            <span className="text-white/20 text-xs">• {producto.categorias.nombre}</span>
          )}
        </div>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Precio unitario (L)"
          className="input-field text-xs py-1.5 mt-1.5 h-8"
          min="0"
          step="0.5"
        />
      </div>
      <button
        onClick={() => {
          const p = parseFloat(price)
          if (!p || p <= 0) return
          onAdd(producto, p)
        }}
        disabled={outOfStock}
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90 ${
          outOfStock
            ? 'bg-white/5 text-white/20 cursor-not-allowed'
            : 'bg-brand text-white shadow-glow-brand'
        }`}
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// ─── Fila de carrito ───────────────────────────────────────────────────────────

function CartItemRow({
  item, onIncrease, onDecrease, onRemove, onPriceChange,
}: {
  item: { producto: Producto; cantidad: number; precio_unitario: number }
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
  onPriceChange: (p: number) => void
}) {
  const [editPrice, setEditPrice] = useState(false)
  const [priceVal, setPriceVal]   = useState(item.precio_unitario.toString())

  return (
    <div className="glass-card p-3 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          <Package size={16} className="text-brand-light" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{item.producto.nombre}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {editPrice ? (
              <input
                type="number"
                value={priceVal}
                autoFocus
                onChange={(e) => setPriceVal(e.target.value)}
                onBlur={() => {
                  const p = parseFloat(priceVal)
                  if (p > 0) onPriceChange(p)
                  setEditPrice(false)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className="input-field text-xs py-1 h-7 w-28"
              />
            ) : (
              <button onClick={() => setEditPrice(true)} className="text-xs text-brand-light font-medium">
                L {item.precio_unitario.toFixed(2)} ✎
              </button>
            )}
          </div>
        </div>
        <button onClick={onRemove} className="text-white/20 hover:text-danger transition-colors">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onDecrease}
            className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center active:scale-90 transition-all"
          >
            <Minus size={13} strokeWidth={2.5} />
          </button>
          <span className="text-white font-bold text-base w-8 text-center">{item.cantidad}</span>
          <button
            onClick={onIncrease}
            className="w-8 h-8 rounded-xl bg-brand/20 flex items-center justify-center active:scale-90 transition-all"
          >
            <Plus size={13} strokeWidth={2.5} className="text-brand-light" />
          </button>
        </div>
        <p className="text-white font-bold">L {(item.cantidad * item.precio_unitario).toFixed(2)}</p>
      </div>
    </div>
  )
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export function NuevaVenta({ onToast }: Props) {
  const {
    cart, total, saving,
    addToCart, updateCantidad, updatePrecio, removeFromCart, clearCart,
    confirmarVenta, searchProductos, getCachedPrice,
    getProductosFrecuentes, registrarMontoLibre,
  } = useVenta()

  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState<Producto[]>([])
  const [searching, setSearching]       = useState(false)
  const [showSuccess, setShowSuccess]   = useState(false)
  const [frecuentes, setFrecuentes]     = useState<Producto[]>([])
  const [showMontoLibre, setShowMontoLibre] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Load frequent products on mount
  useEffect(() => {
    getProductosFrecuentes().then(setFrecuentes)
  }, [getProductosFrecuentes])

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchProductos(q)
        setResults(res)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [searchProductos])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const handleConfirmar = async () => {
    if (cart.length === 0) return
    const ok = await confirmarVenta()
    if (ok) {
      setShowSuccess(true)
      setQuery('')
      setResults([])
      onToast('¡Venta registrada!', `L ${total.toFixed(2)} guardado correctamente`, 'success')
      // Refresh frecuentes after a sale
      setTimeout(() => {
        setShowSuccess(false)
        getProductosFrecuentes().then(setFrecuentes)
      }, 2500)
    } else {
      onToast('Error al guardar', 'Revisa tu conexión e intenta de nuevo', 'error')
    }
  }

  const handleMontoLibre = async (monto: number) => {
    const ok = await registrarMontoLibre(monto)
    if (ok) {
      setShowMontoLibre(false)
      setShowSuccess(true)
      onToast('¡Venta registrada!', `L ${monto.toFixed(2)} — monto libre`, 'success')
      setTimeout(() => setShowSuccess(false), 2500)
    } else {
      onToast('Error al guardar', 'Revisa tu conexión', 'error')
    }
  }

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 pt-20 animate-fade-in">
        <div className="w-24 h-24 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle size={48} className="text-success" />
        </div>
        <p className="text-white text-xl font-bold">¡Venta guardada!</p>
        <p className="text-white/40 text-sm">La base de datos fue actualizada</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">

      {/* Header */}
      <div className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Nueva venta</h2>
          <div className="flex items-center gap-2">
            {/* Monto Libre button */}
            <button
              onClick={() => setShowMontoLibre(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/30 text-accent text-xs font-semibold active:scale-95 transition-all"
            >
              <DollarSign size={13} strokeWidth={2.5} /> Monto libre
            </button>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-white/30 text-xs flex items-center gap-1 hover:text-danger transition-colors">
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Buscador */}
        <div className="relative max-w-xl">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="input-field pl-10"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3">

        {/* Acceso rápido — productos frecuentes */}
        {!query && frecuentes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-warning" />
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Acceso rápido</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-select">
              {frecuentes.map((p) => (
                <ProductoRapidoBtn
                  key={p.id}
                  producto={p}
                  cachedPrice={getCachedPrice(p.id)}
                  onAdd={(prod, price) => {
                    addToCart(prod, price)
                    onToast(`${prod.nombre} agregado`, undefined, 'success')
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Resultados de búsqueda */}
        {query.trim() && (
          <div className="space-y-2">
            {searching ? (
              <div className="text-center py-4 text-white/30 text-sm">Buscando...</div>
            ) : results.length === 0 ? (
              <div className="text-center py-4 text-white/30 text-sm">Sin resultados para "{query}"</div>
            ) : (
              <>
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
                  {results.length} resultados
                </p>
                {results.map((p) => (
                  <ProductSearchResult
                    key={p.id}
                    producto={p}
                    cachedPrice={getCachedPrice(p.id)}
                    onAdd={(prod, price) => {
                      addToCart(prod, price)
                      setQuery('')
                      setResults([])
                      onToast(`${prod.nombre} agregado`, undefined, 'success')
                    }}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Carrito */}
        {cart.length > 0 && !query && (
          <div className="space-y-2">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
              Carrito ({cart.length})
            </p>
            {cart.map((item) => (
              <CartItemRow
                key={item.producto.id}
                item={item}
                onIncrease={() => updateCantidad(item.producto.id, item.cantidad + 1)}
                onDecrease={() => updateCantidad(item.producto.id, item.cantidad - 1)}
                onRemove={() => removeFromCart(item.producto.id)}
                onPriceChange={(p) => updatePrecio(item.producto.id, p)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {cart.length === 0 && !query && (
          <div className="text-center py-12 space-y-3">
            <ShoppingCart size={40} className="text-white/10 mx-auto" />
            <p className="text-white/30 text-sm">Busca un producto o usa acceso rápido</p>
            {frecuentes.length === 0 && (
              <p className="text-white/20 text-xs">Los productos frecuentes aparecerán aquí tras las primeras ventas</p>
            )}
          </div>
        )}
      </div>

      {/* Total y confirmar */}
      {cart.length > 0 && (
        <div className="px-4 pt-3 pb-4 border-t border-white/[0.06]" style={{ background: 'rgba(7,7,20,0.95)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider">Total</p>
              <p className="text-3xl font-black text-white tracking-tight">L {total.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-1 text-white/30 text-xs">
              <AlertTriangle size={12} />
              <span>El stock se actualizará</span>
            </div>
          </div>
          <button
            onClick={handleConfirmar}
            disabled={saving}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${
              saving
                ? 'bg-brand/40 text-white/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-brand to-brand-dark text-white shadow-glow-brand'
            }`}
          >
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
              : <><CheckCircle size={18} /> Confirmar Venta</>
            }
          </button>
        </div>
      )}

      {/* Modal monto libre */}
      {showMontoLibre && (
        <MontoLibreModal
          onConfirm={handleMontoLibre}
          onClose={() => setShowMontoLibre(false)}
          saving={saving}
        />
      )}
    </div>
  )
}
