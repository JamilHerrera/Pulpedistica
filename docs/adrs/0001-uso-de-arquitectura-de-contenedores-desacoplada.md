# 1. Uso de arquitectura de contenedores desacoplada para la gestión de inventario

* **Estatus:** Aprobado
* **Fecha:** 2026-08-25

## Contexto
El sistema Pulpedística requiere gestionar inventario en tiempo real y mostrar alertas visuales mediante un semáforo de productos (Rojo, Amarillo, Verde). Necesitamos una arquitectura que permita mantener la lógica del semáforo centralizada y evitar que las reglas de negocio queden acopladas a la interfaz gráfica o a la base de datos, garantizando que el sistema sea fácil de mantener y escalar.

## Decisión
Adoptaremos una arquitectura basada en contenedores desacoplados (Nivel 2 de C4):
1. **Frontend SPA (JavaScript):** Responsable únicamente de la presentación y la interfaz del semáforo.
2. **API Backend (Node.js / Express):** Encargada de calcular los estados del semáforo, aplicar las reglas de reabastecimiento y exponer endpoints REST.
3. **Base de Datos Relacional (PostgreSQL / MySQL):** Destinada al almacenamiento persistente del catálogo, niveles de stock y movimientos.

## Consecuencias

### Positivas
* Permite evolucionar o cambiar la interfaz de usuario sin alterar las reglas de cálculo del semáforo en el backend.
* Facilita la creación de pruebas unitarias sobre la lógica de reabastecimiento independientemente de la base de datos o la interfaz.
* Mejora la trazabilidad de la lógica de negocio al centralizarla en el servicio de API.

### Negativas
* Añade la complejidad de gestionar latencia y comunicación mediante red (JSON/HTTPS) entre la SPA y la API.
* Requiere mantener y desplegar de forma independiente múltiples entornos de ejecución.
