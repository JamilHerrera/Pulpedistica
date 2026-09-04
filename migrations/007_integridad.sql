-- ============================================================================
--  007 · Integridad de datos
--
--  El esquema original dejaba nulas columnas que la app siempre llena. El
--  caso más peligroso era ventas.anulada: el código filtra con
--  `.eq('anulada', false)`, así que una venta con anulada NULL habría
--  quedado fuera de todas las métricas sin que nadie lo notara.
--
--  Antes de escribir esto se verificó contra la base real que no hay ninguna
--  fila que incumpla estas reglas, así que ninguna restricción puede fallar.
-- ============================================================================

-- ── Valores por defecto y obligatoriedad ───────────────────────────────────
alter table public.ventas    alter column fecha_hora   set default now();
alter table public.ventas    alter column fecha_hora   set not null;
alter table public.ventas    alter column anulada      set default false;
alter table public.ventas    alter column anulada      set not null;

alter table public.productos alter column stock_actual set default 0;
alter table public.productos alter column stock_actual set not null;

-- Una línea de detalle sin venta es un huérfano sin sentido.
alter table public.detalle_ventas alter column venta_id set not null;

-- ── Rangos válidos ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ventas_monto_no_negativo') then
    alter table public.ventas
      add constraint ventas_monto_no_negativo check (monto_total >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'productos_stock_no_negativo') then
    alter table public.productos
      add constraint productos_stock_no_negativo check (stock_actual >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'detalle_cantidad_positiva') then
    alter table public.detalle_ventas
      add constraint detalle_cantidad_positiva check (cantidad > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'detalle_subtotal_no_negativo') then
    alter table public.detalle_ventas
      add constraint detalle_subtotal_no_negativo check (subtotal >= 0);
  end if;
end $$;

-- ── Sin nombres repetidos en el catálogo ───────────────────────────────────
-- Sobre lower(nombre) para que "Huevos" y "huevos" no convivan como productos
-- distintos, que es justo el error que ensucia el inventario de una pulpería.
create unique index if not exists idx_productos_nombre_unico
  on public.productos (lower(trim(nombre)));

create unique index if not exists idx_categorias_nombre_unico
  on public.categorias (lower(trim(nombre)));

insert into public.schema_migrations (version, descripcion)
values ('007', 'NOT NULL, defaults, CHECKs de rango y nombres unicos')
on conflict (version) do nothing;
