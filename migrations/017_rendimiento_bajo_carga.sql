-- ============================================================================
--  017 · Que los números no mientan cuando hay volumen
--
--  Una prueba de carga contra un negocio aislado mostró el problema real: la
--  API de Supabase devuelve como máximo 1000 filas por consulta, y lo hace EN
--  SILENCIO, sin error. Con 1161 líneas de venta en el mes, la pantalla de
--  Análisis recibía 1000, sumaba lo que le llegaba, y mostraba L 10 000 de
--  ingresos cuando el real era L 11 610. Un 14% menos, sin un solo aviso.
--
--  La causa es de diseño, no de un límite mal puesto: cinco pantallas bajaban
--  las líneas de venta crudas al navegador para sumarlas ahí. Eso tiene tres
--  costos que crecen con cada venta, y una prueba de estrés los dispara todos:
--
--    1. Se corta en 1000 filas y el resultado es falso sin avisar.
--    2. Pesa: Análisis bajaba 190 KB por apertura para mostrar diez números.
--    3. Se vuelve lento, porque la latencia sigue al volumen de datos.
--
--  Levantar ese límite no arregla nada: solo corre el precipicio de lugar y
--  multiplica la transferencia. La corrección es no mandar filas crudas.
--  Estas funciones suman EN LA BASE y devuelven una fila por producto o por
--  día: el tamaño de la respuesta ya no depende de cuántas ventas haya.
--
--  Todas son SECURITY INVOKER (el valor por defecto, sin `security definer`):
--  corren con los permisos de quien llama, así que las políticas RLS siguen
--  filtrando por negocio igual que en una consulta directa. No hay que
--  repetir el filtro de negocio a mano ni se puede olvidar.
-- ============================================================================

-- ── 1. Índice compuesto para "las ventas de mi negocio desde tal fecha" ─────
--
--  Es la forma de TODAS las consultas de este archivo: RLS agrega el filtro
--  por negocio y la función agrega el de fecha. Con dos índices separados el
--  motor tiene que elegir uno y recorrer el resto; con este resuelve las dos
--  condiciones en un solo recorrido.

create index if not exists idx_ventas_negocio_fecha
  on public.ventas (negocio_id, fecha_hora desc);

-- ── 2. Rotación por producto: sirve al Semáforo, a Pedidos y a Estancados ───
--
--  Una fila por producto con lo vendido en 7, 15 y 30 días, y la fecha de su
--  última venta. Reemplaza tres cálculos que hacía el navegador, uno de los
--  cuales (Estancados) además armaba una consulta con cientos de
--  identificadores en la URL, que a partir de cierto volumen se cae por largo.

create or replace function public.rotacion_productos()
returns table (
  producto_id  uuid,
  u7           numeric,
  u15          numeric,
  u30          numeric,
  ultima_venta timestamptz
)
language sql
stable
set search_path = public
as $rotacion$
  with lineas as (
    select d.producto_id, d.cantidad, v.fecha_hora
    from public.detalle_ventas d
    join public.ventas v on v.id = d.venta_id
    where not v.anulada
  )
  select
    p.id,
    coalesce(sum(l.cantidad) filter (where l.fecha_hora >= now() - interval '7 days'),  0),
    coalesce(sum(l.cantidad) filter (where l.fecha_hora >= now() - interval '15 days'), 0),
    coalesce(sum(l.cantidad) filter (where l.fecha_hora >= now() - interval '30 days'), 0),
    max(l.fecha_hora)
  from public.productos p
  left join lineas l on l.producto_id = p.id
  group by p.id;
$rotacion$;

-- ── 3. Ventas por día ──────────────────────────────────────────────────────
--
--  El día se cuenta en hora de Honduras, no en UTC. La versión anterior
--  agrupaba por la fecha UTC, y como Honduras está seis horas atrás, toda
--  venta hecha después de las 6 de la tarde aparecía en el día siguiente. En
--  una pulpería, la tarde es justamente cuando más se vende.

create or replace function public.ventas_por_dia(p_desde timestamptz)
returns table (dia date, monto numeric, ventas bigint)
language sql
stable
set search_path = public
as $por_dia$
  select
    (v.fecha_hora at time zone 'America/Tegucigalpa')::date as dia,
    sum(v.monto_total),
    count(*)
  from public.ventas v
  where not v.anulada
    and v.fecha_hora >= p_desde
  group by 1
  order by 1;
$por_dia$;

