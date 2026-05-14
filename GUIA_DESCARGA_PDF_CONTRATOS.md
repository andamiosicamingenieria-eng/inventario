# Guía de Descarga de PDF de Contratos

## 📋 Descripción General
Se ha implementado una funcionalidad completa para descargar contratos en formato PDF desde el panel de contratos. El PDF incluye todos los datos del contrato organizados en secciones profesionales.

---

## 🔧 Configuración Inicial (Base de Datos)

### Paso 1: Ejecutar Script SQL
Antes de usar esta funcionalidad, debes ejecutar el script que agrega los nuevos campos a la base de datos:

**Archivo:** `Antecedente/alter_contratos_pdf.sql`

**Instrucciones:**
1. Ve a Supabase → SQL Editor
2. Crea una nueva consulta
3. Copia todo el contenido del archivo `alter_contratos_pdf.sql`
4. Ejecuta la consulta (Click en "Run")

**Campos Agregados:**
- `contacto_entrega` — Nombre de la persona que recibe en el sitio
- `telefono_contacto_entrega` — Teléfono del contacto
- `direccion_entrega` — Dirección específica de entrega/obra
- `fecha_pago` — Fecha estimada de pago
- `forma_pago` — Método de pago (efectivo, transferencia, etc.)
- `rfc_cliente` — RFC desnormalizado para acceso rápido
- `telefono_cliente` — Teléfono desnormalizado del cliente
- `direccion_cliente` — Dirección desnormalizada del cliente

---

## 📝 Cómo Usar: Crear un Contrato con PDF

### Paso 1: Abrir el Panel de Contratos
1. En la aplicación ICAM 360, dirígete a la sección **Contratos**
2. Haz clic en el botón **"Nuevo Contrato"** (esquina superior derecha)

### Paso 2: Completar Formulario Principal
Llena los campos básicos:
- **Tipo de Contrato** — Renta, Venta, Renovación, etc.
- **Cliente** — Selecciona de la lista (se auto-cargan RFC, teléfono, dirección)
- **Agente de Ventas** — Nombre del vendedor
- **Fechas** — Contrato, Inicio Real, Días de Renta
- **Montos** — Total e Anticipo

### Paso 3: Completar SECCIÓN CLIENTE
Estos datos se cargan automáticamente del cliente seleccionado:
- **Razón Social** — Se completa automáticamente
- **RFC** — Se completa automáticamente
- **Teléfono** — Se completa automáticamente
- **Dirección** — Se completa automáticamente

### Paso 4: Completar SECCIÓN ENTREGA
⚠️ **IMPORTANTE:** Estos campos son específicos para cada contrato:
- **Contacto que Recibe** — Nombre de la persona en el sitio (ej: "Juan García")
- **Teléfono del Contacto** — Teléfono del contacto (ej: "+52 81 1234 5678")
- **Dirección de Entrega/Obra** — Lugar exacto de entrega (si es diferente de la dirección del cliente)

### Paso 5: Completar SECCIÓN PAGO
- **Fecha de Pago** — Fecha estimada del pago
- **Forma de Pago** — Selecciona una opción:
  - 💵 Efectivo
  - 💳 Transferencia Bancaria
  - 🏧 Tarjeta de Crédito/Débito
  - 📄 Cheque
  - 📋 Crédito
  - ⚙ Otro

### Paso 6: Agregar Ítems (Opcional)
1. Haz clic en **"+ Agregar Item"**
2. Selecciona el producto
3. Ingresa cantidad y precio/día
4. Se calcula automáticamente el importe

### Paso 7: Guardar Contrato
1. Haz clic en **"Guardar Contrato"**
2. Se almacena en la base de datos con todos los datos

---

## 📥 Cómo Descargar el PDF

### Opción 1: Desde la Tabla de Contratos
1. En el panel de Contratos, verás la tabla de contratos
2. Haz clic en cualquier fila para expandirla
3. En el detalle expandido, busca el botón **"📄 Generar PDF"**
4. Haz clic y el PDF se descargará automáticamente

### Opción 2: Desde Modal de Edición
1. En la tabla, haz clic en el botón **"✏ Editar"** de un contrato
2. En el modal, haz clic en **"📄 Generar PDF"** (en la sección de botones de acción)
3. El PDF se descargará automáticamente

---

## 📄 Contenido del PDF

El PDF generado incluye las siguientes secciones:

### 1. **Encabezado**
- Título: "CONTRATO [TIPO]" (ej: CONTRATO RENTA)
- Folio del contrato
- Tipo de operación (Nuevo, Renovación, Extensión, Corrección)
- Fecha de emisión

### 2. **Sección Cliente**
- Razón Social
- RFC
- Teléfono
- Dirección del cliente

