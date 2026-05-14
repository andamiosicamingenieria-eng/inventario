-- =====================================================================
-- ICAM 360 — Schema MÍNIMO v1.0
-- Solo las 7 tablas que usa la app actualmente
-- Ejecutar completo en: Supabase → SQL Editor → Run
-- =====================================================================

-- Extensión PostGIS (ya incluida en Supabase, ignorar si da error)
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================================
-- 1. CLIENTES
-- =====================================================================
CREATE TABLE IF NOT EXISTS crm_clientes (
    id               SERIAL PRIMARY KEY,
    razon_social     VARCHAR(200) NOT NULL,
    rfc              VARCHAR(13)  UNIQUE,
    tipo_cliente     VARCHAR(50)  CHECK (tipo_cliente IN ('prospecto','cliente_activo','inactivo','potencial')),
    segmento         VARCHAR(50),
    contacto_principal VARCHAR(150),
    telefono         VARCHAR(20),
    email            VARCHAR(100),
    direccion        TEXT,
    limite_credito   DECIMAL(12,2) CHECK (limite_credito >= 0),
    saldo_actual     DECIMAL(12,2) DEFAULT 0 CHECK (saldo_actual >= 0),
    -- Columnas adicionales para compatibilidad con importación CRM
    sucursal         VARCHAR(100),
    agente_ventas    VARCHAR(100),
    fecha_nac        DATE,
    telefono_oficina VARCHAR(20),
    acceso           VARCHAR(100),
    dias_credito     INTEGER,
    medio_contacto   VARCHAR(100),
    valido           VARCHAR(10),
    notas            TEXT,
    activo           BOOLEAN DEFAULT true,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_clientes_rfc  ON crm_clientes(rfc);
CREATE INDEX IF NOT EXISTS idx_crm_clientes_tipo ON crm_clientes(tipo_cliente);

-- =====================================================================
-- 2. PRODUCTOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS cat_productos (
    id               SERIAL PRIMARY KEY,
    codigo           VARCHAR(50)  UNIQUE NOT NULL,
    nombre           VARCHAR(200) NOT NULL,
    descripcion      TEXT,
    categoria        VARCHAR(100),
    familia          VARCHAR(100),
    unidad_medida    VARCHAR(20),
    peso_kg          DECIMAL(10,3) CHECK (peso_kg >= 0),
    dimensiones      VARCHAR(100),
    precio_lista     DECIMAL(12,2) CHECK (precio_lista >= 0),
    costo_unitario   DECIMAL(12,2) CHECK (costo_unitario >= 0),
    margen_sugerido  DECIMAL(5,2)  CHECK (margen_sugerido >= 0 AND margen_sugerido <= 100),
    rentable         BOOLEAN DEFAULT true,
    especificaciones_tecnicas JSONB,
    imagen_url       VARCHAR(500),
    activo           BOOLEAN DEFAULT true,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cat_productos_codigo    ON cat_productos(codigo);
CREATE INDEX IF NOT EXISTS idx_cat_productos_categoria ON cat_productos(categoria);

-- =====================================================================
-- 3. INVENTARIO
-- =====================================================================
CREATE TABLE IF NOT EXISTS inv_master (
    id                        SERIAL PRIMARY KEY,
    producto_id               INTEGER NOT NULL REFERENCES cat_productos(id) ON DELETE RESTRICT,
    almacen                   VARCHAR(100) NOT NULL DEFAULT 'Principal',
    ubicacion                 VARCHAR(50),
    cantidad_disponible       DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    cantidad_rentada          DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cantidad_rentada >= 0),
    cantidad_en_mantenimiento DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cantidad_en_mantenimiento >= 0),
    cantidad_chatarra         DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cantidad_chatarra >= 0),
    cantidad_en_transito      DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cantidad_en_transito >= 0),
    cantidad_reservada        DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
    stock_minimo              DECIMAL(10,2) CHECK (stock_minimo >= 0),
    stock_maximo              DECIMAL(10,2) CHECK (stock_maximo >= 0),
    ultima_entrada            DATE,
    ultima_salida             DATE,
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_inv_producto_almacen UNIQUE (producto_id, almacen)
);
CREATE INDEX IF NOT EXISTS idx_inv_master_producto ON inv_master(producto_id);

