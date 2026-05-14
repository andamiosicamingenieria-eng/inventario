# -*- coding: utf-8 -*-
import psycopg2

sql = """
INSERT INTO fab_insumos (codigo, nombre, descripcion, tipo, unidad_medida, stock_minimo, stock_actual, costo_unitario, activo) VALUES
('INS-001', 'Tubo Redondo 1.5"', 'Tubo negro cedula 30', 'Materia Prima', 'Tramo', 50, 120, 350.50, true),
('INS-002', 'Soldadura E6013 1/8"', 'Caja de 20kg', 'Consumible', 'Caja', 5, 12, 1200.00, true),
('INS-004', 'Placa de Acero 1/4"', 'Hoja 4x8 ft', 'Materia Prima', 'Hoja', 10, 18, 2100.00, true);

INSERT INTO cat_productos (codigo, nombre, categoria, unidad_medida, tipo_producto)
VALUES ('AND-001', 'ANDAMIO TUBULAR 1.56x1.00m', 'Andamios', 'PZA', 'RENTA_VENTA')
ON CONFLICT (codigo) DO NOTHING;

DO $$
DECLARE
    prod_id UUID;
BEGIN
    SELECT id INTO prod_id FROM cat_productos WHERE codigo = 'AND-001' LIMIT 1;
    INSERT INTO fab_ordenes (folio, producto_destino_id, cantidad, fecha_solicitud, fecha_fin_programada, estatus) VALUES
    ('OP-2603-01', prod_id, 50, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '2 days', 'EN_PROCESO'),
    ('OP-2603-02', prod_id, 120, CURRENT_DATE - INTERVAL '1 days', CURRENT_DATE + INTERVAL '10 days', 'PLANEADA');
END $$;

INSERT INTO fab_externos (proveedor, tipo_servicio, descripcion, monto, fecha_solicitud, orden_compra, estatus) VALUES
('ACEROS DEL VALLE SA DE CV', 'Compra Material', 'Suministro PTR', 45000.00, CURRENT_DATE - INTERVAL '3 days', 'OC-2026-045', 'APROBADO'),
('PINTURAS MEX', 'Servicio Externo', 'Maquila pintura', 12500.50, CURRENT_DATE - INTERVAL '1 days', 'OC-2026-048', 'SOLICITADO');
"""

try:
    conn = psycopg2.connect('dbname=postgres user=postgres password=root host=localhost port=5432')
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print('Seed inserted successfully.')
except Exception as e:
    print(f'Error: {e}')
