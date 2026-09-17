-- ============================================================================
--  015 · No se puede vender lo que no hay
--
--  Hasta acá `registrar_venta` descontaba con `greatest(0, stock - cantidad)`:
--  si la venta superaba las existencias, el stock se quedaba en cero y la
--  venta pasaba igual. El dinero quedaba bien registrado, pero el inventario
--  mentía en silencio —salían cuatro huevos y el número seguía en cero— así
--  que ni la alerta de stock ni el semáforo volvían a decir la verdad sobre
--  ese producto.
--
--  Ahora la venta se rechaza. Es una decisión del dueño del negocio y tiene su
--  costo, que conviene dejar escrito: si la mercadería ya llegó y nadie la
--  cargó al sistema, la app no deja cobrarle a un cliente que está esperando,
--  y hay que ir a Inventario primero.
--
--  SOBRE LA CONCURRENCIA. No alcanza con mirar el stock y después restar: dos
--  ventas simultáneas del último paquete pasarían las dos la comprobación y la
--  segunda dejaría el stock en negativo, que además viola el CHECK de la 007.
--  Por eso el descuento real va como un UPDATE CONDICIONAL —`where stock_actual
--  >= cantidad`— que es atómico sobre la fila: si no actualiza nada, es que
--  alguien se adelantó, y ahí se rechaza. La comprobación previa existe solo
--  para poder decir QUÉ producto y CUÁNTO hay; la que garantiza es la de
--  abajo.
-- ============================================================================

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

  -- Repetir una venta ya registrada devuelve la misma y NO vuelve a descontar,
  -- así que tampoco se le vuelve a exigir stock: la mercadería ya salió.
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

  -- Media libra de queso sí; medio cartón de huevos no.
  select count(*) into v_fraccion
  from jsonb_array_elements(p_items) i
  join public.productos p on p.id = (i->>'producto_id')::uuid
  where p.unidad = 'unidad'
    and (i->>'cantidad')::numeric <> trunc((i->>'cantidad')::numeric);

  if v_fraccion > 0 then
    raise exception 'Hay productos que se venden por unidad y no admiten cantidades partidas';
  end if;

  -- Comprobación previa, solo para el mensaje. Se agrupa por producto porque
  -- la misma mercadería puede venir en dos líneas del mismo pedido, y lo que
  -- importa es el total pedido contra lo que hay.
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

    -- El descuento que manda: condicional y atómico. Ya no hay `greatest`,
    -- así que el stock no se topa en cero escondiendo el faltante.
    update public.productos
    set stock_actual = stock_actual - (v_item->>'cantidad')::numeric
    where id = (v_item->>'producto_id')::uuid
      and negocio_id = v_negocio_id
      and stock_actual >= (v_item->>'cantidad')::numeric;

    get diagnostics v_actualizo = row_count;

    if v_actualizo = 0 then
      select nombre into v_nombre from public.productos
      where id = (v_item->>'producto_id')::uuid;
      -- Se llega acá si otra venta se adelantó entre la comprobación y esto.
      raise exception 'No hay suficiente % para completar la venta', coalesce(v_nombre, 'producto');
    end if;
  end loop;

  return v_venta_id;
end;
$registrar_venta$;

revoke all on function public.registrar_venta(uuid, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb) to authenticated;

insert into public.schema_migrations (version, descripcion)
values ('015', 'La venta se rechaza si no alcanza el stock, en vez de toparse en cero')
on conflict (version) do nothing;
