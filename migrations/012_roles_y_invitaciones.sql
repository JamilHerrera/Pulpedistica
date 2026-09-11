-- ============================================================================
--  012 · Administradores y empleados dentro de cada negocio
--
--  Hasta acá todos los usuarios de un negocio podían todo. Eso alcanza cuando
--  el dueño atiende solo, pero no cuando entra alguien a atender el mostrador:
--  esa persona necesita cobrar, no necesita poder anular ventas ni ver los
--  márgenes del negocio.
--
--  Se definen dos roles:
--    · admin    — el dueño. Hace todo, incluido gestionar a los demás.
--    · empleado — cobra, consulta stock y anota fiados. No anula ventas, no
--                 edita el catálogo, no borra deudas y no ve Análisis.
--
--  Lo importante: los límites se aplican en la BASE, con políticas y con
--  funciones. Esconder un botón no es seguridad; si solo se ocultara en la
--  pantalla, cualquiera podría llamar a la API igual.
-- ============================================================================

-- ── 1. El rol ───────────────────────────────────────────────────────────────
--
--  Por defecto 'admin': quien se registra crea su propio negocio y es su
--  dueño. Los empleados llegan por invitación (sección 3).
alter table public.perfiles
  add column if not exists rol text not null default 'admin';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_rol_valido') then
    alter table public.perfiles add constraint perfiles_rol_valido
      check (rol in ('admin', 'empleado'));
  end if;
end $$;

-- SECURITY DEFINER, igual que mi_negocio(): las políticas consultan esta
-- función y leer `perfiles` con RLS aplicado entraría en recursión.
create or replace function public.soy_admin_del_negocio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select rol = 'admin' from public.perfiles where id = auth.uid()), false);
$$;

revoke all on function public.soy_admin_del_negocio() from public, anon;
grant execute on function public.soy_admin_del_negocio() to authenticated;

-- Los miembros del negocio se ven entre sí; solo el admin cambia roles.
drop policy if exists perfiles_el_mio            on public.perfiles;
drop policy if exists perfiles_de_mi_negocio     on public.perfiles;
drop policy if exists perfiles_admin_gestiona    on public.perfiles;

create policy perfiles_de_mi_negocio on public.perfiles
  for select to authenticated
  using (id = auth.uid() or negocio_id = public.mi_negocio());

create policy perfiles_admin_gestiona on public.perfiles
  for update to authenticated
  using (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio())
  with check (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio());

-- ── 2. Qué puede hacer cada rol ─────────────────────────────────────────────
--
--  Catálogo: todos LEEN (hay que poder vender y consultar stock), solo el
--  admin escribe. El descuento de stock al vender no pasa por acá: lo hace
--  registrar_venta, que más abajo se vuelve SECURITY DEFINER.

drop policy if exists productos_de_mi_negocio   on public.productos;
drop policy if exists categorias_de_mi_negocio  on public.categorias;
drop policy if exists productos_lectura         on public.productos;
drop policy if exists productos_admin_escribe   on public.productos;
drop policy if exists categorias_lectura        on public.categorias;
drop policy if exists categorias_admin_escribe  on public.categorias;

create policy productos_lectura on public.productos
  for select to authenticated using (negocio_id = public.mi_negocio());

create policy productos_admin_escribe on public.productos
  for all to authenticated
  using (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio())
  with check (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio());

create policy categorias_lectura on public.categorias
  for select to authenticated using (negocio_id = public.mi_negocio());

create policy categorias_admin_escribe on public.categorias
  for all to authenticated
  using (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio())
  with check (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio());

--  Ventas: todos las ven y las registran (vía la función). Anularlas es
--  destructivo y devuelve stock, así que queda solo para el admin.
drop policy if exists ventas_de_mi_negocio    on public.ventas;
drop policy if exists ventas_lectura          on public.ventas;
drop policy if exists ventas_admin_modifica   on public.ventas;

create policy ventas_lectura on public.ventas
  for select to authenticated using (negocio_id = public.mi_negocio());

create policy ventas_admin_modifica on public.ventas
  for update to authenticated
  using (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio())
  with check (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio());

drop policy if exists detalle_ventas_de_mi_negocio on public.detalle_ventas;
drop policy if exists detalle_ventas_lectura       on public.detalle_ventas;

create policy detalle_ventas_lectura on public.detalle_ventas
  for select to authenticated using (negocio_id = public.mi_negocio());

--  Fiados: el empleado anota una deuda y la marca pagada, pero borrarla
--  —que hace desaparecer el registro— es del admin.
drop policy if exists clientes_de_mi_negocio on public.clientes;
drop policy if exists fiados_de_mi_negocio   on public.fiados;
drop policy if exists clientes_del_negocio   on public.clientes;
drop policy if exists fiados_del_negocio     on public.fiados;
drop policy if exists fiados_admin_borra     on public.fiados;

create policy clientes_del_negocio on public.clientes
  for all to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy fiados_del_negocio on public.fiados
  for select to authenticated using (negocio_id = public.mi_negocio());

create policy fiados_insertar on public.fiados
  for insert to authenticated with check (negocio_id = public.mi_negocio());

create policy fiados_actualizar on public.fiados
  for update to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy fiados_admin_borra on public.fiados
  for delete to authenticated
  using (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio());

