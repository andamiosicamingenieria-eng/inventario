/**
 * INVENTARIO-CONTRATOS — Utilidades comunes
 */
export const Utils = {
    escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = String(text ?? '');
        return d.innerHTML;
    },
    fmtFecha(dateStr) {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    },
    hoyISO() { return new Date().toISOString().split('T')[0]; },
    fmtMoney(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }); },
    fmtNum(n) { return Number(n || 0).toLocaleString('es-MX'); },
    badge(text, cls) { return `<span class="badge ${cls}">${Utils.escapeHtml(text)}</span>`; },
    badgeEstatus(e) {
        const m = { activo: 'badge-success', entrega_parcial: 'badge-warning', recolectado: 'badge-info', cancelado: 'badge-danger', finalizado: 'badge-gray' };
        return Utils.badge((e || '—').replace(/_/g, ' '), m[e] || 'badge-gray');
    },
};
