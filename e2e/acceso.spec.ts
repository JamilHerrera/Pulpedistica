import { test, expect } from '@playwright/test'
import { entrarAlPanel, irALoginLimpio } from './apoyo'

/**
 * Las rutas públicas y la puerta del panel.
 *
 * Todo esto ya falló en producción alguna vez: la portada quedó en blanco por
 * una variable de entorno, `/admin` llegó a mostrar contenido antes de
 * comprobar la sesión, y una ruta inexistente devolvía 200 con una pantalla de
 * error en vez de un 404 de verdad.
 */

test.describe('rutas públicas', () => {
  test('la portada carga y ofrece entrar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /entrar|iniciar/i }).first()).toBeVisible()
  })

  test('el login es un formulario real, con correo y contraseña', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('#login-form')).toBeVisible()
    await expect(page.locator('#email')).toHaveAttribute('type', 'email')
    await expect(page.locator('#password')).toHaveAttribute('type', 'password')
  })

  test('se puede cambiar a crear cuenta, con el campo de invitación', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#tab-registro').click()

    await expect(page.locator('#campo-negocio')).toBeVisible()
    // El campo por el que un empleado se suma al negocio de alguien más.
    await expect(page.locator('#campo-invitacion')).toBeVisible()
    await expect(page.locator('#login-submit')).toHaveText(/crear cuenta/i)
  })

  test('una ruta inexistente no finge estar bien', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe')
    await expect(page.getByText(/no encontramos|no existe|404/i).first()).toBeVisible()
  })
})

test.describe('la puerta del panel', () => {
  test('sin sesión, /admin no muestra datos del negocio', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())

    await page.goto('/admin')

    // Lo que importa no es a dónde va, sino que NO se vea nada del negocio.
    await expect(page.getByRole('heading', { name: 'Inicio' })).toHaveCount(0)
    await expect(page.getByText(/ventas de hoy/i)).toHaveCount(0)
  })

  test('con la contraseña equivocada no entra y lo dice', async ({ page }) => {
    await irALoginLimpio(page)

    await page.locator('#email').fill('admin@jamilherreravargas.com')
    await page.locator('#password').fill('esta-clave-esta-mal')
    await page.locator('#login-submit').click()

    await expect(page.locator('#login-error')).toBeVisible()
    expect(page.url()).toContain('/login')
  })

  test('con la contraseña correcta entra y ve su pulpería', async ({ page }) => {
    await entrarAlPanel(page)
    await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  })
})

test.describe('menú según el rol', () => {
  test('la cuenta de soporte ve las secciones de soporte', async ({ page }) => {
    await entrarAlPanel(page)

    const menu = page.locator('aside')
    await expect(menu.getByRole('button', { name: 'Tickets' })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Comentarios' })).toBeVisible()
    // Y las de administrador del negocio, que son otra cosa.
    await expect(menu.getByRole('button', { name: 'Usuarios' })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Análisis' })).toBeVisible()
  })

  test('la sección se puede enlazar directo por la dirección', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto('/admin?pantalla=tickets')

    await expect(page.getByRole('heading', { level: 2, name: /tickets de errores/i })).toBeVisible()
  })

  test('al navegar, la dirección refleja la sección', async ({ page }) => {
    await entrarAlPanel(page)
    await page.locator('aside').getByRole('button', { name: 'Inventario' }).click()

    await expect(page).toHaveURL(/pantalla=inventario/)
  })
})
