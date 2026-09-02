import { supabase } from './supabase'

const CACHE_KEY = 'pulpe_precios'
const FLAG_KEY  = 'pulpe_precios_migrados'

/**
 * Sube a la base los precios que quedaron guardados en el navegador.
 *
 * Hasta ahora el precio de cada producto vivía solo en localStorage, así que
 * se perdía al limpiar los datos del sitio y no existía en otro dispositivo.
 * Esta migración corre una vez por navegador y solo COMPLETA los productos
 * que todavía no tienen precio en la base: nunca pisa uno ya guardado, para
 * que un cache viejo no revierta un precio corregido desde otro lado.
 *
 * Debe ejecutarse con sesión iniciada, porque las políticas RLS solo permiten
 * escribir a usuarios autenticados.
 */
export async function migrarPreciosLocales(): Promise<void> {
  try {
    if (localStorage.getItem(FLAG_KEY) === '1') return

    let cache: Record<string, number> = {}
    try {
      cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    } catch {
      // Cache ilegible: no hay nada que migrar.
    }

    const ids = Object.keys(cache).filter((id) => Number(cache[id]) > 0)
    if (ids.length === 0) {
      localStorage.setItem(FLAG_KEY, '1')
      return
    }

    const { data, error } = await supabase
      .from('productos')
      .select('id, precio')
      .in('id', ids)

    // Si falla (red, permisos), no se marca como hecha: se reintenta luego.
    if (error) return

    const pendientes = (data ?? []).filter((p) => p.precio == null)

    for (const p of pendientes) {
      const { error: updErr } = await supabase
        .from('productos')
        .update({ precio: cache[p.id] })
        .eq('id', p.id)
      if (updErr) return // se reintenta en la próxima sesión
    }

    localStorage.setItem(FLAG_KEY, '1')
    if (pendientes.length > 0) {
      console.info(`[precios] migrados ${pendientes.length} precio(s) del navegador a la base.`)
    }
  } catch (e) {
    console.error('Error migrando los precios locales:', e)
  }
}
