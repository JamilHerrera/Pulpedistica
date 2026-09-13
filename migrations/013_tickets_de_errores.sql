-- ============================================================================
--  013 · Tickets automáticos de errores
--
--  Hasta acá, cuando algo fallaba en la app el error terminaba en la consola
--  del navegador del usuario y ahí moría: nadie lo veía. La dueña de una
--  pulpería no va a abrir las herramientas de desarrollo ni a escribir un
--  reporte; simplemente deja de usar la pantalla que se le rompe.
--
--  Esta migración crea el buzón donde la aplicación deposita sola cada error
--  que captura. Tres decisiones explican la forma de la tabla:
--
--  1. UN TICKET POR PROBLEMA, NO POR OCURRENCIA. Si un bug se dispara mil
--     veces, mil filas no dicen nada más que una con un contador. Por eso
--     existe `huella`, que es UNIQUE: el alta es un `on conflict do update`
--     que suma en `veces` y corre `ultima_vez`. Es la misma idea de
--     idempotencia de la migración 008, aplicada a los reportes.
--
--  2. LOS TICKETS NO SE PARTEN POR NEGOCIO. Un error de programación es del
--     PRODUCTO, igual que la retroalimentación de la 011: si se aislara por
--     pulpería, la misma falla generaría un ticket por cliente y quien
--     mantiene la app no vería el patrón. Se guarda `negocio_id` como
--     contexto de quién lo sufrió, no como frontera de acceso.
--
--  3. NADIE ESCRIBE DIRECTO EN LA TABLA. No hay política de INSERT. La única
--     puerta es `reportar_error()`, SECURITY DEFINER, que es quien garantiza
--     el contador, el recorte de los textos y el límite anti-inundación. Si
--     la app pudiera insertar a mano, un cliente en bucle llenaría la tabla.
-- ============================================================================

-- ── 1. La tabla ─────────────────────────────────────────────────────────────

create table if not exists public.tickets (
  id            uuid primary key default gen_random_uuid(),

  -- Identidad del PROBLEMA, no de esta ocurrencia. La calcula la app a partir
  -- del origen y del mensaje ya normalizado (sin ids ni fechas), para que dos
  -- apariciones del mismo bug caigan en la misma fila.
  huella        text        not null unique,

  titulo        text        not null,
  -- De dónde salió: 'render', 'promesa', 'javascript', 'consola', 'recurso'
  -- o 'manual'. Sirve para separar un crash de React de un console.error.
  origen        text        not null default 'javascript',
  -- Traza y contexto. Puede venir vacío: hay errores que no traen stack.
  detalle       text,

  -- Dónde estaba parado el usuario cuando reventó.
  pantalla      text,
  ruta          text,
  navegador     text,

  estado        text        not null default 'nuevo',
  -- Lo que anota soporte al cerrarlo. La app nunca lo toca.
  nota          text,

  veces         integer     not null default 1,
  primera_vez   timestamptz not null default now(),
  ultima_vez    timestamptz not null default now(),

  -- Último que lo reportó. Se conserva el ticket aunque la cuenta se borre:
  -- el bug sigue existiendo, solo se pierde a quién le pasó.
  reportado_por uuid references auth.users(id) on delete set null,
  negocio_id    uuid references public.negocios(id) on delete set null
);

