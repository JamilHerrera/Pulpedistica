-- ============================================================================
--  014 · Venta por peso y fotos de producto
--
--  Dos cambios que vienen del mostrador real de una pulpería.
--
--  1. NO TODO SE VENDE DE A UNO. Media libra de queso, tres cuartos de
--     frijoles, dos libras y media de azúcar. Hasta acá `cantidad` y
--     `stock_actual` eran `integer`, así que media libra era imposible: había
--     que cobrarla como una unidad y el stock quedaba mintiendo.
--
--     Pero abrir los decimales para TODO sería peor: nadie vende 2.5 cartones
--     de huevos, y si se puede teclear, tarde o temprano alguien lo teclea.
--     Por eso cada producto declara su `unidad`, y es esa unidad la que decide
--     si admite decimales. La restricción vive en la base, no solo en la app:
--     `registrar_venta` rechaza una cantidad fraccionaria de algo que se vende
--     por unidad, venga de donde venga la llamada.
--
--  2. LA FOTO IDENTIFICA MÁS RÁPIDO QUE EL NOMBRE. En una lista de dieciocho
--     productos escritos a las apuradas —"arroz 1 lb", "Huevos por und"—
--     encontrar el correcto leyendo es lento. Se agrega `imagen_url` y un
--     depósito de Storage donde cada negocio escribe solo en su propia carpeta.
--
--  Sobre el tipo elegido: `numeric(10,3)`. Tres decimales porque el caso más
--  fino que aparece en una pulpería es el cuarto de libra (0.25) y el octavo
--  (0.125); y `numeric` y no `float` porque esto multiplica precios, y en
--  binario 0.1 + 0.2 no da 0.3. El dinero y las cantidades que lo generan no
--  se guardan en punto flotante.
-- ============================================================================

-- ── 1. Qué unidad usa cada producto ─────────────────────────────────────────

alter table public.productos
  add column if not exists unidad text not null default 'unidad';

do $unidad_valida$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_unidad_valida') then
    alter table public.productos add constraint productos_unidad_valida
      check (unidad in ('unidad', 'libra', 'kilo'));
  end if;
end
$unidad_valida$;

-- Siembra a partir del nombre, que es donde los productos ya traían la unidad
-- escrita a mano ("Aceite en libra", "arroz 1 lb"). Es una conjetura, no un
-- dato: se corrige producto por producto desde Inventario.
--
-- Corre UNA SOLA VEZ, y por eso mira si la migración ya quedó registrada. Sin
-- esa guarda, volver a ejecutar el archivo revertiría las correcciones: a
-- alguien que hubiera marcado "Aceite en libra" como unidad —porque lo vende
-- en botellas de una libra— el nombre lo volvería a mandar a 'libra'.
do $siembra_unidades$
begin
  if exists (select 1 from public.schema_migrations where version = '014') then
    raise notice 'Las unidades ya se sembraron; no se vuelven a tocar.';
    return;
  end if;

  update public.productos
  set unidad = 'libra'
  where unidad = 'unidad'
    and (nombre ~* '(^|[^a-z])(libras?|lbs?)([^a-z]|$)');

  update public.productos
  set unidad = 'kilo'
  where unidad = 'unidad'
    and (nombre ~* '(^|[^a-z])(kilos?|kgs?)([^a-z]|$)');
end
$siembra_unidades$;

-- ── 2. Cantidades con decimales ─────────────────────────────────────────────
--
--  `alter type` de integer a numeric es seguro y conserva los valores: todo
--  entero cabe. Va envuelto en una comprobación del tipo actual para que
--  reejecutar la migración no vuelva a reescribir las tablas.

do $tipos_numericos$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'productos'
        and column_name = 'stock_actual') <> 'numeric' then
    alter table public.productos
      alter column stock_actual type numeric(10,3) using stock_actual::numeric(10,3);
  end if;

  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'detalle_ventas'
        and column_name = 'cantidad') <> 'numeric' then
    alter table public.detalle_ventas
      alter column cantidad type numeric(10,3) using cantidad::numeric(10,3);
  end if;
end
$tipos_numericos$;

-- Las restricciones de la 007 siguen valiendo tal cual (stock >= 0,
-- cantidad > 0): se aplican igual sobre numeric.
--
-- Falta una y no se puede escribir acá: "una cantidad partida solo vale si el
-- producto se vende por peso" mira la fila de OTRA tabla, y un CHECK de
-- Postgres no admite subconsultas. Esa regla se valida dentro de
-- `registrar_venta` (sección 5), que es la única vía por la que se escribe el
-- detalle: `detalle_ventas` no tiene política de INSERT para la app.

-- ── 3. Foto del producto ────────────────────────────────────────────────────

alter table public.productos
  add column if not exists imagen_url text;

