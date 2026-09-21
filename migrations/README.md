# Migraciones

Historial del esquema de PulpeAnálisis, en orden. Cada archivo es un paso
independiente y **idempotente**: volver a ejecutarlo no rompe nada ni duplica
datos, así que ante la duda se puede correr todo de nuevo.

## Cómo aplicarlas

En Supabase → **SQL Editor** → **New query**, pegar el contenido de cada
archivo **en orden numérico** y darle *Run*.

```
000 → 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016
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
| 011 | `011_retroalimentacion.sql` | Comentarios de los usuarios, visibles para soporte |
| 012 | `012_roles_y_invitaciones.sql` | Roles admin/empleado dentro del negocio, con invitaciones |
| 013 | `013_tickets_de_errores.sql` | La app abre tickets sola cuando algo falla, uno por problema |
| 014 | `014_unidades_y_fotos.sql` | Venta por peso con cantidades decimales, y fotos de producto |
| 015 | `015_no_vender_sin_stock.sql` | La venta se rechaza si no alcanza el stock, en vez de toparse en cero |
| 016 | `016_sin_categorias_de_rotacion.sql` | Deja de sembrar categorías de rotación: el semáforo se calcula solo |

## Notas

- **001 reconstruye tablas que ya existían.** Se crearon a mano en Supabase
  antes de versionar el esquema; el archivo las declara con `if not exists`
  para que una base vacía pueda levantarse desde cero sin tocar la actual.
- **007 se escribió después de auditar los datos reales.** Se verificó que
  ninguna fila incumple las nuevas restricciones, así que no pueden fallar al
  aplicarse.
- Para volcar el esquema real a `docs/db-export.json`, usar
  `docs/export-schema.sql`.
- **Cuidado con dos nombres parecidos.** `perfiles.rol` (`admin`/`empleado`)
  define qué puede hacer alguien **dentro de su pulpería**.
  `perfiles.es_soporte` es otra cosa: quien mantiene la aplicación y lee los
  comentarios y los tickets de todos los negocios.
- **013 no tiene política de `INSERT`, y es a propósito.** En `tickets` se
  escribe únicamente llamando a `reportar_error()`, que es `SECURITY DEFINER`.
  Esa función es la que garantiza el contador de `veces`, el recorte de los
  textos y el tope anti-inundación; si la app pudiera insertar filas a mano,
  un navegador en bucle llenaría la tabla.
- **014 cambia el tipo de dos columnas.** `productos.stock_actual` y
  `detalle_ventas.cantidad` pasan de `integer` a `numeric(10,3)`. Es seguro
  —todo entero cabe— y el archivo comprueba el tipo actual antes de tocar
  nada, así que reejecutarlo no vuelve a reescribir las tablas.
- **014 también crea un depósito de Storage.** Es público para LEER, porque
  una etiqueta `<img>` pide la foto sin mandar la sesión. Lo que se protege es
  la escritura: las políticas exigen que el primer tramo de la ruta sea el
  negocio de quien sube, así que ninguna pulpería puede pisar las fotos de otra.
- **016 corrige un error de diseño de la 010.** Cada negocio nuevo nacía con
  tres categorías —"Alta Rotación", "Rotación Media", "Baja Rotación"— de un
  diseño anterior donde la rotación se elegía a mano al cargar el producto.
  Ese diseño quedó reemplazado por el cálculo automático de `lib/semaforo.ts`
  (por ventas reales, no por categoría), pero la siembra se quedó pegada y
  terminaba contradiciendo al semáforo real. Identifica las categorías por
  nombre exacto: un negocio que hubiera renombrado una a propósito no la
  pierde, porque ya no coincide con el nombre que puso el disparador.
