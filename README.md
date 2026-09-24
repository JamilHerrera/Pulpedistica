# PulpeDisticas 🛒📊

**PulpeDisticas** (desarrollado bajo el nombre inicial de PulpeAnálisis) es una Progressive Web App (PWA) de alta fidelidad diseñada específicamente para optimizar la gestión de inventario, el control de caja diaria y la rotación de productos en pulperías de barrio de Honduras.

El sistema transforma el mostrador tradicional en un punto de venta express inteligente, reduciendo las mermas financieras por productos vencidos o estancados mediante una interfaz visual intuitiva y automatizada.

🔗 **En vivo:** [www.jamilherreravargas.lat](https://www.jamilherreravargas.lat)

---

## 🚀 Características Principales

- **Ventas Express:** el catálogo completo en cuadrícula con foto, búsqueda instantánea y filtro por categoría. Tocás el producto, ajustás la cantidad y cobrás.
- **Venta por peso:** los productos que se venden por libra o kilo admiten cantidades partidas (media libra, tres cuartos) con atajos de ¼, ½, ¾ y 1, o escribiendo lo que marque la balanza. Los que se cuentan de a uno no aceptan decimales, y esa regla la impone la base de datos, no solo la pantalla.
- **Semáforo con dos lecturas:**
  - *Qué reponer* (vista por defecto): cruza el stock con el ritmo de venta y calcula **días de cobertura**. Separa lo que hay que pedir hoy de lo que sobra en bodega, y sugiere cuánto pedir.
  - *Cómo rota*: la clasificación clásica por unidades vendidas en 7, 15 o 30 días — **verde** alta rotación, **amarillo** media, **rojo** baja.
- **Fiados:** registro de clientes y de ventas al crédito, con control de lo pendiente y lo saldado.
- **Asistente de Pedidos:** calcula cuánto conviene pedir de cada producto y arma un resumen listo para pegar en WhatsApp del distribuidor.
- **Control de Caja Diaria:** total vendido del día, transacciones y últimas ventas, sin sumar nada a mano.
- **Panel de análisis:** ingresos por día, productos más vendidos y reparto por categoría, sobre períodos de 7, 14 o 30 días.
- **Multi-negocio:** cada pulpería ve únicamente sus propios datos, con usuarios administradores y empleados, y altas por código de invitación.
- **Tickets automáticos de errores:** si algo falla, la app abre sola un ticket con el contexto del fallo, en vez de que el error muera en la consola del navegador.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18, Vite y TypeScript para un desarrollo ágil y tipado estricto.
- **Estilos y UI/UX:** Tailwind CSS para un diseño responsive de alta fidelidad, de escritorio a celular.
- **Backend como Servicio (BaaS):** Supabase (PostgreSQL) — datos, autenticación, Row Level Security, Storage para las fotos y canal de tiempo real.
- **Gráficos:** Recharts. **Iconografía:** Lucide React.
- **PWA:** service worker y manifest escritos a mano y versionados en `public/`, en vez de generarlos con un plugin: así el archivo que se sirve es exactamente el que está en el repositorio.
- **Despliegue / Hosting:** Vercel, con Edge Middleware para el control de rutas y una función *serverless* para el healthcheck.

---

## 📂 Estructura de la Base de Datos (Supabase)

El esquema completo, exportado desde la base real, está en [`docs/db-export.json`](docs/db-export.json): 12 tablas, 83 columnas y 24 políticas RLS. Para regenerarlo se usa [`docs/export-schema.sql`](docs/export-schema.sql), que lee los catálogos de Postgres, así que lo que sale es exactamente lo que hay.

**Catálogo y ventas**

- `categorias`: agrupa los productos (por rubro o proveedor). Es una etiqueta del negocio: **no** determina la rotación, que se calcula sola por ventas reales.
- `productos`: catálogo con `stock_actual`, `precio`, `unidad` (unidad/libra/kilo) e `imagen_url`.
- `ventas` y `detalle_ventas`: historial de transacciones y el desglose de artículos de cada una.
- `clientes` y `fiados`: la venta al crédito.

**Cuentas y aislamiento**

- `negocios` y `perfiles`: cada fila de datos pertenece a un negocio, y cada usuario tiene un rol (`admin` o `empleado`).
- `invitaciones`: códigos para sumar gente a un negocio existente.

**Operación del producto**

- `feedback`: comentarios que mandan los usuarios.
- `tickets`: errores que la app registra sola, uno por problema y con un contador de repeticiones.
- `schema_migrations`: qué migraciones están aplicadas.

Las reglas que protegen el dinero y el inventario viven en la base: políticas RLS por negocio y por rol, restricciones de integridad, y funciones transaccionales (`registrar_venta`, `anular_venta`) que son atómicas e idempotentes.

---

## ⚙️ Configuración del Entorno de Desarrollo

1. **Clona el repositorio:**

```bash
git clone https://github.com/JamilHerrera/Pulpedistica.git
cd Pulpedistica
```

2. **Instala las dependencias:**

```bash
npm install
```

3. **Configura las variables de entorno:**

Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima
```

4. **Aplica las migraciones:**

En Supabase → SQL Editor, ejecuta los archivos de [`migrations/`](migrations/) **en orden numérico**. Son idempotentes: volver a correrlos no rompe nada. El detalle de cada uno está en [`migrations/README.md`](migrations/README.md).

5. **Inicia el servidor de desarrollo:**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

---

## 🧪 Pruebas y calidad

```bash
npm test             # pruebas unitarias (Vitest)
npm run test:coverage # con reporte de cobertura
npm run test:e2e     # pruebas de navegador (Playwright)
npm run typecheck    # verificación de tipos
```

Las pruebas unitarias cubren la capa de lógica —reglas del semáforo, cobertura, unidades, caché, idempotencia, captura de errores y el middleware— y las de navegador recorren la aplicación desplegada: rutas públicas, acceso al panel y el sistema de tickets. Cada *push* dispara el pipeline de GitHub Actions y el análisis de SonarCloud.

---

## 📐 Decisiones de arquitectura

Las decisiones importantes están registradas en [`docs/adrs/`](docs/adrs/), incluidas las que se dieron marcha atrás: el ADR-3 documenta por qué la API propia en Node/Express que planteaban el ADR-1 y el ADR-2 nunca se construyó, y qué la reemplazó.

---

Código de verificación de autoría: `LEARN-CAP-037676CD`
