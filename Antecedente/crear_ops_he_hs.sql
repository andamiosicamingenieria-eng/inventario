-- =====================================================================
-- ICAM 360 - Tablas complementarias para HE / HS
-- Ejecutar en Supabase → SQL Editor
-- =====================================================================

-- Tabla: ops_he (Hojas de Entrada — recolección de equipo)
CREATE TABLE IF NOT EXISTS ops_he (
    id            SERIAL PRIMARY KEY,
    folio         VARCHAR(50) UNIQUE NOT NULL,
    contrato_folio VARCHAR(50),
    razon_social  VARCHAR(200),
    fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
    total_piezas  INTEGER NOT NULL DEFAULT 0 CHECK (total_piezas >= 0),
    estatus       VARCHAR(50) DEFAULT 'recibido'
                    CHECK (estatus IN ('recibido','en_transito','pendiente')),
    vaciado_fabricacion BOOLEAN DEFAULT false,
    tipo          VARCHAR(50) DEFAULT 'normal',       -- 'normal' | 'subarr'
    referencia_sa VARCHAR(50),                        -- folio SARR si aplica
    operador      VARCHAR(150),
    notas         TEXT,
    items         JSONB,                              -- [{codigo, nombre, cantidad_recolectada, estado}]
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ops_he_folio    ON ops_he(folio);
CREATE INDEX IF NOT EXISTS idx_ops_he_contrato ON ops_he(contrato_folio);
CREATE INDEX IF NOT EXISTS idx_ops_he_estatus  ON ops_he(estatus);
COMMENT ON TABLE ops_he IS 'Hojas de Entrada — equipo recolectado/sub-arrendado que ingresa al inventario';

-- Tabla: ops_hs (Hojas de Salida — entrega de equipo)
CREATE TABLE IF NOT EXISTS ops_hs (
    id            SERIAL PRIMARY KEY,
    folio         VARCHAR(50) UNIQUE NOT NULL,
    contrato_folio VARCHAR(50),
    razon_social  VARCHAR(200),
    fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
    total_piezas  INTEGER NOT NULL DEFAULT 0 CHECK (total_piezas >= 0),
    estatus       VARCHAR(50) DEFAULT 'entregado'
                    CHECK (estatus IN ('entregado','parcial','pendiente','venta_perdida')),
    tipo          VARCHAR(50) DEFAULT 'normal',       -- 'normal' | 'devolucion_subarr'
    referencia_sa VARCHAR(50),                        -- folio SARR si aplica
    notas         TEXT,
    items         JSONB,                              -- [{codigo, nombre, cantidad_hs}]
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ops_hs_folio    ON ops_hs(folio);
CREATE INDEX IF NOT EXISTS idx_ops_hs_contrato ON ops_hs(contrato_folio);
CREATE INDEX IF NOT EXISTS idx_ops_hs_estatus  ON ops_hs(estatus);
COMMENT ON TABLE ops_hs IS 'Hojas de Salida — equipo entregado/devuelto que sale del inventario';

-- Trigger updated_at para ambas tablas
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ops_he_updated_at ON ops_he;
CREATE TRIGGER update_ops_he_updated_at
    BEFORE UPDATE ON ops_he
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ops_hs_updated_at ON ops_hs;
CREATE TRIGGER update_ops_hs_updated_at
    BEFORE UPDATE ON ops_hs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- Verificación
-- =====================================================================
SELECT table_name, obj_description(c.oid) AS description
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
WHERE table_schema = 'public'
  AND table_name IN ('ops_he','ops_hs')
ORDER BY table_name;
