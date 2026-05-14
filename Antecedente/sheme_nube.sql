-- =====================================================================
-- ICAM 360 - ERP DATABASE SCHEMA v2.0
-- PostgreSQL 15+ con PostGIS
-- Arquitecto: Sistema de Base de Datos Seguro
-- Fecha: 2026-02-12
-- VERSIÓN 2.0 - Con mejoras implementadas
-- =====================================================================
-- =====================================================================
-- CAMBIOS EN VERSIÓN 2.0:
-- + Control de estados de inventario (disponible/rentado/mantenimiento/chatarra/transito)
-- + Sistema de días de renta (no meses fijos)
-- + Separación fecha_contrato vs fecha_inicio_real
-- + Campo vendedor y comisión (4%) en contratos
-- + Tabla ops_renovaciones (padre-hijo)
-- + Tabla ops_cargos_adicionales (faltantes/chatarra/excedentes)
-- + Tabla ops_subarriendos (flujo Layher completo)
-- + Tabla mto_inspecciones (clasificación en recolección)
-- + Tabla log_transacciones_viaje (unifica evidencias + gastos)
-- + Cálculo automático de flete en cotizaciones
-- - Eliminada: fab_params_corte
-- - Eliminadas: log_evidencias, log_gastos_viaje (consolidadas)
-- =====================================================================
-- =====================================================================
-- NOTA CRÍTICA DE SEGURIDAD - PREVENCIÓN DE INYECCIÓN SQL
-- =====================================================================
-- TODA interacción con esta base de datos DEBE implementarse mediante:
--   1. Prepared Statements (Java, Python, Node.js, etc.)
--   2. Parameterized Queries (Entity Framework, Sequelize, etc.)
--   3. ORM con protección automática (Hibernate, TypeORM, etc.)
--
-- ESTÁ ESTRICTAMENTE PROHIBIDO:
--   - Concatenación de strings para construir consultas SQL
--   - Interpolación directa de variables de usuario en SQL
--   - Ejecución de SQL dinámico sin parametrización
--
-- Ejemplo CORRECTO (Python):
--   cursor.execute("SELECT * FROM crm_clientes WHERE id = %s", (client_id,))
--
-- Ejemplo INCORRECTO (NUNCA USAR):
--   cursor.execute(f"SELECT * FROM crm_clientes WHERE id = {client_id}")
-- =====================================================================
-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- =====================================================================
-- MÓDULO A: CRM & VENTAS (Prefijo: crm_)
-- =====================================================================
-- Tabla: crm_clientes
CREATE TABLE crm_clientes (
    id SERIAL PRIMARY KEY,
    razon_social VARCHAR(200) NOT NULL,
    rfc VARCHAR(13) UNIQUE,
    tipo_cliente VARCHAR(50) CHECK (
        tipo_cliente IN (
            'prospecto',
            'cliente_activo',
            'inactivo',
            'potencial'
        )
    ),
    segmento VARCHAR(50),
    contacto_principal VARCHAR(150),
    telefono VARCHAR(20),
    email VARCHAR(100) CHECK (
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),
    direccion TEXT,
    limite_credito DECIMAL(12, 2) CHECK (limite_credito >= 0),
    saldo_actual DECIMAL(12, 2) DEFAULT 0 CHECK (saldo_actual >= 0),
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_crm_clientes_rfc ON crm_clientes(rfc);
CREATE INDEX idx_crm_clientes_tipo ON crm_clientes(tipo_cliente);
COMMENT ON TABLE crm_clientes IS 'Catálogo maestro de clientes y prospectos';
COMMENT ON COLUMN crm_clientes.email IS 'Email validado con expresión regular en constraint';
-- Tabla: crm_oportunidades
CREATE TABLE crm_oportunidades (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES crm_clientes(id) ON DELETE RESTRICT,
    nombre_oportunidad VARCHAR(200) NOT NULL,
    descripcion TEXT,
    valor_estimado DECIMAL(12, 2) CHECK (valor_estimado >= 0),
    probabilidad INTEGER CHECK (
        probabilidad >= 0
        AND probabilidad <= 100
    ),
    etapa VARCHAR(50) CHECK (
        etapa IN (
            'prospección',
            'calificación',
            'propuesta',
            'negociación',
            'cerrada_ganada',
            'cerrada_perdida'
        )
    ),
    fecha_cierre_estimada DATE,
    fecha_cierre_real DATE,
    vendedor VARCHAR(100),
    fuente VARCHAR(100),
    competencia TEXT,
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fecha_cierre CHECK (
        fecha_cierre_real IS NULL
        OR fecha_cierre_real >= created_at::date
    )
);
CREATE INDEX idx_crm_oportunidades_cliente ON crm_oportunidades(cliente_id);
CREATE INDEX idx_crm_oportunidades_etapa ON crm_oportunidades(etapa);
CREATE INDEX idx_crm_oportunidades_vendedor ON crm_oportunidades(vendedor);
COMMENT ON TABLE crm_oportunidades IS 'Pipeline de ventas y oportunidades comerciales';
-- Tabla: crm_cotizaciones (v2.0: agregado cálculo de flete)
CREATE TABLE crm_cotizaciones (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES crm_clientes(id) ON DELETE RESTRICT,
    oportunidad_id INTEGER REFERENCES crm_oportunidades(id) ON DELETE RESTRICT,
    folio VARCHAR(50) UNIQUE NOT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    -- v2.0: Separación de subtotales
    subtotal_equipo DECIMAL(12, 2) NOT NULL CHECK (subtotal_equipo >= 0),
    subtotal_flete DECIMAL(12, 2) DEFAULT 0 CHECK (subtotal_flete >= 0),
    subtotal DECIMAL(12, 2) GENERATED ALWAYS AS (subtotal_equipo + subtotal_flete) STORED,
    iva DECIMAL(12, 2) NOT NULL CHECK (iva >= 0),
    total DECIMAL(12, 2) NOT NULL CHECK (total >= 0),
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'borrador',
            'enviada',
            'aprobada',
            'rechazada',
            'expirada',
            'convertida'
        )
    ),
    condiciones_pago TEXT,
    tiempo_entrega VARCHAR(100),
    vigencia_dias INTEGER CHECK (vigencia_dias > 0),
    -- v2.0: Datos para cálculo de flete
    peso_total_kg DECIMAL(10, 2),
    distancia_km DECIMAL(8, 2),
    notas TEXT,
    archivo_pdf_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cotizacion_vencimiento CHECK (fecha_vencimiento >= fecha_emision),
    CONSTRAINT chk_cotizacion_total CHECK (total = subtotal + iva)
);
CREATE INDEX idx_crm_cotizaciones_cliente ON crm_cotizaciones(cliente_id);
CREATE INDEX idx_crm_cotizaciones_folio ON crm_cotizaciones(folio);
CREATE INDEX idx_crm_cotizaciones_estatus ON crm_cotizaciones(estatus);
COMMENT ON TABLE crm_cotizaciones IS 'Cotizaciones y propuestas comerciales con cálculo de flete';
COMMENT ON COLUMN crm_cotizaciones.peso_total_kg IS 'Peso total calculado desde items para flete';
COMMENT ON COLUMN crm_cotizaciones.distancia_km IS 'Distancia almacén-cliente para cálculo de flete';
-- Tabla: crm_cotizacion_items
CREATE TABLE crm_cotizacion_items (
    id SERIAL PRIMARY KEY,
    cotizacion_id INTEGER NOT NULL REFERENCES crm_cotizaciones(id) ON DELETE RESTRICT,
    producto_codigo VARCHAR(50),
    descripcion VARCHAR(500) NOT NULL,
    cantidad DECIMAL(10, 2) NOT NULL CHECK (cantidad > 0),
    unidad VARCHAR(20),
    precio_unitario DECIMAL(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    descuento_porcentaje DECIMAL(5, 2) DEFAULT 0 CHECK (
        descuento_porcentaje >= 0
        AND descuento_porcentaje <= 100
    ),
    importe DECIMAL(12, 2) NOT NULL CHECK (importe >= 0),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_item_importe CHECK (
        importe = cantidad * precio_unitario * (1 - descuento_porcentaje / 100)
    )
);
CREATE INDEX idx_crm_cotizacion_items_cotizacion ON crm_cotizacion_items(cotizacion_id);
COMMENT ON TABLE crm_cotizacion_items IS 'Líneas de detalle de cotizaciones';
-- Tabla: crm_cat_rechazos
CREATE TABLE crm_cat_rechazos (
    id SERIAL PRIMARY KEY,
    motivo VARCHAR(200) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE crm_cat_rechazos IS 'Catálogo de motivos de rechazo de cotizaciones';
-- Tabla: crm_metas_comerciales
CREATE TABLE crm_metas_comerciales (
    id SERIAL PRIMARY KEY,
    periodo VARCHAR(7) NOT NULL,
    -- Formato: YYYY-MM
    vendedor VARCHAR(100) NOT NULL,
    meta_ventas DECIMAL(12, 2) NOT NULL CHECK (meta_ventas >= 0),
    ventas_reales DECIMAL(12, 2) DEFAULT 0 CHECK (ventas_reales >= 0),
    porcentaje_cumplimiento DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE
            WHEN meta_ventas > 0 THEN (ventas_reales / meta_ventas * 100)
            ELSE 0
        END
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_meta_periodo_vendedor UNIQUE (periodo, vendedor)
);
CREATE INDEX idx_crm_metas_periodo ON crm_metas_comerciales(periodo);
COMMENT ON TABLE crm_metas_comerciales IS 'Metas mensuales del equipo de ventas';
-- Tabla: crm_servicios_ing
CREATE TABLE crm_servicios_ing (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES crm_clientes(id) ON DELETE RESTRICT,
    tipo_servicio VARCHAR(100) NOT NULL,
    descripcion TEXT,
    especificaciones JSONB,
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_entrega_estimada DATE,
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'solicitado',
            'en_proceso',
            'completado',
            'cancelado'
        )
    ),
    responsable VARCHAR(100),
    monto DECIMAL(12, 2) CHECK (monto >= 0),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fecha_entrega_servicio CHECK (
        fecha_entrega_estimada IS NULL
        OR fecha_entrega_estimada >= fecha_solicitud
    )
);
CREATE INDEX idx_crm_servicios_cliente ON crm_servicios_ing(cliente_id);
CREATE INDEX idx_crm_servicios_estatus ON crm_servicios_ing(estatus);
COMMENT ON TABLE crm_servicios_ing IS 'Servicios de ingeniería y personalizaciones';
-- =====================================================================
-- MÓDULO B: OPERACIONES & RENTAS (Prefijo: ops_ / inv_)
-- =====================================================================
-- Tabla: cat_productos (v2.0: agregado peso para cálculo de flete)
CREATE TABLE cat_productos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    familia VARCHAR(100),
    unidad_medida VARCHAR(20),
    peso_kg DECIMAL(10, 3) CHECK (peso_kg >= 0),
    -- v2.0: CRÍTICO para flete
    dimensiones VARCHAR(100),
    precio_lista DECIMAL(12, 2) CHECK (precio_lista >= 0),
    costo_unitario DECIMAL(12, 2) CHECK (costo_unitario >= 0),
    margen_sugerido DECIMAL(5, 2) CHECK (
        margen_sugerido >= 0
        AND margen_sugerido <= 100
    ),
    rentable BOOLEAN DEFAULT true,
    especificaciones_tecnicas JSONB,
    imagen_url VARCHAR(500),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cat_productos_codigo ON cat_productos(codigo);