-- ── 4. Los productos que más se vendieron ──────────────────────────────────
--
--  Agrupa por producto y RECIÉN DESPUÉS corta. El Dashboard hacía al revés:
--  pedía las 5 líneas de venta con más cantidad y agrupaba esas cinco, así
--  que su "top 5" eran las cinco ventas individuales más grandes, no los
--  cinco productos que más se vendieron. Tampoco excluía las anuladas.

create or replace function public.top_productos(p_desde timestamptz, p_limite int default 8)
returns table (producto_id uuid, nombre text, cantidad numeric, subtotal numeric)
language sql
stable
set search_path = public
as $top$
  select p.id, p.nombre::text, sum(d.cantidad), sum(d.subtotal)
  from public.detalle_ventas d
  join public.ventas v    on v.id = d.venta_id
  join public.productos p on p.id = d.producto_id
  where not v.anulada
    and v.fecha_hora >= p_desde
  group by p.id, p.nombre
  order by sum(d.cantidad) desc
  -- Tope defensivo: nadie necesita un ranking de mil, y un parámetro
  -- desmedido no debe poder convertir esto en otra descarga masiva.
  limit greatest(1, least(coalesce(p_limite, 8), 50));
$top$;

-- ── 5. Ventas por categoría ────────────────────────────────────────────────

create or replace function public.ventas_por_categoria(p_desde timestamptz)
returns table (nombre text, color text, total numeric)
language sql
stable
set search_path = public
as $por_categoria$
  select
    coalesce(c.nombre::text, 'Sin categoría'),
    coalesce(c.color_semaforo::text, 'gris'),
    sum(d.subtotal)
  from public.detalle_ventas d
  join public.ventas v         on v.id = d.venta_id
  left join public.productos p on p.id = d.producto_id
  left join public.categorias c on c.id = p.categoria_id
  where not v.anulada
    and v.fecha_hora >= p_desde
  group by 1, 2
  order by 3 desc;
$por_categoria$;

revoke all on function public.rotacion_productos()                 from public, anon;
revoke all on function public.ventas_por_dia(timestamptz)          from public, anon;
revoke all on function public.top_productos(timestamptz, int)      from public, anon;
revoke all on function public.ventas_por_categoria(timestamptz)    from public, anon;
grant execute on function public.rotacion_productos()              to authenticated;
grant execute on function public.ventas_por_dia(timestamptz)       to authenticated;
grant execute on function public.top_productos(timestamptz, int)   to authenticated;
grant execute on function public.ventas_por_categoria(timestamptz) to authenticated;

