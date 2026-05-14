/**
 * ICAM 360 - Cliente Supabase
 * 
 * ⚠️ SEGURIDAD: La SUPABASE_ANON_KEY es visible para el cliente.
 *    Es imprescindible configurar Row Level Security (RLS) en TODAS las tablas
 *    de Supabase para proteger los datos. Sin RLS, cualquier usuario con esta
 *    key puede leer/escribir/borrar todo.
 *
 * Para producción, considerar:
 *  1. Implementar Supabase Auth y ligar las políticas RLS al auth.uid()
 *  2. O mover las operaciones sensibles a Supabase Edge Functions
 */

export const SUPABASE_URL = 'https://qpvhqiyxzdgtuentzwtr.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmhxaXl4emRndHVlbnR6d3RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTQwMzksImV4cCI6MjA5MTA5MDAzOX0.f26AB4pjN_FPrdj-PUbTCTD8aI4yyyTqNhgK8w39Fmo';

// ✅ USANDO SUPABASE REAL (Datos en vivo)
// Para volver a Modo Demo, cambia a: true
export const DEMO_MODE = false;

export let _supabase = null;
if (!DEMO_MODE && window.supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// === CAPA DE CACHÉ EN MEMORIA ===
const cache = {
    crm_clientes: null,
    cat_productos: null
};

/**
 * Capa de abstracción de base de datos.
 * En modo Demo opera sobre datos locales en memoria.
 * En producción, usa Supabase REST API.
 *
 * Contrato de retorno CONSISTENTE:
 *  - getAll:  Array de filas | null en error
 *  - insert:  Objeto insertado | { error: string }
 *  - update:  { success: true } | { error: string }
 *  - delete:  { success: true } | { error: string }
 */
export const DB = {
    async getAll(table, opts = {}) {
        if (DEMO_MODE || !_supabase) return null;
        
        // Retornar de caché si existe y no se forzó recarga
        if (cache[table] && !opts.forceReload && !opts.limit && !opts.offset) {
            return cache[table];
        }
        
        // Limpiar caché si se fuerza recarga
        if (opts.forceReload && cache[table]) {
            cache[table] = null;
        }

        try {
            const selectStr = opts.select || '*';
            let q = _supabase.from(table).select(selectStr);
            if (opts.orderBy) q = opts.ascending === false ? q.order(opts.orderBy, { ascending: false }) : q.order(opts.orderBy);
            
            // Manejar tablas grandes con paginación
            let allData = [];
            let page = 0;
            const pageSize = 1000;
            
            if (!opts.limit && !opts.offset) {
                // Paginación automática para tablas grandes
                while (true) {
                    const offset = page * pageSize;
                    let pagedQ = _supabase.from(table).select(selectStr);
                    if (opts.orderBy) pagedQ = opts.ascending === false ? pagedQ.order(opts.orderBy, { ascending: false }) : pagedQ.order(opts.orderBy);
                    pagedQ = pagedQ.range(offset, offset + pageSize - 1);
                    
                    const { data, error } = await pagedQ;
                    if (error) throw error;
                    
                    if (data && data.length > 0) {
                        allData = allData.concat(data);
                        if (data.length < pageSize) break; // Última página
                        page++;
                    } else {
                        break;
                    }
                }
                return allData;
            }
            
            // Comportamiento original para consultas con límite
            if (opts.limit) q = q.limit(opts.limit);
            if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit || 1000) - 1);
            const { data, error, status } = await q;
            
            if (error) { 
                console.error(`[DB ERROR] Tabla: ${table}`, {
                    mensaje: error.message,
                    detalles: error.details,
                    codigo: error.code,
                    status: status
                });
                if (window.App && App.toast) {
                    App.toast(`Error cargando ${table}: ${error.message}`, 'danger');
                }
                return null; 
            }
            
            // Guardar en caché si son tablas catálogo y la consulta no está filtrada/paginada
            if ((table === 'crm_clientes' || table === 'cat_productos') && !opts.limit && !opts.offset) {
                cache[table] = allData || data;
            }
            return allData || data;
        } catch (e) { 
            console.error('[DB FATAL]', e); 
            if (window.App && App.toast) App.toast('Error de conexión con la base de datos', 'danger');
            return null; 
        }
    },

    async insert(table, payload) {
        if (DEMO_MODE || !_supabase) return { error: 'Modo demo activo' };
        try {
            const { data, error, status } = await _supabase.from(table).insert(payload).select().single();
            if (error) { 
                console.error(`[DB INSERT ERROR] Tabla: ${table}`, {
                    mensaje: error.message,
                    detalles: error.details,
                    codigo: error.code,
                    status: status,
                    payloadSent: payload
                });
                if (window.App && App.toast) {
                    App.toast(`Error insertando en ${table}: ${error.message}`, 'danger');
                }
                return { error: error.message }; 
            }
            if (cache[table]) cache[table] = null; // invalidar caché
            return data;
        } catch (e) { 
            console.error('[DB INSERT FATAL]', e);
            if (window.App && App.toast) {
                App.toast(`Error insertando en ${table}: ${e.message || e}`, 'danger');
            }
            return { error: e.message }; 
        }
    },

    async update(table, id, payload) {
        if (DEMO_MODE || !_supabase) return { success: true };
        try {
            const { error, status } = await _supabase.from(table).update(payload).eq('id', id);
            if (error) { 
                console.error(`[DB UPDATE ERROR] Tabla: ${table}, ID: ${id}`, {
                    mensaje: error.message,
                    detalles: error.details,
                    codigo: error.code,
                    status: status,
                    payloadSent: payload
                });
                return { error: error.message }; 
            }
            if (cache[table]) cache[table] = null; // invalidar caché
            return { success: true };
        } catch (e) { 
            console.error('[DB UPDATE FATAL]', e);
            return { error: e.message }; 
        }
    },

    async delete(table, id) {
        if (DEMO_MODE || !_supabase) return { success: true };
        try {
            const { error } = await _supabase.from(table).delete().eq('id', id);
            if (error) { 
                console.error(`[DB DELETE ERROR] ${table}:`, error.message); 
                return { error: error.message }; 
            }
            if (cache[table]) cache[table] = null; // invalidar caché
            return { success: true };
        } catch (e) { 
            console.error('[DB DELETE FATAL]', e);
            return { error: e.message }; 
        }
    },

    async deleteWhere(table, column, value) {
        if (DEMO_MODE || !_supabase) return { success: true };
        try {
            const { error } = await _supabase.from(table).delete().eq(column, value);
            if (error) { 
                console.error(`[DB DELETE_WHERE ERROR] ${table}:`, error.message); 
                return { error: error.message }; 
            }
            if (cache[table]) cache[table] = null; // invalidar caché
            return { success: true };
        } catch (e) { 
            console.error('[DB DELETE_WHERE FATAL]', e);
            return { error: e.message }; 
        }
    },
};
