# 🎨 Actualización: Branding y Despiece en PDF

## ✅ Cambios Realizados

### 1. 🎨 Colores Corporativos Andamios ICAM

**Antes:**
- Azul púrpura: `[102, 126, 234]` - Genérico
- Gris neutro

**Ahora (Corporativo):**
- **Azul Marino**: `[0, 61, 112]` - Encabezado, títulos secciones
- **Naranja Corporativo**: `[255, 107, 53]` - Líneas separadoras, encabezados tabla
- **Gris Oscuro**: `[45, 45, 45]` - Texto principal
- **Gris Claro**: `[240, 240, 240]` - Filas alternas tabla

### 2. 📋 Encabezado Mejorado

✅ Logo: "ANDAMIOS ICAM" en blanco
✅ Subtítulo: "Sistemas de Altura"
✅ Información derecha con tipo de contrato, folio y fecha
✅ Fondo azul marino corporativo

```
┌─────────────────────────────────────────────┐
│ ANDAMIOS ICAM          CONTRATO RENTA       │
│ Sistemas de Altura     Folio: 20543         │
│                        Fecha: 11/04/2026     │
└─────────────────────────────────────────────┘
```

### 3. 📦 "DESPIECE" (Tabla de Ítems)

**Implementación:**
- ✅ Tabla con encabezado naranja corporativo
- ✅ Columnas: Cantidad, Código, Descripción, Precio Unitario, Subtotal
- ✅ Filas alternas con fondo gris claro (legibilidad)
- ✅ Paginación automática si hay muchos ítems
- ✅ Repetición de encabezado en nuevas páginas
- ✅ Mensaje si no hay ítems

**Ejemplo en PDF:**
```
┌─────┬───────┬──────────────────┬────────────┬──────────┐
│ Cant│ Código│ Descripción      │ P.Unitario│ Subtotal │
├─────┼───────┼──────────────────┼────────────┼──────────┤
│  10 │ AND-01│ Torre 250kg      │  $1250.00 │$12500.00 │
│   5 │ AND-02│ Andamio 400kg    │   $800.00 │ $4000.00 │
└─────┴───────┴──────────────────┴────────────┴──────────┘
```

### 4. 📑 Separadores Visuales

- Líneas naranja corporativo separando secciones
- Grosor: 0.5px
- Mejora legibilidad y profesionalismo

### 5. 👣 Pie de Página

**Nuevo:**
- Línea naranja separadora
- Texto: "Generado por ICAM 360 • [FECHA]"
- Alineado a pie de página

### 6. 📊 Mejoras en Datos

✅ **Campos cliente**: Razón Social, RFC, Teléfono, Dirección
✅ **Campos entrega**: Contacto, Teléfono, Dirección
✅ **Campos pago**: Fecha, Forma, Montos
✅ **Items detallados**: Cantidad, Código, Descripción, Precio, Total
✅ **Cálculos automáticos**: Subtotal, IVA 16%, Saldo

---

## 📋 Verificación de Despiece

El "despiece" (items del contrato) ahora está:
- ✅ **Integrado correctamente** en el PDF
- ✅ **Con tabla profesional** con colores corporativos
- ✅ **Con manejo de overflow** (múltiples páginas si hay muchos items)
- ✅ **Con alternancia de colores** para mejor legibilidad
- ✅ **Con títulos claros**: "DESPIECE DE CONTRATO"

### Si no ves items:
1. Verifica que el contrato tengan items guardados en BD
2. Revisa consola (F12) para errores
3. Intenta crear un nuevo contrato con items

---

## 🎯 Próximas Mejoras (Opcionales)

- [ ] Agregar logo.png embebido (requiere convertir a base64)
- [ ] Agregar QR con link a facturación
- [ ] Agregar código de barras con folio
- [ ] Plantilla de firma (líneas para firmar)
- [ ] Términos y condiciones de ICAM
- [ ] Banco de datos para pago

---

## 📊 Comparación Antes/Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Colores** | Azul púrpura genérico | Azul marino + naranja corporativo |
| **Logo** | ❌ No | ✅ "ANDAMIOS ICAM" |
| **Despiece/Ítems** | ⚠️ Código existía pero sin énfasis | ✅ Tabla profesional con encabezado |
| **Separadores** | Líneas grises | Líneas naranja corporativo |
| **Legibilidad Items** | Líneas simples | Filas alternas + colores |
| **Pie de página** | ❌ No | ✅ Branding ICAM 360 |
| **Paginación Items** | ⚠️ Básica | ✅ Con repetición de encabezado |

---

## 🧪 Testing

Para verificar los cambios:

1. **Abre ICAM 360**
2. **Ve a Contratos**
3. **Selecciona contrato con items**
4. **Haz clic en "📄 Generar PDF"**
5. **Verifica:**
   - [ ] Encabezado azul marino con logo ICAM
   - [ ] Líneas separadoras naranja
   - [ ] Tabla de despiece con colores alternados
   - [ ] Pie de página con branding
   - [ ] Datos correctos de cliente, entrega, pago

---

## 📁 Archivo Modificado

- **`js/modules/pdf-generator.js`** - Actualizado con:
  - Paleta de colores corporativos
  - Logo/encabezado mejorado
  - Tabla de despiece profesional
  - Pie de página con branding
  - Manejo mejorado de ítems

---

**Versión**: 2.0 - Branding ICAM  
**Estado**: ✅ Listo para producción  
**Fecha**: 11 de Abril 2026