CREATE INDEX idx_cat_productos_categoria ON cat_productos(categoria);
COMMENT ON TABLE cat_productos IS 'Catálogo maestro de productos';
COMMENT ON COLUMN cat_productos.peso_kg IS 'Peso por pieza - CRÍTICO para cálculo de flete';
-- Tabla: inv_master (v2.0: CONTROL DE ESTADOS)
CREATE TABLE inv_master (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES cat_productos(id) ON DELETE RESTRICT,
    almacen VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(50),
    -- v2.0: ESTADOS DEL INVENTARIO (Prioridad 1)
    cantidad_disponible DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    cantidad_rentada DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad_rentada >= 0),
    cantidad_en_mantenimiento DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad_en_mantenimiento >= 0),
    cantidad_chatarra DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad_chatarra >= 0),
    cantidad_en_transito DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad_en_transito >= 0),
    -- Campos originales
    cantidad_reservada DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
    stock_minimo DECIMAL(10, 2) CHECK (stock_minimo >= 0),
    stock_maximo DECIMAL(10, 2) CHECK (stock_maximo >= 0),
    ultima_entrada DATE,
    ultima_salida DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_inv_producto_almacen UNIQUE (producto_id, almacen),
    CONSTRAINT chk_stock_min_max CHECK (
        stock_maximo IS NULL
        OR stock_minimo IS NULL
        OR stock_maximo >= stock_minimo
    )
);
CREATE INDEX idx_inv_master_producto ON inv_master(producto_id);
CREATE INDEX idx_inv_master_almacen ON inv_master(almacen);
COMMENT ON TABLE inv_master IS 'Inventario maestro por almacén con control de estados (v2.0)';
COMMENT ON COLUMN inv_master.cantidad_disponible IS 'Listo para rentar';
COMMENT ON COLUMN inv_master.cantidad_rentada IS 'En contratos activos';
COMMENT ON COLUMN inv_master.cantidad_en_mantenimiento IS 'En taller (sucios funcionales)';
COMMENT ON COLUMN inv_master.cantidad_chatarra IS 'Dañado irreparable, pendiente baja';
COMMENT ON COLUMN inv_master.cantidad_en_transito IS 'En viajes de entrega/recolección';
-- Tabla: ops_contratos (v2.0: DÍAS DE RENTA + VENDEDOR)
CREATE TABLE ops_contratos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES crm_clientes(id) ON DELETE RESTRICT,
    folio VARCHAR(50) UNIQUE NOT NULL,
    tipo_contrato VARCHAR(50) CHECK (
        tipo_contrato IN ('renta', 'venta', 'servicio', 'mixto')
    ),
    -- v2.0: SEPARACIÓN DE FECHAS (Prioridad 2)
    fecha_contrato DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Firma del documento
    fecha_inicio_real DATE,
    -- Entrega física del equipo (gatillo del contrato)
    fecha_fin DATE,
    -- v2.0: DÍAS DE RENTA (no meses)
    dias_renta INTEGER,
    -- 15, 30, 60, 90, etc.
    fecha_vencimiento DATE GENERATED ALWAYS AS (fecha_inicio_real + dias_renta) STORED,
    -- v2.0: PRECIO POR DÍA (para calcular excedentes)
    precio_por_dia DECIMAL(10, 2),
    vigencia_meses INTEGER,
    monto_mensual DECIMAL(12, 2) CHECK (monto_mensual >= 0),
    monto_total DECIMAL(12, 2) CHECK (monto_total >= 0),
    moneda VARCHAR(3) DEFAULT 'MXN',
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'borrador',
            'activo',
            'suspendido',
            'terminado',
            'cancelado'
        )
    ),
    ubicacion_servicio GEOGRAPHY(POINT, 4326),
    direccion_servicio TEXT,
    condiciones_pago TEXT,
    clausulas TEXT,
    archivo_contrato_url VARCHAR(500),
    -- v2.0: VENDEDOR Y COMISIÓN (Prioridad 3)
    vendedor VARCHAR(100),
    -- Quien cerró la venta
    comision_vendedor DECIMAL(12, 2) GENERATED ALWAYS AS (monto_total * 0.04) STORED,
    -- 4%
    responsable_operativo VARCHAR(100),
    -- Renombrado de "responsable"
    -- v2.0: RENOVACIONES (Prioridad 2)
    contrato_origen_folio VARCHAR(50),
    -- Referencia al contrato padre
    tipo_operacion VARCHAR(50) CHECK (
        tipo_operacion IN ('nuevo', 'renovacion', 'extension', 'correccion')
    ),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_contrato_fechas CHECK (
        fecha_fin IS NULL
        OR fecha_fin >= fecha_contrato
    ),
    CONSTRAINT chk_dias_renta CHECK (
        dias_renta IS NULL
        OR dias_renta > 0
    ),
    CONSTRAINT fk_contrato_origen FOREIGN KEY (contrato_origen_folio) REFERENCES ops_contratos(folio) ON DELETE RESTRICT
);
CREATE INDEX idx_ops_contratos_cliente ON ops_contratos(cliente_id);
CREATE INDEX idx_ops_contratos_folio ON ops_contratos(folio);
CREATE INDEX idx_ops_contratos_estatus ON ops_contratos(estatus);
CREATE INDEX idx_ops_contratos_ubicacion ON ops_contratos USING GIST(ubicacion_servicio);
CREATE INDEX idx_ops_contratos_vendedor ON ops_contratos(vendedor);
CREATE INDEX idx_ops_contratos_origen ON ops_contratos(contrato_origen_folio);
CREATE INDEX idx_ops_contratos_vencimiento ON ops_contratos(fecha_vencimiento);
COMMENT ON TABLE ops_contratos IS 'Contratos de renta con días de renta y vendedor (v2.0)';
COMMENT ON COLUMN ops_contratos.fecha_contrato IS 'Fecha de firma del contrato';
COMMENT ON COLUMN ops_contratos.fecha_inicio_real IS 'Fecha de entrega física - GATILLO del contrato';
COMMENT ON COLUMN ops_contratos.dias_renta IS 'Días contratados (15, 30, 60, etc.)';
COMMENT ON COLUMN ops_contratos.fecha_vencimiento IS 'Calculado: fecha_inicio_real + dias_renta';
COMMENT ON COLUMN ops_contratos.precio_por_dia IS 'Para calcular excedentes: monto_total / dias_renta';
COMMENT ON COLUMN ops_contratos.vendedor IS 'Agente de ventas que cerró el negocio';
COMMENT ON COLUMN ops_contratos.comision_vendedor IS 'Calculado: monto_total × 4%';
-- Tabla: ops_contrato_items
CREATE TABLE ops_contrato_items (
    id SERIAL PRIMARY KEY,
    contrato_id INTEGER NOT NULL REFERENCES ops_contratos(id) ON DELETE RESTRICT,
    producto_id INTEGER REFERENCES cat_productos(id) ON DELETE RESTRICT,
    descripcion VARCHAR(500) NOT NULL,
    cantidad DECIMAL(10, 2) NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    periodo_renta VARCHAR(50),
    fecha_entrega DATE,
    fecha_retorno DATE,
    estatus_entrega VARCHAR(50) CHECK (
        estatus_entrega IN ('pendiente', 'entregado', 'en_uso', 'retornado')
    ),
    serie_numero VARCHAR(100),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ops_contrato_items_contrato ON ops_contrato_items(contrato_id);
CREATE INDEX idx_ops_contrato_items_producto ON ops_contrato_items(producto_id);
COMMENT ON TABLE ops_contrato_items IS 'Líneas de detalle de contratos y rentas';
-- Tabla: ops_renovaciones (v2.0: NUEVA - Prioridad 2)
CREATE TABLE ops_renovaciones (
    id SERIAL PRIMARY KEY,
    contrato_padre_folio VARCHAR(50) NOT NULL,
    contrato_hijo_folio VARCHAR(50) NOT NULL,
    tipo_renovacion VARCHAR(20) CHECK (tipo_renovacion IN ('total', 'parcial')),
    porcentaje_renovado DECIMAL(5, 2) CHECK (
        porcentaje_renovado > 0
        AND porcentaje_renovado <= 100
    ),
    items_renovados JSONB,
    -- [{producto_id, cantidad_renovada}]
    items_devueltos JSONB,
    -- [{producto_id, cantidad_devuelta}]
    fecha_renovacion DATE NOT NULL DEFAULT CURRENT_DATE,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_renovacion_padre FOREIGN KEY (contrato_padre_folio) REFERENCES ops_contratos(folio) ON DELETE RESTRICT,
    CONSTRAINT fk_renovacion_hijo FOREIGN KEY (contrato_hijo_folio) REFERENCES ops_contratos(folio) ON DELETE RESTRICT
);
CREATE INDEX idx_ops_renovaciones_padre ON ops_renovaciones(contrato_padre_folio);
CREATE INDEX idx_ops_renovaciones_hijo ON ops_renovaciones(contrato_hijo_folio);
COMMENT ON TABLE ops_renovaciones IS 'Historial de renovaciones de contratos (padre-hijo) - v2.0';
COMMENT ON COLUMN ops_renovaciones.tipo_renovacion IS 'total: 100% del equipo, parcial: solo un %';
COMMENT ON COLUMN ops_renovaciones.items_renovados IS 'JSON: equipos que continúan rentados';
COMMENT ON COLUMN ops_renovaciones.items_devueltos IS 'JSON: equipos devueltos en renovación parcial';
-- Tabla: ops_cargos_adicionales (v2.0: NUEVA - Prioridad 4)
CREATE TABLE ops_cargos_adicionales (
    id SERIAL PRIMARY KEY,
    contrato_folio VARCHAR(50) NOT NULL,
    tipo_cargo VARCHAR(30) CHECK (
        tipo_cargo IN ('faltante', 'chatarra', 'dias_excedentes')
    ),
    producto_id INTEGER REFERENCES cat_productos(id) ON DELETE RESTRICT,
    cantidad DECIMAL(10, 2) CHECK (cantidad > 0),
    motivo TEXT NOT NULL,
    valor_unitario DECIMAL(12, 2) CHECK (valor_unitario >= 0),
    -- Precio nuevo × 0.90
    total_cargo DECIMAL(12, 2) CHECK (total_cargo >= 0),
    fecha_deteccion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_limite_gracia DATE,
    -- +7 días para faltantes
    aprobado_por VARCHAR(100),
    -- Director Operativo
    fecha_aprobacion DATE,
    estatus VARCHAR(30) CHECK (
        estatus IN (
            'pendiente',
            'en_gracia',
            'aprobado',
            'facturado',
            'cobrado',
            'cancelado'
        )
    ),
    numero_factura VARCHAR(50),
    evidencias_url VARCHAR(500),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cargo_contrato FOREIGN KEY (contrato_folio) REFERENCES ops_contratos(folio) ON DELETE RESTRICT
);
CREATE INDEX idx_ops_cargos_contrato ON ops_cargos_adicionales(contrato_folio);
CREATE INDEX idx_ops_cargos_estatus ON ops_cargos_adicionales(estatus);
CREATE INDEX idx_ops_cargos_tipo ON ops_cargos_adicionales(tipo_cargo);
COMMENT ON TABLE ops_cargos_adicionales IS 'Cobros por faltantes, chatarra y días excedentes - v2.0';
COMMENT ON COLUMN ops_cargos_adicionales.fecha_limite_gracia IS '7 días de gracia para faltantes';
COMMENT ON COLUMN ops_cargos_adicionales.valor_unitario IS 'Precio nuevo con 10% depreciación';
-- Tabla: ops_subarriendos (v2.0: NUEVA - Prioridad 5)
CREATE TABLE ops_subarriendos (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    contrato_destino_folio VARCHAR(50) NOT NULL,
    proveedor VARCHAR(200) NOT NULL DEFAULT 'Layher',
    tipo_proveedor VARCHAR(50) CHECK (tipo_proveedor IN ('layher', 'otro')),
    producto_id INTEGER NOT NULL REFERENCES cat_productos(id) ON DELETE RESTRICT,
    cantidad_solicitada DECIMAL(10, 2) NOT NULL CHECK (cantidad_solicitada > 0),
    -- FASE 1: Solicitud y Cotización
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_cotizacion_recibida DATE,
    monto_cotizado DECIMAL(12, 2) CHECK (monto_cotizado >= 0),
    disponibilidad_confirmada BOOLEAN DEFAULT NULL,
    motivo_rechazo TEXT,
    -- FASE 2: Aprobación y Pago
    fecha_aprobacion DATE,
    fecha_pago DATE,
    comprobante_pago_url VARCHAR(500),
    -- FASE 3: Documentación Layher
    fecha_ficha_recibida DATE,
    folio_ficha_layher VARCHAR(100),
    -- FASE 4: Logística ICAM
    fecha_recoleccion_programada DATE,
    viaje_recoleccion_id INTEGER,
    -- FK a log_viajes (recolección en Layher)
    fecha_recoleccion_real DATE,
    viaje_entrega_cliente_id INTEGER,
    -- FK a log_viajes (entrega al cliente)
    -- FASE 5: Finalización
    fecha_recoleccion_cliente DATE,
    viaje_devolucion_layher_id INTEGER,
    -- FK a log_viajes (devolución a Layher)
    fecha_devolucion_layher DATE,
    fecha_confirmacion_devolucion DATE,
    -- Costos
    costo_unitario_dia DECIMAL(10, 2) CHECK (costo_unitario_dia >= 0),
    -- Lo que Layher cobra
    dias_renta INTEGER,
    costo_total DECIMAL(12, 2) CHECK (costo_total >= 0),
    factura_proveedor VARCHAR(50),
    -- Control
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'solicitado',
            'cotizado',
            'sin_stock',
            'rechazado',
            'aprobado',
            'pagado',
            'ficha_recibida',
            'recolectado_layher',
            'entregado_cliente',
            'recolectado_cliente',
            'devuelto_layher',
            'cerrado'
        )
    ),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subarriendo_contrato FOREIGN KEY (contrato_destino_folio) REFERENCES ops_contratos(folio) ON DELETE RESTRICT
);
CREATE INDEX idx_ops_subarriendos_folio ON ops_subarriendos(folio);
CREATE INDEX idx_ops_subarriendos_contrato ON ops_subarriendos(contrato_destino_folio);
CREATE INDEX idx_ops_subarriendos_estatus ON ops_subarriendos(estatus);
CREATE INDEX idx_ops_subarriendos_proveedor ON ops_subarriendos(proveedor);
COMMENT ON TABLE ops_subarriendos IS 'Flujo completo de subarriendo (principalmente Layher) - v2.0';
COMMENT ON COLUMN ops_subarriendos.disponibilidad_confirmada IS 'Layher puede NO tener stock disponible';
COMMENT ON COLUMN ops_subarriendos.costo_unitario_dia IS 'Precio que Layher cobra a ICAM por día';
-- =====================================================================
-- MÓDULO C: FABRICACIÓN (Prefijo: fab_)
-- =====================================================================
-- Tabla: fab_insumos
CREATE TABLE fab_insumos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(100),
    proveedor VARCHAR(200),
    unidad_medida VARCHAR(20),
    costo_unitario DECIMAL(12, 2) CHECK (costo_unitario >= 0),
    stock_actual DECIMAL(10, 2) DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo DECIMAL(10, 2) CHECK (stock_minimo >= 0),
    especificaciones JSONB,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fab_insumos_codigo ON fab_insumos(codigo);