-- ── 3. Invitaciones ─────────────────────────────────────────────────────────
--
--  Sin esto el rol de empleado seria teorico: nadie podria sumarse a un
--  negocio existente, porque registrarse siempre crea uno nuevo. El admin
--  genera un codigo y quien se registre con el entra a SU negocio.
create table if not exists public.invitaciones (
  codigo      text        primary key,
  negocio_id  uuid        not null references public.negocios(id) on delete cascade,
  rol         text        not null default 'empleado',
  creada_por  uuid        references auth.users(id) on delete set null,
  usada_por   uuid        references auth.users(id) on delete set null,
  usada_en    timestamptz,
  expira_en   timestamptz not null default now() + interval '7 days',
  created_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invitaciones_rol_valido') then
    alter table public.invitaciones add constraint invitaciones_rol_valido
      check (rol in ('admin', 'empleado'));
  end if;
end $$;

create index if not exists idx_invitaciones_negocio on public.invitaciones(negocio_id);

alter table public.invitaciones enable row level security;

drop policy if exists invitaciones_admin on public.invitaciones;

-- Solo el admin del negocio ve y crea invitaciones. Nadie mas necesita
-- listarlas: quien se registra solo escribe el codigo, y eso lo valida el
-- disparador con permisos elevados.
create policy invitaciones_admin on public.invitaciones
  for all to authenticated
  using (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio())
  with check (negocio_id = public.mi_negocio() and public.soy_admin_del_negocio());

-- ── 4. El alta ahora contempla la invitacion ────────────────────────────────
create or replace function public.al_registrarse_crear_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio_id uuid;
  v_codigo     text;
  v_inv        record;
begin
  if exists (select 1 from public.perfiles where id = new.id) then
    return new;
  end if;

  v_codigo := upper(trim(coalesce(new.raw_user_meta_data->>'invitacion', '')));

  if v_codigo <> '' then
    select * into v_inv
    from public.invitaciones
    where codigo = v_codigo and usada_por is null and expira_en > now();

    if found then
      -- Se suma al negocio que invita, con el rol que definio el admin.
      insert into public.perfiles (id, negocio_id, nombre, rol)
      values (new.id, v_inv.negocio_id,
              coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), new.email),
              v_inv.rol);

      update public.invitaciones
      set usada_por = new.id, usada_en = now()
      where codigo = v_codigo;

      return new;
    end if;
    -- Codigo invalido o vencido: no se rechaza el registro, se lo trata como
    -- un alta normal. Rechazarlo dejaria al usuario sin cuenta y sin
    -- explicacion posible desde un disparador.
  end if;

  insert into public.negocios (nombre)
  values (coalesce(nullif(trim(new.raw_user_meta_data->>'negocio'), ''), 'Mi pulpería'))
  returning id into v_negocio_id;

  insert into public.perfiles (id, negocio_id, nombre, rol)
  values (new.id, v_negocio_id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), new.email),
          'admin');

  insert into public.categorias (negocio_id, nombre, color_semaforo) values
    (v_negocio_id, 'Alta Rotación',  '#10B981'),
    (v_negocio_id, 'Rotación Media', '#F59E0B'),
    (v_negocio_id, 'Baja Rotación',  '#EF4444');

  return new;
end;
$$;

-- ── 5. Las operaciones de venta respetan el rol ─────────────────────────────
--
--  registrar_venta pasa a SECURITY DEFINER: el empleado no tiene permiso
--  directo para escribir en productos, pero SI debe poder vender. La funcion
--  encapsula exactamente esa operacion y valida por su cuenta que todo
--  pertenezca a su negocio, ya que al elevarse deja de aplicarse RLS.
create or replace function public.registrar_venta(
  p_idempotency_key uuid,
  p_items           jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio_id uuid;
  v_venta_id   uuid;
  v_total      numeric;
  v_item       jsonb;
  v_ajenos     int;
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

  select coalesce(sum((i->>'cantidad')::int * (i->>'precio_unitario')::numeric), 0)
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
      (v_item->>'cantidad')::int,
      (v_item->>'cantidad')::int * (v_item->>'precio_unitario')::numeric
    );

    update public.productos
    set stock_actual = greatest(0, stock_actual - (v_item->>'cantidad')::int)
    where id = (v_item->>'producto_id')::uuid and negocio_id = v_negocio_id;
  end loop;

  return v_venta_id;
end;
$$;

--  Anular devuelve mercaderia al inventario: solo el admin.
create or replace function public.anular_venta(p_venta_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio_id uuid;
  v_afectadas  int;
  v_linea      record;
begin
  v_negocio_id := public.mi_negocio();
  if v_negocio_id is null then
    raise exception 'El usuario no pertenece a ningun negocio';
  end if;

  if not public.soy_admin_del_negocio() then
    raise exception 'Solo un administrador puede anular ventas';
  end if;

  update public.ventas
  set anulada = true
  where id = p_venta_id and negocio_id = v_negocio_id and anulada = false;

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
    where id = v_linea.producto_id and negocio_id = v_negocio_id;
  end loop;

  return true;
end;
$$;

revoke all on function public.registrar_venta(uuid, jsonb) from public, anon;
revoke all on function public.anular_venta(uuid)           from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb) to authenticated;
grant execute on function public.anular_venta(uuid)           to authenticated;

insert into public.schema_migrations (version, descripcion)
values ('012', 'Roles admin/empleado por negocio, con invitaciones')
on conflict (version) do nothing;