-- ── 6. registrar_venta: la carrera del doble clic ──────────────────────────
--
--  La 015 buscaba la clave y, si no estaba, insertaba. Entre esos dos pasos
--  hay una ventana: dos pedidos con la MISMA clave llegan juntos, ninguno ve
--  al otro, los dos intentan insertar, y el índice único rechaza al segundo
--  con un error. La venta existe —el índice impide el duplicado— pero quien
--  mandó el segundo pedido recibe un error y la pantalla dice "no se pudo
--  guardar" sobre una venta que sí se guardó.
--
--  Ahora esa violación se atrapa y se devuelve la venta que ganó, que es lo
--  que la idempotencia promete: mismo pedido, misma respuesta.
--
--  Todo lo demás es idéntico a la 015.

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
  v_faltante   record;
  v_actualizo  int;
  v_nombre     text;
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

  select count(*) into v_ajenos
  from jsonb_array_elements(p_items) i
  left join public.productos p on p.id = (i->>'producto_id')::uuid
  where p.id is null or p.negocio_id <> v_negocio_id;

  if v_ajenos > 0 then
    raise exception 'La venta incluye productos que no son de este negocio';
  end if;

  select count(*) into v_fraccion
  from jsonb_array_elements(p_items) i
  join public.productos p on p.id = (i->>'producto_id')::uuid
  where p.unidad = 'unidad'
    and (i->>'cantidad')::numeric <> trunc((i->>'cantidad')::numeric);

  if v_fraccion > 0 then
    raise exception 'Hay productos que se venden por unidad y no admiten cantidades partidas';
  end if;

  select p.nombre, p.stock_actual, sum((i->>'cantidad')::numeric) as pedida
  into v_faltante
  from jsonb_array_elements(p_items) i
  join public.productos p on p.id = (i->>'producto_id')::uuid
  group by p.id, p.nombre, p.stock_actual
  having sum((i->>'cantidad')::numeric) > p.stock_actual
  limit 1;

  if found then
    raise exception 'No hay suficiente % : quedan % y se piden %',
      v_faltante.nombre, v_faltante.stock_actual, v_faltante.pedida;
  end if;

  select coalesce(sum((i->>'cantidad')::numeric * (i->>'precio_unitario')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_items) i;

  -- La única diferencia con la 015: si otro pedido con la misma clave ganó
  -- la carrera, se devuelve su venta en vez de propagar el error.
  begin
    insert into public.ventas (monto_total, idempotency_key, negocio_id)
    values (v_total, p_idempotency_key, v_negocio_id)
    returning id into v_venta_id;
  exception when unique_violation then
    select id into v_venta_id
    from public.ventas
    where idempotency_key = p_idempotency_key;
    return v_venta_id;
  end;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.detalle_ventas (venta_id, producto_id, cantidad, subtotal)
    values (
      v_venta_id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad')::numeric,
      (v_item->>'cantidad')::numeric * (v_item->>'precio_unitario')::numeric
    );

    update public.productos
    set stock_actual = stock_actual - (v_item->>'cantidad')::numeric
    where id = (v_item->>'producto_id')::uuid
      and negocio_id = v_negocio_id
      and stock_actual >= (v_item->>'cantidad')::numeric;

    get diagnostics v_actualizo = row_count;

    if v_actualizo = 0 then
      select nombre into v_nombre from public.productos
      where id = (v_item->>'producto_id')::uuid;
      raise exception 'No hay suficiente % para completar la venta', coalesce(v_nombre, 'producto');
    end if;
  end loop;

  return v_venta_id;
end;
$registrar_venta$;

revoke all on function public.registrar_venta(uuid, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb) to authenticated;

-- ── 7. Políticas: que la función se evalúe una vez por consulta ────────────
--
--  Las políticas decían `negocio_id = public.mi_negocio()`. Escrito así,
--  Postgres puede volver a llamar a la función POR CADA FILA que examina: si
--  la consulta recorre 50 000 ventas, son 50 000 búsquedas en `perfiles`.
--  Envolviéndola en un subselect —`(select public.mi_negocio())`— el
--  planificador la trata como una constante: la calcula una vez al empezar
--  y la reutiliza. Es la recomendación explícita de Supabase para RLS bajo
--  carga, y el efecto crece justo con lo que mide una prueba de estrés.
--
--  Se hace con ALTER POLICY y no reescribiendo cada política a mano. Son
--  39 apariciones repartidas en siete migraciones, y reconstruirlas copiando
--  y pegando es la forma más segura de romper un control de acceso sin
--  darse cuenta. ALTER POLICY cambia SOLO las expresiones: no toca el nombre,
--  la operación, los roles ni si es permisiva, así que lo que la política
--  permite queda exactamente igual. Lo único que cambia es cuántas veces se
--  evalúa la función.
--
--  Es reejecutable: una política que ya tiene un subselect se salta, así que
--  correr esto dos veces no envuelve la función dos veces.

do $envolver_politicas$
declare
  pol         record;
  v_using     text;
  v_check     text;
  v_patron    constant text := '(public\.)?(mi_negocio|soy_admin_del_negocio|soy_soporte)\(\)';
  v_sentencia text;
  v_tocadas   int := 0;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~ v_patron or with_check ~ v_patron
           or qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)')
  loop
    -- Ya optimizada en una corrida anterior: no se vuelve a envolver.
    if coalesce(pol.qual, '') ~* 'select' or coalesce(pol.with_check, '') ~* 'select' then
      continue;
    end if;

    v_using := pol.qual;
    v_check := pol.with_check;

    if v_using is not null then
      v_using := regexp_replace(v_using, v_patron, '(select public.\2())', 'g');
      v_using := regexp_replace(v_using, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    end if;
    if v_check is not null then
      v_check := regexp_replace(v_check, v_patron, '(select public.\2())', 'g');
      v_check := regexp_replace(v_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    end if;

    v_sentencia := format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    if v_using is not null then
      v_sentencia := v_sentencia || format(' using (%s)', v_using);
    end if;
    if v_check is not null then
      v_sentencia := v_sentencia || format(' with check (%s)', v_check);
    end if;

    execute v_sentencia;
    v_tocadas := v_tocadas + 1;
  end loop;

  raise notice 'Politicas optimizadas: %', v_tocadas;
end
$envolver_politicas$;

insert into public.schema_migrations (version, descripcion)
values ('017', 'Agregacion en la base: los totales no se cortan en 1000 filas')
on conflict (version) do nothing;