-- =====================================================================
-- 4. CONTRATOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops_contratos (
    id                    SERIAL PRIMARY KEY,
    cliente_id            INTEGER NOT NULL REFERENCES crm_clientes(id) ON DELETE RESTRICT,
    folio                 VARCHAR(50) UNIQUE NOT NULL,
    tipo_contrato         VARCHAR(50) CHECK (tipo_contrato IN ('renta','venta','renovacion','venta_perdida','cancelacion')),
    fecha_contrato        DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_inicio_real     DATE,
    fecha_fin             DATE,
    dias_renta            INTEGER CHECK (dias_renta IS NULL OR dias_renta > 0),
    fecha_vencimiento     DATE GENERATED ALWAYS AS (fecha_inicio_real + dias_renta) STORED,
    precio_por_dia        DECIMAL(10,2),
    vigencia_meses        INTEGER,
    monto_mensual         DECIMAL(12,2) CHECK (monto_mensual >= 0),
    monto_total           DECIMAL(12,2) CHECK (monto_total >= 0),
    moneda                VARCHAR(3) DEFAULT 'MXN',
    estatus               VARCHAR(50) CHECK (estatus IN ('borrador','activo','entrega_parcial','recolectado','suspendido','terminado','cancelado')),
    -- Datos adicionales del cliente desnormalizados
    razon_social          VARCHAR(200),
    rfc_cliente           VARCHAR(13),
    telefono_cliente      VARCHAR(20),
    direccion_cliente     TEXT,
    -- Gestión de Cobranza
    anticipo              DECIMAL(12,2) DEFAULT 0 CHECK (anticipo >= 0),
    estatus_pago          VARCHAR(50) DEFAULT 'pendiente' CHECK (estatus_pago IN ('pendiente','parcial','liquidado')),
    fecha_pago            DATE,
    forma_pago            VARCHAR(50),
    -- Operación y Logística
    sistema               VARCHAR(100),
    contacto_entrega      VARCHAR(100),
    telefono_contacto_entrega VARCHAR(20),
    direccion_entrega     TEXT,
    direccion_servicio    TEXT,
    -- Cadena de folios
    renta_anterior        VARCHAR(50),
    renta_posterior       VARCHAR(50),
    folio_raiz            VARCHAR(50),
    -- Otros datos
    condiciones_pago      TEXT,
    clausulas             TEXT,
    archivo_contrato_url  VARCHAR(500),
    vendedor              VARCHAR(100),
    comision_vendedor     DECIMAL(12,2) GENERATED ALWAYS AS (COALESCE(monto_total,0) * 0.04) STORED,
    responsable_operativo VARCHAR(100),
    contrato_origen_folio VARCHAR(50),
    tipo_operacion        VARCHAR(50) CHECK (tipo_operacion IN ('nuevo','renovacion','extension','correccion')),
    items                 JSONB,
    notas                 TEXT,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_contrato_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_contrato),
    CONSTRAINT fk_contrato_origen  FOREIGN KEY (contrato_origen_folio) REFERENCES ops_contratos(folio) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_ops_contratos_cliente    ON ops_contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ops_contratos_folio      ON ops_contratos(folio);
CREATE INDEX IF NOT EXISTS idx_ops_contratos_folio_raiz ON ops_contratos(folio_raiz);
CREATE INDEX IF NOT EXISTS idx_ops_contratos_estatus    ON ops_contratos(estatus);
CREATE INDEX IF NOT EXISTS idx_ops_contratos_vencimiento ON ops_contratos(fecha_vencimiento);

