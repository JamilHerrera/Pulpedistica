import { useState, useMemo, useRef } from 'react'
import { Search, Plus, Package, Check, X, ChevronDown, Tag, Info, Camera, Trash2, Pencil } from 'lucide-react'
import { useInventario } from '../hooks/useInventario'
import { usePerfil } from '../hooks/usePerfil'
import { SkeletonList } from '../components/ui/SkeletonCard'
import { FotoProducto } from '../components/ui/FotoProducto'
import { UNIDADES, UNIDADES_DISPONIBLES, formatearCantidad, redondearCantidad, reglaDe } from '../lib/unidades'
import {
  validarProducto, nombreRepetido, cambiosDeProducto, erroresDe, NOMBRE_MAX,
  type ValoresProducto, type ErroresProducto,
} from '../lib/producto'
import type { Producto, UnidadMedida } from '../types'

interface Props {
  onToast: (title: string, msg?: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const STOCK_MIN = 5

/**
 * Enfoca el campo apenas aparece.
 *
 * Reemplaza a `autoFocus`, que está desaconsejado porque roba el foco al
 * cargar una página. Acá el campo aparece dentro de un modal que la persona
 * acaba de abrir a propósito, así que enfocarlo es lo que espera: es la
 * diferencia entre escribir de una o tener que tocar el campo primero, con la
 * fila esperando. Al ser una referencia estable, React la invoca una sola vez.
 */
const enfocarAlAparecer = (el: HTMLInputElement | null) => el?.focus()

function stockStatus(stock: number): { label: string; color: string; bar: string } {
  if (stock === 0)  return { label: 'Agotado', color: 'text-danger',  bar: 'bg-danger'  }
  if (stock <= 5)   return { label: 'Crítico', color: 'text-warning', bar: 'bg-warning' }
  if (stock <= 15)  return { label: 'Bajo',    color: 'text-yellow-400', bar: 'bg-yellow-400' }
  return             { label: 'OK',     color: 'text-success', bar: 'bg-success' }
}

/**
 * La tarjeta de un producto en el inventario.
 *
 * Lo único que se cambia acá es la existencia, tocando el número. Es lo que se
 * corrige a diario cuando entra o sale mercadería, y merece estar a un toque.
 * Los datos del catálogo —nombre, foto, precio, categoría y cómo se vende— se
 * editan en la ficha, que se abre con el botón Editar: se tocan pocas veces y
 * tenerlos acá llenaba la tarjeta de controles.
 */
function ProductoCard({
  producto, onUpdate, isUpdating, esAdmin, onEditar,
}: Readonly<{
  producto: Producto
  onUpdate: (id: string, stock: number) => void
  isUpdating: boolean
  esAdmin: boolean
  onEditar: (p: Producto) => void
}>) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(producto.stock_actual))

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
        <FotoProducto
          nombre={producto.nombre}
          url={producto.imagen_url}
          className="h-12 w-12 shrink-0 rounded-xl"
          iconSize={20}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{producto.nombre}</p>

