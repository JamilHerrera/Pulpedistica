-- ============================================================================
--  001 · Esquema base: catálogo, ventas y su detalle
--
--  Estas cuatro tablas se crearon a mano en Supabase antes de versionar el
--  esquema. Este archivo las reconstruye tal como existen hoy, para que una
--  base vacía pueda levantarse desde cero. Al usar "if not exists" no toca
--  las tablas ya creadas.
-- ============================================================================

create table if not exists public.categorias (
  id             uuid primary key default gen_random_uuid(),
  nombre         varchar not null,
  color_semaforo varchar not null
);

create table if not exists public.productos (
  id           uuid primary key default gen_random_uuid(),
  nombre       varchar not null,
  stock_actual integer,
  categoria_id uuid references public.categorias(id)
);

create table if not exists public.ventas (
  id          uuid primary key default gen_random_uuid(),
  fecha_hora  timestamptz,
  monto_total numeric not null,
  anulada     boolean
);

-- Una línea por producto vendido. El subtotal se guarda ya calculado porque
-- el precio puede cambiar después y la venta debe conservar el que se cobró.
create table if not exists public.detalle_ventas (
  id          uuid primary key default gen_random_uuid(),
  venta_id    uuid references public.ventas(id),
  producto_id uuid references public.productos(id),
  cantidad    integer not null,
  subtotal    numeric not null
);

-- RLS se activa acá mismo, en el archivo que crea las tablas, y no en una
-- migración posterior: si no, una base nueva quedaría con las tablas
-- expuestas hasta que alguien corriera la 005. Activarlo sin políticas
-- deniega todo, que es el modo seguro de fallar; las políticas llegan en 005.
alter table public.categorias     enable row level security;
alter table public.productos      enable row level security;
alter table public.ventas         enable row level security;
alter table public.detalle_ventas enable row level security;

insert into public.schema_migrations (version, descripcion)
values ('001', 'Esquema base: categorias, productos, ventas, detalle_ventas')
on conflict (version) do nothing;
