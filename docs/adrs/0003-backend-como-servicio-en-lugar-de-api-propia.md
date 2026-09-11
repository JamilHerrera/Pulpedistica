# 3. Backend como servicio (BaaS) en lugar de una API propia

* **Estatus:** Aprobado
* **Fecha:** 2026-09-10
* **Reemplaza a:** [ADR-1](0001-uso-de-arquitectura-de-contenedores-desacoplada.md) y [ADR-2](0002-evaluacion-de-umbrales-de-semaforo-en-backend.md)

## Contexto

El ADR-1 definió tres contenedores desacoplados y el ADR-2 decidió evaluar los
umbrales del semáforo dentro de una **API Backend en Node.js / Express**. Al
construir el sistema esas decisiones no se sostuvieron, y este documento
registra por qué, en vez de dejar los ADR describiendo una arquitectura que no
existe.

Dos hechos cambiaron el análisis:

1. **El cliente es una pulpería de barrio, no una empresa.** Operar un servidor
   propio implica costo mensual, parches de seguridad, monitoreo y un
   responsable de que siga encendido. Para un negocio de una sola persona, ese
   mantenimiento es un pasivo permanente, no una inversión.
2. **Buena parte de lo que se iba a poner en la API ya lo resuelve la base de
   datos.** PostgreSQL, a través de Supabase, ofrece autenticación, seguridad a
   nivel de fila (RLS), restricciones de integridad y funciones transaccionales.
   Escribir una capa intermedia para reexponer eso habría duplicado
   responsabilidades sin agregar garantías.

## Decisión

Adoptamos un **backend como servicio (BaaS)**: la SPA se comunica directamente
con **Supabase** sobre HTTPS, sin una API propia intermedia.

1. **SPA (React + TypeScript):** presentación y, desde acá, las consultas.
2. **Supabase (PostgreSQL gestionado):** persistencia, autenticación, RLS,
   restricciones y las operaciones que deben ser atómicas.
3. **Funciones serverless en Vercel:** solo para lo que no puede vivir en la
   base, hoy únicamente el healthcheck `/api/health`.

Las reglas se reparten según **qué garantiza cada capa**:

* **En la base de datos** todo lo que protege el dinero y el inventario:
  aislamiento por negocio mediante políticas RLS, restricciones `CHECK` y
  `NOT NULL`, y las funciones `registrar_venta` y `anular_venta`, que son
  atómicas e idempotentes. Son reglas que el cliente **no puede** evadir porque
  se aplican del lado del servidor.
* **En la SPA** la clasificación del semáforo, contenida en un único módulo,
  `src/lib/semaforo.ts`, con sus umbrales y 12 pruebas unitarias sobre los
  bordes de cada rango.

## Consecuencias

### Positivas

* **Menos superficie que operar.** Se elimina un contenedor y su pipeline de
  despliegue. No hay servidor propio que parchear ni que pagar.
* **Menor latencia.** Desaparece un salto de red: la SPA consulta la base
  directamente en lugar de pasar por un intermediario.
* **Las garantías fuertes quedan donde se pueden hacer cumplir.** La seguridad
  se apoya en RLS y en restricciones del motor, no en la disciplina del código
  de aplicación. Un cliente manipulado no puede leer ni escribir datos de otro
  negocio.
* **La regla del semáforo sigue teniendo una sola fuente.** El objetivo del
  ADR-2 se conserva: la lógica no está esparcida por las pantallas, vive en un
  módulo propio y es verificable con pruebas deterministas, sin levantar la
  interfaz.

### Negativas

* **Se pierde el cálculo del semáforo del lado del servidor**, que era el punto
  del ADR-2. Se asumen dos costos concretos:
  * Un segundo cliente —por ejemplo una app móvil— tendría que **reimplementar
    la regla** o compartir el módulo. Mientras la SPA sea el único cliente, el
    costo es teórico.
  * Un usuario con conocimientos podría **alterar en su navegador el color que
    ve**. Es aceptable porque el semáforo es una ayuda visual, no un control de
    acceso: no decide permisos ni modifica datos, y las escrituras siguen
    limitadas por RLS.
* **Dependencia de un proveedor.** Migrar fuera de Supabase exigiría reemplazar
  autenticación y realtime. El esquema en sí es PostgreSQL estándar y está
  versionado en `migrations/`, así que los datos son portables; el acoplamiento
  está en los servicios que lo rodean, no en la base.
* **Menos control sobre los límites del servicio.** Las cuotas del plan
  gratuito —envío de correos, pausa por inactividad— las fija el proveedor.

## Cuándo revisar esta decisión

* Si aparece un **segundo cliente** que necesite la misma clasificación: mover
  `calcularNivel` a una función de PostgreSQL o a una función de borde, para
  que ambos consuman la misma implementación.
* Si el semáforo pasa a **disparar acciones automáticas** —pedidos a
  proveedores, por ejemplo— en lugar de solo informar: ahí sí deja de ser una
  ayuda visual y el cálculo tiene que volver al servidor.
