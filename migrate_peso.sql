-- =============================================================
-- MIGRACIÓN: Agregar peso a hs_items y he_items
-- Ejecutar en Supabase SQL Editor (proyecto eftsuegjfqgwdrajkloc)
-- =============================================================

-- hs_items: agregar peso
ALTER TABLE hs_items ADD COLUMN IF NOT EXISTS peso_unitario NUMERIC(10,2) DEFAULT 0;
ALTER TABLE hs_items ADD COLUMN IF NOT EXISTS peso_total NUMERIC(10,2) DEFAULT 0;

-- he_items: agregar peso
ALTER TABLE he_items ADD COLUMN IF NOT EXISTS peso_unitario NUMERIC(10,2) DEFAULT 0;
ALTER TABLE he_items ADD COLUMN IF NOT EXISTS peso_total NUMERIC(10,2) DEFAULT 0;

-- hs: agregar peso total consolidado
ALTER TABLE hs ADD COLUMN IF NOT EXISTS peso_total NUMERIC(10,2) DEFAULT 0;

-- he: agregar peso total consolidado
ALTER TABLE he ADD COLUMN IF NOT EXISTS peso_total NUMERIC(10,2) DEFAULT 0;