CREATE INDEX idx_fab_insumos_tipo ON fab_insumos(tipo);
COMMENT ON TABLE fab_insumos IS 'Catálogo de insumos y materiales de fabricación';
-- Tabla: fab_ordenes
CREATE TABLE fab_ordenes (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    contrato_id INTEGER REFERENCES ops_contratos(id) ON DELETE RESTRICT,
    producto_id INTEGER REFERENCES cat_productos(id) ON DELETE RESTRICT,
    tipo_orden VARCHAR(50) CHECK (
        tipo_orden IN ('produccion', 'mantenimiento', 'modificacion')
    ),
    cantidad DECIMAL(10, 2) NOT NULL CHECK (cantidad > 0),
    prioridad VARCHAR(20) CHECK (
        prioridad IN ('baja', 'normal', 'alta', 'urgente')
    ),
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_inicio_programada DATE,
    fecha_fin_programada DATE,
    fecha_inicio_real DATE,
    fecha_fin_real DATE,
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'pendiente',
            'programada',
            'en_proceso',
            'pausada',
            'completada',
            'cancelada'
        )
    ),
    supervisor VARCHAR(100),
    operadores TEXT,
    especificaciones_tecnicas JSONB,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fab_fechas_programadas CHECK (
        fecha_fin_programada IS NULL
        OR fecha_inicio_programada IS NULL
        OR fecha_fin_programada >= fecha_inicio_programada
    ),
    CONSTRAINT chk_fab_fechas_reales CHECK (
        fecha_fin_real IS NULL
        OR fecha_inicio_real IS NULL
        OR fecha_fin_real >= fecha_inicio_real
    )
);
CREATE INDEX idx_fab_ordenes_folio ON fab_ordenes(folio);
CREATE INDEX idx_fab_ordenes_estatus ON fab_ordenes(estatus);
CREATE INDEX idx_fab_ordenes_contrato ON fab_ordenes(contrato_id);
COMMENT ON TABLE fab_ordenes IS 'Órdenes de fabricación y producción';
-- Tabla: fab_externos
CREATE TABLE fab_externos (
    id SERIAL PRIMARY KEY,
    orden_fabricacion_id INTEGER REFERENCES fab_ordenes(id) ON DELETE RESTRICT,
    proveedor VARCHAR(200) NOT NULL,
    tipo_servicio VARCHAR(100) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(12, 2) CHECK (monto >= 0),
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_entrega_estimada DATE,
    fecha_entrega_real DATE,
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'solicitado',
            'en_proceso',
            'completado',
            'cancelado'
        )
    ),
    orden_compra VARCHAR(50),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fab_externos_orden ON fab_externos(orden_fabricacion_id);
