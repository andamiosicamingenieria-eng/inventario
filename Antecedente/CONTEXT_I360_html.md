# ICAM 360 — Contexto del Proyecto para Claude Code

## Resumen ejecutivo

ERP para empresa de renta y venta de andamios (equipo de scaffolding). El sistema maneja el ciclo completo: contratos de renta/venta → hojas de salida (HS) → hojas de entrada (HE) → inventario bidireccional → pagos → reportes.

**Estado actual:** Sistema funcional en Google Sheets + Apps Script. Se está migrando a arquitectura nueva: **Frontend HTML/JS + Supabase (PostgreSQL) como backend y core**.

---

## Stack tecnológico objetivo

```
Frontend      → HTML + JS puro (sin framework) + SheetJS para exportar Excel
Backend API   → Supabase REST API (autogenerado desde tablas PostgreSQL)
Auth          → Supabase Auth (email/password)
Core / BD     → PostgreSQL en Supabase
Automatizaciones → Python + APScheduler (proyecto separado ya existente)
Lógica especial  → Supabase Edge Functions (PDF, emails)
```

---

## Estructura de archivos recomendada

```
icam360/
├── index.html              ← Shell principal con sidebar (Opción B)
├── css/
│   └── styles.css          ← Variables CSS, layout, componentes
├── js/
│   ├── supabase-client.js  ← Inicialización cliente Supabase + auth
│   ├── app.js              ← Router, estado global, navegación
│   ├── contratos.js        ← Módulo contratos (tabla + edición inline)
│   ├── clientes.js         ← Módulo clientes (grid cards + modal)
│   ├── hs.js               ← Hojas de salida
│   ├── he.js               ← Hojas de entrada
│   ├── pagos.js            ← Registro de pagos por contrato
│   ├── arrendamientos.js   ← Subarrendamiento Layher
│   ├── inventario.js       ← Stock disponible
│   ├── seguimiento.js      ← Panel seguimiento (tab Renta / tab Venta)
│   └── excel.js            ← Exportaciones Excel con SheetJS
├── supabase/
│   ├── schema.sql          ← Schema completo (ya existe en el proyecto)
│   ├── triggers.sql        ← Triggers de inventario, estatus, folio_raiz
│   ├── functions.sql       ← Funciones SQL (estado de cuenta, saldos)
│   ├── views.sql           ← Vistas (v_seguimiento, v_inventario, v_adeudos)
│   └── policies.sql        ← Row Level Security por rol
└── python/
    ├── reportes.py         ← Generación de reportes semanales
    └── scheduler.py        ← APScheduler para envío automático sábados
```

---

## Arquitectura de la interfaz — Opción B (sidebar + tabla)

Layout decidido: sidebar fijo izquierdo con módulos, área central con tabla principal y fila expandible para edición inline.

```
┌─────────────────────────────────────────────────────┐
│ HEADER: ICAM 360 logo | ↻ Sincronizar | user@email  │
├──────────────┬──────────────────────────────────────┤
│ SIDEBAR      │ TABLA PRINCIPAL                       │
│              │ ┌─────────────────────────────────┐  │
│ Contratos ←  │ │ Toolbar: búsqueda + filtros      │  │
│ Clientes     │ │ + botón Nuevo                    │  │
│ Seguimiento  │ ├─────────────────────────────────┤  │
│ ─────────    │ │ thead: Folio|Cliente|Tipo|...    │  │
│ HS / HE      │ ├─────────────────────────────────┤  │
│ ─────────    │ │ tr: fila normal (clic expande)   │  │
│ Pagos        │ ├─────────────────────────────────┤  │
│ Arrendamien. │ │ tr.expanded: detalle + items     │  │
│ ─────────    │ │   [campos editables inline]      │  │
│ Inventario   │ │   [tabla items editable]         │  │
│              │ │   [botones: HS|HE|Pagos|EC|Arr]  │  │
└──────────────┴──────────────────────────────────────┘
```

**Comportamiento clave:**
- Clic en fila → expande hacia abajo mostrando detalle + items editables
- Clic en fila expandida → colapsa
- Los campos del detalle son inputs editables directamente
- Botón "Guardar cambios" por fila expandida
- Botones de acción rápida: + HS, + HE, 💰 Pagos, EC, 🏗 Arrendamiento

---

## Tablas en Supabase (mapeo desde Google Sheets)

### Tablas principales de operación