-- ── 4. Dónde viven las fotos ────────────────────────────────────────────────
--
--  Depósito público PARA LEER: la etiqueta <img> pide la foto sin enviar la
--  sesión, y una dirección firmada vencería a los minutos, rompería el caché
--  del service worker y dejaría la app sin fotos al usarla sin internet. Lo
--  que se protege es la ESCRITURA, y con dos condiciones, no una:
--
--    · el primer tramo de la ruta tiene que ser el negocio de quien sube, así
--      que nadie puede tocar las fotos de otra pulpería;
--    · y quien sube tiene que ser ADMINISTRADOR de ese negocio, igual que para
--      escribir en `productos`.
--
--  La segunda condición se agregó después de probarlo: sin ella, un empleado
--  —que no puede ni cambiar el nombre de un producto— sí podía subir archivos
--  y, peor, BORRAR las fotos del catálogo. La pantalla ya lo escondía, pero
--  esconder un botón no es un control de acceso.
--
--  El límite de 2 MB es del lado del servidor. La app además reduce la imagen
--  antes de subirla, pero eso es una cortesía del cliente, no una garantía.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fotos_ver          on storage.objects;
drop policy if exists fotos_subir        on storage.objects;
drop policy if exists fotos_reemplazar   on storage.objects;
drop policy if exists fotos_borrar       on storage.objects;

create policy fotos_ver on storage.objects
  for select to public
  using (bucket_id = 'productos');

-- `storage.foldername(name)` parte la ruta; el primer tramo tiene que ser el
-- identificador del negocio de quien sube. Así la ruta misma es la frontera.
create policy fotos_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = public.mi_negocio()::text
    and public.soy_admin_del_negocio()
  );

create policy fotos_reemplazar on storage.objects
  for update to authenticated
  using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = public.mi_negocio()::text
    and public.soy_admin_del_negocio()
  );

create policy fotos_borrar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = public.mi_negocio()::text
    and public.soy_admin_del_negocio()
  );

-- ── 5. registrar_venta acepta decimales, pero no en cualquier producto ──────
--
--  Cambia respecto de la 012 en tres cosas: los `::int` pasan a `::numeric`,
--  se valida que la cantidad fraccionaria corresponda a un producto que se
--  vende por peso, y el descuento de stock ya no redondea.

create or replace function public.registrar_venta(
  p_idempotency_key uuid,
  p_items           jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $registrar_venta$
declare
  v_negocio_id uuid;
  v_venta_id   uuid;
  v_total      numeric;
  v_item       jsonb;
  v_ajenos     int;
  v_fraccion   int;
begin
  v_negocio_id := public.mi_negocio();
  if v_negocio_id is null then
    raise exception 'El usuario no pertenece a ningun negocio';
  end if;

  if p_idempotency_key is null then
    raise exception 'Se requiere una clave de idempotencia';
  end if;

  select id into v_venta_id
  from public.ventas
  where idempotency_key = p_idempotency_key and negocio_id = v_negocio_id;
  if found then
    return v_venta_id;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  -- Al elevar permisos hay que validar a mano lo que antes garantizaba RLS:
  -- que ningun producto sea de otro negocio.
  select count(*) into v_ajenos
  from jsonb_array_elements(p_items) i
  left join public.productos p on p.id = (i->>'producto_id')::uuid
  where p.id is null or p.negocio_id <> v_negocio_id;

  if v_ajenos > 0 then
    raise exception 'La venta incluye productos que no son de este negocio';
  end if;

  -- Media libra de queso sí; medio cartón de huevos no. La app ya no deja
  -- teclearlo, pero esta es la barrera que vale, porque cubre cualquier
  -- llamada a la API, no solo las que pasan por la pantalla.
  select count(*) into v_fraccion
  from jsonb_array_elements(p_items) i
  join public.productos p on p.id = (i->>'producto_id')::uuid
  where p.unidad = 'unidad'
    and (i->>'cantidad')::numeric <> trunc((i->>'cantidad')::numeric);

  if v_fraccion > 0 then
    raise exception 'Hay productos que se venden por unidad y no admiten cantidades partidas';
  end if;

  select coalesce(sum((i->>'cantidad')::numeric * (i->>'precio_unitario')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_items) i;

  insert into public.ventas (monto_total, idempotency_key, negocio_id)
  values (v_total, p_idempotency_key, v_negocio_id)
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.detalle_ventas (venta_id, producto_id, cantidad, subtotal)
    values (
      v_venta_id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad')::numeric,
      (v_item->>'cantidad')::numeric * (v_item->>'precio_unitario')::numeric
    );

    update public.productos
    set stock_actual = greatest(0, stock_actual - (v_item->>'cantidad')::numeric)
    where id = (v_item->>'producto_id')::uuid and negocio_id = v_negocio_id;
  end loop;

  return v_venta_id;
end;
$registrar_venta$;

revoke all on function public.registrar_venta(uuid, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb) to authenticated;

insert into public.schema_migrations (version, descripcion)
values ('014', 'Venta por peso con cantidades decimales y fotos de producto')
on conflict (version) do nothing;
