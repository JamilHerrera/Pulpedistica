import { useState } from 'react'
import { Package } from 'lucide-react'

/**
 * La foto de un producto, o un marcador cuando no tiene.
 *
 * El marcador no es gris: toma un color estable a partir del nombre, así que
 * dos productos sin foto igual se distinguen de un vistazo y el catálogo no se
 * ve como una lista de cajas iguales. El mismo producto conserva su color
 * entre recargas porque el color sale del nombre, no del azar.
 *
 * También cubre el caso de la foto que no carga —un archivo borrado a mano en
 * Storage, o el teléfono sin datos— cayendo al marcador en vez de dejar el
 * ícono roto del navegador.
 *
 * Pero ese respaldo AVISA. La primera versión caía en silencio, y eso escondió
 * un fallo real: la CSP del sitio bloqueaba las fotos de Supabase, así que se
 * subían bien y no se veían, sin nada en la consola. Ahora se registra una vez
 * por sesión, con un mensaje sin la dirección: así todas las fotos rotas caen
 * en UN ticket —el problema es el mismo— en vez de abrir uno por producto.
 */

const TONOS = [
  'from-brand/30 to-brand-dark/20 text-brand-light',
  'from-accent/30 to-brand/20 text-accent',
  'from-success/25 to-brand/15 text-success',
  'from-warning/25 to-danger/15 text-warning',
  'from-danger/25 to-brand/15 text-danger',
]

function tonoDe(nombre: string): string {
  let suma = 0
  for (let i = 0; i < nombre.length; i++) suma += nombre.charCodeAt(i)
  return TONOS[suma % TONOS.length]
}

/** Ya se avisó en esta sesión. Evita un ticket por cada tarjeta del catálogo. */
let yaSeAviso = false

interface Props {
  nombre: string
  url?: string | null
  /** Clases de tamaño y forma. Las decide quien lo usa. */
  className?: string
  iconSize?: number
}

export function FotoProducto({ nombre, url, className = '', iconSize = 22 }: Readonly<Props>) {
  const [fallo, setFallo] = useState(false)

  if (url && !fallo) {
    return (
      <img
        src={url}
        alt={nombre}
        loading="lazy"
        onError={() => {
          setFallo(true)
          if (!yaSeAviso) {
            yaSeAviso = true
            console.error('Las fotos de producto no se pueden cargar')
          }
        }}
        className={`object-cover bg-white/5 ${className}`}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-gradient-to-br ${tonoDe(nombre)} ${className}`}
    >
      <Package size={iconSize} strokeWidth={1.8} />
    </div>
  )
}
