-- ============================================================================
--  PulpeAnálisis — esquema de base de datos
--  Ejecutar en Supabase → SQL Editor → New query → Run
--
--  Es idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================


-- ─── 1. Tablas nuevas ───────────────────────────────────────────────────────

-- Clientes de la pulpería (los que compran al fiado).
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text        not null,
  telefono    text,
  notas       text,
  created_at  timestamptz not null default now()
);

-- Deudas: cada fiado pertenece a un cliente y, opcionalmente, a una venta.
-- venta_id es nulo cuando se registra una deuda sin pasar por el carrito.
create table if not exists public.fiados (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid        not null references public.clientes(id) on delete cascade,
  venta_id        uuid        references public.ventas(id) on delete set null,
  monto           numeric(10,2) not null check (monto > 0),
  pagado          boolean     not null default false,
  fecha_registro  timestamptz not null default now(),
  fecha_pago      timestamptz,
  -- No se puede marcar como pagado sin fecha de pago, ni viceversa.
  constraint fiados_pago_coherente check (
    (pagado and fecha_pago is not null) or (not pagado and fecha_pago is null)
  )
);


-- ─── 2. Índices ─────────────────────────────────────────────────────────────
-- Acompañan a las consultas que ya hace la app (y a las de fiados).

create index if not exists idx_productos_categoria      on public.productos(categoria_id);
create index if not exists idx_ventas_fecha_hora        on public.ventas(fecha_hora desc);
create index if not exists idx_detalle_ventas_venta     on public.detalle_ventas(venta_id);
create index if not exists idx_detalle_ventas_producto  on public.detalle_ventas(producto_id);
create index if not exists idx_fiados_cliente           on public.fiados(cliente_id);
create index if not exists idx_fiados_pendientes        on public.fiados(pagado, fecha_registro desc);


-- ─── 3. Seguridad a nivel de fila (RLS) ─────────────────────────────────────
--
--  IMPORTANTE: sin esto, la clave publicable que viaja en el JavaScript del
--  sitio permite a cualquiera leer, modificar y BORRAR toda la base. Con RLS
--  activo y sin política para el rol `anon`, ese acceso queda cerrado.
--
--  El panel /admin ya exige sesión, así que la app sigue funcionando igual.

alter table public.categorias     enable row level security;
alter table public.productos      enable row level security;
alter table public.ventas         enable row level security;
alter table public.detalle_ventas enable row level security;
alter table public.clientes       enable row level security;
alter table public.fiados         enable row level security;

-- Una política por tabla: acceso completo solo para usuarios autenticados.
-- Se recrean para que el script sea idempotente.
drop policy if exists categorias_acceso_autenticado     on public.categorias;
drop policy if exists productos_acceso_autenticado      on public.productos;
drop policy if exists ventas_acceso_autenticado         on public.ventas;
drop policy if exists detalle_ventas_acceso_autenticado on public.detalle_ventas;
drop policy if exists clientes_acceso_autenticado       on public.clientes;
drop policy if exists fiados_acceso_autenticado         on public.fiados;

create policy categorias_acceso_autenticado     on public.categorias
  for all to authenticated using (true) with check (true);

create policy productos_acceso_autenticado      on public.productos
  for all to authenticated using (true) with check (true);

create policy ventas_acceso_autenticado         on public.ventas
  for all to authenticated using (true) with check (true);

create policy detalle_ventas_acceso_autenticado on public.detalle_ventas
  for all to authenticated using (true) with check (true);

create policy clientes_acceso_autenticado       on public.clientes
  for all to authenticated using (true) with check (true);

create policy fiados_acceso_autenticado         on public.fiados
  for all to authenticated using (true) with check (true);


-- ─── 4. Realtime ────────────────────────────────────────────────────────────
-- La app se suscribe a cambios en ventas y detalle_ventas.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ventas'
  ) then
    alter publication supabase_realtime add table public.ventas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'detalle_ventas'
  ) then
    alter publication supabase_realtime add table public.detalle_ventas;
  end if;
end $$;
