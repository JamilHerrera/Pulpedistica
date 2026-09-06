-- ============================================================================
--  010 · Multi-negocio: cada pulpería ve solo sus datos
--
--  Hasta ahora los datos eran globales: las políticas decían
--  `to authenticated using (true)`, o sea que CUALQUIER cuenta veía todo. Con
--  el registro libre abierto, bastaba con crear un usuario para entrar a las
--  ventas, el inventario y las deudas del negocio.
--
--  A partir de acá cada fila pertenece a un negocio, y las políticas filtran
--  por el negocio de quien consulta. Registrarse deja de ser un riesgo: el
--  usuario nuevo entra a un negocio propio y vacío.
--
--  La unidad de aislamiento es el NEGOCIO, no el usuario, para que mañana un
--  dueño pueda sumar a un empleado y compartan el mismo inventario sin tener
--  que migrar los datos de nuevo.
-- ============================================================================

-- ── 1. Negocios y perfiles ─────────────────────────────────────────────────

create table if not exists public.negocios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text        not null,
  created_at timestamptz not null default now()
);

-- Un perfil por usuario de auth, que lo ata a su negocio.
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  negocio_id uuid        not null references public.negocios(id) on delete cascade,
  nombre     text,
  created_at timestamptz not null default now()
);

create index if not exists idx_perfiles_negocio on public.perfiles(negocio_id);

alter table public.negocios enable row level security;
alter table public.perfiles enable row level security;

-- ── 2. Negocio del usuario que consulta ────────────────────────────────────
--
--  SECURITY DEFINER a propósito: las políticas de las demás tablas llaman a
--  esta función, y si leyera `perfiles` con RLS aplicado se entraría en una
--  recursión infinita. Al definirla así, la lectura de perfiles se salta RLS,
--  pero la función solo devuelve el negocio de quien pregunta.
create or replace function public.mi_negocio()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select negocio_id from public.perfiles where id = auth.uid();
$$;

revoke all on function public.mi_negocio() from public, anon;
grant execute on function public.mi_negocio() to authenticated;

-- ── 3. Columna de pertenencia en cada tabla ────────────────────────────────
--
--  El default hace que la app siga insertando igual que antes: no necesita
--  mandar negocio_id, la base lo completa con el de la sesión.
alter table public.categorias     add column if not exists negocio_id uuid references public.negocios(id) on delete cascade;
alter table public.productos      add column if not exists negocio_id uuid references public.negocios(id) on delete cascade;
alter table public.ventas         add column if not exists negocio_id uuid references public.negocios(id) on delete cascade;
alter table public.detalle_ventas add column if not exists negocio_id uuid references public.negocios(id) on delete cascade;
alter table public.clientes       add column if not exists negocio_id uuid references public.negocios(id) on delete cascade;
alter table public.fiados         add column if not exists negocio_id uuid references public.negocios(id) on delete cascade;

alter table public.categorias     alter column negocio_id set default public.mi_negocio();
alter table public.productos      alter column negocio_id set default public.mi_negocio();
alter table public.ventas         alter column negocio_id set default public.mi_negocio();
alter table public.detalle_ventas alter column negocio_id set default public.mi_negocio();
alter table public.clientes       alter column negocio_id set default public.mi_negocio();
alter table public.fiados         alter column negocio_id set default public.mi_negocio();

-- ── 4. Traspaso de los datos que ya existían ───────────────────────────────
--
--  Todo lo cargado antes de esta migración se le asigna al primer usuario
--  registrado, que es quien lo creó. Es idempotente: solo toca filas que
--  todavía no tienen negocio.
do $$
declare
  v_user_id    uuid;
  v_negocio_id uuid;
begin
  if not exists (select 1 from public.productos where negocio_id is null)
     and not exists (select 1 from public.ventas where negocio_id is null)
     and not exists (select 1 from public.categorias where negocio_id is null) then
    return;
  end if;

  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise notice 'No hay usuarios todavia: no hay a quien asignarle los datos.';
    return;
  end if;

  select negocio_id into v_negocio_id from public.perfiles where id = v_user_id;

  if v_negocio_id is null then
    insert into public.negocios (nombre) values ('Mi pulpería')
    returning id into v_negocio_id;

    insert into public.perfiles (id, negocio_id, nombre)
    values (v_user_id, v_negocio_id, (select email from auth.users where id = v_user_id))
    on conflict (id) do update set negocio_id = excluded.negocio_id;
  end if;

  update public.categorias     set negocio_id = v_negocio_id where negocio_id is null;
  update public.productos      set negocio_id = v_negocio_id where negocio_id is null;
  update public.ventas         set negocio_id = v_negocio_id where negocio_id is null;
  update public.detalle_ventas set negocio_id = v_negocio_id where negocio_id is null;
  update public.clientes       set negocio_id = v_negocio_id where negocio_id is null;
  update public.fiados         set negocio_id = v_negocio_id where negocio_id is null;
end $$;

-- Recién ahora que no quedan filas huérfanas se puede exigir el dato.
alter table public.categorias     alter column negocio_id set not null;
alter table public.productos      alter column negocio_id set not null;
alter table public.ventas         alter column negocio_id set not null;
alter table public.detalle_ventas alter column negocio_id set not null;
alter table public.clientes       alter column negocio_id set not null;
alter table public.fiados         alter column negocio_id set not null;

