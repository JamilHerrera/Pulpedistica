/**
 * La política de seguridad de contenido del sitio, en forma consultable.
 *
 * Existe por un fallo concreto: al agregar las fotos de producto, la foto se
 * subía bien y la dirección devolvía 200, pero el navegador la bloqueaba
 * porque `img-src` solo permitía el propio dominio. No hubo error visible —la
 * app cae a un marcador de color cuando una imagen no carga— así que el
 * síntoma fue "subí la foto y no se ve", sin nada en la consola que lo
 * explicara.
 *
 * Esa es la trampa de la CSP: agregar una función que carga algo de un origen
 * nuevo falla en silencio hasta que alguien mira la pestaña de red. Con esto,
 * una prueba puede afirmar qué necesita la app y romperse en el pipeline en
 * vez de en la pulpería.
 */

/** Directivas de una CSP, ya partidas en sus valores. */
export type Directivas = Record<string, string[]>

/**
 * Parte una cabecera CSP. Tolera espacios de más y el punto y coma final,
 * que es como suelen quedar escritas a mano.
 */
export function parsearCSP(cabecera: string): Directivas {
  const directivas: Directivas = {}

  for (const parte of cabecera.split(';')) {
    const piezas = parte.trim().split(/\s+/).filter(Boolean)
    if (piezas.length === 0) continue

    const [nombre, ...valores] = piezas
    directivas[nombre.toLowerCase()] = valores
  }

  return directivas
}

/**
 * ¿La directiva permite ese origen?
 *
 * Contempla los comodines de subdominio (`https://*.supabase.co`), que es como
 * se escriben los orígenes de Supabase, y el respaldo a `default-src` cuando
 * la directiva concreta no está declarada: así funciona la CSP de verdad, y
 * una prueba que lo ignore daría falsos negativos.
 */
export function permite(
  directivas: Directivas,
  directiva: string,
  origen: string,
): boolean {
  const valores = directivas[directiva] ?? directivas['default-src'] ?? []

  return valores.some((valor) => {
    if (valor === origen || valor === '*') return true
    if (!valor.includes('*')) return false

    // `https://*.supabase.co` tiene que aceptar `https://algo.supabase.co`
    // pero no `https://supabase.co.atacante.com`.
    const patron = new RegExp(
      `^${valor.split('*').map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^./]+')}$`,
    )
    return patron.test(origen)
  })
}
