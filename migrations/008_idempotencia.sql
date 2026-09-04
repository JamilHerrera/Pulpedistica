-- ============================================================================
--  008 · Claves de idempotencia
--
--  Registrar una venta o un fiado son operaciones que mueven dinero. Si el
--  usuario toca dos veces, o el navegador reintenta tras un corte de red, se
--  creaban DOS ventas y el stock se descontaba dos veces.
--
--  La app genera un UUID por operación y lo manda en la inserción. El índice
--  único hace que el segundo intento con la misma clave falle en la base
--  (error 23505) en vez de duplicar: la app detecta ese código, recupera la
--  fila que ya existe y la trata como éxito.
--
--  El índice es parcial (where ... is not null) para que las filas anteriores,
--  que no tienen clave, no choquen entre sí.
-- ============================================================================

alter table public.ventas add column if not exists idempotency_key uuid;
alter table public.fiados add column if not exists idempotency_key uuid;

create unique index if not exists idx_ventas_idempotency
  on public.ventas (idempotency_key) where idempotency_key is not null;

create unique index if not exists idx_fiados_idempotency
  on public.fiados (idempotency_key) where idempotency_key is not null;

insert into public.schema_migrations (version, descripcion)
values ('008', 'Claves de idempotencia en ventas y fiados')
on conflict (version) do nothing;
