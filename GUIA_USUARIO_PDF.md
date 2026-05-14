# 📄 Guía Rápida: Descargar PDF de Contrato en ICAM 360

## 🎯 Objetivo
Generar y descargar un PDF profesional del contrato con toda la información desde la base de datos.

---

## 📱 Paso a Paso

### 1️⃣ Abre la aplicación ICAM 360
- Dirección: `file:///e:/Contratos-inv/index.html`
- Espera a que cargue completamente

### 2️⃣ Ve a Operaciones → Contratos
- Haz clic en el menú lateral izquierdo
- Selecciona **"Contratos"**

### 3️⃣ Selecciona un Contrato
- Ve la tabla con todos tus contratos
- Haz clic en cualquier fila para expandir los detalles

### 4️⃣ Descarga el PDF
- Cuando la fila esté expandida, verás el botón **"📄 Generar PDF"**
- Haz clic en él
- El PDF se descargará automáticamente

---

## 📥 Dónde se Descarga

El archivo descargado se guardará en tu carpeta de **Descargas** con el nombre:
```
Contrato_[FOLIO]_[FECHA].pdf
```

Ejemplo: `Contrato_20543_2024-01-15.pdf`

---

## 📋 Contenido del PDF

El PDF incluirá automáticamente:

### 🏢 Datos del Cliente
- Razón Social
- RFC
- Teléfono de contacto
- Dirección

### 📦 Datos de Entrega
- Persona que recibe
- Teléfono de entrega
- Dirección de entrega/obra

### 💳 Datos de Pago
- Fecha de pago
- Forma de pago
- Montos totales y saldo

### 📊 Detalles de la Operación
- Folio del contrato
- Tipo de operación
- Ítems (tabla con cantidad, código, descripción, precio)
- Totales (Subtotal, IVA, Total, Saldo)

---

## ⚙️ Requisitos

✅ Todos están ya configurados, pero por si acaso:

- [x] Navegador moderno (Chrome, Edge, Firefox)
- [x] JavaScript habilitado
- [x] Base de datos Supabase conectada
- [x] Contratos cargados en la BD
- [x] Permisos de descarga de archivos permitidos

---

## 🚨 Preguntas Frecuentes

### ¿Qué pasa si no tengo ítems en el contrato?
El PDF se genera normalmente, pero mostrará "Sin ítems registrados" en la tabla.

### ¿Dónde veo la descarga?
En la carpeta de **Descargas** de tu computadora o navegador.

### ¿El PDF queda guardado en la BD?
No, se genera bajo demanda cada vez que haces clic en el botón. No se guarda automáticamente.

### ¿Qué datos no incluye el PDF?
El PDF solo incluye información del contrato y sus ítems directos. No incluye:
- Hojas de salida (HS) o entrada (HE) relacionadas
- Pagos registrados (solo proyectados)
- Documentos adjuntos

### ¿Puedo modificar el PDF después de descargarlo?
Sí, puedes abrirlo en cualquier editor PDF, pero se recomienda no cambiar datos críticos.

---

## 💡 Tips de Uso

### 📌 Mejor Práctica
1. **Completa todos los campos** del contrato antes de generar PDF
2. **Verifica los ítems** estén bien ingresados en la tabla
3. **Revisa el PDF** que se descarga para validar datos
4. **Archiva los PDFs** en una carpeta identificada por año/cliente

### 🔄 Flujo Recomendado
```
Crear Contrato 
    → Llenar Cliente, Entrega, Pago
    → Agregar Ítems
    → Guardar en BD
    → Generar PDF
    → Enviar al cliente
```

### 📧 Para Enviar al Cliente
1. Descarga el PDF
2. Adjúntalo en un email
3. O comparte el archivo directamente

---

## 🆘 Si Hay Problemas

### "El botón 📄 Generar PDF no aparece"
- Verifica que hayas expandido la fila del contrato (clic en la fila)
- Recarga la página (F5)

### "No se descarga el PDF"
- Verifica que las descargas no estén bloqueadas
- Prueba con otro navegador
- Revisa la consola (F12) para ver si hay errores

### "El PDF se ve en blanco o sin datos"
- Verifica que el contrato tenga datos guardados en la BD
- Revisa que los ítems estén registrados
- Recarga los contratos haciendo clic en "Contratos" nuevamente

### "Error: PDFGenerator is not defined"
- Recarga completamente la página (Ctrl+Shift+R)
- Verifica que la conexión a internet sea correcta

---

## 📞 Soporte

Si el problema persiste:
1. Abre la Consola del navegador (tecla F12)
2. Copia el error que aparece en rojo
3. Contacta al equipo técnico con:
   - El error completo
   - El folio del contrato que genera el error
   - Navegador y versión que usas

---

**Última actualización**: 2024
**Versión**: 1.0  
**Status**: ✅ Funcional
