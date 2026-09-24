-- ============================================================================
--  Limpieza de negocios huérfanos (datos de prueba)
--
--  Uso: Supabase → SQL Editor → New query. Correr PRIMERO el paso 1, mirar lo
--  que lista, y recién entonces el paso 2.
--
--  QUÉ BORRA. Únicamente los negocios que no tienen NINGÚN perfil asociado,
--  es decir, aquellos cuyos usuarios ya fueron eliminados de Authentication.
--  A esos datos no puede llegar nadie: las políticas RLS filtran por el
--  negocio del usuario que consulta, y si no queda ningún usuario en ese
--  negocio, sus filas son inalcanzables desde la aplicación.
--
--  QUÉ NO PUEDE BORRAR. Cualquier negocio con al menos un usuario vivo, y eso
--  incluye el tuyo. No hay forma de que esta consulta lo alcance: la condición
--  es la ausencia total de perfiles.
--
--  POR QUÉ ALCANZA CON BORRAR EL NEGOCIO. Las seis tablas de datos
--  —categorias, productos, ventas, detalle_ventas, clientes, fiados— declaran
--  su `negocio_id` con `on delete cascade` (migración 010), así que al
--  eliminar la fila del negocio se van con ella todas sus filas. `feedback` y
--  `tickets` usan `on delete set null`: no se borran, solo pierden la
--  referencia al negocio, que es lo correcto porque son datos del producto y
--  no de una pulpería.
--
--  ANTES DE CORRER ESTO: si todavía quedan cuentas de prueba en
--  Authentication → Users, borralas primero. Al eliminar el usuario
--  desaparece su perfil, y recién entonces su negocio queda huérfano y entra
--  en esta limpieza.
-- ============================================================================

-- ── Paso 1: ver qué se va a borrar (no modifica nada) ───────────────────────

select
  n.id,
  n.nombre,
  n.created_at,
  (select count(*) from public.productos      p where p.negocio_id = n.id) as productos,
  (select count(*) from public.ventas         v where v.negocio_id = n.id) as ventas,
  (select count(*) from public.detalle_ventas d where d.negocio_id = n.id) as lineas,
  (select count(*) from public.clientes       c where c.negocio_id = n.id) as clientes,
  (select count(*) from public.fiados         f where f.negocio_id = n.id) as fiados
from public.negocios n
where not exists (select 1 from public.perfiles pf where pf.negocio_id = n.id)
order by n.created_at;

-- ── Paso 2: borrarlos ───────────────────────────────────────────────────────
--
--  Va dentro de un bloque que informa cuánto borró, para dejar constancia en
--  la salida de lo que efectivamente se eliminó.

do $limpieza$
declare
  v_negocios int;
  v_ventas   int;
  v_lineas   int;
begin
  select
    count(*),
    coalesce(sum((select count(*) from public.ventas         v where v.negocio_id = n.id)), 0),
    coalesce(sum((select count(*) from public.detalle_ventas d where d.negocio_id = n.id)), 0)
  into v_negocios, v_ventas, v_lineas
  from public.negocios n
  where not exists (select 1 from public.perfiles pf where pf.negocio_id = n.id);

  if v_negocios = 0 then
    raise notice 'No hay negocios huerfanos: nada que limpiar.';
    return;
  end if;

  delete from public.negocios n
  where not exists (select 1 from public.perfiles pf where pf.negocio_id = n.id);

  raise notice 'Borrados % negocios huerfanos, con % ventas y % lineas de detalle.',
    v_negocios, v_ventas, v_lineas;
end
$limpieza$;

-- ── Paso 3: comprobar cómo quedó ────────────────────────────────────────────

select
  (select count(*) from public.negocios)       as negocios,
  (select count(*) from public.perfiles)       as perfiles,
  (select count(*) from public.productos)      as productos,
  (select count(*) from public.ventas)         as ventas,
  (select count(*) from public.detalle_ventas) as lineas;

-- Después de esto conviene regenerar el modelo de datos exportado, para que
-- `docs/db-export.json` refleje los números reales del negocio y no los de
-- las pruebas: correr `docs/export-schema.sql` y reemplazar el archivo.
