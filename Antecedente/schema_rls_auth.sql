-- =====================================================================
-- ICAM 360 — Seguridad: Supabase Auth y Row Level Security (RLS)
-- Ejecutar en Supabase -> SQL Editor -> Run
-- =====================================================================

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE public.crm_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cat_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_he ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_hs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_subarriendos ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes (por si se ejecuta este script más de una vez)
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON public.crm_clientes;
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON public.cat_productos;
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON public.inv_master;
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON public.ops_contratos;
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON public.ops_pagos;
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON public.ops_he;
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON public.ops_hs;
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON public.ops_subarriendos;

-- 3. Crear políticas que permiten TODAS las operaciones (SELECT, INSERT, UPDATE, DELETE)
-- de manera EXCLUSIVA a usuarios que han iniciado sesión (rol 'authenticated').

CREATE POLICY "Solo usuarios autenticados"
ON public.crm_clientes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo usuarios autenticados"
ON public.cat_productos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo usuarios autenticados"
ON public.inv_master
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo usuarios autenticados"
ON public.ops_contratos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo usuarios autenticados"
ON public.ops_pagos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo usuarios autenticados"
ON public.ops_he
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo usuarios autenticados"
ON public.ops_hs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo usuarios autenticados"
ON public.ops_subarriendos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================================
-- FIN
-- NOTA: Con este script, la SUPABASE_ANON_KEY ya no permite el acceso
-- libre a la DB. Ahora se requiere incluir un token JWT (authorization
-- header) enviado por Supabase Auth.
-- =====================================================================