-- =====================================================================
-- 5. PAGOS (COBRANZA)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops_pagos (
    id               SERIAL PRIMARY KEY,
    contrato_id      INTEGER NOT NULL REFERENCES ops_contratos(id) ON DELETE CASCADE,
    fecha_pago       DATE NOT NULL DEFAULT CURRENT_DATE,
    monto            DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    metodo_pago      VARCHAR(50) CHECK (metodo_pago IN ('Transferencia','Efectivo','Cheque','Tarjeta','Otro')),
    referencia       VARCHAR(100),
    notas            TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ops_pagos_contrato ON ops_pagos(contrato_id);

-- =====================================================================
-- 6. HOJAS DE ENTRADA (HE)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops_he (
    id                  SERIAL PRIMARY KEY,
    folio               VARCHAR(50) UNIQUE NOT NULL,
    contrato_folio      VARCHAR(50),
    razon_social        VARCHAR(200),
    fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
    total_piezas        INTEGER NOT NULL DEFAULT 0 CHECK (total_piezas >= 0),
    estatus             VARCHAR(50) DEFAULT 'recibido'
                            CHECK (estatus IN ('recibido','en_transito','pendiente')),
    vaciado_fabricacion BOOLEAN DEFAULT false,
    tipo                VARCHAR(50) DEFAULT 'normal',   -- 'normal' | 'subarr'
    referencia_sa       VARCHAR(50),
    operador            VARCHAR(150),
    notas               TEXT,
    items               JSONB,   -- [{codigo, nombre, cantidad_recolectada, estado}]
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ops_he_folio    ON ops_he(folio);
CREATE INDEX IF NOT EXISTS idx_ops_he_contrato ON ops_he(contrato_folio);

-- =====================================================================
-- 7. HOJAS DE SALIDA (HS)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops_hs (
    id             SERIAL PRIMARY KEY,
    folio          VARCHAR(50) UNIQUE NOT NULL,
    contrato_folio VARCHAR(50),
    razon_social   VARCHAR(200),
    fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
    total_piezas   INTEGER NOT NULL DEFAULT 0 CHECK (total_piezas >= 0),
    estatus        VARCHAR(50) DEFAULT 'entregado'
                       CHECK (estatus IN ('entregado','parcial','pendiente','venta_perdida')),
    tipo           VARCHAR(50) DEFAULT 'normal',   -- 'normal' | 'devolucion_subarr'
    referencia_sa  VARCHAR(50),
    notas          TEXT,
    items          JSONB,   -- [{codigo, nombre, cantidad_hs}]
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ops_hs_folio    ON ops_hs(folio);
CREATE INDEX IF NOT EXISTS idx_ops_hs_contrato ON ops_hs(contrato_folio);

-- =====================================================================
-- 8. SUB-ARRENDAMIENTOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops_subarriendos (
    id                     SERIAL PRIMARY KEY,
    folio                  VARCHAR(50) UNIQUE NOT NULL,
    proveedor              VARCHAR(200) NOT NULL DEFAULT 'Layher',
    contrato_destino_folio VARCHAR(50),
    razon_social_destino   VARCHAR(200),
    fecha_inicio           DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_devolucion       DATE,
    costo_unitario_dia     DECIMAL(10,2) CHECK (costo_unitario_dia >= 0),
    estatus                VARCHAR(50) DEFAULT 'activo'
                               CHECK (estatus IN ('activo','devuelto','cancelado')),
    folio_he               VARCHAR(50),
    folio_hs               VARCHAR(50),
    items                  JSONB,   -- [{producto_id, codigo, nombre, cantidad}]
    notas                  TEXT,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ops_subarriendos_folio    ON ops_subarriendos(folio);
CREATE INDEX IF NOT EXISTS idx_ops_subarriendos_estatus  ON ops_subarriendos(estatus);
CREATE INDEX IF NOT EXISTS idx_ops_subarriendos_contrato ON ops_subarriendos(contrato_destino_folio);

-- =====================================================================
-- TRIGGER updated_at (aplica a todas las tablas anteriores)
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'crm_clientes','cat_productos','inv_master','ops_contratos','ops_pagos',
    'ops_he','ops_hs','ops_subarriendos'
  ]) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
      CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- VERIFICACIÓN FINAL
-- =====================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'crm_clientes','cat_productos','inv_master',
    'ops_contratos','ops_pagos','ops_he','ops_hs','ops_subarriendos'
  )
ORDER BY table_name;
-- Resultado esperado: 8 filas ✓
