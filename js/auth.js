/**
 * ICAM 360 - Módulo de Autenticación
 * Utiliza Supabase Auth para manejar login y sesiones.
 */
import { _supabase, DEMO_MODE } from './supabase-client.js';

export const Auth = (() => {
    let currentUser = null;
    
    // Inicializar y escuchar cambios de sesión
    async function init() {
        if (!_supabase || DEMO_MODE) {
            console.log("✓ Auth: Ejecutando en Modo Demo.");
            // Sesión demo por defecto (hasta que el usuario haga login explícito)
            if (!currentUser) {
                currentUser = {
                    id: 'demo-user',
                    email: 'admin@icam360.com',
                    app_metadata: { role: 'admin' },
                    user_metadata: {},
                };
            }
            return true;
        }

        try {
            // Obtener la sesión inicial
            const { data: { session }, error } = await _supabase.auth.getSession();
            if (error) {
                console.error("❌ Auth init error:", error);
                console.warn("⚠️ Fallback a Modo Demo por error de autenticación");
                return false;
            }

            currentUser = session ? session.user : null;

            // Escuchar cambios de estado (e.g., login, logout, caducidad del token)
            _supabase.auth.onAuthStateChange((event, session) => {
                currentUser = session ? session.user : null;
                if (event === 'SIGNED_IN') {
                    document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser } }));
                } else if (event === 'SIGNED_OUT') {
                    document.dispatchEvent(new CustomEvent('auth:logout'));
                }
            });

            return !!currentUser;
        } catch (e) {
            console.error("❌ Auth init fatal error:", e.message);
            console.warn("⚠️ Fallback a Modo Demo por excepción");
            return false;
        }
    }

    async function login(email, password) {
        if (!_supabase || DEMO_MODE) {
            const u = String(email || '').trim().toLowerCase();
            const ok =
                (u === 'admin@icam360.com' && password === 'demo123') ||
                (u === 'contratos@icam360.com' && password === 'demo123') ||
                (u === 'inventarios@icam360.com' && password === 'demo123') ||
                (u === 'facturacion@andamiosicam.com' && password === 'contratos26*') ||
                (u === 'andamiosicaminventarios@gmail.com' && password === 'Exigenciadiaria2026');
            if (!ok) return { error: 'Credenciales inválidas en demo.' };

            // Usuario “simulado” para que la UI pueda aplicar permisos por rol
            currentUser = {
                id: 'demo-user',
                email: u,
                app_metadata: { role: u === 'admin@icam360.com' ? 'admin' : (u === 'contratos@icam360.com' ? 'contratos' : (u === 'facturacion@andamiosicam.com' ? 'revisor' : 'inventarios')) },
                user_metadata: {},
            };
            return currentUser;
        }

        try {
            const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
            if (error) return { error: error.message };
            return data.user;
        } catch (e) {
            console.error("Login fatal error:", e);
            return { error: e.message };
        }
    }

    async function logout() {
        if (!_supabase || DEMO_MODE) {
            currentUser = null;
            return true;
        }
        try {
            const { error } = await _supabase.auth.signOut();
            return !error;
        } catch (e) {
            console.error("Logout error:", e);
            return false;
        }
    }

    function getUser() {
        return currentUser;
    }

    function isAuthenticated() {
        if (DEMO_MODE) return true; // Siempre "auth" en demo
        return !!currentUser;
    }

    return {
        init,
        login,
        logout,
        getUser,
        isAuthenticated
    };
})();