CREATE INDEX idx_fab_externos_proveedor ON fab_externos(proveedor);
COMMENT ON TABLE fab_externos IS 'Servicios de fabricación externalizados (galvanizado, etc.)';
-- Tabla: mto_inspecciones (v2.0: NUEVA - Prioridad 4)
CREATE TABLE mto_inspecciones (
    id SERIAL PRIMARY KEY,
    viaje_recoleccion_id INTEGER NOT NULL,
    -- FK a log_viajes
    contrato_id INTEGER NOT NULL REFERENCES ops_contratos(id) ON DELETE RESTRICT,
    producto_id INTEGER NOT NULL REFERENCES cat_productos(id) ON DELETE RESTRICT,
    cantidad_esperada DECIMAL(10, 2) NOT NULL CHECK (cantidad_esperada > 0),
    cantidad_inspeccionada DECIMAL(10, 2) NOT NULL CHECK (cantidad_inspeccionada >= 0),
    -- CLASIFICACIÓN (Prioridad 4)
    cantidad_limpia_funcional DECIMAL(10, 2) DEFAULT 0 CHECK (cantidad_limpia_funcional >= 0),
    -- Directo a inventario disponible
    cantidad_sucia_funcional DECIMAL(10, 2) DEFAULT 0 CHECK (cantidad_sucia_funcional >= 0),
    -- A mantenimiento
    cantidad_chatarra DECIMAL(10, 2) DEFAULT 0 CHECK (cantidad_chatarra >= 0),
    -- Cobro al cliente
    inspector VARCHAR(100) NOT NULL,
    -- Chofer capacitado
    fecha_inspeccion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    evidencias_url VARCHAR(500),
    -- Fotos de daños
    observaciones TEXT,
    aprobado_por VARCHAR(100),
    -- Director Operativo
    fecha_aprobacion DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_inspeccion_suma CHECK (
        cantidad_limpia_funcional + cantidad_sucia_funcional + cantidad_chatarra = cantidad_inspeccionada
    )
);
CREATE INDEX idx_mto_inspecciones_viaje ON mto_inspecciones(viaje_recoleccion_id);
CREATE INDEX idx_mto_inspecciones_contrato ON mto_inspecciones(contrato_id);
COMMENT ON TABLE mto_inspecciones IS 'Inspecciones en recolección: limpio/sucio/chatarra - v2.0';
COMMENT ON COLUMN mto_inspecciones.cantidad_limpia_funcional IS 'Regresa a inventario disponible';
COMMENT ON COLUMN mto_inspecciones.cantidad_sucia_funcional IS 'Va a mantenimiento';
COMMENT ON COLUMN mto_inspecciones.cantidad_chatarra IS 'Genera cargo al cliente';
-- v2.0: ELIMINADA fab_params_corte (no se usa por ahora)
-- =====================================================================
-- MÓDULO D: LOGÍSTICA (Prefijo: log_)
-- =====================================================================
-- Tabla: log_flota
CREATE TABLE log_flota (
    id SERIAL PRIMARY KEY,
    numero_economico VARCHAR(20) UNIQUE NOT NULL,
    tipo_unidad VARCHAR(50) CHECK (
        tipo_unidad IN ('camion', 'camioneta', 'grua', 'trailer', 'van')
    ),
    marca VARCHAR(50),
    modelo VARCHAR(50),
    anio INTEGER CHECK (
        anio >= 1900
        AND anio <= EXTRACT(
            YEAR
            FROM CURRENT_DATE
        ) + 1
    ),
    placas VARCHAR(20) UNIQUE,
    capacidad_carga_kg DECIMAL(10, 2) CHECK (capacidad_carga_kg > 0),
    kilometraje_actual DECIMAL(10, 2) DEFAULT 0 CHECK (kilometraje_actual >= 0),
    fecha_ultima_verificacion DATE,
    fecha_proxima_verificacion DATE,
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'activo',
            'mantenimiento',
            'fuera_servicio',
            'vendido'
        )
    ),
    operador_asignado VARCHAR(100),
    ubicacion_actual VARCHAR(200),
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_flota_verificacion CHECK (
        fecha_proxima_verificacion IS NULL
        OR fecha_ultima_verificacion IS NULL
        OR fecha_proxima_verificacion >= fecha_ultima_verificacion
    )
);
CREATE INDEX idx_log_flota_economico ON log_flota(numero_economico);
CREATE INDEX idx_log_flota_estatus ON log_flota(estatus);
COMMENT ON TABLE log_flota IS 'Catálogo de vehículos de la flota';
-- Tabla: log_viajes
CREATE TABLE log_viajes (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    unidad_id INTEGER NOT NULL REFERENCES log_flota(id) ON DELETE RESTRICT,
    contrato_id INTEGER REFERENCES ops_contratos(id) ON DELETE RESTRICT,
    operador VARCHAR(100) NOT NULL,
    tipo_viaje VARCHAR(50) CHECK (
        tipo_viaje IN (
            'entrega',
            'recoleccion',
            'recoleccion_parcial',
            'traslado',
            'retorno',
            'recoleccion_layher',
            'devolucion_layher'
        )
    ),
    fecha_salida TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_llegada_estimada TIMESTAMP WITH TIME ZONE,
    fecha_llegada_real TIMESTAMP WITH TIME ZONE,
    origen VARCHAR(300) NOT NULL,
    destino VARCHAR(300) NOT NULL,
    km_inicial DECIMAL(10, 2) CHECK (km_inicial >= 0),
    km_final DECIMAL(10, 2) CHECK (km_final >= 0),
    km_recorridos DECIMAL(10, 2) GENERATED ALWAYS AS (km_final - km_inicial) STORED,
    combustible_litros DECIMAL(8, 2) CHECK (combustible_litros >= 0),
    costo_combustible DECIMAL(10, 2) CHECK (costo_combustible >= 0),
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'programado',
            'en_transito',
            'completado',
            'cancelado',
            'incidente'
        )
    ),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_viaje_km CHECK (
        km_final IS NULL
        OR km_inicial IS NULL
        OR km_final >= km_inicial
    ),
    CONSTRAINT chk_viaje_fecha_llegada CHECK (
        fecha_llegada_real IS NULL
        OR fecha_llegada_real >= fecha_salida
    )
);
CREATE INDEX idx_log_viajes_folio ON log_viajes(folio);
CREATE INDEX idx_log_viajes_unidad ON log_viajes(unidad_id);
CREATE INDEX idx_log_viajes_estatus ON log_viajes(estatus);
CREATE INDEX idx_log_viajes_fecha_salida ON log_viajes(fecha_salida);
CREATE INDEX idx_log_viajes_contrato ON log_viajes(contrato_id);
COMMENT ON TABLE log_viajes IS 'Registro de viajes y rutas de la flota';
-- Tabla: log_viaje_carga
CREATE TABLE log_viaje_carga (
    id SERIAL PRIMARY KEY,
    viaje_id INTEGER NOT NULL REFERENCES log_viajes(id) ON DELETE RESTRICT,
    producto_id INTEGER REFERENCES cat_productos(id) ON DELETE RESTRICT,
    descripcion VARCHAR(500) NOT NULL,
    cantidad DECIMAL(10, 2) NOT NULL CHECK (cantidad > 0),
    peso_kg DECIMAL(10, 2) CHECK (peso_kg >= 0),
    serie_numero VARCHAR(100),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_log_viaje_carga_viaje ON log_viaje_carga(viaje_id);
COMMENT ON TABLE log_viaje_carga IS 'Detalle de carga transportada por viaje';
-- Tabla: log_transacciones_viaje (v2.0: NUEVA - Consolida evidencias + gastos)
CREATE TABLE log_transacciones_viaje (
    id SERIAL PRIMARY KEY,
    viaje_id INTEGER NOT NULL REFERENCES log_viajes(id) ON DELETE RESTRICT,
    tipo_transaccion VARCHAR(50) CHECK (
        tipo_transaccion IN (
            'foto_carga',
            'foto_descarga',
            'firma_entrega',
            'firma_recoleccion',
            'foto_inspeccion',
            'ticket',
            'incidente',
            'gasto_combustible',
            'gasto_caseta',
            'gasto_mantenimiento',
            'gasto_alimentacion',
            'gasto_hospedaje',
            'gasto_otro'
        )
    ),
    concepto VARCHAR(200),
    monto DECIMAL(10, 2) CHECK (monto >= 0),
    -- NULL para fotos/firmas
    archivo_url VARCHAR(500),
    -- URL de foto, firma o comprobante
    descripcion TEXT,
    fecha_transaccion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ubicacion_gps VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_log_transacciones_viaje ON log_transacciones_viaje(viaje_id);
CREATE INDEX idx_log_transacciones_tipo ON log_transacciones_viaje(tipo_transaccion);
COMMENT ON TABLE log_transacciones_viaje IS 'Evidencias y gastos de viajes unificados - v2.0';
-- Tabla: log_rendimiento_unidades
CREATE TABLE log_rendimiento_unidades (
    id SERIAL PRIMARY KEY,
    unidad_id INTEGER NOT NULL REFERENCES log_flota(id) ON DELETE RESTRICT,
    periodo VARCHAR(7) NOT NULL,
    -- Formato: YYYY-MM
    km_recorridos DECIMAL(10, 2) CHECK (km_recorridos >= 0),
    litros_consumidos DECIMAL(10, 2) CHECK (litros_consumidos >= 0),
    rendimiento_km_litro DECIMAL(6, 2) GENERATED ALWAYS AS (
        CASE
            WHEN litros_consumidos > 0 THEN km_recorridos / litros_consumidos
            ELSE 0
        END
    ) STORED,
    costo_total_combustible DECIMAL(12, 2) CHECK (costo_total_combustible >= 0),
    costo_mantenimiento DECIMAL(12, 2) CHECK (costo_mantenimiento >= 0),
    numero_viajes INTEGER DEFAULT 0 CHECK (numero_viajes >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_rendimiento_unidad_periodo UNIQUE (unidad_id, periodo)
);
CREATE INDEX idx_log_rendimiento_periodo ON log_rendimiento_unidades(periodo);
COMMENT ON TABLE log_rendimiento_unidades IS 'Indicadores de rendimiento mensual por unidad';
-- =====================================================================
-- MÓDULO E: MANTENIMIENTO TALLER (Prefijo: mto_)
-- =====================================================================
-- Tabla: mto_ordenes
CREATE TABLE mto_ordenes (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    unidad_id INTEGER REFERENCES log_flota(id) ON DELETE RESTRICT,
    producto_id INTEGER REFERENCES cat_productos(id) ON DELETE RESTRICT,
    tipo_mantenimiento VARCHAR(50) CHECK (
        tipo_mantenimiento IN (
            'preventivo',
            'correctivo',
            'emergencia',
            'inspeccion'
        )
    ),
    descripcion_falla TEXT,
    diagnostico TEXT,
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_inicio DATE,
    fecha_fin_estimada DATE,
    fecha_fin_real DATE,
    prioridad VARCHAR(20) CHECK (
        prioridad IN ('baja', 'normal', 'alta', 'urgente')
    ),
    estatus VARCHAR(50) CHECK (
        estatus IN (
            'pendiente',
            'en_proceso',
            'completado',
            'cancelado'
        )
    ),
    mecanico_asignado VARCHAR(100),
    kilometraje_unidad DECIMAL(10, 2),
    costo_mano_obra DECIMAL(10, 2) CHECK (costo_mano_obra >= 0),
    costo_refacciones DECIMAL(10, 2) CHECK (costo_refacciones >= 0),
    costo_total DECIMAL(10, 2) GENERATED ALWAYS AS (
        COALESCE(costo_mano_obra, 0) + COALESCE(costo_refacciones, 0)
    ) STORED,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_mto_fechas CHECK (
        fecha_fin_real IS NULL
        OR fecha_inicio IS NULL
        OR fecha_fin_real >= fecha_inicio
    )
);
CREATE INDEX idx_mto_ordenes_folio ON mto_ordenes(folio);
CREATE INDEX idx_mto_ordenes_unidad ON mto_ordenes(unidad_id);
CREATE INDEX idx_mto_ordenes_estatus ON mto_ordenes(estatus);
COMMENT ON TABLE mto_ordenes IS 'Órdenes de mantenimiento de flota y equipo';
-- Tabla: mto_insumos (v2.0: para tracking de consumibles - Prioridad 4)
CREATE TABLE mto_insumos (
    id SERIAL PRIMARY KEY,
    orden_mto_id INTEGER NOT NULL REFERENCES mto_ordenes(id) ON DELETE RESTRICT,
    codigo_parte VARCHAR(100),
    descripcion VARCHAR(300) NOT NULL,
    cantidad DECIMAL(10, 2) NOT NULL CHECK (cantidad > 0),
    unidad VARCHAR(20),
    costo_unitario DECIMAL(10, 2) CHECK (costo_unitario >= 0),
    costo_total DECIMAL(10, 2) GENERATED ALWAYS AS (cantidad * COALESCE(costo_unitario, 0)) STORED,
    proveedor VARCHAR(200),
    numero_factura VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_mto_insumos_orden ON mto_insumos(orden_mto_id);
COMMENT ON TABLE mto_insumos IS 'Refacciones e insumos utilizados en mantenimiento (pintura, soldadura, etc.)';
-- =====================================================================
-- MÓDULO F: DATA & BI (Prefijo: bi_)
-- =====================================================================
-- Tabla: bi_legacy_ventas
CREATE TABLE bi_legacy_ventas (
    id SERIAL PRIMARY KEY,
    fecha_venta DATE NOT NULL,
    cliente VARCHAR(200),
    producto VARCHAR(200),
    cantidad DECIMAL(10, 2) CHECK (cantidad >= 0),
    precio_unitario DECIMAL(12, 2) CHECK (precio_unitario >= 0),
    total DECIMAL(12, 2) CHECK (total >= 0),
    vendedor VARCHAR(100),
    region VARCHAR(100),
    sistema_origen VARCHAR(50),
    datos_adicionales JSONB,
    fecha_importacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bi_legacy_fecha ON bi_legacy_ventas(fecha_venta);
CREATE INDEX idx_bi_legacy_cliente ON bi_legacy_ventas(cliente);
COMMENT ON TABLE bi_legacy_ventas IS 'Datos históricos de ventas de sistemas legacy';
-- Tabla: bi_roi_skus
CREATE TABLE bi_roi_skus (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES cat_productos(id) ON DELETE RESTRICT,
    periodo VARCHAR(7) NOT NULL,
    -- Formato: YYYY-MM
    unidades_vendidas DECIMAL(10, 2) DEFAULT 0 CHECK (unidades_vendidas >= 0),
    ingresos_totales DECIMAL(12, 2) DEFAULT 0 CHECK (ingresos_totales >= 0),
    costo_total DECIMAL(12, 2) DEFAULT 0 CHECK (costo_total >= 0),
    margen_bruto DECIMAL(12, 2) GENERATED ALWAYS AS (ingresos_totales - costo_total) STORED,
    margen_porcentaje DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE
            WHEN ingresos_totales > 0 THEN (
                (ingresos_totales - costo_total) / ingresos_totales * 100
            )
            ELSE 0
        END
    ) STORED,
    roi_porcentaje DECIMAL(6, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_roi_producto_periodo UNIQUE (producto_id, periodo)
);
CREATE INDEX idx_bi_roi_periodo ON bi_roi_skus(periodo);
CREATE INDEX idx_bi_roi_producto ON bi_roi_skus(producto_id);
COMMENT ON TABLE bi_roi_skus IS 'Análisis de rentabilidad por SKU y periodo';
-- Tabla: bi_metricas_mensuales
CREATE TABLE bi_metricas_mensuales (
    id SERIAL PRIMARY KEY,
    periodo VARCHAR(7) NOT NULL UNIQUE,
    -- Formato: YYYY-MM
    ventas_totales DECIMAL(14, 2) DEFAULT 0 CHECK (ventas_totales >= 0),
    costos_totales DECIMAL(14, 2) DEFAULT 0 CHECK (costos_totales >= 0),
    margen_bruto DECIMAL(14, 2) GENERATED ALWAYS AS (ventas_totales - costos_totales) STORED,
    clientes_nuevos INTEGER DEFAULT 0 CHECK (clientes_nuevos >= 0),
    clientes_activos INTEGER DEFAULT 0 CHECK (clientes_activos >= 0),
    ticket_promedio DECIMAL(12, 2) CHECK (ticket_promedio >= 0),
    tasa_conversion DECIMAL(5, 2) CHECK (
        tasa_conversion >= 0
        AND tasa_conversion <= 100
    ),
    inventario_promedio DECIMAL(14, 2) CHECK (inventario_promedio >= 0),
    rotacion_inventario DECIMAL(6, 2),
    km_flota_total DECIMAL(12, 2) CHECK (km_flota_total >= 0),
    eficiencia_operativa DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bi_metricas_periodo ON bi_metricas_mensuales(periodo);
COMMENT ON TABLE bi_metricas_mensuales IS 'Tablero de métricas consolidadas mensuales';
-- =====================================================================
-- MÓDULO G: SISTEMA (Prefijo: sys_)
-- =====================================================================
-- Tabla: sys_import_logs
CREATE TABLE sys_import_logs (
    id SERIAL PRIMARY KEY,
    tabla_destino VARCHAR(100) NOT NULL,
    archivo_origen VARCHAR(300),
    total_registros INTEGER CHECK (total_registros >= 0),
    registros_exitosos INTEGER CHECK (registros_exitosos >= 0),
    registros_fallidos INTEGER CHECK (registros_fallidos >= 0),
    errores TEXT,
    usuario VARCHAR(100),
    fecha_importacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duracion_segundos INTEGER CHECK (duracion_segundos >= 0)
);
CREATE INDEX idx_sys_import_tabla ON sys_import_logs(tabla_destino);
CREATE INDEX idx_sys_import_fecha ON sys_import_logs(fecha_importacion);
COMMENT ON TABLE sys_import_logs IS 'Registro de importaciones y migraciones de datos';
-- Tabla: sys_ia_logs
CREATE TABLE sys_ia_logs (
    id SERIAL PRIMARY KEY,
    tipo_consulta VARCHAR(100) NOT NULL,
    prompt_enviado TEXT,
    respuesta_obtenida TEXT,
    modelo_ia VARCHAR(50),
    tokens_utilizados INTEGER CHECK (tokens_utilizados >= 0),
    tiempo_respuesta_ms INTEGER CHECK (tiempo_respuesta_ms >= 0),
    usuario VARCHAR(100),
    metadata JSONB,
    fecha_consulta TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sys_ia_tipo ON sys_ia_logs(tipo_consulta);
CREATE INDEX idx_sys_ia_fecha ON sys_ia_logs(fecha_consulta);
COMMENT ON TABLE sys_ia_logs IS 'Registro de interacciones con motores de IA';
-- Tabla: sys_audit
CREATE TABLE sys_audit (
    id SERIAL PRIMARY KEY,
    tabla VARCHAR(100) NOT NULL,
    registro_id INTEGER,
    operacion VARCHAR(20) CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    usuario VARCHAR(100),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_origen VARCHAR(45),
    user_agent TEXT,
    fecha_operacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sys_audit_tabla ON sys_audit(tabla);
CREATE INDEX idx_sys_audit_usuario ON sys_audit(usuario);
CREATE INDEX idx_sys_audit_fecha ON sys_audit(fecha_operacion);
COMMENT ON TABLE sys_audit IS 'Auditoría de cambios en datos críticos';
-- =====================================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';
-- Aplicar trigger a todas las tablas con updated_at
DO $$
DECLARE t text;
BEGIN FOR t IN
SELECT table_name
FROM information_schema.columns
WHERE column_name = 'updated_at'
    AND table_schema = 'public' LOOP EXECUTE format(
        '
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ',
        t,
        t
    );
END LOOP;
END;
$$ LANGUAGE plpgsql;
-- =====================================================================
-- FOREIGN KEYS ADICIONALES (Para viajes en subarriendos)
-- =====================================================================
ALTER TABLE ops_subarriendos
ADD CONSTRAINT fk_subarriendo_viaje_recoleccion FOREIGN KEY (viaje_recoleccion_id) REFERENCES log_viajes(id) ON DELETE RESTRICT;
ALTER TABLE ops_subarriendos
ADD CONSTRAINT fk_subarriendo_viaje_entrega FOREIGN KEY (viaje_entrega_cliente_id) REFERENCES log_viajes(id) ON DELETE RESTRICT;
ALTER TABLE ops_subarriendos
ADD CONSTRAINT fk_subarriendo_viaje_devolucion FOREIGN KEY (viaje_devolucion_layher_id) REFERENCES log_viajes(id) ON DELETE RESTRICT;
ALTER TABLE mto_inspecciones
ADD CONSTRAINT fk_inspeccion_viaje FOREIGN KEY (viaje_recoleccion_id) REFERENCES log_viajes(id) ON DELETE RESTRICT;
-- =====================================================================
-- COMENTARIOS FINALES DE VERSIÓN
-- =====================================================================
COMMENT ON DATABASE icam360 IS 'ICAM 360 ERP - BASE DE DATOS VERSIÓN 2.0
Cambios principales:
- Control de estados de inventario (disponible/rentado/mantenimiento/chatarra/transito)
- Sistema de días de renta con separación de fechas
- Renovaciones de contratos (padre-hijo)
- Cargos adicionales (faltantes/chatarra/excedentes con 7 días gracia)
- Subarriendo Layher (flujo completo)
- Inspecciones en recolección
- Cálculo automático de flete
- Comisiones de vendedores (4%)
Total de tablas: 31 (29 originales - 3 eliminadas + 5 nuevas)
RECORDATORIO: Toda interacción DEBE usar Prepared Statements.';
-- =====================================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- =====================================================================
DO $$
DECLARE tabla_count INTEGER;
BEGIN
SELECT COUNT(*) INTO tabla_count
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
RAISE NOTICE 'Total de tablas creadas: %',
tabla_count;
IF tabla_count = 31 THEN RAISE NOTICE '✓ Todas las 31 tablas fueron creadas correctamente';
ELSE RAISE WARNING '⚠ Se esperaban 31 tablas, pero se encontraron %',
tabla_count;
END IF;
END $$;
-- =====================================================================
-- FIN DEL SCRIPT DDL v2.0
-- Fecha de generación: 2026-02-12
-- Versión del esquema: 2.0
-- Cambios: +5 tablas nuevas, -3 tablas eliminadas, múltiples mejoras
-- =====================================================================