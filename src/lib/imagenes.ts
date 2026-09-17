/**
 * Fotos de producto: qué se acepta, dónde se guarda y cuánto pesa.
 *
 * En una lista de dieciocho productos escritos a las apuradas —"arroz 1 lb",
 * "Huevos por und"— encontrar el correcto leyendo es lento. La foto lo
 * resuelve de un vistazo, que es justo lo que hace falta con gente esperando.
 *
 * La parte de arriba es cálculo puro y está probada. La de abajo necesita el
 * navegador, porque redimensionar una imagen es dibujarla en un canvas.
 */

/** Lo que el depósito acepta. Coincide con el bucket de la migración 014. */
export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Tope del servidor, en bytes. La app reduce antes para no chocarlo. */
export const TAMANO_MAX = 2 * 1024 * 1024

/** Nombre del depósito de Storage. */
export const DEPOSITO = 'productos'

/**
 * Lado más largo al que se reduce la foto.
 *
 * Se muestra en tarjetas de unos 200 píxeles, así que 600 alcanza incluso en
 * pantallas de alta densidad. Una foto de teléfono ronda los 4 MB y sale de
 * acá en unos 50 KB: la diferencia la paga el dueño de la pulpería en datos
 * móviles cada vez que abre la pantalla de ventas.
 */
const LADO_MAX = 600

/** Calidad del WebP. Por debajo de esto se empiezan a ver los cuadros. */
const CALIDAD = 0.8

export function tipoPermitido(tipo: string): boolean {
  return (TIPOS_PERMITIDOS as readonly string[]).includes(tipo)
}

export function extensionDe(tipo: string): string {
  if (tipo === 'image/png') return 'png'
  if (tipo === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * Dónde se guarda la foto dentro del depósito.
 *
 * El primer tramo es el negocio, y eso no es decorativo: las políticas de
 * Storage de la migración 014 comparan ese tramo contra `mi_negocio()`, así
 * que la ruta misma es lo que impide que una pulpería pise las fotos de otra.
 *
 * La marca de tiempo va en el nombre para que reemplazar una foto genere una
 * dirección nueva. Sin eso, el navegador y el service worker seguirían
 * mostrando la anterior desde su caché.
 */
export function rutaDeFoto(
  negocioId: string,
  productoId: string,
  tipo: string,
  marca: number,
): string {
  return `${negocioId}/${productoId}-${marca}.${extensionDe(tipo)}`
}

/**
 * Recupera la ruta interna a partir de la dirección pública.
 *
 * Hace falta para borrar la foto anterior cuando se reemplaza: la fila guarda
 * la dirección completa, pero la API de Storage borra por ruta. Devuelve
 * `null` si la dirección no es de este depósito, para no intentar borrar algo
 * que no nos pertenece.
 */
export function rutaDesdeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marca = `/storage/v1/object/public/${DEPOSITO}/`
  const corte = url.indexOf(marca)
  if (corte === -1) return null

  const ruta = url.slice(corte + marca.length).split('?')[0]
  return ruta.length > 0 ? ruta : null
}

/** Por qué se rechaza un archivo, o `null` si está bien. */
export function motivoDeRechazo(
  tipo: string,
  tamano: number,
): string | null {
  if (!tipoPermitido(tipo)) return 'Solo se aceptan fotos JPG, PNG o WebP.'
  // El tope se compara contra el archivo original: si ya viene enorme, se
  // avisa antes de gastar tiempo procesándolo.
  if (tamano > TAMANO_MAX * 8) return 'La foto es demasiado pesada.'
  return null
}

// ── De acá para abajo hace falta el navegador ──────────────────────────────

function proporcion(ancho: number, alto: number): { ancho: number; alto: number } {
  const lado = Math.max(ancho, alto)
  if (lado <= LADO_MAX) return { ancho, alto }
  const escala = LADO_MAX / lado
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

/**
 * Reduce la foto antes de subirla.
 *
 * Sale siempre en WebP, que para una foto de producto pesa cerca de la mitad
 * que el JPG equivalente. Si el navegador no lo soporta, `toBlob` devuelve
 * PNG y el depósito lo acepta igual.
 */
export async function reducirImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo)
  try {
    const { ancho, alto } = proporcion(bitmap.width, bitmap.height)

    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto

    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('El navegador no permitió procesar la imagen')
    ctx.drawImage(bitmap, 0, 0, ancho, alto)

    const blob = await new Promise<Blob | null>((resolve) => {
      lienzo.toBlob(resolve, 'image/webp', CALIDAD)
    })
    if (!blob) throw new Error('No se pudo convertir la imagen')
    return blob
  } finally {
    // Sin esto la imagen decodificada queda ocupando memoria hasta que el
    // recolector pase, y en un teléfono modesto eso se nota.
    bitmap.close()
  }
}
