-- =====================================================================
-- ICAM 360 - Alteraciones para PDF de Contratos
-- Agregar campos necesarios para la descarga completa del contrato en PDF
-- Ejecutar en Supabase → SQL Editor
-- =====================================================================

-- Agregar campos a la tabla ops_contratos si no existen

-- Contacto que recibe la entrega
ALTER TABLE ops_contratos
ADD COLUMN IF NOT EXISTS contacto_entrega VARCHAR(200);

-- Teléfono del contacto de entrega
ALTER TABLE ops_contratos
ADD COLUMN IF NOT EXISTS telefono_contacto_entrega VARCHAR(20);

-- Dirección específica de entrega/Obra (podría ser diferente a direccion_servicio)
ALTER TABLE ops_contratos
ADD COLUMN IF NOT EXISTS direccion_entrega TEXT;

-- Fecha de pago esperado
ALTER TABLE ops_contratos
ADD COLUMN IF NOT EXISTS fecha_pago DATE;

-- Forma de pago (efectivo, transferencia, tarjeta, crédito, etc)
ALTER TABLE ops_contratos
ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(100);

-- RFC del cliente (desnormalizado de crm_clientes para acceso rápido)
ALTER TABLE ops_contratos
ADD COLUMN IF NOT EXISTS rfc_cliente VARCHAR(13);

-- Teléfono del cliente (desnormalizado de crm_clientes)
ALTER TABLE ops_contratos
ADD COLUMN IF NOT EXISTS telefono_cliente VARCHAR(20);

-- Dirección del cliente (desnormalizado de crm_clientes)
ALTER TABLE ops_contratos
ADD COLUMN IF NOT EXISTS direccion_cliente TEXT;

-- =====================================================================
-- Comentarios de documentación
-- =====================================================================
COMMENT ON COLUMN ops_contratos.contacto_entrega IS 'Nombre de la persona que recibe la entrega en el sitio';
COMMENT ON COLUMN ops_contratos.telefono_contacto_entrega IS 'Teléfono del contacto que recibe en el sitio';
COMMENT ON COLUMN ops_contratos.direccion_entrega IS 'Dirección específica de entrega/obra (puede diferir de dirección del cliente)';
COMMENT ON COLUMN ops_contratos.fecha_pago IS 'Fecha estimada de pago del contrato';
COMMENT ON COLUMN ops_contratos.forma_pago IS 'Método de pago: efectivo, transferencia, tarjeta, crédito, etc';
COMMENT ON COLUMN ops_contratos.rfc_cliente IS 'RFC del cliente (desnormalizado de crm_clientes)';
COMMENT ON COLUMN ops_contratos.telefono_cliente IS 'Teléfono del cliente (desnormalizado de crm_clientes)';
COMMENT ON COLUMN ops_contratos.direccion_cliente IS 'Dirección del cliente (desnormalizado de crm_clientes)';

-- =====================================================================
-- Verificación: listar columnas agregadas
-- =====================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ops_contratos'
  AND column_name IN (
    'contacto_entrega', 'telefono_contacto_entrega', 'direccion_entrega',
    'fecha_pago', 'forma_pago', 'rfc_cliente', 'telefono_cliente', 'direccion_cliente'
  )
ORDER BY ordinal_position;