| Hoja Google Sheets | Tabla Supabase | Descripción |
|---|---|---|
| `_data_contratos` | `ops_contratos` | Contratos de renta y venta |
| `_data_contrato_items` | `ops_contrato_items` | Items de cada contrato |
| `_data_hs` | `ops_hs` | Hojas de salida (entregas) |
| `_data_hs_items` | `ops_hs_items` | Items de cada HS |
| `_data_he` | `ops_he` | Hojas de entrada (recolecciones) |
| `_data_he_items` | `ops_he_items` | Items de cada HE |
| `_data_inventario` | `inv_master` | Stock disponible por SKU |
| `_data_productos` | `cat_productos` | Catálogo de productos/SKUs |
| `_data_clientes` | `crm_clientes` | Catálogo de clientes |
| `_data_pagos` | `fin_pagos` | Pagos por contrato |
| `_data_agentes` | `sys_agentes` | Agentes de ventas con email |
| `_data_arrendamientos` | `ops_arrendamientos` | Subarrendamientos Layher |
| `_data_arrendamiento_items` | `ops_arrendamiento_items` | Items de arrendamientos |

### Columnas críticas de `ops_contratos`

```sql
folio_c          VARCHAR(50) UNIQUE NOT NULL  -- número de contrato (ej: "20001")
folio_raiz       VARCHAR(50)                  -- folio origen de la cadena de renovaciones
renta_anterior   VARCHAR(50)                  -- folio que precede (si es renovación)
renta_posterior  VARCHAR(50)                  -- folio siguiente (si fue renovado)
tipo_operacion   VARCHAR(50)                  -- 'RENTA' | 'VENTA' | 'VENTA PERDIDA'
razon_social     VARCHAR(200)                 -- nombre del cliente
estatus          VARCHAR(50)                  -- ver valores abajo
fecha_contrato   DATE
fecha_solicitada DATE                         -- fecha de inicio de la renta
fecha_vencimiento_estimada DATE
dias_renta       INTEGER
importe          DECIMAL(12,2)
anticipo         DECIMAL(12,2)
agente           VARCHAR(100)
folio_hs         VARCHAR(50)                  -- última HS generada
```

### Valores de estatus en `ops_contratos`

```
RENTA:
  ACTIVO          → equipo entregado completamente, en obra
  ENTREGA PARCIAL → se han hecho HS pero no cubre todo el contrato
  RECOLECTADO     → equipo devuelto, contrato cerrado
  RENOVACION      → fue reemplazado por un contrato nuevo
  CANCELADO       → cancelado

VENTA:
  VENTA           → pendiente de entrega completa
  RECOLECTADO     → entrega completada
  VENTA PERDIDA   → cliente perdió el equipo (genera HS automática)
```

---

## Lógica de negocio crítica

### 1. Folio raíz (cadena de renovaciones)

Cuando un contrato se renueva, el nuevo hereda el `folio_raiz` del anterior. Esto permite rastrear toda la cadena de renovaciones y generar el Estado de Cuenta consolidado.

```
Contrato 20001 (folio_raiz: 20001) → se renueva →
Contrato 20002 (folio_raiz: 20001, renta_anterior: 20001) → se renueva →
Contrato 20003 (folio_raiz: 20001, renta_anterior: 20002)
```

El algoritmo es **bidireccional** — si un contrato se fusiona con otra cadena, debe propagar el folio_raiz hacia abajo.

### 2. Inventario bidireccional

- Al guardar una **HS** (salida): `stock_disponible -= cantidad`
- Al guardar una **HE** (entrada/recolección): `stock_disponible += cantidad`
- Al crear **arrendamiento Layher**: `stock_disponible += cantidad` (equipo temporal)
- Al **cerrar arrendamiento**: `stock_disponible -= cantidad`
- Al guardar **VENTA PERDIDA**: genera HS automática → descuenta inventario

### 3. Estatus automático al guardar HS

Al guardar una HS, el sistema compara piezas entregadas vs piezas del contrato:
```
totalEnviado >= totalContrato → estatus = 'ACTIVO'
totalEnviado <  totalContrato → estatus = 'ENTREGA PARCIAL'
```

### 4. Generación de folios

```
Contratos: número entero secuencial (20001, 20002...)
           → Math.max de todos los folios existentes + 1
HS:        'HS-' + número secuencial (HS-001, HS-002...)
HE:        'HE-' + número secuencial
ARR:       'ARR-' + número con padding (ARR-001, ARR-002...)
HSP:       'HSP-' + folio_contrato (para ventas por pérdida)
```

### 5. Venta por pérdida

Al crear contrato tipo `VENTA PERDIDA`:
1. Se guarda el contrato normalmente
2. Se genera automáticamente una HS con folio `HSP-{folio_c}`
3. Los items de la HS son los mismos del contrato
4. Se descuenta del inventario
5. El estatus del contrato queda como `ACTIVO`

### 6. Estado de cuenta

Agrupa todos los contratos del mismo `folio_raiz` y muestra:
- Historial de HS (entregas)
- Historial de HE (recolecciones)
- Balance de equipo en campo por SKU (entregado - recolectado = en campo)
- Resumen financiero: importe total, pagos, saldo

