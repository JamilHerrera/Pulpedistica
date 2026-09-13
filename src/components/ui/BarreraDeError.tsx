import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { reportarError } from '../../lib/tickets'

/**
 * Atrapa los errores que ocurren al dibujar la interfaz.
 *
 * Es el único de los cuatro capturadores que no puede ser un `addEventListener`:
 * React se traga las excepciones de render y, si nadie las atrapa, desmonta el
 * árbol entero. Eso es la pantalla en blanco —el peor fallo posible, porque el
 * usuario no ve ni un mensaje— y hasta ahora no dejaba ningún rastro.
 *
 * Tiene que ser una clase: `componentDidCatch` no existe como hook.
 */

interface Props {
  children: ReactNode
  /** Se reinicia la vista al cambiar de sección, para no dejarla trabada. */
  claveDeReinicio?: string
}

interface State {
  fallo: boolean
  /** Código corto que el usuario le puede dictar a soporte. */
  codigo: string | null
}

export class BarreraDeError extends Component<Props, State> {
  state: State = { fallo: false, codigo: null }

  static getDerivedStateFromError(): Partial<State> {
    return { fallo: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // El árbol de componentes dice qué pantalla reventó, y es lo primero que
    // se necesita para reproducirlo. Va pegado a la traza del error.
    const conContexto = new Error(error.message)
    conContexto.name = error.name
    conContexto.stack = `${error.stack ?? ''}\n\nComponentes:${info.componentStack ?? ''}`

    this.setState({ codigo: reportarError(conContexto, 'render') })
  }

  componentDidUpdate(anterior: Readonly<Props>) {
    // Si el usuario navega a otra sección, la barrera se rearma sola. Sin
    // esto, un error en una pantalla dejaría la app inservible hasta recargar.
    if (this.state.fallo && anterior.claveDeReinicio !== this.props.claveDeReinicio) {
      this.setState({ fallo: false, codigo: null })
    }
  }

  render() {
    if (!this.state.fallo) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center">
          <AlertTriangle size={26} className="text-danger" />
        </div>

        <div className="space-y-1.5 max-w-sm">
          <p className="font-bold text-white">Se rompió esta pantalla</p>
          <p className="text-white/45 text-sm leading-relaxed">
            Ya quedó reportado solo: no hace falta que hagas nada. Podés seguir
            usando el resto de la app.
          </p>
        </div>

        {this.state.codigo && (
          <p className="text-white/30 text-xs">
            Si querés avisarnos, el código es{' '}
            <span className="font-mono font-bold text-white/60">{this.state.codigo}</span>
          </p>
        )}

        <button
          onClick={() => this.setState({ fallo: false, codigo: null })}
          className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 active:scale-95 transition-all"
        >
          <RotateCcw size={15} /> Intentar de nuevo
        </button>
      </div>
    )
  }
}
