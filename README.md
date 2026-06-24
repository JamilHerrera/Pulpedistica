# PulpeMétricas 🛒📊

**PulpeMétricas** (desarrollado bajo el nombre inicial de PulpeAnálisis) es una Progressive Web App (PWA) de alta fidelidad diseñada específicamente para optimizar la gestión de inventario, el control de caja diaria y la rotación de productos en pulperías de barrio de Honduras.

El sistema transforma el mostrador tradicional en un punto de venta express inteligente, reduciendo las mermas financieras por productos vencidos o estancados mediante una interfaz visual intuitiva y automatizada.

---

## 🚀 Características Principales

- **Ventas Express (Mostrador Móvil):** Interfaz táctil premium optimizada para celulares que permite registrar transacciones comunes (leche, pan, refrescos) en menos de 5 segundos.
- **Semáforo Inteligente de Rotación:** Clasificación visual y en tiempo real del inventario en tres niveles críticos de alerta (Rojo para Alta rotación, Amarillo para Media rotación y Azul para Baja rotación).
- **Asistente de Pedidos Automatizado:** Generación de listas de compras optimizadas por proveedor, estructuradas como una lista de chequeo y listas para enviar directamente a los distribuidores a través de WhatsApp.
- **Control de Caja Diaria:** Monitoreo financiero asíncrono que registra y acumula el saldo total de ventas del día de forma transparente.

---

## 🛠️ Stack Tecnológico

La arquitectura de la aplicación está construida sobre un stack moderno, escalable y eficiente (*Full-Stack*):

- **Frontend:** React 18, Vite y TypeScript para un desarrollo ágil y tipado estricto.
- **Estilos y UI/UX:** Tailwind CSS para un diseño móvil de alta fidelidad, interactivo y adaptado a dispositivos de gama baja.
- **Backend como Servicio (BaaS):** Supabase (PostgreSQL) para la gestión asíncrona de datos en la nube.
- **Iconografía:** Lucide React.
- **Despliegue / Hosting:** Vercel de forma continua.

---

## 📂 Estructura de la Base de Datos (Supabase)

El sistema opera de forma relacional con las siguientes tablas clave en el backend:

- `categorias`: Clasifica los productos y define el comportamiento lógico del `color_semaforo`.
- `productos`: Almacena el catálogo de la pulpería, controlando el `stock_actual` y vinculándose mediante `categoria_id`.
- `ventas`: Registra el historial cronológico, montos totales y marcas de tiempo de cada transacción de la caja.
- `detalle_ventas`: Tabla relacional que desglosa los artículos específicos comprados en cada orden.

---

## ⚙️ Configuración del Entorno de Desarrollo

Para levantar este proyecto de forma local, sigue estos pasos:

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

4. **Inicia el servidor de desarrollo:**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.