---

## Módulos del sistema

### Panel Seguimiento (tab Renta / tab Venta)

**Tab Renta:**
- Sección 1: Contratos ACTIVO y ENTREGA PARCIAL, sin `renta_posterior` (no renovados), ordenados por días restantes (más atrasados primero). Chips de color: rojo=vencido, amarillo=≤5 días, verde=con tiempo
- Sección 2: Últimos 10 RECOLECTADO
- Sección 3: Arrendamientos Layher activos con alerta ≤5 días

**Tab Venta:**
- Sección 1: Ventas con entrega incompleta (barra de progreso piezas entregadas/total)
- Sección 2: Últimas 10 ventas completadas con días del ciclo (fecha contrato → última HS)

### Panel HS (Hoja de Salida)

Al seleccionar un folio de contrato:
1. Carga el `STOCK_MAP` via `getStockLoteHS(folioC)` — una sola llamada batch
2. Cada fila de items muestra 4 badges: Stock disponible | Cantidad contrato | Ya entregado | Pendiente
3. La cantidad se pre-llena con el `pendiente` como sugerencia
4. Si cantidad > stock → campo se pone rojo y bloquea el guardado
5. Al guardar → actualiza estatus del contrato automáticamente

### Módulo Pagos

Tipos: Anticipo | Abono parcial | Pago total

Saldo = importe - anticipo - suma(pagos registrados)

Tabla `fin_pagos`: id, folio_c, fecha, tipo, monto, referencia, notas

### Módulo Arrendamientos Layher

- Solo proveedor: LAYHER
- Al crear → suma al inventario (equipo temporal disponible)
- Al cerrar/devolver → resta del inventario
- Alerta visual en Seguimiento cuando faltan ≤5 días para vencer

---

## Roles y permisos

```
contratos:   Panel Contrato, Panel Seguimiento, Panel HS, Panel HE,
             Inventario, Estado de Cuenta, Pagos, Arrendamientos
operaciones: Panel HS, Panel HE, Inventario (lectura)
```

La seguridad se implementa con **Row Level Security** en PostgreSQL:

```sql
-- Ejemplo: operaciones solo puede leer/escribir HS y HE
CREATE POLICY "operaciones_hs" ON ops_hs
  FOR ALL USING (auth.jwt()->>'role' = 'operaciones');

-- contratos tiene acceso total
CREATE POLICY "contratos_full" ON ops_contratos
  FOR ALL USING (auth.jwt()->>'role' = 'contratos');
```

---

## Exportaciones Excel (SheetJS)

Librería: SheetJS (`xlsx`) desde CDN `cdnjs.cloudflare.com`

Reportes implementados:
- **Resumen contratos**: 3 hojas (Contratos | Por Agente | Adeudos)
- **Detalle con items**: 3 hojas (Contratos | Items | SKUs en campo)

Patrón:
```js
import * as XLSX from 'xlsx'; // o desde CDN
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws['!cols'] = [{wch:10}, {wch:35}, ...]; // anchos de columna
XLSX.utils.book_append_sheet(wb, ws, 'Nombre hoja');
XLSX.writeFile(wb, 'ICAM360_' + fecha + '.xlsx');
```

---

## Automatizaciones Python (proyecto separado)

El proyecto Python con Supabase ya existe y está avanzado. Se le agrega:

```python
# APScheduler — reporte semanal sábados 8am
@scheduler.scheduled_job('cron', day_of_week='sat', hour=8)
def reporte_semanal():
    # Consultar Supabase
    # Agrupar por agente
    # Armar HTML del correo
    # Enviar via Resend/SendGrid
    # Un correo por agente al revisor de contratos
    # BCC al admin
```

Reportes semanales:
- Contratos con adeudos (saldo > 0)
- Contratos por vencer próxima semana (lunes a lunes)
- Contratos nuevos/renovados esta semana
- Ventas de la semana

---

