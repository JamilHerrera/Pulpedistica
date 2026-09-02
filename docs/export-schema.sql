-- ============================================================================
--  Genera docs/db-export.json leyendo el esquema REAL de la base.
--
--  Uso: Supabase → SQL Editor → New query → pegar esto → Run.
--  Devuelve una sola celda con el JSON completo; copiarla tal cual al archivo.
--
--  Lee de los catálogos de Postgres (pg_class, pg_index, pg_constraint,
--  pg_policy), así que lo que salga es exactamente lo que hay en la base:
--  columnas, tipos, llaves primarias, foráneas, índices y políticas RLS.
--  Las filas se cuentan de verdad, tabla por tabla.
-- ============================================================================

select jsonb_pretty(jsonb_build_object(
  'generado_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'motor',       'postgres',
  'tablas',      coalesce(jsonb_agg(t.tabla order by t.nombre), '[]'::jsonb)
))
from (
  select
    c.relname as nombre,
    jsonb_build_object(
      'nombre', c.relname,

      -- Conteo real de filas (count(*) dinámico por tabla).
      'filas', (
        xpath(
          '/row/cnt/text()',
          query_to_xml(format('select count(*) as cnt from public.%I', c.relname), false, true, '')
        )
      )[1]::text::bigint,

      'columnas', (
        select jsonb_agg(
          jsonb_build_object(
            'nombre', a.attname,
            'tipo',   format_type(a.atttypid, a.atttypmod),
            'pk',     exists (
                        select 1 from pg_index i
                        where i.indrelid = c.oid
                          and i.indisprimary
                          and a.attnum = any (i.indkey)
                      ),
            'nulo',   not a.attnotnull
          )
          order by a.attnum
        )
        from pg_attribute a
        where a.attrelid = c.oid
          and a.attnum > 0
          and not a.attisdropped
      ),

      'indices', coalesce((
        select jsonb_agg(ci.relname order by ci.relname)
        from pg_index i
        join pg_class ci on ci.oid = i.indexrelid
        where i.indrelid = c.oid
      ), '[]'::jsonb),

      'relaciones', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'columna',    att.attname,
            'referencia', rc.relname || '.' || ratt.attname
          )
          order by att.attname
        )
        from pg_constraint con
        cross join lateral unnest(con.conkey, con.confkey) as k(origen, destino)
        join pg_attribute att  on att.attrelid  = con.conrelid  and att.attnum  = k.origen
        join pg_class     rc   on rc.oid        = con.confrelid
        join pg_attribute ratt on ratt.attrelid = con.confrelid and ratt.attnum = k.destino
        where con.conrelid = c.oid
          and con.contype  = 'f'
      ), '[]'::jsonb),

      'politicas_rls', coalesce((
        select jsonb_agg(pol.polname order by pol.polname)
        from pg_policy pol
        where pol.polrelid = c.oid
      ), '[]'::jsonb)
    ) as tabla
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'          -- solo tablas ordinarias
) t;
