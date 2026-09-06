# Correo transaccional

Cómo queda configurado el envío de correos de PulpeAnálisis (confirmación de
cuenta y recuperación de contraseña).

## Por qué no alcanza el SMTP de Supabase

Supabase trae un servidor de correo compartido solo para desarrollo, con un
límite muy bajo de envíos por hora. Al probar el registro de una cuenta el
proyecto respondió `email rate limit exceeded`, así que apenas se registren
unas pocas pulperías los correos dejan de salir. Para uso real hace falta un
SMTP propio.

## Proveedor

**Resend** (`resend.com`), plan gratuito: 3.000 correos al mes, 100 por día.
Para el volumen de esta app —altas de pulperías y recuperación de contraseñas—
sobra de largo.

El dominio `jamilherreravargas.lat` tiene el DNS administrado por **Vercel**
(`ns1.vercel-dns.com`), así que los registros que pide Resend se agregan en
Vercel → el dominio → **DNS Records**. Antes de esta configuración el dominio
no tenía MX, SPF ni DMARC.

Enviar desde `no-reply@jamilherreravargas.lat` —en vez de un remitente
genérico del proveedor— es lo que evita que el correo caiga en spam.

## Configuración en Supabase

`Authentication` → `Emails` → `SMTP Settings`:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la API key de Resend |
| Sender email | `no-reply@jamilherreravargas.lat` |
| Sender name | `PulpeAnálisis` |

Después hay que subir el tope en `Authentication` → `Rate Limits` → *Emails per
hour*: viene en un valor pensado para el SMTP compartido y, si no se cambia,
sigue frenando los envíos aunque el SMTP propio ya funcione.

## Plantillas

`Authentication` → `Email Templates`. El contenido por defecto de Supabase
llega en inglés, que no sirve para el público de esta app.

| Plantilla de Supabase | Archivo | Asunto sugerido |
|---|---|---|
| Confirm signup | `confirmar-cuenta.html` | Confirmá tu cuenta de PulpeAnálisis |
| Reset password | `recuperar-contrasena.html` | Recuperá tu contraseña de PulpeAnálisis |

Ambas usan la variable `{{ .ConfirmationURL }}`, que es la que Supabase
reemplaza por el enlace real. Los estilos van en línea porque los clientes de
correo ignoran las hojas de estilo externas.
