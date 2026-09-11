# 2. Evaluación de umbrales del semáforo en el servidor backend

* **Estatus:** Reemplazado por [ADR-3](0003-backend-como-servicio-en-lugar-de-api-propia.md)
* **Fecha:** 2026-08-25

## Contexto
El cálculo del semáforo de stock determina cuándo un producto entra en estado crítico (Rojo) o de advertencia (Amarillo). Existía la opción de calcular estos colores directamente en el navegador del usuario utilizando JavaScript ejecutable en el cliente para reducir peticiones al servidor.

## Decisión
Decidimos trasladar y ejecutar el 100% de la evaluación de umbrales del semáforo dentro del **API Backend**, enviando al cliente el estado procesado junto con el payload del producto.

## Consecuencias

### Positivas
* Evita la duplicación de código de reglas de negocio en clientes web, móviles o integración con terceros.
* Garantiza una única fuente de verdad (*Single Source of Truth*) para los estados del inventario.
* Previene alteraciones maliciosas o inconsistencias visuales en el cliente.

### Negativas
* Incrementa ligeramente la carga de procesamiento en la CPU del backend al calcular los estados en cada respuesta de inventario.

---

> **Nota (2026-09-10):** esta decisión fue reemplazada. El semáforo se evalúa en el cliente, dentro de un módulo propio, no en una API.
> El contenido se conserva tal como se aprobó, porque un ADR documenta lo que
> se decidió en su momento; el cambio de rumbo se registra en el [ADR-3](0003-backend-como-servicio-en-lugar-de-api-propia.md).
