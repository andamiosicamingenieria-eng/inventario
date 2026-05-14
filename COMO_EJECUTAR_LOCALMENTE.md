# 🚀 Cómo Ejecutar ICAM 360 Correctamente

## El Problema
El navegador **no puede cargar archivos locales** directamente por razones de seguridad (CORS).

Para que funcione la descarga de PDF y todo lo demás, necesitas un **servidor web local**.

---

## ✅ Solución Rápida: Usa el Servidor Incluido

### Paso 1: Abre PowerShell
```
Botón Inicio → Escribe: PowerShell
```

### Paso 2: Navega a la carpeta del proyecto
```powershell
cd e:\Contratos-inv
```

### Paso 3: Ejecuta el servidor
```powershell
python server.py
```

Deberías ver:
```
╔══════════════════════════════════════════════════════════════╗
║           SERVIDOR LOCAL ICAM 360                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  🌐 Abre en el navegador:                                   ║
║     → http://localhost:8000                                 ║
...
```

### Paso 4: Abre en el navegador
```
http://localhost:8000
```

**¡Listo!** Ahora sí funcionará todo:
- ✅ Guardar contratos
- ✅ Guardar items
- ✅ **Descargar PDF** ← Esto ahora SÍ funcionará

---

## 🛑 Para Detener el Servidor
En PowerShell, presiona: **Ctrl + C**

---

## 💡 Alternativa: Si usas VS Code Live Server

Si tienes la extensión "Live Server" de VS Code:

1. Click derecho en `index.html`
2. "Open with Live Server"
3. Se abrirá automáticamente en `http://localhost:5500`

**¡Listo!**

---

## 🔍 Verificación: ¿Funciona?

**Test rápido:**
1. Ir a Contratos
2. Crear un contrato nuevo
3. Agregar un item
4. Guardar
5. Expandir fila
6. Click en "📄 Generar PDF"

Si todo funciona y descargas el PDF → **✓ SUCCESS**

---

## ⚠️ Si Aún No Funciona

**Verifica en la consola (F12):**

Si ves:
```
✓ Plantilla cargada desde: Antecedente/contrato_plantilla.pdf
```

→ **¡Funciona!** El PDF debería descargar

If ves:
```
❌ Error generando PDF...
```

→ Abre consola (F12) y cópiame el error completo

---

## 📊 Puertos Disponibles

Si el puerto 8000 no está disponible, puedes cambiar a otro:

```powershell
# Modificar en server.py
PORT = 8001  # o 8002, 8003, etc
```

O usar:
```powershell
python -m http.server 9000
```

Luego:
```
http://localhost:9000
```

---

## 🎯 Resumen

| Acción | Comando |
|--------|---------|
| Navega a proyecto | `cd e:\Contratos-inv` |
| Inicia servidor | `python server.py` |
| Abre aplicación | `http://localhost:8000` |
| Detener servidor | `Ctrl + C` |

---

**¿Ya lo intentaste con el servidor local?** 🚀
