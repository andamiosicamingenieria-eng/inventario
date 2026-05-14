# 🔧 Solución de Problemas: Error "Failed to fetch" + Items no guardados

## ✅ Cambios Implementados

Se han realizado dos correcciones importantes:

### 1. **Error "Failed to fetch" → Rutas de PDF Mejoradas**
   - ✅ Ahora intenta cargar la plantilla desde múltiples rutas
   - ✅ Mejor manejo de errores con mensajes claros
   - ✅ Logging en consola para diagnosticar

### 2. **Items no guardados → Validación y Logging Mejorados**
   - ✅ Extracción más robusta de datos de items
   - ✅ Logging detallado de cada item
   - ✅ Validación de cantidad y precio

---

## 🎯 Pasos para Diagnosticar y Solucionar

### Paso 1: Abre la Consola del Navegador
```
Presiona: F12 (o Ctrl+Shift+K)
Verás la pestaña "Console"
```

### Paso 2: Intenta Crear un Contrato
1. Ve a **Contratos** → **Nuevo Contrato**
2. Completa TODOS los campos:
   - Cliente ✓
   - Folio ✓
   - Tipo de Operación ✓
   - Sección de Entrega ✓
   - Sección de Pago ✓
   - **Agrega al menos 1 ITEM**
3. Haz clic en **"Guardar Contrato"**

### Paso 3: Revisa la Consola
Deberías ver mensajes como:

```
✓ Item 1: {producto_id: 1, codigo: "AND-001", nombre: "Andamio Tubular...", cantidad: 50, precio_unitario: 85}
✓ Item 2: {producto_id: 3, codigo: "TAB-001", nombre: "Tablón de Madera...", cantidad: 30, precio_unitario: 35}
✓ Total de ítems recolectados: 2

📋 Payload a guardar: {
  folio: "20001",
  cliente_id: 1,
  razon_social: "CONSTRUCTORA TORRES...",
  ...
  items: [ Array(2) ]
}
📦 Items en payload: 2
```

Si ves esto ✓✓✓ entonces **los items SÍ se recolectaron correctamente**.

### Paso 4: Si los Items No Aparecen en Consola

**Problema:** Los campos de Item están vacíos
```
✗ Item 1 incompleto (falta: sel=true, cant=true, prec=true, valor=)
```

**Solución:**
1. Asegúrate que el formulario tenga la sección de Ítems
2. Haz clic en **"+ Agregar Item"**
3. Selecciona un Producto
4. Ingresa Cantidad y Precio/Día
5. Intenta guardar nuevamente

---

## 🚀 Ahora Intenta Descargar el PDF

Una vez que los ítems se guardan correctamente, haz:

1. **Haz clic en la fila del contrato** para expandirla
2. **Busca el botón "📄 Generar PDF"**
3. Si sale error "Failed to fetch", revisa la consola:

### Error PDF: Diagnóstico en Consola

Si ves:
```
✗ Intento fallido: Antecedente/contrato_plantilla.pdf
✗ Intento fallido: /Antecedente/contrato_plantilla.pdf
✗ Intento fallido: ../Antecedente/contrato_plantilla.pdf
✗ Intento fallido: ./Antecedente/contrato_plantilla.pdf

❌ No se pudo cargar la plantilla PDF desde ninguna ruta...
```

**Soluciones:**

#### Opción A: Verificar que el Archivo Existe
```
1. Abre el explorador de archivos
2. Navega a: e:\Contratos-inv\Antecedente\
3. Verifica que exista: contrato_plantilla.pdf
4. Si no existe, descárgalo o crea uno en blanco
```

#### Opción B: Probar desde localhost
```
En lugar de:   file:///e:/Contratos-inv/
Usa:           http://localhost:8000/Contratos-inv/
```

Para esto necesitas un servidor local:
```bash
# En PowerShell, desde la carpeta Contratos-inv
python -m http.server 8000
```

Luego abre: `http://localhost:8000`

#### Opción C: Usar una Ruta Absoluta Correcta
Si tu servidor ya está corriendo, busca en consola:
```
✓ Plantilla cargada desde: [AQUÍ VERÁS LA RUTA QUE FUNCIONÓ]
```

---

## ✅ Verificación Final: ¿Todo Funciona?

Marca lo que ya está resuelto:

- [ ] Al guardar contrato, la consola muestra "✓ Item 1, Item 2, etc..."
- [ ] El payload debe contener `items: [...]` con los datos corretos
- [ ] Al expandir un contrato, ves el botón "📄 Generar PDF"
- [ ] Al hacer clic en generar PDF, se abre y descarga correctamente
- [ ] El PDF tiene todas las secciones (Cliente, Entrega, Pago, Items, Totales)

Si marcaste todas, ¡**ÉXITO!** ✨

---

## 📋 Información para Reportar Si Persisten Errores

Si aún hay problemas, copia y comparte:

1. **Consola completa** (F12 → Console → Ctrl+A → Ctrl+C)
2. **Respuesta en Network** de la llamada a PDF
3. **URL actual del navegador**
4. **Nombre del archivo contrato_plantilla.pdf existe?**

---

## 🎓 Resumen Técnico

**Cambios en js/modules/contratos.js:**

✅ Función `generarPDF()`:
- Intenta 4 rutas diferentes para la plantilla
- Mejor logging de errores

✅ Función `guardar()`:
- Extrae items de forma más robusta
- Valida cada item antes de guardarlo
- Logging detallado en consola

✅ Items collection:
- Ahora maneja mejor el parsing "CODIGO — NOMBRE"
- Valida que cantidad y precio sean números reales

---

**Status:** 🟡 LISTO PARA PRUEBA
**Próximo paso:** Abre consola y crea un contrato de prueba
