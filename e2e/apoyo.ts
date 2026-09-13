import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

/**
 * Lo compartido por las pruebas de extremo a extremo.
 *
 * Estas pruebas hablan con la base REAL, no con un simulacro. Es a propósito:
 * los tres errores más caros de este proyecto —el esquema que no coincidía, la
 * base abierta a internet y la pantalla en blanco por una variable faltante—
 * habrían pasado limpios contra cualquier simulacro. El precio es que hay que
 * marcar y borrar todo lo que se crea, y de eso se encargan `MARCA` y
 * `borrarRastro()`.
 */

/**
 * Prefijo que lleva todo lo que estas pruebas crean.
 *
 * Es lo que hace que la limpieza sea segura: se borra por este marcador, nunca
 * "todos los tickets", así que un descuido no puede vaciar datos de verdad.
 */
export const MARCA = 'E2E_PRUEBA'

export const CUENTA = {
  correo: 'admin@jamilherreravargas.com',
  clave: '1234',
}

/**
 * Lee las credenciales del `.env` del proyecto.
 *
 * A mano y no con una librería: es un archivo de dos líneas y agregar una
 * dependencia para leerlo no se justifica.
 */
function leerEnv(): { url: string; anon: string } {
  const ruta = fileURLToPath(new URL('../.env', import.meta.url))
  const texto = readFileSync(ruta, 'utf8')
  const valor = (clave: string) =>
    texto.split('\n').find((l) => l.startsWith(`${clave}=`))?.slice(clave.length + 1).trim() ?? ''

  const url = valor('VITE_SUPABASE_URL')
  const anon = valor('VITE_SUPABASE_ANON_KEY')
  if (!url || !anon) {
    throw new Error('Falta .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
  }
  return { url, anon }
}

const { url: SUPABASE_URL, anon: ANON } = leerEnv()

let tokenCache: string | null = null

/** Sesión de soporte, para mirar y limpiar la tabla de tickets por fuera. */
async function tokenDeSoporte(): Promise<string> {
  if (tokenCache) return tokenCache

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CUENTA.correo, password: CUENTA.clave }),
  })
  const datos = await res.json()
  if (!datos.access_token) {
    throw new Error(`No se pudo iniciar sesión de soporte: ${JSON.stringify(datos)}`)
  }
  tokenCache = datos.access_token as string
  return tokenCache
}

async function api(ruta: string, init: RequestInit = {}): Promise<Response> {
  const token = await tokenDeSoporte()
  return await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

export interface TicketGuardado {
  id: string
  huella: string
  titulo: string
  origen: string
  detalle: string | null
  pantalla: string | null
  ruta: string | null
  estado: string
  veces: number
}

/** Los tickets que dejó esta corrida, mirando la base por fuera de la app. */
export async function ticketsDePrueba(): Promise<TicketGuardado[]> {
  const res = await api(`tickets?select=*&titulo=like.*${MARCA}*&order=ultima_vez.desc`)
  return await res.json()
}

/**
 * Espera a que el ticket aparezca en la base.
 *
 * Hace falta esperar porque el envío es una promesa suelta: la app sigue
 * andando sin aguardar a que el ticket se cree, que es justo lo que se quiere.
 */
export async function esperarTicket(
  contiene: string,
  intentos = 20,
): Promise<TicketGuardado | null> {
  for (let i = 0; i < intentos; i++) {
    const encontrado = (await ticketsDePrueba()).find((t) => t.titulo.includes(contiene))
    if (encontrado) return encontrado
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

/** Borra todo lo que crearon las pruebas. Se llama al terminar la corrida. */
export async function borrarRastro(): Promise<number> {
  const res = await api(`tickets?titulo=like.*${MARCA}*`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  const borrados = await res.json()
  return Array.isArray(borrados) ? borrados.length : 0
}

/**
 * Abre el login sin sesión y en modo "entrar".
 *
 * Las dos partes importan. Si queda una sesión de la prueba anterior, la
 * pantalla muestra "ya estás dentro" en vez del formulario. Y al cerrar sesión
 * el formulario queda en modo CREAR CUENTA, así que enviarlo ahí intentaría
 * registrar en vez de entrar: con un correo que ya existe eso devuelve un
 * mensaje de éxito, no de error, y la prueba se vuelve loca buscando el error
 * que nunca aparece. Se deja el estado explícito en vez de suponerlo.
 */
export async function irALoginLimpio(page: Page): Promise<void> {
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.context().clearCookies()
  await page.goto('/login')

  await page.locator('#bloque-acceso').waitFor({ state: 'visible' })
  await page.locator('#tab-entrar').click()
}

/**
 * Entra al panel por el formulario de verdad, no metiendo la sesión a mano.
 *
 * Escribir el token directo en localStorage sería más rápido, pero saltearía
 * lo que se quiere comprobar: que el login real funcione y que deje la cookie
 * que el middleware necesita.
 */
export async function entrarAlPanel(page: Page): Promise<void> {
  await irALoginLimpio(page)

  await page.locator('#email').fill(CUENTA.correo)
  await page.locator('#password').fill(CUENTA.clave)
  await page.locator('#login-submit').click()

  await page.waitForURL('**/admin**')
  await page.getByRole('heading', { name: 'Inicio' }).waitFor()
}

/** Provoca un error de verdad dentro de la página y espera a que se reporte. */
export async function provocarError(
  page: Page,
  disparar: () => Promise<void>,
): Promise<void> {
  const enviado = page.waitForResponse(
    (r) => r.url().includes('/rpc/reportar_error'),
    { timeout: 15_000 },
  )
  await disparar()
  await enviado
}
