import { supabase } from './supabase'

/** Postgres: violación de restricción única. */
const VIOLACION_UNICA = '23505'

/** Clave nueva para una operación que mueve dinero. */
export function nuevaClave(): string {
  return crypto.randomUUID()
}

/**
 * Inserta una fila con clave de idempotencia.
 *
 * Si la clave ya fue usada —el usuario tocó dos veces, o el navegador
 * reintentó tras un corte— la base rechaza el duplicado por el índice único
 * y acá se recupera la fila original en vez de crear otra. Para quien llama,
 * el resultado es el mismo que si hubiera insertado.
 */
export async function insertarIdempotente<T>(
  tabla: string,
  fila: Record<string, unknown>,
  clave: string,
): Promise<{ fila: T; yaExistia: boolean }> {
  const { data, error } = await supabase
    .from(tabla)
    .insert({ ...fila, idempotency_key: clave })
    .select()
    .single()

  if (!error) return { fila: data as T, yaExistia: false }
  if (error.code !== VIOLACION_UNICA) throw error

  const { data: existente, error: errorLectura } = await supabase
    .from(tabla)
    .select()
    .eq('idempotency_key', clave)
    .single()

  if (errorLectura) throw errorLectura
  return { fila: existente as T, yaExistia: true }
}
