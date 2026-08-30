import { next } from '@vercel/edge'

export const config = { runtime: 'edge' }

const KNOWN_PAGES = new Set(['/', '/login', '/admin'])

const NOT_FOUND_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 — Página no encontrada | PulpeAnálisis</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center;
         justify-content:center; gap:1rem; padding:0 1.5rem; text-align:center;
         background:#070714; color:#fff; font-family:Inter,system-ui,sans-serif; }
  .code { font-size:4rem; font-weight:900; color:rgba(255,255,255,0.1); line-height:1; }
  h1 { font-size:1.25rem; margin:0; }
  p { color:rgba(255,255,255,0.45); font-size:.875rem; max-width:20rem; margin:0; }
  a { display:inline-block; margin-top:.5rem; background:#7C3AED; color:#fff; text-decoration:none;
      font-weight:600; font-size:.875rem; padding:.75rem 1.5rem; border-radius:1rem; }
</style>
</head>
<body>
  <p class="code">404</p>
  <h1>Esta página no existe</h1>
  <p>Revisá el enlace o volvé al inicio.</p>
  <a href="/">Volver al inicio</a>
</body>
</html>`

function hasSession(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? ''
  return /(?:^|;\s*)pa_session=1(?:\s*;|\s*$)/.test(cookie)
}

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname

  // Las funciones serverless y los archivos estaticos se resuelven solos.
  if (path.startsWith('/api/') || path.startsWith('/_vercel') || /\.[a-z0-9]+$/i.test(path)) {
    return next()
  }

  // Redirect HTTP real: el visitante anonimo nunca recibe el documento de /admin.
  if (path === '/admin' && !hasSession(request)) {
    url.pathname = '/login'
    url.search = ''
    return Response.redirect(url, 302)
  }

  if (KNOWN_PAGES.has(path)) return next()

  return new Response(NOT_FOUND_HTML, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
