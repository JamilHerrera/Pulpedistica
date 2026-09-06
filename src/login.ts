import './index.css'
import { supabase } from './lib/supabase'
import { registrarServiceWorker } from './lib/registrarSW'

registrarServiceWorker()

const form        = document.getElementById('login-form')     as HTMLFormElement
const email       = document.getElementById('email')          as HTMLInputElement
const password    = document.getElementById('password')       as HTMLInputElement
const negocio     = document.getElementById('negocio')        as HTMLInputElement
const campoNegocio= document.getElementById('campo-negocio')  as HTMLDivElement
const ayudaPass   = document.getElementById('ayuda-password') as HTMLParagraphElement
const submit      = document.getElementById('login-submit')   as HTMLButtonElement
const errorBox    = document.getElementById('login-error')    as HTMLParagraphElement
const okBox       = document.getElementById('login-ok')       as HTMLParagraphElement
const titulo      = document.getElementById('titulo')         as HTMLHeadingElement
const subtitulo   = document.getElementById('subtitulo')      as HTMLParagraphElement
const tabEntrar   = document.getElementById('tab-entrar')     as HTMLButtonElement
const tabRegistro = document.getElementById('tab-registro')   as HTMLButtonElement

type Modo = 'entrar' | 'registro'
let modo: Modo = 'entrar'

supabase.auth.getSession().then(({ data }) => {
  if (data.session) window.location.replace('/admin')
})

function mostrarError(mensaje: string) {
  okBox.hidden = true
  errorBox.textContent = mensaje
  errorBox.hidden = false
}

function mostrarOk(mensaje: string) {
  errorBox.hidden = true
  okBox.textContent = mensaje
  okBox.hidden = false
}

const CLASES_ACTIVA = ['bg-brand', 'text-white', 'shadow-glow-brand']

function cambiarModo(nuevo: Modo) {
  modo = nuevo
  errorBox.hidden = true
  okBox.hidden = true

  const registrando = modo === 'registro'
  campoNegocio.hidden = !registrando
  ayudaPass.hidden = !registrando
  negocio.required = registrando
  password.autocomplete = registrando ? 'new-password' : 'current-password'

  titulo.textContent = registrando ? 'Crear cuenta' : 'Iniciar sesión'
  subtitulo.textContent = registrando
    ? 'Registrá tu pulpería y empezá a usar el panel'
    : 'Accedé al panel de PulpeAnálisis'
  submit.textContent = registrando ? 'Crear cuenta' : 'Entrar'

  const activa = registrando ? tabRegistro : tabEntrar
  const inactiva = registrando ? tabEntrar : tabRegistro
  activa.classList.add(...CLASES_ACTIVA)
  activa.classList.remove('text-white/40')
  inactiva.classList.remove(...CLASES_ACTIVA)
  inactiva.classList.add('text-white/40')
}

tabEntrar.addEventListener('click', () => cambiarModo('entrar'))
tabRegistro.addEventListener('click', () => cambiarModo('registro'))

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorBox.hidden = true
  okBox.hidden = true
  submit.disabled = true

  const etiquetaOriginal = modo === 'registro' ? 'Crear cuenta' : 'Entrar'
  submit.textContent = modo === 'registro' ? 'Creando…' : 'Entrando…'

  const restaurar = () => {
    submit.disabled = false
    submit.textContent = etiquetaOriginal
  }

  if (modo === 'registro') {
    if (password.value.length < 8) {
      restaurar()
      mostrarError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    // El nombre del negocio viaja en los metadatos: un disparador en la base
    // lo usa para crear el negocio del usuario nuevo y sembrarle las
    // categorías del semáforo.
    const { data, error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: { data: { negocio: negocio.value.trim() } },
    })

    if (error) {
      restaurar()
      mostrarError(
        error.message.toLowerCase().includes('already')
          ? 'Ya existe una cuenta con ese correo. Probá iniciar sesión.'
          : 'No se pudo crear la cuenta. Revisá los datos e intentá de nuevo.',
      )
      return
    }

    // Si el proyecto exige confirmar el correo, signUp no devuelve sesión.
    if (!data.session) {
      restaurar()
      mostrarOk('Cuenta creada. Revisá tu correo para confirmarla y después iniciá sesión.')
      cambiarModo('entrar')
      return
    }

    window.location.replace('/admin')
    return
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (error) {
    restaurar()
    mostrarError('Correo o contraseña incorrectos.')
    return
  }

  window.location.replace('/admin')
})
