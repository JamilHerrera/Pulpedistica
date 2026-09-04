-- ============================================================================
--  009 · Registrar y anular ventas dentro de una transacción
--
--  Hasta ahora la app hacía una venta con tres escrituras sueltas: insertar
--  la venta, insertar el detalle y descontar el stock de cada producto. Sin
--  transacción, un corte de red a mitad dejaba una venta sin detalle o con el
--  stock a medio descontar, y no había forma de saberlo después.
--
--  Además ninguna de las dos operaciones era idempotente:
--    · tocar dos veces "Confirmar" creaba DOS ventas y descontaba doble;
--    · anular dos veces la misma venta devolvía el stock DOS veces, inflando
--      el inventario con mercadería que no existe.
--
--  Estas funciones resuelven ambas cosas: son atómicas (o pasa todo o no pasa
--  nada) y repetirlas no cambia el resultado.
--
--  Van con `security invoker` para que las políticas RLS se sigan evaluando
--  con la identidad de quien llama, no con la del dueño de la función.
-- ============================================================================

-- ── Registrar una venta ────────────────────────────────────────────────────
-- p_items: [{"producto_id": uuid, "cantidad": int, "precio_unitario": numeric}]
create or replace function public.registrar_venta(
  p_idempotency_key uuid,
  p_items           jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta_id uuid;
  v_total    numeric;
  v_item     jsonb;
begin
  if p_idempotency_key is null then
    raise exception 'Se requiere una clave de idempotencia';
  end if;

  -- Si esta operación ya se registró, se devuelve la venta original.
  select id into v_venta_id
  from public.ventas
  where idempotency_key = p_idempotency_key;

  if found then
    return v_venta_id;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  select coalesce(sum((i->>'cantidad')::int * (i->>'precio_unitario')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_items) i;

  insert into public.ventas (monto_total, idempotency_key)
  values (v_total, p_idempotency_key)
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.detalle_ventas (venta_id, producto_id, cantidad, subtotal)
    values (
      v_venta_id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad')::int,
      (v_item->>'cantidad')::int * (v_item->>'precio_unitario')::numeric
    );

    -- greatest(0, ...) respeta el check de stock no negativo aunque el
    -- inventario esté desfasado respecto de lo que se vende.
    update public.productos
    set stock_actual = greatest(0, stock_actual - (v_item->>'cantidad')::int)
    where id = (v_item->>'producto_id')::uuid;
  end loop;

  return v_venta_id;
end;
$$;

-- ── Anular una venta ───────────────────────────────────────────────────────
-- Devuelve true si la anuló ahora, false si ya estaba anulada.
create or replace function public.anular_venta(p_venta_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_afectadas int;
  v_linea     record;
begin
  -- La condición `anulada = false` es la que hace idempotente la operación:
  -- en el segundo intento no afecta ninguna fila y el stock no se devuelve
  -- por segunda vez.
  update public.ventas
  set anulada = true
  where id = p_venta_id and anulada = false;

  get diagnostics v_afectadas = row_count;
  if v_afectadas = 0 then
    return false;
  end if;

  for v_linea in
    select producto_id, cantidad
    from public.detalle_ventas
    where venta_id = p_venta_id and producto_id is not null
  loop
    update public.productos
    set stock_actual = stock_actual + v_linea.cantidad
    where id = v_linea.producto_id;
  end loop;

  return true;
end;
$$;

revoke all on function public.registrar_venta(uuid, jsonb) from public, anon;
revoke all on function public.anular_venta(uuid)           from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb) to authenticated;
grant execute on function public.anular_venta(uuid)           to authenticated;

insert into public.schema_migrations (version, descripcion)
values ('009', 'Funciones transaccionales e idempotentes registrar_venta y anular_venta')
on conflict (version) do nothing;