### 3. **Sección Entrega**
- Contacto que recibe en el sitio
- Teléfono del contacto
- Dirección de entrega/obra

### 4. **Sección Operación**
- Tipo de operación
- Fecha de inicio
- Días de renta
- Fecha de vencimiento
- Agente de ventas

### 5. **Sección Pago**
- Fecha de pago
- Forma de pago
- Monto total
- Anticipo pagado

### 6. **Tabla de Ítems**
- Cantidad de cada producto
- Código de producto
- Descripción
- Precio por día
- Importe total

### 7. **Totales**
- Subtotal (monto sin IVA)
- IVA (16%)
- Total a pagar
- Saldo pendiente

### 8. **Datos Adicionales**
- Notas del contrato (si existen)
- Fecha de generación del documento

---

## ✅ Checklist: Antes de Descargar PDF

- [ ] Cliente seleccionado (se cargan datos automáticamente)
- [ ] Folio del contrato completado
- [ ] Tipo de contrato seleccionado
- [ ] Contacto que recibe: Completado
- [ ] Teléfono del contacto: Completado
- [ ] Dirección de entrega: Completada (o usa la del cliente)
- [ ] Fecha de pago: Seleccionada
- [ ] Forma de pago: Seleccionada
- [ ] Ítems agregados (al menos uno)
- [ ] Contrato guardado en la base de datos

---

## 🐛 Solución de Problemas

### Error: "No se pudo cargar la plantilla PDF"
**Causa:** El archivo `Antecedente/contrato_plantilla.pdf` no existe o no es accesible.
**Solución:** 
1. Verifica que el archivo exista en la carpeta `Antecedente/`
2. Revisa que el servidor pueda acceder a él
3. Si es necesario, coloca una plantilla PDF en esa ubicación

### El PDF se descarga pero viene en blanco
**Causa:** La plantilla PDF podría estar vacía o los datos no se están escribiendo correctamente.
**Solución:**
1. Verifica que los datos del contrato estén completos
2. Abre la consola del navegador (F12) para ver errores
3. Intenta con datos simples primero

### Falta la forma de pago en el PDF
**Causa:** No seleccionaste una forma de pago o el campo no se guardó.
**Solución:**
1. Completa el campo "Forma de Pago" en el formulario
2. Guarda el contrato nuevamente
3. Intenta descargar el PDF de nuevo

---

## 📦 Archivos Modificados/Creados

- ✅ `Antecedente/alter_contratos_pdf.sql` — Script para agregar campos a BD
- ✅ `js/modules/contratos.js` — Actualizado con nuevos campos y función PDF mejorada

---

## 🎓 Ejemplo de Contrato Completado

```
CONTRATO RENTA
Folio: 20001
Tipo: NUEVO
Fecha: 11/04/2026

SECCIÓN CLIENTE
Razón Social: CONSTRUCTORA TORRES DEL NORTE SA DE CV
RFC: CTN123456ABC
Teléfono: +52 81 8765 4321
Dirección: Calle Principal 123, Monterrey, NL 64000

SECCIÓN ENTREGA
Contacto que Recibe: Juan García López
Teléfono Contacto: +52 81 1234 5678
Dirección de Entrega/Obra: Obra en construcción, Avenida Del Tecnológico, Monterrey

SECCIÓN OPERACIÓN
Tipo de Operación: NUEVO
Fecha Inicio: 15/04/2026
Días Renta: 60
Vencimiento: 14/06/2026
Agente Ventas: Carlos Hernández

SECCIÓN PAGO
Fecha de Pago: 30/06/2026
Forma de Pago: TRANSFERENCIA BANCARIA
Monto Total: $85,000.00
Anticipo: $0.00

[Tabla de ítems]

TOTALES
Subtotal: $73,275.86
IVA (16%): $11,724.14
TOTAL: $85,000.00
Saldo Pendiente: $85,000.00
```

---

## 💡 Tips Útiles

1. **Reutilizar datos:** Si creas varios contratos para el mismo cliente, los datos se prellenan automáticamente.

2. **Editar después:** Puedes editar un contrato existente, actualizar los datos (especialmente SECCIÓN ENTREGA y SECCIÓN PAGO) y descargar el PDF nuevamente.

3. **Descargas múltiples:** Cada descarga incluye la fecha actual en el nombre del archivo, permitiendo múltiples versiones.

4. **Datos desnormalizados:** El RFC, teléfono y dirección del cliente se guardan en el contrato, permitiendo que si el cliente cambia después, el contrato siga teniendo los datos originales.

---

**Versión:** 1.0  
**Última actualización:** 11/04/2026  
**Estado:** ✅ Implementado y Funcional
