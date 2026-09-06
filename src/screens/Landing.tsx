import { TrendingUp, ShoppingCart, Package, BarChart2, LogIn } from 'lucide-react'

const features = [
  { icon: TrendingUp, title: 'Semáforo de inventario', desc: 'Detectá en segundos qué productos rotan bien y cuáles están estancados.' },
  { icon: ShoppingCart, title: 'Ventas express', desc: 'Registrá ventas rápido y llevá el control de tu caja del día.' },
  { icon: Package, title: 'Control de stock', desc: 'Alertas automáticas de stock bajo y sugerencias de pedido.' },
  { icon: BarChart2, title: 'Análisis de negocio', desc: 'Tendencias de ventas y productos top de la semana.' },
]

export function Landing() {
  return (
    <div className="min-h-screen bg-app font-sans text-white flex flex-col">
      <header className="max-w-5xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <span className="font-black text-lg tracking-tight">PulpeAnálisis ✦</span>
        <a href="/login?registro=1" className="btn-ghost flex items-center gap-2 text-sm">
          Crear cuenta
        </a>
        <a href="/login" className="btn-ghost flex items-center gap-2 text-sm">
          <LogIn size={15} /> Iniciar sesión
        </a>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 space-y-16">
        <section className="text-center space-y-5 max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-gradient-brand">
            Rotación de inventario y ventas, en tiempo real
          </h1>
          <p className="text-white/50 text-base sm:text-lg">
            PulpeAnálisis es el panel para pulperías y tiendas pequeñas: sabé qué vender,
            qué reponer y cuánto facturaste, sin planillas.
          </p>
          <a href="/login" className="btn-primary inline-flex items-center gap-2">
            <LogIn size={16} /> Acceder al panel
          </a>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
                <f.icon size={18} className="text-brand-light" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-sm">{f.title}</h2>
                <p className="text-white/45 text-sm mt-1">{f.desc}</p>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="max-w-5xl mx-auto w-full px-6 py-6 text-center text-white/25 text-xs space-y-1">
        <p>© {new Date().getFullYear()} PulpeAnálisis</p>
        <p>Código de verificación: LEARN-CAP-037676CD</p>
      </footer>
    </div>
  )
}
