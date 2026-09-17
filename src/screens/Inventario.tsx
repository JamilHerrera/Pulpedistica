import { useState, useMemo, useRef } from 'react'
import { Search, Plus, Package, Check, X, ChevronDown, Tag, Info, Camera, Trash2 } from 'lucide-react'
import { useInventario } from '../hooks/useInventario'
import { usePerfil } from '../hooks/usePerfil'
import { SkeletonList } from '../components/ui/SkeletonCard'
import { FotoProducto } from '../components/ui/FotoProducto'
import { UNIDADES, UNIDADES_DISPONIBLES, formatearCantidad, redondearCantidad, reglaDe } from '../lib/unidades'
import type { Producto, UnidadMedida } from '../types'

interface Props {
  onToast: (title: string, msg?: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const STOCK_MIN = 5

function stockStatus(stock: number): { label: string; color: string; bar: string } {
  if (stock === 0)  return { label: 'Agotado', color: 'text-danger',  bar: 'bg-danger'  }
  if (stock <= 5)   return { label: 'Crítico', color: 'text-warning', bar: 'bg-warning' }
  if (stock <= 15)  return { label: 'Bajo',    color: 'text-yellow-400', bar: 'bg-yellow-400' }
  return             { label: 'OK',     color: 'text-success', bar: 'bg-success' }
}

function ProductoCard({
  producto, onUpdate, isUpdating, esAdmin, onFoto, onQuitarFoto, onUnidad,
}: Readonly<{
  producto: Producto
  onUpdate: (id: string, stock: number) => void
  isUpdating: boolean
  esAdmin: boolean
  onFoto: (p: Producto, archivo: File) => void
  onQuitarFoto: (p: Producto) => void
  onUnidad: (id: string, unidad: UnidadMedida) => void
}>) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(producto.stock_actual))
  const archivoRef = useRef<HTMLInputElement>(null)

  const status = stockStatus(producto.stock_actual)
  const max = Math.max(50, producto.stock_actual)
  const pct = Math.min(100, (producto.stock_actual / max) * 100)
  const { abreviatura } = reglaDe(producto.unidad)

  const handleSave = () => {
    // El stock se redondea según la unidad del producto: 2.5 libras de queso
    // es una existencia real, 2.5 cartones de huevos no.
    const n = redondearCantidad(Number.parseFloat(val.replace(',', '.')), producto.unidad)
    if (!Number.isFinite(n) || n < 0) return
    onUpdate(producto.id, n)
    setEditing(false)
  }

  return (
    <div className={`glass-card p-4 transition-all duration-200 ${isUpdating ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        {/* La foto es el botón de subirla: no hace falta otro control. */}
        <div className="relative shrink-0">
          <FotoProducto
            nombre={producto.nombre}
            url={producto.imagen_url}
            className="h-12 w-12 rounded-xl"
            iconSize={20}
          />
          {esAdmin && (
            <>
              <input
                ref={archivoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                // `capture` deja que el teléfono ofrezca la cámara directo.
                capture="environment"
                className="hidden"
                aria-label={`Foto de ${producto.nombre}`}
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) onFoto(producto, archivo)
                  // Se limpia para poder volver a elegir el MISMO archivo.
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => archivoRef.current?.click()}
                title={producto.imagen_url ? 'Cambiar la foto' : 'Agregar una foto'}
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-lg border border-white/15 bg-surface-elevated text-white/60 transition-all hover:text-white active:scale-90"
              >
                <Camera size={11} />
              </button>
            </>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{producto.nombre}</p>

          <div className="mt-0.5 flex items-center gap-2">
            {producto.categorias && (
              <span className="truncate text-xs text-white/30">{producto.categorias.nombre}</span>
            )}
            {esAdmin ? (
              <select
                value={producto.unidad ?? 'unidad'}
                onChange={(e) => onUnidad(producto.id, e.target.value as UnidadMedida)}
                aria-label={`Unidad de ${producto.nombre}`}
                className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/50 outline-none focus:border-brand/50"
              >
                {UNIDADES_DISPONIBLES.map((u) => (
                  <option key={u} value={u} className="bg-surface">{UNIDADES[u].etiqueta}</option>
                ))}
              </select>
            ) : (
              abreviatura && <span className="text-[10px] text-white/30">por {abreviatura}</span>
            )}
            {producto.imagen_url && esAdmin && (
              <button
                onClick={() => onQuitarFoto(producto)}
                title="Quitar la foto"
                className="text-white/20 transition-colors hover:text-danger"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className={`h-full rounded-full transition-all duration-700 ${status.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`shrink-0 text-xs font-bold ${status.color}`}>{status.label}</span>
          </div>
        </div>

        {editing ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              value={val}
              autoFocus
              aria-label={`Stock de ${producto.nombre}`}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              className="input-field h-8 w-16 py-1.5 text-center text-sm"
            />
            <button onClick={handleSave} aria-label="Guardar" className="flex h-8 w-8 items-center justify-center rounded-xl bg-success/20 text-success active:scale-90">
              <Check size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => { setEditing(false); setVal(String(producto.stock_actual)) }}
              aria-label="Cancelar"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-white/40 active:scale-90"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="group shrink-0 text-right">
            <p className="text-xl font-black leading-none text-white transition-colors group-hover:text-brand-light">
              {formatearCantidad(producto.stock_actual, producto.unidad)}
            </p>
            <p className="text-[10px] text-white/25">{abreviatura ? 'en existencia ✎' : 'unidades ✎'}</p>
          </button>
        )}
      </div>
    </div>
  )
}


