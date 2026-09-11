-- ============================================================================
--  011 · Retroalimentación de los usuarios
--
--  La opinión sobre la app es un dato DEL PRODUCTO, no de cada pulpería. Si se
--  tratara como el resto de las tablas —aisladas por negocio— cada dueño vería
--  solo la suya y quien mantiene el producto no vería ninguna, que es
--  justamente lo contrario de lo que sirve.
--
--  Por eso las políticas acá son distintas al resto del esquema:
--    · cualquier usuario con sesión puede ENVIAR y ver lo que él mismo mandó;
--    · solo un administrador puede ver TODO y marcarlo como atendido.
-- ============================================================================

-- ── 1. Quién da soporte al producto ─────────────────────────────────────────
--
--  Ojo con el nombre: `es_soporte` NO es lo mismo que ser administrador de un
--  negocio (migración 012). Un dueño administra SU pulpería; soporte es quien
--  mantiene la aplicación y lee lo que opinan todos.

alter table public.perfiles
  add column if not exists es_soporte boolean not null default false;

-- SECURITY DEFINER por el mismo motivo que mi_negocio(): las políticas de
-- `feedback` llaman a esta función, y leer `perfiles` con RLS aplicado
-- entraría en recursión.
create or replace function public.soy_soporte()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select es_soporte from public.perfiles where id = auth.uid()), false);
$$;

revoke all on function public.soy_soporte() from public, anon;
grant execute on function public.soy_soporte() to authenticated;

-- ── 2. La tabla ─────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),

  -- Se conserva el comentario aunque la cuenta se borre: la opinión sigue
  -- siendo válida, solo se pierde a quién atribuirla.
  user_id      uuid references auth.users(id) on delete set null,
  negocio_id   uuid references public.negocios(id) on delete set null,

  tipo         text        not null default 'sugerencia',
  -- Opcional: hay comentarios que no vienen con nota.
  calificacion smallint,
  mensaje      text        not null,
  -- Desde qué sección se envió, para ubicar el comentario en contexto.
  pantalla     text,

  atendido     boolean     not null default false,
  created_at   timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'feedback_tipo_valido') then
    alter table public.feedback add constraint feedback_tipo_valido
      check (tipo in ('sugerencia', 'problema', 'elogio', 'otro'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'feedback_calificacion_valida') then
    alter table public.feedback add constraint feedback_calificacion_valida
      check (calificacion is null or calificacion between 1 and 5);
  end if;

  -- Un mensaje de dos letras no es retroalimentación, y uno enorme suele ser
  -- basura. El límite se valida también en la app, pero acá no se puede evadir.
  if not exists (select 1 from pg_constraint where conname = 'feedback_mensaje_razonable') then
    alter table public.feedback add constraint feedback_mensaje_razonable
      check (char_length(trim(mensaje)) between 10 and 2000);
  end if;
end $$;

create index if not exists idx_feedback_reciente  on public.feedback(created_at desc);
create index if not exists idx_feedback_pendiente on public.feedback(atendido, created_at desc);
create index if not exists idx_feedback_autor     on public.feedback(user_id);

-- ── 3. Políticas ────────────────────────────────────────────────────────────

alter table public.feedback enable row level security;

drop policy if exists feedback_enviar        on public.feedback;
drop policy if exists feedback_ver_lo_propio on public.feedback;
drop policy if exists feedback_admin_ve_todo on public.feedback;
drop policy if exists feedback_admin_atiende on public.feedback;
drop policy if exists feedback_admin_borra   on public.feedback;

-- Cualquiera con sesión envía, pero solo a su propio nombre: el `with check`
-- impide firmar un comentario como otra persona.
create policy feedback_enviar on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

create policy feedback_ver_lo_propio on public.feedback
  for select to authenticated
  using (user_id = auth.uid());

create policy feedback_admin_ve_todo on public.feedback
  for select to authenticated
  using (public.soy_soporte());

create policy feedback_admin_atiende on public.feedback
  for update to authenticated
  using (public.soy_soporte()) with check (public.soy_soporte());

create policy feedback_admin_borra on public.feedback
  for delete to authenticated
  using (public.soy_soporte());

-- ── 4. Primer usuario de soporte ────────────────────────────────────────────
--
--  Sin esto nadie podría leer los comentarios. Se marca al primer usuario
--  registrado, que es quien creó el proyecto. Idempotente: si ya hay alguien
--  de soporte, no toca nada.
do $$
declare
  v_user_id uuid;
begin
  if exists (select 1 from public.perfiles where es_soporte) then
    return;
  end if;

  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise notice 'No hay usuarios todavia: no se designo soporte.';
    return;
  end if;

  update public.perfiles set es_soporte = true where id = v_user_id;
end $$;

insert into public.schema_migrations (version, descripcion)
values ('011', 'Retroalimentacion de usuarios, visible para soporte')
on conflict (version) do nothing;
