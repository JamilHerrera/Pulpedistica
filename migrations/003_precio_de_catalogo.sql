-- ============================================================================
--  003 · Precio de catálogo
--
--  Antes el precio de cada producto vivía solo en el localStorage del
--  navegador: se perdía al limpiar los datos del sitio y no existía en otro
--  dispositivo. Ahora es parte del catálogo.
--
--  Queda NULL mientras no se le fije precio; la app lo muestra como
--  "Toca para precio".
-- ============================================================================

alter table public.productos
  add column if not exists precio numeric(10,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_precio_no_negativo') then
    alter table public.productos
      add constraint productos_precio_no_negativo check (precio is null or precio >= 0);
  end if;
end $$;

insert into public.schema_migrations (version, descripcion)
values ('003', 'Columna productos.precio')
on conflict (version) do nothing;
