# Migraciones

Historial del esquema de PulpeAnálisis, en orden. Cada archivo es un paso
independiente y **idempotente**: volver a ejecutarlo no rompe nada ni duplica
datos, así que ante la duda se puede correr todo de nuevo.

## Cómo aplicarlas

En Supabase → **SQL Editor** → **New query**, pegar el contenido de cada
archivo **en orden numérico** y darle *Run*.

```
000 → 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010
```

Cada migración anota su versión en `public.schema_migrations`. Para ver qué
está aplicado:

```sql
select version, descripcion, aplicada_en
from public.schema_migrations
order by version;
```

## Qué hace cada una

| # | Archivo | Qué cambia |
|---|---|---|
| 000 | `000_control_de_migraciones.sql` | Tabla `schema_migrations` que registra el historial |
| 001 | `001_esquema_base.sql` | Catálogo (`categorias`, `productos`) y ventas (`ventas`, `detalle_ventas`) |
| 002 | `002_clientes_y_fiados.sql` | `clientes` y `fiados` para la venta a crédito |
| 003 | `003_precio_de_catalogo.sql` | `productos.precio`, que antes vivía en el navegador |
| 004 | `004_indices.sql` | Índices de las consultas reales de la app |
| 005 | `005_seguridad_rls.sql` | RLS: solo usuarios autenticados leen y escriben |
| 006 | `006_realtime.sql` | Publicación realtime para refrescar sin recargar |
| 007 | `007_integridad.sql` | `NOT NULL`, defaults, rangos válidos y nombres únicos |
| 008 | `008_idempotencia.sql` | Claves de idempotencia en `ventas` y `fiados` |
| 009 | `009_operaciones_transaccionales.sql` | `registrar_venta` y `anular_venta`: atómicas e idempotentes |
| 010 | `010_multi_negocio.sql` | Cada pulpería ve solo sus datos; alta automática al registrarse |

## Notas

- **001 reconstruye tablas que ya existían.** Se crearon a mano en Supabase
  antes de versionar el esquema; el archivo las declara con `if not exists`
  para que una base vacía pueda levantarse desde cero sin tocar la actual.
- **007 se escribió después de auditar los datos reales.** Se verificó que
  ninguna fila incumple las nuevas restricciones, así que no pueden fallar al
  aplicarse.
- Para volcar el esquema real a `docs/db-export.json`, usar
  `docs/export-schema.sql`.
