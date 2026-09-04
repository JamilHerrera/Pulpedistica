-- ============================================================================
--  002 · Clientes y fiados
--
--  El fiado es la venta a crédito de la pulpería. Se normaliza el cliente en
--  su propia tabla en vez de repetir el nombre en cada deuda: así se corrige
--  un teléfono en un solo lugar y se puede agrupar la deuda por persona.
-- ============================================================================

create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text        not null,
  telefono   text,
  notas      text,
  created_at timestamptz not null default now()
);

create table if not exists public.fiados (
  id             uuid primary key default gen_random_uuid(),
  -- Al borrar un cliente se van sus deudas: no tienen sentido sin él.
  cliente_id     uuid          not null references public.clientes(id) on delete cascade,
  -- La venta es opcional: se puede anotar una deuda sin pasar por el carrito.
  venta_id       uuid          references public.ventas(id) on delete set null,
  monto          numeric(10,2) not null check (monto > 0),
  pagado         boolean       not null default false,
  fecha_registro timestamptz   not null default now(),
  fecha_pago     timestamptz
);

-- No se puede marcar como pagado sin fecha de pago, ni al revés.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fiados_pago_coherente') then
    alter table public.fiados
      add constraint fiados_pago_coherente check (
        (pagado and fecha_pago is not null) or (not pagado and fecha_pago is null)
      );
  end if;
end $$;

-- Igual que en 001: RLS desde el momento de la creación, nunca después.
alter table public.clientes enable row level security;
alter table public.fiados   enable row level security;

insert into public.schema_migrations (version, descripcion)
values ('002', 'Tablas clientes y fiados')
on conflict (version) do nothing;
