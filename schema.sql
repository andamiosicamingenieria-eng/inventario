-- =============================================================
-- SCHEMA: INVENTARIO-CONTRATOS
-- Proyecto Supabase: eftsuegjfqgwdrajkloc
-- Ejecutar en: https://app.supabase.com → SQL Editor
-- =============================================================

-- Función auxiliar para updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- TABLA: contratos (recibe datos del macro VBA de Excel)
-- =============================================================
CREATE TABLE IF NOT EXISTS contratos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_contrato INTEGER NOT NULL UNIQUE,
    cliente TEXT NOT NULL,
    direccion_cliente TEXT,
    telefono TEXT,
    obra TEXT,
    encargado TEXT,
    vendedor INTEGER,
    sucursal TEXT,
    fecha_pago DATE,
    fecha_inicio_renta DATE,
    quien_recibe TEXT,
    movil_quien_recibe TEXT,
    factura TEXT,
    forma_pago TEXT,
    medio_contacto TEXT,
    dias_renta INTEGER DEFAULT 0,
    subtotal NUMERIC(12,2) DEFAULT 0,
    iva NUMERIC(12,2) DEFAULT 0,
    tipo TEXT DEFAULT 'EN RENTA',
    sistema TEXT,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    estatus TEXT DEFAULT 'activo',
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_c_num ON contratos(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_c_est ON contratos(estatus);

CREATE TRIGGER set_contratos_upd BEFORE UPDATE ON contratos
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================================
-- TABLA: contratos_items (recibe datos del macro VBA)
-- =============================================================
CREATE TABLE IF NOT EXISTS contratos_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_contrato INTEGER NOT NULL REFERENCES contratos(numero_contrato) ON DELETE CASCADE,
    cantidad NUMERIC(10,2) DEFAULT 0,
    sku TEXT NOT NULL,
    descripcion TEXT,
    peso_unitario NUMERIC(10,2) DEFAULT 0,
    peso_total NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_c ON contratos_items(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_ci_s ON contratos_items(sku);

-- =============================================================
-- TABLA: hs (Hojas de Salida — entregas a obra)
-- =============================================================
CREATE TABLE IF NOT EXISTS hs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    folio TEXT NOT NULL UNIQUE,
    numero_contrato INTEGER NOT NULL REFERENCES contratos(numero_contrato),
    cliente TEXT,
    obra TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    total_piezas NUMERIC(10,2) DEFAULT 0,
    estatus TEXT DEFAULT 'entregado',
    operador TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_c ON hs(numero_contrato);
CREATE TRIGGER set_hs_upd BEFORE UPDATE ON hs
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================================
-- TABLA: hs_items (detalle de piezas entregadas)
-- =============================================================
CREATE TABLE IF NOT EXISTS hs_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hs_id BIGINT NOT NULL REFERENCES hs(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    descripcion TEXT,
    cantidad NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hsi_h ON hs_items(hs_id);
CREATE INDEX IF NOT EXISTS idx_hsi_s ON hs_items(sku);

-- =============================================================
-- TABLA: he (Hojas de Entrada — recolecciones desde obra)
-- =============================================================
CREATE TABLE IF NOT EXISTS he (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    folio TEXT NOT NULL UNIQUE,
    numero_contrato INTEGER NOT NULL REFERENCES contratos(numero_contrato),
    cliente TEXT,
    obra TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    total_piezas NUMERIC(10,2) DEFAULT 0,
    estatus TEXT DEFAULT 'recibido',
    vaciado_fabricacion BOOLEAN DEFAULT FALSE,
    operador TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_he_c ON he(numero_contrato);
CREATE TRIGGER set_he_upd BEFORE UPDATE ON he
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================================
-- TABLA: he_items (detalle de piezas recolectadas)
-- =============================================================
CREATE TABLE IF NOT EXISTS he_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    he_id BIGINT NOT NULL REFERENCES he(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    descripcion TEXT,
    cantidad_recolectada NUMERIC(10,2) NOT NULL DEFAULT 0,
    cantidad_buena NUMERIC(10,2) DEFAULT 0,
    cantidad_dano NUMERIC(10,2) DEFAULT 0,
    cantidad_perdida NUMERIC(10,2) DEFAULT 0,
    estado TEXT DEFAULT 'pendiente_clasificacion',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hei_h ON he_items(he_id);
CREATE INDEX IF NOT EXISTS idx_hei_s ON he_items(sku);

-- =============================================================
-- TABLA: inventario (stock global por SKU)
-- Actualizado automáticamente por triggers de hs_items y he_items
-- Conteos cíclicos: UPDATE directo desde el panel
-- =============================================================
CREATE TABLE IF NOT EXISTS inventario (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku TEXT NOT NULL,
    descripcion TEXT,
    almacen TEXT DEFAULT 'Principal',
    cantidad_disponible NUMERIC(10,2) DEFAULT 0,
    cantidad_en_obra NUMERIC(10,2) DEFAULT 0,
    cantidad_mantenimiento NUMERIC(10,2) DEFAULT 0,
    cantidad_chatarra NUMERIC(10,2) DEFAULT 0,
    UNIQUE(sku, almacen),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_s ON inventario(sku);
CREATE TRIGGER set_inv_upd BEFORE UPDATE ON inventario
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================================
-- TRIGGER: Al insertar hs_items → restar disponible, sumar en_obra
-- =============================================================
CREATE OR REPLACE FUNCTION fn_hs_item_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO inventario (sku, descripcion, cantidad_disponible, cantidad_en_obra)
    VALUES (NEW.sku, NEW.descripcion, -NEW.cantidad, NEW.cantidad)
    ON CONFLICT (sku, almacen) DO UPDATE SET
        cantidad_disponible = inventario.cantidad_disponible - NEW.cantidad,
        cantidad_en_obra = inventario.cantidad_en_obra + NEW.cantidad,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_hs_item_insert
AFTER INSERT ON hs_items
FOR EACH ROW EXECUTE FUNCTION fn_hs_item_insert();

-- =============================================================
-- TRIGGER: Al borrar hs_items → revertir (devolver a disponible)
-- =============================================================
CREATE OR REPLACE FUNCTION fn_hs_item_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inventario SET
        cantidad_disponible = cantidad_disponible + OLD.cantidad,
        cantidad_en_obra = cantidad_en_obra - OLD.cantidad,
        updated_at = NOW()
    WHERE sku = OLD.sku AND almacen = 'Principal';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_hs_item_delete
AFTER DELETE ON hs_items
FOR EACH ROW EXECUTE FUNCTION fn_hs_item_delete();

-- =============================================================
-- TRIGGER: Al insertar he_items → restar en_obra, sumar disponible
-- =============================================================
CREATE OR REPLACE FUNCTION fn_he_item_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO inventario (sku, descripcion, cantidad_disponible, cantidad_en_obra)
    VALUES (NEW.sku, NEW.descripcion, NEW.cantidad_recolectada, -NEW.cantidad_recolectada)
    ON CONFLICT (sku, almacen) DO UPDATE SET
        cantidad_en_obra = inventario.cantidad_en_obra - NEW.cantidad_recolectada,
        cantidad_disponible = inventario.cantidad_disponible + NEW.cantidad_recolectada,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_he_item_insert
AFTER INSERT ON he_items
FOR EACH ROW EXECUTE FUNCTION fn_he_item_insert();

-- =============================================================
-- TRIGGER: Al borrar he_items → revertir
-- =============================================================
CREATE OR REPLACE FUNCTION fn_he_item_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inventario SET
        cantidad_en_obra = cantidad_en_obra + OLD.cantidad_recolectada,
        cantidad_disponible = cantidad_disponible - OLD.cantidad_recolectada,
        updated_at = NOW()
    WHERE sku = OLD.sku AND almacen = 'Principal';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_he_item_delete
AFTER DELETE ON he_items
FOR EACH ROW EXECUTE FUNCTION fn_he_item_delete();

-- =============================================================
-- RLS: Acceso permisivo con anon key (sin auth por ahora)
-- =============================================================
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE he ENABLE ROW LEVEL SECURITY;
ALTER TABLE he_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON contratos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON contratos_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON hs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON hs_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON he FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON he_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON inventario FOR ALL USING (true) WITH CHECK (true);
