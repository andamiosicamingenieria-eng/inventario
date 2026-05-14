-- =====================================================================
-- ICAM 360 - Script de actualización para tabla crm_clientes
-- Ejecutar en: Supabase -> SQL Editor -> Run
-- Propósito: Añadir columnas necesarias para importación desde CRM/Excel
-- =====================================================================

ALTER TABLE crm_clientes 
    ADD COLUMN IF NOT EXISTS sucursal           VARCHAR(100),
    ADD COLUMN IF NOT EXISTS agente_ventas      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS fecha_nac         DATE,
    ADD COLUMN IF NOT EXISTS telefono_oficina   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS acceso             VARCHAR(100),
    ADD COLUMN IF NOT EXISTS dias_credito       INTEGER,
    ADD COLUMN IF NOT EXISTS medio_contacto     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS valido             VARCHAR(10);

-- Verificación de la estructura actualizada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'crm_clientes';
