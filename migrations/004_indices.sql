-- ============================================================================
--  004 · Índices
--
--  Acompañan a las consultas que realmente hace la app: el dashboard ordena
--  ventas por fecha, el detalle se une por venta y por producto, el
--  inventario filtra por categoría y los fiados se listan por cliente y por
--  estado de pago.
-- ============================================================================

create index if not exists idx_productos_categoria     on public.productos(categoria_id);
create index if not exists idx_ventas_fecha_hora       on public.ventas(fecha_hora desc);
create index if not exists idx_detalle_ventas_venta    on public.detalle_ventas(venta_id);
create index if not exists idx_detalle_ventas_producto on public.detalle_ventas(producto_id);
create index if not exists idx_fiados_cliente          on public.fiados(cliente_id);
create index if not exists idx_fiados_pendientes       on public.fiados(pagado, fecha_registro desc);

insert into public.schema_migrations (version, descripcion)
values ('004', 'Indices de las consultas de la app')
on conflict (version) do nothing;
