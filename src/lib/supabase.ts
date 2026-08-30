import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno de Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
})

// Supabase guarda la sesion en localStorage, invisible para el servidor. Esta
// cookie le permite al edge middleware redirigir visitantes anonimos en /admin
// sin esperar a que React arranque. Es solo una senal de navegacion: el acceso
// real a los datos lo siguen controlando el JWT de Supabase y las policies RLS.
const SESSION_FLAG = 'pa_session'

supabase.auth.onAuthStateChange((_event, session) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = session
    ? `${SESSION_FLAG}=1; Path=/; SameSite=Lax; Max-Age=604800${secure}`
    : `${SESSION_FLAG}=; Path=/; SameSite=Lax; Max-Age=0${secure}`
})
