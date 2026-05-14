-- Datos Semilla para Módulo de Fabricación y Compras

-- 1. Insumos (fab_insumos)
INSERT INTO fab_insumos (codigo, nombre, descripcion, tipo, unidad_medida, stock_minimo, stock_actual, costo_unitario, activo) VALUES
('INS-001', 'Tubo Redondo 1.5"', 'Tubo negro cédula 30, largo 6m', 'Materia Prima', 'Tramo', 50, 120, 350.50, true),
('INS-002', 'Soldadura E6013 1/8"', 'Caja de 20kg', 'Consumible', 'Caja', 5, 12, 1200.00, true),
('INS-003', 'Pintura Esmalte Azul', 'Cubeta 19L', 'Consumible', 'Cubeta', 10, 25, 1850.00, true),
('INS-004', 'Placa de Acero 1/4"', 'Hoja 4x8 ft', 'Materia Prima', 'Hoja', 10, 18, 2100.00, true),
('INS-005', 'Disco de Corte 14"', 'Paquete 10 pzas', 'Herramienta', 'Paquete', 15, 30, 450.00, true);

-- Asegurarse de que exista el producto destino (cat_productos) para las órdenes
-- (Asumiendo que AND-001 ya existe del insert de la otra vez, pero metemos uno por precaución si no estuviera)
INSERT INTO cat_productos (codigo, nombre, categoria, unidad_medida, tipo_producto)
VALUES ('AND-001', 'ANDAMIO TUBULAR 1.56x1.00m', 'Andamios', 'PZA', 'RENTA_VENTA')
ON CONFLICT (codigo) DO NOTHING;

-- Obtener el ID del producto
DO $$
DECLARE
    prod_id UUID;
BEGIN
    SELECT id INTO prod_id FROM cat_productos WHERE codigo = 'AND-001' LIMIT 1;

    -- 2. Órdenes de Producción (fab_ordenes)
    INSERT INTO fab_ordenes (folio, producto_destino_id, cantidad, fecha_solicitud, fecha_fin_programada, estatus, creado_por) VALUES
    ('OP-2603-01', prod_id, 50, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '2 days', 'EN_PROCESO', 'user_id_aquí'),
    ('OP-2603-02', prod_id, 120, CURRENT_DATE - INTERVAL '1 days', CURRENT_DATE + INTERVAL '10 days', 'PLANEADA', 'user_id_aquí'),
    ('OP-2602-01', prod_id, 30, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '15 days', 'COMPLETADA', 'user_id_aquí');

END $$;

-- 3. Órdenes de Compra/Servicios Externos (fab_externos)
INSERT INTO fab_externos (proveedor, tipo_servicio, descripcion, monto, fecha_solicitud, orden_compra, estatus, creado_por) VALUES
('ACEROS DEL VALLE SA DE CV', 'Compra Material', 'Suministro de PTR y Tubo negro para la OP-2603-01', 45000.00, CURRENT_DATE - INTERVAL '3 days', 'OC-2026-045', 'APROBADO', 'user_id_aquí'),
('PINTURAS Y RECUBRIMIENTOS MEX', 'Servicio Externo', 'Maquila de pintura electrostática para andamios', 12500.50, CURRENT_DATE - INTERVAL '1 days', 'OC-2026-048', 'SOLICITADO', 'user_id_aquí'),
('FERRETERIA LA TUERCA', 'Compra Consumibles', 'Soldadura, discos y equipo seguridad', 8400.00, CURRENT_DATE - INTERVAL '15 days', 'OC-2026-021', 'PAGADO', 'user_id_aquí');