function AddProductModal({
  categorias, onAdd, onAddCategoria, onClose,
}: Readonly<{
  categorias: { id: string; nombre: string }[]
  onAdd: (nombre: string, stock: number, catId: string, unidad: UnidadMedida) => Promise<boolean>
  onAddCategoria: (nombre: string) => Promise<string | null>
  onClose: () => void
}>) {
  const [tab, setTab] = useState<'producto' | 'categoria'>('producto')

  // Producto
  const [nombre, setNombre] = useState('')
  const [stock, setStock] = useState('0')
  const [unidad, setUnidad] = useState<UnidadMedida>('unidad')
  const [catId, setCatId] = useState(categorias[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  // Categoría nueva
  const [catNombre, setCatNombre] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const [catError, setCatError] = useState<string | null>(null)
  const [prodError, setProdError] = useState<string | null>(null)

  const handleSubmitProducto = async () => {
    if (!nombre.trim()) { setProdError('Escribe el nombre del producto'); return }
    if (!catId) { setTab('categoria'); return }
    setProdError(null)
    setSaving(true)
    const cantidad = redondearCantidad(Number.parseFloat(stock.replace(',', '.')) || 0, unidad)
    const ok = await onAdd(nombre.trim(), cantidad, catId, unidad)
    setSaving(false)
    if (ok) onClose()
    else setProdError('No se pudo guardar. Verifica tu conexión a Supabase.')
  }

  const handleSubmitCategoria = async () => {
    if (!catNombre.trim()) { setCatError('Escribe el nombre de la categoría'); return }
    setCatError(null)
    setSavingCat(true)
    const newId = await onAddCategoria(catNombre.trim())
    setSavingCat(false)
    if (newId) {
      setCatId(newId)
      setCatNombre('')
      setTab('producto')
    } else {
      setCatError('No se pudo crear. Verifica la conexión o los permisos de Supabase (RLS).')
    }
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
      <div
        className="relative w-full sm:max-w-lg glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">
            {tab === 'producto' ? 'Nuevo Producto' : 'Nueva Categoría'}
          </h2>
          <button onClick={onClose} className="text-white/30"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('producto')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'producto' ? 'bg-brand text-white' : 'bg-white/5 text-white/50 border border-white/8'
            }`}
          >
            <Plus size={12} /> Producto
          </button>
          <button
            onClick={() => setTab('categoria')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'categoria' ? 'bg-brand text-white' : 'bg-white/5 text-white/50 border border-white/8'
            }`}
          >
            <Tag size={12} /> Categoría
          </button>
        </div>

        {tab === 'producto' ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Nombre del producto</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Arroz 1 lb" className="input-field" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="stock-inicial" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Stock inicial</label>
                  <input id="stock-inicial" type="text" inputMode="decimal" value={stock}
                    onChange={(e) => setStock(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label htmlFor="unidad-producto" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Cómo se vende</label>
                  <div className="relative">
                    <select
                      id="unidad-producto"
                      value={unidad}
                      onChange={(e) => setUnidad(e.target.value as UnidadMedida)}
                      className="input-field appearance-none pr-8"
                    >
                      {UNIDADES_DISPONIBLES.map((u) => (
                        <option key={u} value={u} className="bg-surface">{UNIDADES[u].etiqueta}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  </div>
                </div>
              </div>
              {/* Lo que se pesa admite media libra; lo que se cuenta, no. */}
              <p className="text-white/25 text-[11px] -mt-1">
                {UNIDADES[unidad].fraccionable
                  ? 'Vas a poder cobrar media libra, un cuarto, o la cantidad que marque la balanza.'
                  : 'Solo se va a poder cobrar en cantidades enteras.'}
              </p>
              <div>
                <label className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Categoría</label>
                {categorias.length === 0 ? (
                  <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs flex items-center gap-2">
                    <Tag size={14} />
                    <span>No hay categorías. Crea una primero en la pestaña <strong>Categoría</strong>.</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={catId}
                      onChange={(e) => setCatId(e.target.value)}
                      className="input-field appearance-none pr-8"
                    >
                      <option value="">— Selecciona una categoría —</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  </div>
                )}
              </div>
            </div>
            {prodError && (
              <div className="px-3 py-2 rounded-xl bg-danger/15 border border-danger/25 text-danger text-xs">
                ⚠️ {prodError}
              </div>
            )}
            <button
              onClick={handleSubmitProducto}
              disabled={saving}
              className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                saving
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-gradient-to-r from-brand to-brand-dark text-white shadow-glow-brand'
              }`}
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={16} />}
              Guardar producto
            </button>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Nombre de la categoría</label>
                <input
                  value={catNombre}
                  onChange={(e) => { setCatNombre(e.target.value); setCatError(null) }}
                  placeholder="Ej: Granos básicos"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-brand/10 border border-brand/20">
                <Info size={14} className="text-brand-light shrink-0 mt-0.5" />
                <p className="text-white/50 text-xs leading-relaxed">
                  La rotación se calcula <strong className="text-white/70">automáticamente</strong> según las ventas reales. El Semáforo clasifica cada producto en tiempo real.
                </p>
              </div>
            </div>
            {catError && (
              <div className="px-3 py-2 rounded-xl bg-danger/15 border border-danger/25 text-danger text-xs">
                ⚠️ {catError}
              </div>
            )}
            <button
              onClick={handleSubmitCategoria}
              disabled={savingCat}
              className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                savingCat
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-gradient-to-r from-accent to-brand text-white'
              }`}
            >
              {savingCat ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Tag size={16} />}
              Crear categoría
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function Inventario({ onToast }: Readonly<Props>) {
  const {
    productos, categorias, loading, error, updatingId,
    actualizarStock, cambiarUnidad, subirFoto, quitarFoto,
    agregarProducto, agregarCategoria, refetch,
  } = useInventario()
  // Editar el catalogo es del admin: las politicas lo exigen del lado del servidor.
  const { esAdmin } = usePerfil()
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState<string>('todos')
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const filtered = useMemo(() => {
    return productos.filter((p) => {
      const matchQ = !query || p.nombre.toLowerCase().includes(query.toLowerCase())
      const matchCat = catFilter === 'todos' || p.categoria_id === catFilter
      const matchAlert = !soloAlertas || p.stock_actual <= STOCK_MIN
      return matchQ && matchCat && matchAlert
    })
  }, [productos, query, catFilter, soloAlertas])

  const criticalCount = productos.filter((p) => p.stock_actual <= STOCK_MIN).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Inventario</h2>
          <p className="text-white/40 text-sm mt-0.5">{productos.length} productos totales</p>
        </div>
        {esAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all shadow-glow-brand"
          >
            <Plus size={16} strokeWidth={2.5} /> Agregar
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative max-w-xl">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto..." className="input-field pl-10"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-select">
        <button
          onClick={() => setSoloAlertas(!soloAlertas)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            soloAlertas ? 'bg-danger text-white' : 'bg-white/5 text-white/50 border border-white/8'
          }`}
        >
          🚨 Alertas ({criticalCount})
        </button>
        <button
          onClick={() => setCatFilter('todos')}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            catFilter === 'todos' ? 'bg-brand text-white' : 'bg-white/5 text-white/50 border border-white/8'
          }`}
        >
          Todos
        </button>
        {categorias.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatFilter(catFilter === c.id ? 'todos' : c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              catFilter === c.id ? 'bg-brand text-white' : 'bg-white/5 text-white/50 border border-white/8'
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* Lista */}
      {error ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-white/40 text-sm">{error}</p>
          <button onClick={refetch} className="btn-ghost text-sm">Reintentar</button>
        </div>
      ) : loading ? (
        <SkeletonList rows={6} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={36} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No se encontraron productos</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProductoCard
              key={p.id}
              producto={p}
              isUpdating={updatingId === p.id}
              esAdmin={esAdmin}
              onUpdate={async (id, stock) => {
                const ok = await actualizarStock(id, stock)
                if (ok) onToast('Stock actualizado', `${p.nombre}: ${formatearCantidad(stock, p.unidad)}`, 'success')
                else onToast('Error al actualizar', undefined, 'error')
              }}
              onUnidad={async (id, unidad) => {
                const ok = await cambiarUnidad(id, unidad)
                if (ok) onToast('Unidad actualizada', `${p.nombre}: ${UNIDADES[unidad].etiqueta.toLowerCase()}`, 'success')
                else onToast('No se pudo cambiar la unidad', undefined, 'error')
              }}
              onFoto={async (prod, archivo) => {
                onToast('Subiendo la foto…', prod.nombre, 'info')
                const problema = await subirFoto(prod, archivo)
                if (problema) onToast('No se pudo subir', problema, 'error')
                else onToast('Foto lista', prod.nombre, 'success')
              }}
              onQuitarFoto={async (prod) => {
                const ok = await quitarFoto(prod)
                if (ok) onToast('Foto quitada', prod.nombre, 'success')
                else onToast('No se pudo quitar la foto', undefined, 'error')
              }}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddProductModal
          categorias={categorias}
          onClose={() => setShowAdd(false)}
          onAdd={async (nombre, stock, catId, unidad) => {
            const ok = await agregarProducto(nombre, stock, catId, unidad)
            if (ok) onToast('Producto agregado', nombre, 'success')
            else onToast('Error al agregar', undefined, 'error')
            return ok
          }}
          onAddCategoria={async (nombre) => {
            const id = await agregarCategoria(nombre)
            if (id) onToast('Categoría creada', nombre, 'success')
            else onToast('Error al crear categoría', undefined, 'error')
            return id
          }}
        />
      )}
    </div>
  )
}