          <div className="mt-0.5 flex items-center gap-2">
            {producto.categorias && (
              <span className="truncate text-xs text-white/30">{producto.categorias.nombre}</span>
            )}
            {abreviatura && <span className="text-[10px] text-white/30">por {abreviatura}</span>}
            {producto.precio !== null && producto.precio !== undefined && (
              <span className="text-[10px] font-medium text-brand-light">
                L {Number(producto.precio).toFixed(2)}{abreviatura && `/${abreviatura}`}
              </span>
            )}
            {esAdmin && (
              <button
                onClick={() => onEditar(producto)}
                title={`Editar ${producto.nombre}`}
                className="flex items-center gap-1 text-[10px] font-medium text-white/40 transition-colors hover:text-brand-light"
              >
                <Pencil size={10} /> Editar
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
              ref={enfocarAlAparecer}
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


/**
 * Ficha de edición de un producto.
 *
 * Están los datos del catálogo: nombre, foto, precio, categoría y cómo se
 * vende. La existencia no, y no es un olvido: se corrige en la tarjeta, de a un
 * toque, porque cambia cada vez que entra o sale mercadería.
 *
 * `id` y `negocio_id` tampoco están: mover un producto de negocio rompería el
 * historial de ventas y el aislamiento entre pulperías. Borrar no se ofrece
 * acá, porque un producto con ventas no se puede borrar sin dejar el historial
 * sin referencia — la base misma lo impide.
 *
 * Renombrar y cambiar el precio SÍ son seguros: las ventas pasadas apuntan al
 * identificador y guardan su propio subtotal, así que nada de lo ya cobrado
 * cambia de monto al corregir el catálogo.
 */
function EditarProductoModal({
  producto, categorias, productos, onGuardar, onFoto, onQuitarFoto, onClose,
}: Readonly<{
  producto: Producto
  categorias: { id: string; nombre: string }[]
  productos: Producto[]
  onGuardar: (cambios: Partial<ValoresProducto>) => Promise<string | null>
  onFoto: (archivo: File) => Promise<string | null>
  onQuitarFoto: () => Promise<string | null>
  onClose: () => void
}>) {
  const [nombre, setNombre] = useState(producto.nombre)
  const [precio, setPrecio] = useState(
    producto.precio === null || producto.precio === undefined ? '' : String(producto.precio),
  )
  const [unidad, setUnidad] = useState<UnidadMedida>(producto.unidad ?? 'unidad')
  const [catId, setCatId] = useState(producto.categoria_id ?? '')
  const [fallo, setFallo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [foto, setFoto] = useState<'quieta' | 'trabajando'>('quieta')
  const archivoRef = useRef<HTMLInputElement>(null)

  const original: ValoresProducto = {
    nombre: producto.nombre,
    precio: producto.precio === null || producto.precio === undefined ? null : Number(producto.precio),
    unidad: producto.unidad ?? 'unidad',
    categoria_id: producto.categoria_id ?? null,
  }

  const validacion = validarProducto({ nombre, precio, unidad, categoria_id: catId })
  const repetido = nombreRepetido(nombre, productos, producto.id)
  const cambios = validacion.ok ? cambiosDeProducto(original, validacion.valores) : {}
  const hayCambios = Object.keys(cambios).length > 0

  /**
   * Los avisos se muestran mientras se escribe, no al apretar Guardar.
   *
   * Guardar está deshabilitado justamente cuando hay algo mal, así que pedirle
   * un clic para enterarse de qué está mal dejaba el botón muerto y sin
   * explicación. La ficha abre con los valores que ya están guardados, que son
   * válidos: si algo no pasa la validación es porque se acabó de escribir.
   */
  const errores: ErroresProducto = erroresDe(validacion)
  const puedeGuardar = validacion.ok && !repetido && hayCambios && !guardando

  /**
   * ¿Pasar a "por unidad" deja una existencia que no se puede contar?
   *
   * Cambiar cómo se vende no toca la existencia guardada: si hay 2.5 libras,
   * siguen siendo 2.5 hasta que alguien las corrija. Truncarlas acá haría
   * desaparecer media libra real sin que nadie lo pidiera. Lo que sí se puede
   * hacer es avisar, para que no quede un "2.5 unidades" que nadie entiende.
   */
  const existenciaQuedaRara =
    unidad === 'unidad' && !Number.isInteger(producto.stock_actual)

  const guardar = async () => {
    if (!puedeGuardar) return

    setFallo(null)
    setGuardando(true)
    const problema = await onGuardar(cambios)
    setGuardando(false)
    if (problema) setFallo(problema)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full sm:max-w-lg glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FotoProducto nombre={producto.nombre} url={producto.imagen_url} className="h-11 w-11 rounded-xl shrink-0" iconSize={18} />
            <div className="min-w-0">
              <h2 className="text-white font-bold text-base leading-tight truncate">Editar producto</h2>
              <p className="text-white/35 text-xs truncate">{producto.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-white/30 shrink-0"><X size={20} /></button>
        </div>

        {/* La foto se aplica al instante: subir un archivo es su propia
            operación contra el almacenamiento, no una columna que pueda viajar
            con el resto de los campos al apretar Guardar. */}
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
          <FotoProducto nombre={producto.nombre} url={producto.imagen_url} className="h-16 w-16 rounded-xl shrink-0" iconSize={24} />
          <div className="min-w-0 flex-1">
            <input
              ref={archivoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              // `capture` deja que el teléfono ofrezca la cámara directo.
              capture="environment"
              className="hidden"
              aria-label={`Foto de ${producto.nombre}`}
              onChange={async (e) => {
                const archivo = e.target.files?.[0]
                // Se limpia para poder volver a elegir el MISMO archivo.
                e.target.value = ''
                if (!archivo) return
                setFallo(null)
                setFoto('trabajando')
                const problema = await onFoto(archivo)
                setFoto('quieta')
                if (problema) setFallo(problema)
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => archivoRef.current?.click()}
                disabled={foto === 'trabajando'}
                className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 transition-colors hover:text-white disabled:opacity-40"
              >
                <Camera size={13} /> {producto.imagen_url ? 'Cambiar foto' : 'Agregar foto'}
              </button>
              {producto.imagen_url && (
                <button
                  onClick={async () => {
                    setFallo(null)
                    setFoto('trabajando')
                    const problema = await onQuitarFoto()
                    setFoto('quieta')
                    if (problema) setFallo(problema)
                  }}
                  disabled={foto === 'trabajando'}
                  className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-bold text-white/35 transition-colors hover:text-danger disabled:opacity-40"
                >
                  <Trash2 size={13} /> Quitar
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-white/25">
              {foto === 'trabajando' ? 'Trabajando con la foto…' : 'La foto se guarda sola, al elegirla.'}
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="editar-nombre" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Nombre</label>
          <input
            id="editar-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={NOMBRE_MAX}
            className="input-field"
            ref={enfocarAlAparecer}
          />
          {errores.nombre && <p className="mt-1.5 text-xs text-danger">{errores.nombre}</p>}
          {repetido && <p className="mt-1.5 text-xs text-danger">Ya tenés otro producto con ese nombre.</p>}
        </div>

        <div>
          <label htmlFor="editar-unidad" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Cómo se vende</label>
          <div className="relative">
            <select
              id="editar-unidad"
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
          {existenciaQuedaRara && (
            <p className="mt-1.5 text-[11px] text-yellow-400/80">
              Hay {formatearCantidad(producto.stock_actual, 'libra')} en existencia. Vendiéndose de a uno
              vas a querer corregir ese número en la tarjeta; desde acá no se toca.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="editar-precio" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">
            Precio {UNIDADES[unidad].abreviatura && `por ${UNIDADES[unidad].abreviatura}`}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">L</span>
            <input
              id="editar-precio"
              type="text"
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="Sin precio"
              className="input-field pl-8"
            />
          </div>
          {errores.precio && <p className="mt-1.5 text-xs text-danger">{errores.precio}</p>}
          {/* Cambiar el precio no toca lo ya cobrado: cada venta guardó el suyo. */}
          <p className="mt-1.5 text-white/25 text-[11px]">
            Se usa en las ventas nuevas. Las ventas ya registradas conservan el precio con el que se cobraron.
          </p>
        </div>

        <div>
          <label htmlFor="editar-categoria" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Categoría</label>
          <div className="relative">
            <select
              id="editar-categoria"
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="input-field appearance-none pr-8"
            >
              <option value="" className="bg-surface">— Sin categoría —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id} className="bg-surface">{c.nombre}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        </div>

        {fallo && (
          <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{fallo}</p>
        )}

        {validacion.ok && !repetido && !hayCambios && (
          <p className="text-center text-[11px] text-white/25">Todavía no cambiaste nada.</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-bold bg-white/5 text-white/60 active:scale-95 transition-all">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            className={`flex-[2] py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
              puedeGuardar
                ? 'bg-gradient-to-r from-brand to-brand-dark text-white'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {guardando
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando…</>
              : <><Check size={16} /> Guardar cambios</>}
          </button>
        </div>
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
                <label htmlFor="nombre-producto" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Nombre del producto</label>
                <input id="nombre-producto" value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Arroz 1 lb" className="input-field" ref={enfocarAlAparecer} />
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
                <label htmlFor="categoria-producto" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Categoría</label>
                {categorias.length === 0 ? (
                  <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs flex items-center gap-2">
                    <Tag size={14} />
                    <span>No hay categorías. Crea una primero en la pestaña <strong>Categoría</strong>.</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      id="categoria-producto"
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
                <label htmlFor="nombre-categoria" className="text-white/40 text-xs uppercase tracking-wider mb-1.5 block">Nombre de la categoría</label>
                <input
                  id="nombre-categoria"
                  value={catNombre}
                  onChange={(e) => { setCatNombre(e.target.value); setCatError(null) }}
                  placeholder="Ej: Granos básicos"
                  className="input-field"
                  ref={enfocarAlAparecer}
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
    actualizarStock, editarProducto, subirFoto, quitarFoto,
    agregarProducto, agregarCategoria, refetch,
  } = useInventario()
  const [editandoId, setEditandoId] = useState<string | null>(null)
  // Editar el catalogo es del admin: las politicas lo exigen del lado del servidor.
  const { esAdmin } = usePerfil()
  const [query, setQuery] = useState('')

  // La ficha se lee de la lista viva, no de una copia: así al cambiar la foto
  // la vista previa se actualiza en el momento.
  const editando = editandoId === null ? null : productos.find((p) => p.id === editandoId) ?? null
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
      {error && (
        <div className="text-center py-12 space-y-3">
          <p className="text-white/40 text-sm">{error}</p>
          <button onClick={refetch} className="btn-ghost text-sm">Reintentar</button>
        </div>
      )}
      {!error && loading && (
        <SkeletonList rows={6} />
      )}
      {!error && !loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Package size={36} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No se encontraron productos</p>
        </div>
      )}
      {!error && !loading && filtered.length > 0 && (
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
              onEditar={(prod) => setEditandoId(prod.id)}
            />
          ))}
        </div>
      )}

      {editando && (
        <EditarProductoModal
          producto={editando}
          categorias={categorias}
          productos={productos}
          onClose={() => setEditandoId(null)}
          onGuardar={async (cambios) => {
            const problema = await editarProducto(editando.id, cambios)
            if (!problema) onToast('Producto actualizado', editando.nombre, 'success')
            return problema
          }}
          onFoto={async (archivo) => {
            const problema = await subirFoto(editando, archivo)
            if (!problema) onToast('Foto lista', editando.nombre, 'success')
            return problema
          }}
          onQuitarFoto={async () => {
            const ok = await quitarFoto(editando)
            if (ok) onToast('Foto quitada', editando.nombre, 'success')
            return ok ? null : 'No se pudo quitar la foto.'
          }}
        />
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
