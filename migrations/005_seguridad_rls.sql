-- ============================================================================
--  005 · Seguridad a nivel de fila (RLS)
--
--  Sin esto la clave publicable que viaja en el JavaScript del sitio permite
--  a cualquiera leer, modificar y BORRAR toda la base. Con RLS activo y sin
--  política para el rol `anon`, ese acceso queda cerrado.
--
--  El panel /admin ya exige sesión, así que la app sigue funcionando igual.
-- ============================================================================

alter table public.categorias     enable row level security;
alter table public.productos      enable row level security;
alter table public.ventas         enable row level security;
alter table public.detalle_ventas enable row level security;
alter table public.clientes       enable row level security;
alter table public.fiados         enable row level security;

-- Una política por tabla: acceso completo solo para usuarios autenticados.
-- Se recrean para que el archivo se pueda volver a ejecutar sin error.
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

insert into public.schema_migrations (version, descripcion)
values ('005', 'RLS activo con acceso solo para usuarios autenticados')
on conflict (version) do nothing;
