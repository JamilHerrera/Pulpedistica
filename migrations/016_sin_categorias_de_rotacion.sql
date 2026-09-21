-- ============================================================================
--  016 · La rotación no es una categoría que se elige a mano
--
--  Desde la migración 010, cada negocio nuevo nacía con tres categorías ya
--  cargadas: "Alta Rotación", "Rotación Media" y "Baja Rotación". La idea
--  original —de antes de que existiera `lib/semaforo.ts`— era clasificar el
--  producto por la categoría que se le eligiera al crearlo.
--
--  Ese diseño quedó abandonado: la rotación real se calcula sola, por las
--  unidades que se vendieron en los últimos 7/15/30 días (ver la migración
--  009 y `lib/semaforo.ts`). Pero las tres categorías se siguieron sembrando,
--  así que quedaron DOS sistemas diciendo cosas distintas: un producto podía
--  tener la categoría "Alta Rotación" a mano y el semáforo real clasificarlo
--  como baja, porque hace tiempo que no se vende. El usuario terminaba
--  llenando un campo que no alimentaba ningún cálculo, y que encima
--  contradecía a la pantalla que sí importa.
--
--  Esta migración corrige las dos puntas:
--
--  1. El alta de un negocio nuevo deja de sembrar esas tres categorías.
--  2. En los negocios que ya existen, los productos que las tuvieran quedan
--     sin categoría (no se inventa una: elegirla es del dueño), y las tres
--     filas se borran.
-- ============================================================================

-- ── 1. El alta ya no siembra categorías de rotación ─────────────────────────
--
--  Igual que la 012, salvo por el bloque de `insert into categorias` que se
--  quita. El resto de la función —el camino de invitación y el de negocio
--  nuevo— no cambia.

create or replace function public.al_registrarse_crear_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $al_registrarse$
declare
  v_negocio_id uuid;
  v_codigo     text;
  v_inv        record;
begin
  if exists (select 1 from public.perfiles where id = new.id) then
    return new;
  end if;

  v_codigo := upper(trim(coalesce(new.raw_user_meta_data->>'invitacion', '')));

  if v_codigo <> '' then
    select * into v_inv
    from public.invitaciones
    where codigo = v_codigo and usada_por is null and expira_en > now();

    if found then
      -- Se suma al negocio que invita, con el rol que definio el admin.
      insert into public.perfiles (id, negocio_id, nombre, rol)
      values (new.id, v_inv.negocio_id,
              coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), new.email),
              v_inv.rol);

      update public.invitaciones
      set usada_por = new.id, usada_en = now()
      where codigo = v_codigo;

      return new;
    end if;
    -- Codigo invalido o vencido: no se rechaza el registro, se lo trata como
    -- un alta normal. Rechazarlo dejaria al usuario sin cuenta y sin
    -- explicacion posible desde un disparador.
  end if;

  insert into public.negocios (nombre)
  values (coalesce(nullif(trim(new.raw_user_meta_data->>'negocio'), ''), 'Mi pulpería'))
  returning id into v_negocio_id;

  insert into public.perfiles (id, negocio_id, nombre, rol)
  values (new.id, v_negocio_id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), new.email),
          'admin');

  -- Ya NO se siembran "Alta/Media/Baja Rotación": esa clasificación la
  -- calcula sola el semáforo, por ventas reales, no por lo que alguien elija
  -- al cargar el producto. Un negocio nuevo arranca sin categorías; las que
  -- necesite se las crea su dueño desde Inventario, con nombres que le sirvan
  -- a él (rubros, proveedores, lo que sea), no con nombres que compiten con
  -- una pantalla que ya resuelve la rotación por su cuenta.
  return new;
end;
$al_registrarse$;

-- ── 2. Limpieza de lo que ya se sembró en negocios existentes ───────────────
--
--  Se identifican por NOMBRE EXACTO y no por id, porque cada negocio tiene su
--  propia fila de categoría (la siembra las creaba una vez por negocio). Un
--  negocio que hubiera renombrado una de estas tres a propósito ya no
--  coincide con el nombre exacto, así que esta limpieza no la toca: se asume
--  que un nombre igual y sin editar es el que puso el trigger, no una
--  decisión humana.
--
--  Los productos quedan SIN categoría (no se les inventa una): asignarle una
--  categoría real a un producto es una decisión del dueño del negocio, no
--  algo que una migración pueda adivinar.

do $limpieza_categorias_rotacion$
declare
  v_categorias uuid[];
  v_productos  int;
begin
  select array_agg(id) into v_categorias
  from public.categorias
  where nombre in ('Alta Rotación', 'Rotación Media', 'Baja Rotación');

  if v_categorias is null then
    raise notice 'No había categorías de rotación que limpiar.';
    return;
  end if;

  update public.productos
  set categoria_id = null
  where categoria_id = any(v_categorias);
  get diagnostics v_productos = row_count;

  delete from public.categorias where id = any(v_categorias);

  raise notice '% categorías de rotación borradas; % productos quedaron sin categoría.',
    array_length(v_categorias, 1), v_productos;
end
$limpieza_categorias_rotacion$;

insert into public.schema_migrations (version, descripcion)
values ('016', 'Deja de sembrar categorias de rotacion: el semaforo se calcula solo')
on conflict (version) do nothing;
