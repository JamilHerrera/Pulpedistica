import './index.css'
import { supabase } from './lib/supabase'

const form = document.getElementById('login-form') as HTMLFormElement
const email = document.getElementById('email') as HTMLInputElement
const password = document.getElementById('password') as HTMLInputElement
const submit = document.getElementById('login-submit') as HTMLButtonElement
const errorBox = document.getElementById('login-error') as HTMLParagraphElement

supabase.auth.getSession().then(({ data }) => {
  if (data.session) window.location.replace('/admin')
})

function showError(message: string) {
  errorBox.textContent = message
  errorBox.hidden = false
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorBox.hidden = true
  submit.disabled = true
  submit.textContent = 'Entrando…'

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (error) {
    submit.disabled = false
    submit.textContent = 'Entrar'
    showError('Correo o contraseña incorrectos.')
    return
  }

  window.location.replace('/admin')
})
