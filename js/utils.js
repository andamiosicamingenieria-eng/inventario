/**
 * ICAM 360 - Utilidades Compartidas
 * Funciones comunes usadas por múltiples módulos.
 * Evita duplicación de código y centraliza lógica de sanitización, formateo y badges.
 */
import { DB } from './supabase-client.js';

export const Utils = (() => {

    // ── Sanitización XSS ─────────────────────────────────
    /**
     * Escapa HTML para prevenir inyección XSS.
     * Debe usarse en TODO dato proveniente de la base de datos
     * antes de renderizarlo con innerHTML.
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const str = String(text);
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }

    // ── Formateo de Fechas ───────────────────────────────
    /** Formatea una fecha ISO (YYYY-MM-DD) a formato local es-MX */
    function fmtFecha(f) {
        if (!f) return '—';
        return new Date(f + 'T12:00:00').toLocaleDateString('es-MX');
    }

    /** Retorna la fecha de hoy en formato ISO YYYY-MM-DD */
    function hoyISO() {
        return new Date().toISOString().split('T')[0];
    }

    /** Calcula días restantes desde hoy hasta una fecha */
    function diasRestantes(f) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const venc = new Date(f + 'T00:00:00');
        return Math.ceil((venc - hoy) / 86400000);
    }

    /** Retorna color CSS según proximidad de vencimiento */
    function colorVencimiento(f) {
        const dias = Math.ceil((new Date(f + 'T12:00:00') - new Date()) / 86400000);
        if (dias < 0) return 'var(--danger)';
        if (dias <= 5) return 'var(--warning)';
        return 'var(--success)';
    }

    // ── Badges de Estatus ────────────────────────────────
    function badgeTipoContrato(t) {
        const map = { renta:'badge-info', venta:'badge-purple', renovacion:'badge-primary', venta_perdida:'badge-danger', cancelacion:'badge-gray' };
        return `<span class="badge ${map[t]||'badge-gray'}">${escapeHtml((t||'—').replace('_',' '))}</span>`;
    }

    function badgeEstatusContrato(e) {
        const map = { activo:'badge-success', entrega_parcial:'badge-warning', recolectado:'badge-success', borrador:'badge-gray', renovacion:'badge-primary', cancelado:'badge-gray' };
        return `<span class="badge ${map[e]||'badge-gray'}">${escapeHtml((e||'—').replace('_',' '))}</span>`;
    }

    function badgePago(p) {
        const map = { pendiente:'badge-danger', parcial:'badge-warning', liquidado:'badge-success' };
        return `<span class="badge ${map[p]||'badge-danger'}">${escapeHtml((p||'pendiente').toUpperCase())}</span>`;
    }

    // ── Estatus de Logística ─────────────────────────────
    function calcularEstatusEntrega(contrato, todasHS) {
        const itemsReq = contrato.items || [];
        if (!itemsReq.length) return 'sin_items';
        const hsContrato = todasHS.filter(h => h.contrato_folio === contrato.folio);
        if (!hsContrato.length) return 'sin_entrega';
        const entregado = {};
        hsContrato.forEach(h => {
            (h.items || []).forEach(it => {
                entregado[it.producto_id] = (entregado[it.producto_id] || 0) + (parseFloat(it.cantidad_hs || it.cantidad) || 0);
            });
        });
        let totalReq = 0, totalEnt = 0;
        itemsReq.forEach(req => {
            totalReq += parseFloat(req.cantidad) || 0;
            totalEnt += Math.min(parseFloat(req.cantidad) || 0, entregado[req.producto_id] || 0);
        });
        if (totalEnt <= 0) return 'sin_entrega';
        if (totalEnt >= totalReq) return 'total';
        return 'parcial';
    }

    function calcularEstatusRecoleccion(contrato, todasHE) {
        if (contrato.estatus === 'renovacion') return 'renovacion';
        const itemsReq = contrato.items || [];
        if (!itemsReq.length) return 'sin_items';
        const heContrato = todasHE.filter(h => h.contrato_folio === contrato.folio);
        if (!heContrato.length) return 'sin_recoleccion';
        const recolectado = {};
        heContrato.forEach(h => {
            (h.items || []).forEach(it => {
                recolectado[it.producto_id] = (recolectado[it.producto_id] || 0) + (parseFloat(it.cantidad_recolectada || it.cantidad) || 0);
            });
        });
        let totalReq = 0, totalRec = 0;
        itemsReq.forEach(req => {
            totalReq += parseFloat(req.cantidad) || 0;
            totalRec += Math.min(parseFloat(req.cantidad) || 0, recolectado[req.producto_id] || 0);
        });
        if (totalRec <= 0) return 'sin_recoleccion';
        if (totalRec >= totalReq) return 'total';
        return 'parcial';
    }

    function getBadgeEntrega(estatus) {
        const map = {
            'total':       '<span class="badge badge-success" title="Entregado al 100%">🚛 Total</span>',
            'parcial':     '<span class="badge badge-warning" title="Parte del equipo entregado">🚛 Parcial</span>',
            'sin_entrega': '<span class="badge badge-danger" title="0% entregado">🚛 Sin entrega</span>',
            'sin_items':   '<span class="badge badge-gray">🚛 Sin equipo</span>'
        };
        return map[estatus] || map['sin_entrega'];
    }

    function getBadgeRecoleccion(estatus) {
        const map = {
            'renovacion':      '<span class="badge badge-primary">🔄 Renovación</span>',
            'total':           '<span class="badge badge-success" title="Equipo recolectado al 100%">📥 Total</span>',
            'parcial':         '<span class="badge badge-warning" title="Recolección parcial">📥 Parcial</span>',
            'sin_recoleccion': '<span class="badge badge-danger" title="Sin recolectar aún">📥 Pendiente</span>',
            'sin_items':       '<span class="badge badge-gray">📥 Sin equipo</span>'
        };
        return map[estatus] || map['sin_recoleccion'];
    }

    // ── Comparación de folios ────────────────────────────
    function folioIgual(a, b) {
        return String(a || '').trim() === String(b || '').trim();
    }

    // ── Normalización de texto (para búsquedas) ─────────
    function normalizarTexto(valor) {
        return (valor || '')
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    // ── Truncar texto ────────────────────────────────────
    function truncar(str, n) {
        if (!str) return '—';
        return str.length > n ? str.slice(0, n) + '…' : str;
    }

    // ── Obtener contratos con items (helpers para HS/HE) ─
    async function obtenerContratosConItems() {
        const contratos = (await DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false })) || [];
        return contratos;
    }

    // ── API Pública ──────────────────────────────────────
    return {
        // Seguridad
        escapeHtml,
        // Fechas
        fmtFecha,
        hoyISO,
        diasRestantes,
        colorVencimiento,
        // Badges
        badgeTipoContrato,
        badgeEstatusContrato,
        badgePago,
        // Logística
        calcularEstatusEntrega,
        calcularEstatusRecoleccion,
        getBadgeEntrega,
        getBadgeRecoleccion,
        // Texto
        folioIgual,
        normalizarTexto,
        truncar,
        // Datos
        obtenerContratosConItems,
    };
})();
