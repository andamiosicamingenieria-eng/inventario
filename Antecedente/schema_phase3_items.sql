-- =====================================================================
-- ICAM 360 — FASE 3: Migración a Tablas Relacionales de Items
-- Este script crea las tablas satélite para items de andamios.
-- =====================================================================

-- 1. Items de Contratos
CREATE TABLE IF NOT EXISTS ops_contratos_items (
    id               SERIAL PRIMARY KEY,
    contrato_id      INTEGER NOT NULL REFERENCES ops_contratos(id) ON DELETE CASCADE,
    producto_id      VARCHAR(50) NOT NULL REFERENCES cat_productos(codigo) ON DELETE RESTRICT,
    cantidad         DECIMAL(10,2) NOT NULL CHECK (cantidad > 0),
    precio_unitario  DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contratos_items_contrato ON ops_contratos_items(contrato_id);

-- 2. Items de Hojas de Salida (HS)
CREATE TABLE IF NOT EXISTS ops_hs_items (
    id               SERIAL PRIMARY KEY,
    hs_id            INTEGER NOT NULL REFERENCES ops_hs(id) ON DELETE CASCADE,
    producto_id      VARCHAR(50) NOT NULL REFERENCES cat_productos(codigo) ON DELETE RESTRICT,
    cantidad_hs      DECIMAL(10,2) NOT NULL CHECK (cantidad_hs > 0),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hs_items_hs ON ops_hs_items(hs_id);

-- 3. Items de Hojas de Entrada (HE)
CREATE TABLE IF NOT EXISTS ops_he_items (
    id                   SERIAL PRIMARY KEY,
    he_id                INTEGER NOT NULL REFERENCES ops_he(id) ON DELETE CASCADE,
    producto_id          VARCHAR(50) NOT NULL REFERENCES cat_productos(codigo) ON DELETE RESTRICT,
    cantidad_recolectada DECIMAL(10,2) NOT NULL CHECK (cantidad_recolectada >= 0),
    cantidad_buena       DECIMAL(10,2) NOT NULL DEFAULT 0,
    cantidad_dano        DECIMAL(10,2) NOT NULL DEFAULT 0,
    cantidad_perdida     DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_he_items_he ON ops_he_items(he_id);

-- 4. Habilitar RLS en estas tablas para proteger datos
ALTER TABLE public.ops_contratos_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_hs_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_he_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo usuarios autenticados_citems" ON public.ops_contratos_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Solo usuarios autenticados_hsitems" ON public.ops_hs_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Solo usuarios autenticados_heitems" ON public.ops_he_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
