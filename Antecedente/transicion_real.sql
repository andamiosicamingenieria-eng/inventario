-- =====================================================================
-- ICAM 360 — SCRIPT DE TRANSICIÓN A PRODUCCIÓN (V2)
-- 1. Limpieza de datos operativos (conservando catálogo e inventario)
-- 2. Automatización: JSONB -> Tablas Relacionales -> Inventario
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ASEGURAR QUE LAS TABLAS EXISTEN
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_solicitudes (
    id                SERIAL PRIMARY KEY,
    tipo              VARCHAR(50) NOT NULL CHECK (tipo IN ('entrega','recoleccion')),
    contrato_id       INTEGER NOT NULL, -- Temporalmente sin FK para permitir el truncate/creación en orden
    folio_contrato    VARCHAR(50),
    fecha_programada  DATE NOT NULL DEFAULT CURRENT_DATE,
    estatus           VARCHAR(50) DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','completada','cancelada')),
    datos_entrega     JSONB,  -- {contacto, telefono, direccion}
    items             JSONB,  -- [{codigo, nombre, cantidad}]
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. LIMPIEZA DE DATOS (Borrar todo excepto Productos e Inventario)
BEGIN;
  TRUNCATE TABLE ops_solicitudes CASCADE;
  TRUNCATE TABLE ops_pagos CASCADE;
  TRUNCATE TABLE ops_contratos CASCADE; 
  TRUNCATE TABLE ops_hs CASCADE;        
  TRUNCATE TABLE ops_he CASCADE;        
  TRUNCATE TABLE ops_subarriendos CASCADE;
  TRUNCATE TABLE crm_clientes CASCADE;
COMMIT;

-- Asegurar que la columna agente_ventas existe
ALTER TABLE crm_clientes ADD COLUMN IF NOT EXISTS agente_ventas VARCHAR(100);

-- Quitar restricción obligatoria al contrato de destino en subarriendos
ALTER TABLE ops_subarriendos ALTER COLUMN contrato_destino_folio DROP NOT NULL;

-- 3. APLICAR LLAVES FORÁNEAS Y OTROS AJUSTES
ALTER TABLE ops_solicitudes 
DROP CONSTRAINT IF EXISTS fk_solicitudes_contrato;

ALTER TABLE ops_solicitudes
ADD CONSTRAINT fk_solicitudes_contrato 
FOREIGN KEY (contrato_id) REFERENCES ops_contratos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_solicitudes_tipo ON ops_solicitudes(tipo);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estatus ON ops_solicitudes(estatus);

-- ---------------------------------------------------------------------
-- 3. LÓGICA DE INVENTARIO AUTOMÁTICO (HS -> Salida)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_process_hs_logic()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    p_id INTEGER;
BEGIN
    -- A. Llenar la tabla relacional ops_hs_items desde el JSONB
    -- Esto permite que los reportes relacionales funcionen sin cambiar el JS
    FOR item IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(codigo text, cantidad_hs numeric)
    LOOP
        -- Insertar en tabla relacional
        INSERT INTO ops_hs_items (hs_id, producto_id, cantidad_hs)
        VALUES (NEW.id, item.codigo, item.cantidad_hs);

        -- B. Actualizar Inventario (inv_master)
        SELECT id INTO p_id FROM cat_productos WHERE codigo = item.codigo;
        
        IF p_id IS NOT NULL THEN
            UPDATE inv_master 
            SET cantidad_disponible = cantidad_disponible - item.cantidad_hs,
                cantidad_rentada    = cantidad_rentada + item.cantidad_hs,
                ultima_salida       = CURRENT_DATE,
                updated_at          = CURRENT_TIMESTAMP
            WHERE producto_id = p_id;
            
            -- Si no existe en inv_master, lo inicializamos
            IF NOT FOUND THEN
                INSERT INTO inv_master (producto_id, cantidad_disponible, cantidad_rentada, ultima_salida)
                VALUES (p_id, -item.cantidad_hs, item.cantidad_hs, CURRENT_DATE);
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_hs ON ops_hs;
CREATE TRIGGER trg_process_hs
AFTER INSERT ON ops_hs
FOR EACH ROW EXECUTE FUNCTION fn_process_hs_logic();

-- ---------------------------------------------------------------------
-- 3. LÓGICA DE AUTOMATIZACIÓN PARA HOJAS DE ENTRADA (HE)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_process_he_logic()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    p_id INTEGER;
BEGIN
    -- A. Llenar la tabla relacional ops_he_items desde el JSONB
    FOR item IN SELECT * FROM jsonb_to_recordset(NEW.items) 
                 AS x(codigo text, cantidad_recolectada numeric, estado text)
    LOOP
        -- Insertar en tabla relacional
        INSERT INTO ops_he_items (he_id, producto_id, cantidad_recolectada, cantidad_buena)
        VALUES (NEW.id, item.codigo, item.cantidad_recolectada, item.cantidad_recolectada);

        -- B. Actualizar Inventario (inv_master)
        SELECT id INTO p_id FROM cat_productos WHERE codigo = item.codigo;
        
        IF p_id IS NOT NULL THEN
            -- Por defecto, lo que entra vuelve a disponible y sale de rentado
            UPDATE inv_master 
            SET cantidad_disponible = cantidad_disponible + item.cantidad_recolectada,
                cantidad_rentada    = cantidad_rentada - item.cantidad_recolectada,
                ultima_entrada      = CURRENT_DATE,
                updated_at          = CURRENT_TIMESTAMP
            WHERE producto_id = p_id;
            
            IF NOT FOUND THEN
                INSERT INTO inv_master (producto_id, cantidad_disponible, cantidad_rentada, ultima_entrada)
                VALUES (p_id, item.cantidad_recolectada, -item.cantidad_recolectada, CURRENT_DATE);
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_he ON ops_he;
CREATE TRIGGER trg_process_he
AFTER INSERT ON ops_he
FOR EACH ROW EXECUTE FUNCTION fn_process_he_logic();