do $ticket_checks$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_estado_valido') then
    alter table public.tickets add constraint tickets_estado_valido
      check (estado in ('nuevo', 'en_proceso', 'resuelto', 'descartado'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tickets_origen_valido') then
    alter table public.tickets add constraint tickets_origen_valido
      check (origen in ('render', 'promesa', 'javascript', 'consola', 'recurso', 'manual'));
  end if;

  -- Un contador no puede ir para atrás.
  if not exists (select 1 from pg_constraint where conname = 'tickets_veces_positivo') then
    alter table public.tickets add constraint tickets_veces_positivo
      check (veces > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tickets_titulo_no_vacio') then
    alter table public.tickets add constraint tickets_titulo_no_vacio
      check (char_length(trim(titulo)) > 0);
  end if;
end
$ticket_checks$;

-- Contexto automático, igual que en feedback: la app no lo manda.
alter table public.tickets
  alter column negocio_id set default public.mi_negocio();

-- La bandeja se ordena por "lo último que pasó" y se filtra por estado.
create index if not exists idx_tickets_recientes on public.tickets(ultima_vez desc);
create index if not exists idx_tickets_estado    on public.tickets(estado, ultima_vez desc);
-- Para el límite anti-inundación, que cuenta altas por usuario y hora.
create index if not exists idx_tickets_alta      on public.tickets(reportado_por, primera_vez desc);

-- ── 2. Políticas ────────────────────────────────────────────────────────────
--
--  Solo soporte lee y administra. Un ticket está deduplicado entre todos los
--  negocios, así que no existe "el ticket de tu pulpería" que se le pudiera
--  mostrar a un dueño sin filtrarle la traza de otro. Y una traza de error es
--  información sensible: nombra tablas, columnas y rutas internas.
--
--  Ausencia deliberada: no hay política de INSERT. Ver la nota 3 de arriba.

alter table public.tickets enable row level security;

drop policy if exists tickets_soporte_ve    on public.tickets;
drop policy if exists tickets_soporte_edita on public.tickets;
drop policy if exists tickets_soporte_borra on public.tickets;

create policy tickets_soporte_ve on public.tickets
  for select to authenticated
  using (public.soy_soporte());

create policy tickets_soporte_edita on public.tickets
  for update to authenticated
  using (public.soy_soporte()) with check (public.soy_soporte());

create policy tickets_soporte_borra on public.tickets
  for delete to authenticated
  using (public.soy_soporte());

-- ── 3. La única puerta de entrada ───────────────────────────────────────────
--
--  Idempotente por diseño: llamarla mil veces con la misma huella deja una
--  fila con veces = 1000, nunca mil filas. Y no lanza excepciones hacia la
--  app —si el reporte fallara y la app intentara reportar ESE fallo se
--  entraría en un bucle— así que devuelve null cuando descarta la llamada.

create or replace function public.reportar_error(
  p_huella    text,
  p_titulo    text,
  p_origen    text default 'javascript',
  p_detalle   text default null,
  p_pantalla  text default null,
  p_ruta      text default null,
  p_navegador text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $reportar_error$
declare
  v_id     uuid;
  v_huella text := nullif(trim(p_huella), '');
  v_titulo text := nullif(trim(p_titulo), '');
  v_origen text := coalesce(nullif(trim(p_origen), ''), 'javascript');
  v_nuevos integer;
begin
  -- Sin identidad no hay ticket: evita que la clave pública llene la tabla.
  if auth.uid() is null then
    return null;
  end if;

  -- Un reporte sin huella o sin título no sirve para nada, y no vale la pena
  -- hacer fallar a la app por eso.
  if v_huella is null or v_titulo is null then
    return null;
  end if;

  if v_origen not in ('render', 'promesa', 'javascript', 'consola', 'recurso', 'manual') then
    v_origen := 'javascript';
  end if;

  -- Límite anti-inundación: un cliente en bucle puede generar huellas
  -- distintas sin parar. Repetir un problema YA conocido no cuesta nada (es
  -- un update sobre una fila), así que el tope aplica solo a las altas.
  if not exists (select 1 from public.tickets where huella = v_huella) then
    select count(*) into v_nuevos
    from public.tickets
    where reportado_por = auth.uid()
      and primera_vez > now() - interval '1 hour';

    if v_nuevos >= 50 then
      return null;
    end if;
  end if;

  -- El recorte se hace acá y no en el navegador: es el servidor el que tiene
  -- que garantizar que una traza gigante no infle la tabla.
  insert into public.tickets as t (
    huella, titulo, origen, detalle, pantalla, ruta, navegador, reportado_por
  )
  values (
    v_huella,
    left(v_titulo, 300),
    v_origen,
    left(p_detalle, 4000),
    left(p_pantalla, 60),
    left(p_ruta, 300),
    left(p_navegador, 300),
    auth.uid()
  )
  on conflict (huella) do update
    set veces         = t.veces + 1,
        ultima_vez    = now(),
        reportado_por = auth.uid(),
        negocio_id    = public.mi_negocio(),
        -- Se refresca el contexto para que soporte vea dónde pasó la ÚLTIMA
        -- vez, que es lo reproducible. El detalle, en cambio, solo se llena
        -- si el guardado estaba vacío: la primera traza suele ser la buena.
        pantalla      = coalesce(left(excluded.pantalla, 60), t.pantalla),
        ruta          = coalesce(left(excluded.ruta, 300), t.ruta),
        detalle       = coalesce(t.detalle, left(excluded.detalle, 4000)),
        -- Un problema que reaparece después de cerrado se reabre solo.
        estado        = case when t.estado in ('resuelto', 'descartado')
                             then 'nuevo' else t.estado end
  returning t.id into v_id;

  return v_id;
end;
$reportar_error$;

-- La app corre con la clave pública: solo una sesión iniciada puede reportar.
revoke all on function public.reportar_error(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.reportar_error(text, text, text, text, text, text, text) to authenticated;

insert into public.schema_migrations (version, descripcion)
values ('013', 'Tickets automaticos de errores, deduplicados por huella')
on conflict (version) do nothing;
