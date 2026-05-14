/**
 * INVENTARIO-CONTRATOS — Cliente Supabase
 * Proyecto: eftsuegjfqgwdrajkloc (mismo del macro VBA)
 */
export const SUPABASE_URL = 'https://eftsuegjfqgwdrajkloc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdHN1ZWdqZnFnd2RyYWprbG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQ5NDUsImV4cCI6MjA5NDM1MDk0NX0.qjtTRJk7oM3SQf5iat9OzbFmt2-VSneBNZ28TSUDXmE';

export let _supabase = null;
if (window.supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Capa de abstracción de base de datos.
 * Soporta paginación automática, filtros eq/in_, upsert.
 */
export const DB = {
    async getAll(table, opts = {}) {
        if (!_supabase) return null;
        try {
            const buildQuery = (base) => {
                let q = base;
                if (opts.eq) Object.entries(opts.eq).forEach(([k, v]) => { q = q.eq(k, v); });
                if (opts.in_) Object.entries(opts.in_).forEach(([k, v]) => { q = q.in(k, v); });
                if (opts.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending !== false });
                return q;
            };
            let allData = [];
            let page = 0;
            const ps = 1000;
            while (true) {
                const off = page * ps;
                let pq = buildQuery(_supabase.from(table).select(opts.select || '*'));
                pq = pq.range(off, off + ps - 1);
                const { data, error } = await pq;
                if (error) throw error;
                if (data && data.length > 0) {
                    allData = allData.concat(data);
                    if (data.length < ps) break;
                    page++;
                } else break;
            }
            return allData;
        } catch (e) {
            console.error(`[DB] ${table}:`, e);
            if (window.App?.toast) App.toast(`Error: ${e.message}`, 'danger');
            return null;
        }
    },

    async insert(table, payload) {
        if (!_supabase) return { error: 'Sin conexión' };
        try {
            const { data, error } = await _supabase.from(table).insert(payload).select().single();
            if (error) { console.error(`[DB INSERT] ${table}:`, error); return { error: error.message }; }
            return data;
        } catch (e) { return { error: e.message }; }
    },

    async update(table, id, payload) {
        if (!_supabase) return { error: 'Sin conexión' };
        try {
            const { error } = await _supabase.from(table).update(payload).eq('id', id);
            if (error) return { error: error.message };
            return { success: true };
        } catch (e) { return { error: e.message }; }
    },

    async upsert(table, payload, conflictCols) {
        if (!_supabase) return { error: 'Sin conexión' };
        try {
            const { data, error } = await _supabase.from(table)
                .upsert(payload, { onConflict: conflictCols }).select().single();
            if (error) return { error: error.message };
            return data;
        } catch (e) { return { error: e.message }; }
    },

    async delete(table, id) {
        if (!_supabase) return { error: 'Sin conexión' };
        try {
            const { error } = await _supabase.from(table).delete().eq('id', id);
            if (error) return { error: error.message };
            return { success: true };
        } catch (e) { return { error: e.message }; }
    },

    async deleteWhere(table, column, value) {
        if (!_supabase) return { error: 'Sin conexión' };
        try {
            const { error } = await _supabase.from(table).delete().eq(column, value);
            if (error) return { error: error.message };
            return { success: true };
        } catch (e) { return { error: e.message }; }
    },
};
