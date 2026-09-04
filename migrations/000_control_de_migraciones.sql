-- ============================================================================
--  000 · Control de migraciones
--
--  Registra qué migraciones ya se aplicaron. Cada archivo posterior anota su
--  versión al final, así se puede ver el historial y detectar si falta alguna.
--
--  Todas las migraciones son idempotentes: volver a ejecutarlas no rompe nada
--  ni duplica datos.
-- ============================================================================

create table if not exists public.schema_migrations (
  version     text        primary key,
  descripcion text        not null,
  aplicada_en timestamptz not null default now()
);

-- Solo el dueño de la base debería leer esto; nunca se expone desde la app.
alter table public.schema_migrations enable row level security;

insert into public.schema_migrations (version, descripcion)
values ('000', 'Tabla de control de migraciones')
on conflict (version) do nothing;
