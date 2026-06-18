import { useState, useMemo } from 'react'
import { Search, Plus, Package, Check, X, ChevronDown, Tag } from 'lucide-react'
import { useInventario } from '../hooks/useInventario'
import { SkeletonList } from '../components/ui/SkeletonCard'
import type { Producto } from '../types'

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
  producto, onUpdate, isUpdating,
}: { producto: Producto; onUpdate: (id: string, stock: number) => void; isUpdating: boolean }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(producto.stock_actual.toString())
  const status = stockStatus(producto.stock_actual)
  const max = Math.max(50, producto.stock_actual)
  const pct = Math.min(100, (producto.stock_actual / max) * 100)

  const handleSave = () => {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 0) return
    onUpdate(producto.id, n)
    setEditing(false)
  }

  return (
    <div className={`glass-card p-4 transition-all duration-200 ${isUpdating ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center shrink-0">
          <Package size={18} className={status.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{producto.nombre}</p>
          {producto.categorias && (
            <p className="text-white/30 text-xs mt-0.5">{producto.categorias.nombre}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${status.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-xs font-bold shrink-0 ${status.color}`}>{status.label}</span>
          </div>
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              value={val}
              autoFocus
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              className="w-16 input-field text-center py-1.5 text-sm h-8"
              min="0"
            />
            <button onClick={handleSave} className="w-8 h-8 rounded-xl bg-success/20 text-success flex items-center justify-center active:scale-90">
              <Check size={14} strokeWidth={2.5} />
            </button>
            <button onClick={() => { setEditing(false); setVal(producto.stock_actual.toString()) }}
              className="w-8 h-8 rounded-xl bg-white/5 text-white/40 flex items-center justify-center active:scale-90">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 text-right group"
          >
            <p className="text-white font-black text-xl leading-none group-hover:text-brand-light transition-colors">
              {producto.stock_actual}
            </p>
            <p className="text-white/25 text-[10px]">unidades ✎</p>
          </button>
        )}
      </div>
    </div>
  )
}

const COLORES_SEMAFORO = [
  { value: 'verde',    label: '🟢 Verde — Alta rotación'   },
  { value: 'amarillo', label: '🟡 Amarillo — Rotación media' },
  { value: 'rojo',     label: '🔴 Rojo — Baja rotación'    },
  { value: 'azul',     label: '🔵 Azul — Especiales'       },
]

function AddProductModal({
  categorias, onAdd, onAddCategoria, onClose,
}: {
  categorias: { id: string; nombre: string }[]
  onAdd: (nombre: string, stock: number, catId: string) => Promise<boolean>
  onAddCategoria: (nombre: string, color: string) => Promise<string | null>
  onClose: () => void
}) {
  const [tab, setTab] = useState<'producto' | 'categoria'>('producto')

  // Producto
  const [nombre, setNombre] = useState('')
  const [stock, setStock] = useState('0')
  const [catId, setCatId] = useState(categorias[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  // Categoría nueva
  const [catNombre, setCatNombre] = useState('')
  const [catColor, setCatColor] = useState('verde')
  const [savingCat, setSavingCat] = useState(false)

  const handleSubmitProducto = async () => {
    if (!nombre.trim()) return
    if (!catId) { setTab('categoria'); return }
    setSaving(true)
    const ok = await onAdd(nombre.trim(), parseInt(stock, 10) || 0, catId)
    setSaving(false)
    if (ok) onClose()
  }

  const handleSubmitCategoria = async () => {
    if (!catNombre.trim()) return
    setSavingCat(true)
    const newId = await onAddCategoria(catNombre.trim(), catColor)
    setSavingCat(false)
    if (newId) {
      setCatId(newId)
      setCatNombre('')
      setTab('producto')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:absolute" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[390px] glass-card rounded-t-3xl p-5 pb-8 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
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
              <div>
                <label className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Stock inicial</label>
                <input type="number" value={stock} onChange={(e) => setStock(e.target.value)}
                  className="input-field" min="0" />
              </div>
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
            <button
              onClick={handleSubmitProducto}
              disabled={saving || !nombre.trim() || !catId}
              className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                saving || !nombre.trim() || !catId
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
                <input value={catNombre} onChange={(e) => setCatNombre(e.target.value)}
                  placeholder="Ej: Granos básicos" className="input-field" autoFocus />
              </div>
              <div>
                <label className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Color semáforo</label>
                <div className="relative">
                  <select value={catColor} onChange={(e) => setCatColor(e.target.value)}
                    className="input-field appearance-none pr-8">
                    {COLORES_SEMAFORO.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              </div>
            </div>
            <button
              onClick={handleSubmitCategoria}
              disabled={savingCat || !catNombre.trim()}
              className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                savingCat || !catNombre.trim()
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

export function Inventario({ onToast }: Props) {
  const { productos, categorias, loading, error, updatingId, actualizarStock, agregarProducto, agregarCategoria, refetch } = useInventario()
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
    <div className="px-4 pb-36 pt-16 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventario</h1>
          <p className="text-white/40 text-sm mt-0.5">{productos.length} productos totales</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all shadow-glow-brand"
        >
          <Plus size={16} strokeWidth={2.5} /> Agregar
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
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
        <div className="space-y-2">
          {filtered.map((p) => (
            <ProductoCard
              key={p.id}
              producto={p}
              isUpdating={updatingId === p.id}
              onUpdate={async (id, stock) => {
                const ok = await actualizarStock(id, stock)
                if (ok) onToast('Stock actualizado', `${p.nombre}: ${stock} unidades`, 'success')
                else onToast('Error al actualizar', undefined, 'error')
              }}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddProductModal
          categorias={categorias}
          onClose={() => setShowAdd(false)}
          onAdd={async (nombre, stock, catId) => {
            const ok = await agregarProducto(nombre, stock, catId)
            if (ok) onToast('Producto agregado', nombre, 'success')
            else onToast('Error al agregar', undefined, 'error')
            return ok
          }}
          onAddCategoria={async (nombre, color) => {
            const id = await agregarCategoria(nombre, color)
            if (id) onToast('Categoría creada', nombre, 'success')
            else onToast('Error al crear categoría', undefined, 'error')
            return id
          }}
        />
      )}
    </div>
  )
}
