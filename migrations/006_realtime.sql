-- ============================================================================
--  006 · Realtime
--
--  La app se suscribe a cambios para refrescar el dashboard y los fiados sin
--  que el usuario recargue.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['ventas', 'detalle_ventas', 'fiados', 'clientes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

insert into public.schema_migrations (version, descripcion)
values ('006', 'Publicacion realtime de ventas, detalle, fiados y clientes')
on conflict (version) do nothing;