## Conexión Supabase desde el frontend

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
const supabase = window.supabase.createClient(
  'https://TU_PROYECTO.supabase.co',
  'TU_ANON_KEY'  // clave pública, segura para el frontend
);
</script>
```

Variables de entorno (archivo `.env` en la raíz):
```
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...  ← NUNCA en el frontend
```

---

## Decisiones de diseño tomadas

- **Sin frameworks JS** — HTML/CSS/JS puro. Más fácil de mantener, sin dependencias complejas
- **Sin bundler** — archivos JS separados por módulo, cargados directamente en el HTML
- **CSS Variables** — paleta centralizada, soporte implícito de tema
- **Paginación**: 25 registros por página
- **Caché**: 5 minutos en Supabase (o local en memoria del browser)
- **Fonts**: DM Sans (cuerpo) + DM Mono (folios, números, código)
- **Excel**: siempre disponible — el usuario siempre puede descargar lo que ve en tabla

### Paleta de colores del sistema

```css
--accent:  #2563eb  /* azul principal */
--verde:   #dcfce7 / --verde-t:   #166534  /* activo, ok */
--amarillo:#fef9c3 / --amarillo-t:#854d0e  /* parcial, alerta */
--rojo:    #fee2e2 / --rojo-t:    #991b1b  /* vencido, error */
--azul:    #dbeafe / --azul-t:    #1e40af  /* info, seleccionado */
```

### Chips de estatus

| Estatus | Color |
|---|---|
| ACTIVO | Azul |
| ENTREGA PARCIAL | Amarillo |
| RECOLECTADO | Verde |
| CANCELADO | Gris |
| VENTA | Púrpura |
| VENTA PERDIDA | Rosa |

---

## Código base existente (migrar/adaptar)

El sistema anterior en Google Sheets + Apps Script tiene todo el siguiente código funcionando que debe portarse a la nueva arquitectura:

### contratos.gs — funciones principales
```
guardarContrato()         → POST /ops_contratos + /ops_contrato_items
wa_actualizarContrato()   → PATCH /ops_contratos
wa_actualizarItems()      → DELETE + INSERT /ops_contrato_items
guardarHojaHS()           → POST /ops_hs + /ops_hs_items + actualizar inventario + estatus
guardarHojaHE()           → POST /ops_he + /ops_he_items + actualizar inventario
guardarVentaPerdida()     → guardarContrato() + HS automática
guardarArrendamiento()    → POST arrendamiento + sumar inventario
cerrarArrendamiento()     → PATCH estatus + restar inventario
registrarPago()           → POST /fin_pagos
getSaldoContrato()        → GET pagos + calcular saldo
getDatosSeguimiento()     → GET contratos + hs_items + contrato_items (batch)
getStockLoteHS()          → GET inventario + contrato_items + hs_items (batch)
generarEstadoCuenta()     → consulta cruzada de toda la cadena folio_raiz
```

### Triggers SQL a implementar en PostgreSQL

```sql
-- 1. Al insertar/actualizar ops_hs_items → actualizar inv_master
-- 2. Al insertar/actualizar ops_he_items → actualizar inv_master
-- 3. Al insertar ops_hs → recalcular estatus de ops_contratos
-- 4. Al insertar ops_arrendamiento_items → actualizar inv_master
-- 5. Al actualizar ops_arrendamientos.estatus = 'CERRADO' → restar inventario
```

### Vistas SQL a crear

```sql
-- v_contratos_activos: contratos con días restantes calculados y saldo
-- v_seguimiento_renta: contratos renta activos ordenados por días restantes
-- v_seguimiento_venta: ventas con progreso de entrega (piezas)
-- v_inventario: stock con SKU, disponible, en campo, dañado
-- v_adeudos: contratos con saldo > 0 agrupados por agente
-- v_estado_cuenta: balance por folio_raiz con movimientos HS/HE
```

---

## Pasos para arrancar el proyecto

1. **Crear proyecto en Supabase** en supabase.com
2. **Ejecutar schema**: pegar `icam360_schema.sql` en el SQL Editor de Supabase
3. **Crear triggers y vistas**: crear archivos `triggers.sql`, `views.sql`, `policies.sql`
4. **Migrar datos**: exportar cada hoja `_data_*` de Google Sheets como CSV → importar en Supabase Table Editor
5. **Crear estructura de archivos** del proyecto según la estructura definida arriba
6. **Configurar autenticación**: en Supabase Auth crear los usuarios con roles custom (`contratos`, `operaciones`)
7. **Implementar módulo Contratos** primero como prueba piloto
8. **Validar con usuarios** antes de continuar con HS/HE/Pagos
9. **Configurar RLS** para cada tabla según los roles
10. **Agregar exportaciones Excel** a cada módulo

---

## Notas importantes para Claude Code

- El usuario ya tiene un proyecto Python con Supabase avanzado — las automatizaciones (reportes semanales, emails) van en ese proyecto, NO en el HTML
- El HTML no usa ningún framework (sin React, sin Vue, sin Angular)
- Todo el CSS usa variables CSS — no hardcodear colores
- Las llamadas a Supabase siempre deben manejar el error: `const { data, error } = await supabase.from(...)`
- Los folios de contratos son números enteros pero se tratan como strings en todo momento
- La `anon key` de Supabase va en el HTML — es segura. La `service key` NUNCA en el frontend
- SheetJS se carga desde `cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`
- El Supabase JS SDK se carga desde `cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- Para RLS: el campo `role` en el JWT de Supabase se configura via custom claims en Auth hooks
