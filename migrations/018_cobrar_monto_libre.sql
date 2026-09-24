-- ============================================================================
--  018 · Que "Cobrar un monto libre" vuelva a funcionar
--
--  El ticket 134D93 lo dejó al descubierto: apretar "Cobrar un monto libre" en
--  la pantalla de ventas devolvía 42501, "new row violates row-level security
--  policy for table ventas". No era un permiso mal puesto ni una cuenta rota:
--  era una puerta que se cerró y un camino que se quedó afuera.
--
--  La 012 reemplazó la vieja política `ventas_de_mi_negocio` —que era FOR ALL,
--  y por lo tanto también cubría el INSERT— por dos políticas más finas:
--  `ventas_lectura` (SELECT) y `ventas_admin_modifica` (UPDATE, para anular).
--  Ninguna de las dos permite insertar, y eso fue deliberado: la única forma
--  de registrar una venta debía ser `registrar_venta()`, que es SECURITY
--  DEFINER y garantiza en una sola transacción el detalle, el descuento de
--  stock y la idempotencia. Dejar abierto el INSERT directo habría permitido
--  crear ventas sin detalle y sin descontar nada.
--
--  El problema es que las ventas de monto libre nunca se mudaron a esa
--  función, y no podían: `registrar_venta()` exige al menos un producto, y
--  una venta de monto libre justamente no tiene ninguno —es el "me llevo esto
--  que no está en el catálogo" que se cobra y se anota. Así que desde la 012
--  ese botón estaba roto para todo el mundo, admin incluido.
--
--  La corrección no es abrirle el INSERT a la tabla, porque eso devolvería el
--  agujero que la 012 cerró. Es darle a la venta de monto libre su propia
--  puerta con nombre: una función que hace exactamente eso y nada más.
-- ============================================================================

-- ── 1. La función ───────────────────────────────────────────────────────────
--
-- Hermana de `registrar_venta()`, con las mismas garantías y una diferencia:
-- no toca `detalle_ventas` ni el stock, porque no hay producto que descontar.
-- Eso es lo que la vuelve segura de exponer: no puede alterar el inventario.

create or replace function public.registrar_monto_libre(
  p_idempotency_key uuid,
  p_monto           numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $registrar_monto_libre$
declare
  v_negocio_id uuid;
  v_venta_id   uuid;
begin
  v_negocio_id := public.mi_negocio();
  if v_negocio_id is null then
    raise exception 'El usuario no pertenece a ningun negocio';
  end if;

  if p_idempotency_key is null then
    raise exception 'Se requiere una clave de idempotencia';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto tiene que ser mayor que cero';
  end if;

  -- Un cobro de seis cifras por este camino es un dedazo, no una venta: el
  -- monto libre se escribe a mano y no lo valida ningún precio del catálogo.
  if p_monto > 1000000 then
    raise exception 'El monto es demasiado grande';
  end if;

  -- Mismo contrato de idempotencia que registrar_venta: repetir la llamada
  -- con la misma clave devuelve la venta ya registrada, no crea otra.
  select id into v_venta_id
  from public.ventas
  where idempotency_key = p_idempotency_key and negocio_id = v_negocio_id;
  if found then
    return v_venta_id;
  end if;

  -- Y si dos pedidos con la misma clave corren a la vez, el que pierde la
  -- carrera devuelve la venta del que ganó en lugar de propagar el error.
  begin
    insert into public.ventas (monto_total, idempotency_key, negocio_id)
    values (round(p_monto, 2), p_idempotency_key, v_negocio_id)
    returning id into v_venta_id;
  exception when unique_violation then
    select id into v_venta_id
    from public.ventas
    where idempotency_key = p_idempotency_key;
    return v_venta_id;
  end;

  return v_venta_id;
end;
$registrar_monto_libre$;

-- Como toda función SECURITY DEFINER del proyecto: nadie sin sesión la ve.
revoke all on function public.registrar_monto_libre(uuid, numeric) from public, anon;
grant execute on function public.registrar_monto_libre(uuid, numeric) to authenticated;

comment on function public.registrar_monto_libre(uuid, numeric) is
  'Registra una venta sin productos (monto libre). No toca el stock. '
  'Existe porque ventas no tiene politica de INSERT a proposito: toda venta '
  'entra por una funcion, y registrar_venta() exige al menos un producto.';

insert into public.schema_migrations (version, descripcion)
values ('018', 'Cobrar un monto libre vuelve a funcionar, por su propia funcion')
on conflict (version) do nothing;