-- ── 5. El detalle hereda el negocio de su venta ────────────────────────────
--
--  Cierra el hueco de insertar una línea con el negocio propio apuntando a
--  la venta de otro: el negocio no se acepta desde afuera, se copia siempre
--  del encabezado.
create or replace function public.detalle_hereda_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select negocio_id into new.negocio_id from public.ventas where id = new.venta_id;
  return new;
end;
$$;

drop trigger if exists trg_detalle_hereda_negocio on public.detalle_ventas;
create trigger trg_detalle_hereda_negocio
  before insert or update of venta_id on public.detalle_ventas
  for each row execute function public.detalle_hereda_negocio();

-- ── 6. Índices ─────────────────────────────────────────────────────────────
create index if not exists idx_categorias_negocio     on public.categorias(negocio_id);
create index if not exists idx_productos_negocio      on public.productos(negocio_id);
create index if not exists idx_ventas_negocio         on public.ventas(negocio_id);
create index if not exists idx_detalle_ventas_negocio on public.detalle_ventas(negocio_id);
create index if not exists idx_clientes_negocio       on public.clientes(negocio_id);
create index if not exists idx_fiados_negocio         on public.fiados(negocio_id);

-- Los únicos de la 007 eran globales: habrían impedido que dos pulperías
-- distintas tuvieran ambas un producto "Azúcar" o la categoría "Alta
-- Rotación". Ahora el nombre es único DENTRO de cada negocio.
drop index if exists public.idx_productos_nombre_unico;
drop index if exists public.idx_categorias_nombre_unico;

create unique index if not exists idx_productos_nombre_unico_por_negocio
  on public.productos (negocio_id, lower(trim(nombre)));
create unique index if not exists idx_categorias_nombre_unico_por_negocio
  on public.categorias (negocio_id, lower(trim(nombre)));

-- ── 7. Políticas: cada quien ve lo suyo ────────────────────────────────────
drop policy if exists categorias_acceso_autenticado     on public.categorias;
drop policy if exists productos_acceso_autenticado      on public.productos;
drop policy if exists ventas_acceso_autenticado         on public.ventas;
drop policy if exists detalle_ventas_acceso_autenticado on public.detalle_ventas;
drop policy if exists clientes_acceso_autenticado       on public.clientes;
drop policy if exists fiados_acceso_autenticado         on public.fiados;

drop policy if exists categorias_de_mi_negocio     on public.categorias;
drop policy if exists productos_de_mi_negocio      on public.productos;
drop policy if exists ventas_de_mi_negocio         on public.ventas;
drop policy if exists detalle_ventas_de_mi_negocio on public.detalle_ventas;
drop policy if exists clientes_de_mi_negocio       on public.clientes;
drop policy if exists fiados_de_mi_negocio         on public.fiados;
drop policy if exists negocios_el_mio              on public.negocios;
drop policy if exists perfiles_el_mio              on public.perfiles;

create policy categorias_de_mi_negocio on public.categorias
  for all to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy productos_de_mi_negocio on public.productos
  for all to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy ventas_de_mi_negocio on public.ventas
  for all to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy detalle_ventas_de_mi_negocio on public.detalle_ventas
  for all to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy clientes_de_mi_negocio on public.clientes
  for all to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy fiados_de_mi_negocio on public.fiados
  for all to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

-- Solo se ve el propio negocio y el propio perfil.
create policy negocios_el_mio on public.negocios
  for select to authenticated using (id = public.mi_negocio());

create policy perfiles_el_mio on public.perfiles
  for select to authenticated using (id = auth.uid());

-- ── 8. Alta automática al registrarse ──────────────────────────────────────
--
--  Sin esto, una cuenta nueva quedaría sin perfil: mi_negocio() devolvería
--  NULL y no vería ni podría crear nada. Se le arma su negocio y se siembran
--  las categorías del semáforo para que pueda cargar productos de entrada.
create or replace function public.al_registrarse_crear_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio_id uuid;
begin
  if exists (select 1 from public.perfiles where id = new.id) then
    return new;
  end if;

  insert into public.negocios (nombre)
  values (coalesce(nullif(trim(new.raw_user_meta_data->>'negocio'), ''), 'Mi pulpería'))
  returning id into v_negocio_id;

  insert into public.perfiles (id, negocio_id, nombre)
  values (new.id, v_negocio_id, coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), new.email));

  insert into public.categorias (negocio_id, nombre, color_semaforo) values
    (v_negocio_id, 'Alta Rotación',  '#10B981'),
    (v_negocio_id, 'Rotación Media', '#F59E0B'),
    (v_negocio_id, 'Baja Rotación',  '#EF4444');

  return new;
end;
$$;

drop trigger if exists trg_al_registrarse on auth.users;
create trigger trg_al_registrarse
  after insert on auth.users
  for each row execute function public.al_registrarse_crear_negocio();

insert into public.schema_migrations (version, descripcion)
values ('010', 'Multi-negocio: cada pulperia ve solo sus datos')
on conflict (version) do nothing;
