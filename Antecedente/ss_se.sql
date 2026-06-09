-- 1. Agregar columna de folio raíz a contratos
ALTER TABLE contratos
ADD COLUMN IF NOT EXISTS contrato_raiz INTEGER;
CREATE INDEX IF NOT EXISTS idx_c_raiz ON contratos(contrato_raiz);
-- 2. Crear tablas para Solicitudes de Salida (SS)
CREATE TABLE IF NOT EXISTS solicitudes_salida (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    folio_ss TEXT NOT NULL UNIQUE,
    numero_contrato INTEGER NOT NULL REFERENCES contratos(numero_contrato) ON DELETE CASCADE,
    fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
    chofer TEXT,
    estatus TEXT NOT NULL DEFAULT 'pendiente',
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS solicitudes_salida_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    solicitud_id BIGINT REFERENCES solicitudes_salida(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    descripcion TEXT,
    cantidad NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cantidad_cargada NUMERIC(10, 2) DEFAULT 0
);
-- 3. Crear tablas para Solicitudes de Entrada (SE)
CREATE TABLE IF NOT EXISTS solicitudes_entrada (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    folio_se TEXT NOT NULL UNIQUE,
    numero_contrato INTEGER NOT NULL REFERENCES contratos(numero_contrato) ON DELETE CASCADE,
    fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
    chofer TEXT,
    estatus TEXT NOT NULL DEFAULT 'pendiente',
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS solicitudes_entrada_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    solicitud_id BIGINT REFERENCES solicitudes_entrada(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    descripcion TEXT,
    cantidad NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cantidad_recolectada NUMERIC(10, 2) DEFAULT 0
);
-- 4. Habilitar seguridad RLS y crear políticas para permitir lecturas/escrituras anónimas
ALTER TABLE solicitudes_salida ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_salida_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_entrada_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON solicitudes_salida FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON solicitudes_salida_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON solicitudes_entrada FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON solicitudes_entrada_items FOR ALL USING (true) WITH CHECK (true);