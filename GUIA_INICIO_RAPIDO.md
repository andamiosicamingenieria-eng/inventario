# 🚀 GUÍA DE INICIO RÁPIDO - ICAM 360

## 🎯 ¿Qué se arregló?

✅ El proyecto ahora **carga correctamente en Modo Demo**
✅ Mejorado manejo de errores en inicialización
✅ Mensajes de error más descriptivos en la consola

---

## 📦 Cambios Realizados

### 1. Activado Modo Demo
**Archivo:** `js/supabase-client.js`
- Cambiado `DEMO_MODE = false` a `DEMO_MODE = true`
- Ahora la app funciona sin necesidad de Supabase
- Los datos se cargan desde memoria local

### 2. Mejor Manejo de Errores
**Archivo:** `js/auth.js`
- Añadidos mensajes de error más claros en consola
- Fallback automático a Modo Demo si falla la conexión

---

## ✨ Cómo Ejecutar el Proyecto

### Opción 1: Servidor Local (Recomendado)

```bash
# 1. Abre terminal en la carpeta del proyecto
# En Windows:
cd e:\Contratos-inv

# 2. Inicia el servidor
python server.py

# 3. Abre en navegador:
# http://localhost:8000

# 4. Login en Modo Demo:
# Email: admin@icam360.com
# Contraseña: demo123
```

### Opción 2: Abrir directamente (No recomendado)

Si simplemente abres `index.html` con doble click, puede que no funcione correctamente por CORS. Siempre usa el servidor local.

---

## 🔐 Acceso a Modo Demo

### Credenciales de Acceso (Modo Demo)

| Campo | Valor |
|-------|-------|
| Email | `admin@icam360.com` |
| Contraseña | `demo123` |

### Características disponibles en Modo Demo

- ✓ Panel de Dashboard completo
- ✓ Gestión de Clientes
- ✓ Gestión de Productos
- ✓ Gestión de Contratos
- ✓ Hojas de Salida y Entrada
- ✓ Inventario
- ✓ Cobranza y Pagos
- ✓ Generación de PDFs
- ✓ Exportación a Excel

**Limitación:** Los datos no persisten. Al recargar o cerrar navegador, se pierden.

---

## 🔗 Conectar a Supabase Real (Producción)

Si deseas usar una base de datos real, sigue estos pasos:

### Paso 1: Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea una nueva cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Copia tu **URL del proyecto** y **Clave Anónima** (ANON_KEY)

### Paso 2: Configurar las credenciales

Abre `js/supabase-client.js` y reemplaza:

```javascript
export const SUPABASE_URL = 'https://TU_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi... (tu clave aquí)';

// Para usar Supabase real, cambia a false:
export const DEMO_MODE = false;
```

### Paso 3: Crear tablas en Supabase

Ejecuta los scripts SQL disponibles en la carpeta `Antecedente/`:

- `schema_minimo.sql` - Estructura básica
- `schema_phase3_items.sql` - Con manejo de items
- `schema_rls_auth.sql` - Con seguridad RLS

En Supabase:
1. Abre **SQL Editor**
2. Copia el contenido de los scripts
3. Ejecuta cada script

### Paso 4: Configurar Autenticación

En Supabase, ve a **Authentication → Providers** y habilita:
- ✓ Email / Password

### Paso 5: Crear usuario admin

En Supabase, ve a **Authentication → Users** y crea:

| Campo | Valor |
|-------|-------|
| Email | `admin@icam360.com` |
| Contraseña | Tu contraseña segura |

### Paso 6: Cambiar de Modo Demo a Producción

```javascript
// En js/supabase-client.js, línea 15:
export const DEMO_MODE = false; // ← Cambia a false
```

Recarga el navegador. Ahora deberías poder autenticarte con Supabase.

---

## 🛠️ Solución de Problemas

### Problema: Pantalla en blanco

**Solución:**
1. Abre F12 → Consola del navegador
2. Busca mensajes de error
3. Si hay errores CORS de Supabase, verifica que:
   - El URL de Supabase sea correcto
   - La clave ANON_KEY sea válida
   - El proyecto Supabase esté activo

### Problema: No puedo hacer login

**Si estás en Modo Demo:**
- Email: `admin@icam360.com`
- Contraseña: `demo123`

**Si usas Supabase real:**
- Verifica que el usuario exista en Authentication → Users
- Verifica que hayas creado el usuario correctamente

### Problema: Los datos no persisten

**Es normal en Modo Demo.** Los datos se cargan solo en memoria del navegador.
Para persistencia, conecta a Supabase real (ver sección anterior).

---

## 📱 Funcionalidades Principales

### Dashboard
- Vista general de contratos activos
- KPIs principales
- Acceso rápido a módulos

### Módulos Disponibles

1. **Catálogos**
   - Gestión de Clientes
   - Gestión de Productos

2. **Operaciones**
   - Gestión de Contratos
   - Cobranza y Pagos
   - Seguimiento de contratos
   - Sub-Arrendamiento
   - Estado de Cuenta

3. **Logística**
   - Hojas de Salida (HS)
   - Hojas de Entrada (HE)

4. **Almacén**
   - Gestión de Inventario

5. **Taller**
   - Módulo de Fabricación

---

## 📞 Soporte

Si encuentras problemas:

1. **Revisa DIAGNOSTICO_CARGA.md** - Problemas de carga identificados
2. **Abre la consola del navegador** (F12) - Busca mensajes de error
3. **Verifica que el servidor esté corriendo** - `python server.py`
4. **Recarga con Ctrl+Shift+R** - Fuerza recarga sin caché

---

## ⚙️ Configuración Recomendada para Producción

1. **Migrar credenciales a variables de entorno**
   - No hardcodear en el código
   - Usar `.env` (no versionar)

2. **Implementar Row Level Security (RLS) en Supabase**
   - Proteger datos por usuario
   - Ligar políticas a `auth.uid()`

3. **Usar Edge Functions de Supabase para operaciones sensibles**
   - Validación de datos
   - Lógica de negocio

4. **Regenerar claves de Supabase**
   - Las credenciales actuales están expuestas
   - En Dashboard Supabase → Settings → API Keys

5. **Configurar CORS correctamente**
   - Whitelist de dominios permitidos
   - No usar `*` en producción

---

**¡Tu aplicación está lista para usar! 🎉**

