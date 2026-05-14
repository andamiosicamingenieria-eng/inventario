# 🔧 CONFIGURACIÓN DE SUPABASE - Instrucciones

## Paso 1: Crear un Proyecto en Supabase

1. Ve a https://supabase.com
2. Inicia sesión o crea una cuenta
3. Haz clic en "New Project"
4. Completa los datos:
   - **Project Name:** ICAM 360 (o el que prefieras)
   - **Database Password:** Crea una contraseña segura
   - **Region:** Selecciona la más cercana a ti
5. Espera a que se cree (2-3 minutos)

## Paso 2: Obtener las Credenciales

Una vez creado el proyecto:

1. Ve a **Settings → API**
2. Copia estos valores:
   - **Project URL** → Lo necesitarás como `SUPABASE_URL`
   - **Anon Public Key** → Lo necesitarás como `SUPABASE_ANON_KEY`

## Paso 3: Actualizar la Configuración en tu Proyecto

Abre el archivo: `e:\Contratos-inv\js\supabase-client.js`

Busca estas líneas (alrededor de línea 12-13):
```javascript
export const SUPABASE_URL = 'https://qpvhqiyxzdgtuentzwtr.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';
```

Y reemplazalas con tus valores:
```javascript
export const SUPABASE_URL = 'https://TU_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'tu_clave_anonima_aqui';
```

**Ejemplo:**
```javascript
export const SUPABASE_URL = 'https://myproject123.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cHJvamVjdDEyMyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc1NTE0MDM5LCJleHAiOjIwOTEwOTAwMzl9.xxxxx';
```

## Paso 4: Desactivar Modo Demo

Busca esta línea en `js/supabase-client.js` (línea ~15):
```javascript
export const DEMO_MODE = true;
```

Cámbiala a:
```javascript
export const DEMO_MODE = false;
```

## Paso 5: Crear las Tablas en Supabase

1. En el Dashboard de Supabase, ve a **SQL Editor**
2. Crea una consulta nueva
3. Copia y pega el contenido del archivo: `e:\Contratos-inv\Antecedente\schema_minimo.sql`
4. Ejecuta el SQL

Esto creará todas las tablas necesarias.

## Paso 6: Crear un Usuario Admin

1. En Supabase, ve a **Authentication → Users**
2. Haz clic en "Add user"
3. Llena:
   - **Email:** admin@icam360.com (o el que prefieras)
   - **Password:** Una contraseña segura
4. Haz clic en "Create user"

## Paso 7: Recargar la Aplicación

1. Guarda los cambios en `supabase-client.js`
2. Recarga la página en el navegador (Ctrl+Shift+R)
3. Deberías ver la pantalla de login
4. Ingresa el email y contraseña que creaste en el paso 6

---

## 🔐 Configuración de Seguridad (Importante)

### Row Level Security (RLS)

Para proteger tus datos, debes habilitar RLS en cada tabla:

1. Ve a **Authentication → Policies**
2. Para cada tabla, crea políticas que solo permitan acceso al usuario autenticado

### Ejemplo básico para tabla `ops_contratos`:

```sql
-- Permitir lectura a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden leer"
ON ops_contratos FOR SELECT
USING (auth.uid() = usuario_id);

-- Permitir inserción
CREATE POLICY "Usuarios autenticados pueden insertar"
ON ops_contratos FOR INSERT
WITH CHECK (auth.uid() = usuario_id);
```

---

## ❓ Problemas Comunes

### "Error: Unauthorized"
- El usuario no existe en Supabase
- La contraseña es incorrecta
- RLS está demasiado restrictivo

### "Error: Table not found"
- No ejecutaste el SQL del schema
- Ejecuta `schema_minimo.sql` desde SQL Editor

### "CORS error"
- Las credenciales están incompletas
- Verifica que `SUPABASE_URL` termine en `.supabase.co`

---

## 📱 Próximos Pasos

Una vez que todo funciona:

1. Importa datos reales a las tablas
2. Configura permisos de usuario
3. Personaliza los módulos según tus necesidades
4. Implementa backups regulares

---

¿Necesitas ayuda con algo específico? 📍

