/**
 * Módulo Contratos — Solo lectura (datos del macro VBA)
 * Tablas: contratos, contratos_items
 */
import { DB } from '../supabase-client.js';
import { Utils } from '../utils.js';

export const ModContratos = (() => {
    let data = [];
    let items = {};
    let filtro = '';
    let expandedId = null;

    async function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="c-search" type="text" placeholder="Folio, cliente, obra…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <span class="badge badge-info">📊 Datos del Macro Excel</span>
            </div>
        </div>
        <div class="table-wrapper">
            <table><thead><tr>
                <th>Folio</th><th>Cliente</th><th>Obra</th><th>Sistema</th>
                <th>Días</th><th>Subtotal</th><th>Tipo</th><th>Fecha</th>
            </tr></thead>
            <tbody id="c-tbody"><tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr></tbody>
            </table>
        </div>`;
        document.getElementById('c-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        await cargar();
    }

    async function cargar() {
        const [raw, rawItems] = await Promise.all([
            DB.getAll('contratos', { orderBy: 'numero_contrato', ascending: false }),
            DB.getAll('contratos_items')
        ]);
        data = raw || [];
        items = {};
        (rawItems || []).forEach(it => {
            if (!items[it.numero_contrato]) items[it.numero_contrato] = [];
            items[it.numero_contrato].push(it);
        });
        renderTabla();
    }

    function renderTabla() {
        const tbody = document.getElementById('c-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        const filtered = data.filter(c =>
            String(c.numero_contrato).includes(f) ||
            (c.cliente || '').toLowerCase().includes(f) ||
            (c.obra || '').toLowerCase().includes(f)
        );
        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><h3>Sin contratos</h3><p>Los datos llegarán del macro de Excel.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = filtered.map(c => {
            const row = `<tr class="cont-row" data-id="${c.id}" style="cursor:pointer">
                <td class="td-mono">${c.numero_contrato}</td>
                <td><strong style="color:var(--text-main)">${Utils.escapeHtml(c.cliente)}</strong></td>
                <td style="font-size:0.8rem">${Utils.escapeHtml(c.obra || '—')}</td>
                <td style="font-size:0.8rem">${Utils.escapeHtml(c.sistema || '—')}</td>
                <td class="td-mono">${c.dias_renta || '—'}</td>
                <td class="td-mono">${Utils.fmtMoney((c.subtotal||0)+(c.iva||0))}</td>
                <td>${Utils.badgeEstatus(c.estatus)}</td>
                <td style="font-size:0.8rem">${Utils.fmtFecha(c.fecha_inicio_renta)}</td>
            </tr>`;
            const detail = expandedId === c.id ? renderDetalle(c) : '';
            return row + detail;
        }).join('');

        document.querySelectorAll('.cont-row').forEach(r => {
            r.addEventListener('click', () => {
                expandedId = expandedId === parseInt(r.dataset.id) ? null : parseInt(r.dataset.id);
                renderTabla();
            });
        });
    }

    function renderDetalle(c) {
        const its = items[c.numero_contrato] || [];
        return `<tr class="detail-row"><td colspan="8"><div class="expand-detail-panel">
            <div class="form-row cols-3" style="margin-bottom:1rem">
                <div><span class="stat-label">Cliente</span><div>${Utils.escapeHtml(c.cliente)}</div></div>
                <div><span class="stat-label">Encargado</span><div>${Utils.escapeHtml(c.encargado || '—')}</div></div>
                <div><span class="stat-label">Vendedor</span><div>V${c.vendedor || '—'}</div></div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:1rem">
                <div><span class="stat-label">Sucursal</span><div>${Utils.escapeHtml(c.sucursal || '—')}</div></div>
                <div><span class="stat-label">Teléfono</span><div>${Utils.escapeHtml(c.telefono || '—')}</div></div>
                <div><span class="stat-label">Forma de Pago</span><div>${Utils.escapeHtml(c.forma_pago || '—')}</div></div>
            </div>
            <div class="expand-detail-title">📦 Ítems del Contrato (${its.length})</div>
            <table class="items-table-mini"><thead><tr>
                <th>SKU</th><th>Descripción</th><th>Cantidad</th><th>Peso Unit.</th><th>Peso Total</th>
            </tr></thead><tbody>
                ${its.length ? its.map(i => `<tr>
                    <td class="td-mono">${Utils.escapeHtml(i.sku)}</td>
                    <td>${Utils.escapeHtml(i.descripcion || '—')}</td>
                    <td class="td-mono">${i.cantidad}</td>
                    <td class="td-mono">${i.peso_unitario || '—'}</td>
                    <td class="td-mono">${i.peso_total || '—'}</td>
                </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Sin ítems</td></tr>'}
            </tbody></table>
            <div class="flex gap-2 mt-4">
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();App.navigate('estado_cuenta','${c.numero_contrato}')">📊 Estado de Cuenta</button>
                <button class="btn btn-success btn-sm" onclick="event.stopPropagation();ModHS.abrirDesdeContrato(${c.numero_contrato})">🚛 + HS</button>
                <button class="btn btn-info btn-sm" onclick="event.stopPropagation();ModHE.abrirDesdeContrato(${c.numero_contrato})">📥 + HE</button>
            </div>
        </div></td></tr>`;
    }

    function getContratos() { return data; }
    function getItems(numContrato) { return items[numContrato] || []; }

    return { render, getContratos, getItems, cargar };
})();
