/**
 * Módulo Hojas de Salida (hs + hs_items)
 * Entregas de material a obra. Trigger en BD actualiza inventario.
 */
import { DB } from '../supabase-client.js';
import { Utils } from '../utils.js';
import { ModContratos } from './contratos.js';

export const ModHS = (() => {
    let hsData = [];
    let filtro = '';
    let expandedId = null;

    async function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="hs-search" type="text" placeholder="Folio, contrato, cliente…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-primary" id="btn-nueva-hs">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva Hoja de Salida
                </button>
            </div>
        </div>
        <div class="table-wrapper">
            <table><thead><tr>
                <th>Folio HS</th><th>Contrato</th><th>Cliente</th><th>Obra</th>
                <th>Fecha</th><th>Piezas</th><th>Estatus</th><th></th>
            </tr></thead>
            <tbody id="hs-tbody"><tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr></tbody>
            </table>
        </div>`;
        document.getElementById('hs-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('btn-nueva-hs').addEventListener('click', () => abrirModal());
        await cargarHS();
    }

    async function cargarHS() {
        const [raw, rawItems] = await Promise.all([
            DB.getAll('hs', { orderBy: 'id', ascending: false }),
            DB.getAll('hs_items')
        ]);
        const itemsMap = {};
        (rawItems || []).forEach(it => {
            if (!itemsMap[it.hs_id]) itemsMap[it.hs_id] = [];
            itemsMap[it.hs_id].push(it);
        });
        hsData = (raw || []).map(h => ({ ...h, items: itemsMap[h.id] || [] }));
        renderTabla();
    }

    function renderTabla() {
        const tbody = document.getElementById('hs-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        const d = hsData.filter(h =>
            (h.folio || '').toLowerCase().includes(f) ||
            String(h.numero_contrato).includes(f) ||
            (h.cliente || '').toLowerCase().includes(f)
        );
        if (!d.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><h3>Sin Hojas de Salida</h3><p>Crea la primera HS para registrar una entrega.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = d.map(h => {
            const isExp = expandedId === h.id;
            let html = `<tr onclick="ModHS.toggleExp(${h.id})" class="${isExp ? 'row-expanded' : ''}" style="cursor:pointer">
                <td class="td-mono">${h.folio}</td>
                <td class="td-mono">${h.numero_contrato}</td>
                <td><strong style="color:var(--text-main);font-size:0.8rem">${Utils.escapeHtml(h.cliente || '—')}</strong></td>
                <td style="font-size:0.8rem">${Utils.escapeHtml(h.obra || '—')}</td>
                <td>${Utils.fmtFecha(h.fecha)}</td>
                <td class="td-mono">${h.total_piezas || 0} pzas</td>
                <td><span class="badge badge-success">${h.estatus || 'entregado'}</span></td>
                <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();ModHS.verDetalle(${h.id})">🔍</button></td>
            </tr>`;
            if (isExp) {
                html += `<tr class="detail-row"><td colspan="8"><div class="expand-detail-panel">
                    <div class="expand-detail-title">📦 Despiece de Salida</div>
                    <table class="items-table-mini"><thead><tr><th>SKU</th><th>Descripción</th><th>Cantidad</th></tr></thead>
                    <tbody>${(h.items||[]).map(it => `<tr><td class="td-mono">${it.sku}</td><td>${Utils.escapeHtml(it.descripcion||'—')}</td><td class="td-mono">${it.cantidad}</td></tr>`).join('')}</tbody></table>
                </div></td></tr>`;
            }
            return html;
        }).join('');
    }

    function toggleExp(id) { expandedId = expandedId === id ? null : id; renderTabla(); }

    async function abrirModal(preselContrato = null) {
        if (ModContratos.getContratos().length === 0) await ModContratos.cargar();
        const contratos = ModContratos.getContratos().filter(c => c.estatus === 'activo');
        const folio = await nextFolio();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-hs';
        overlay.innerHTML = `
        <div class="modal modal-xl">
            <div class="modal-header">
                <div><div class="modal-title">Nueva Hoja de Salida</div>
                <div class="modal-subtitle">Entrega de material a obra</div></div>
                <button class="modal-close" onclick="document.getElementById('modal-hs').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row cols-3">
                    <div class="form-group"><label class="form-label">Folio HS</label>
                        <input id="hs-folio" class="form-control td-mono" value="${folio}" readonly style="background:var(--bg-elevated)"></div>
                    <div class="form-group"><label class="form-label">Contrato <span class="required">*</span></label>
                        <select id="hs-contrato" class="form-control">
                            <option value="">— Selecciona contrato —</option>
                            ${contratos.map(c => `<option value="${c.numero_contrato}" ${preselContrato==c.numero_contrato?'selected':''}>${c.numero_contrato} — ${c.cliente}</option>`).join('')}
                        </select></div>
                    <div class="form-group"><label class="form-label">Fecha de Salida</label>
                        <input id="hs-fecha" type="date" class="form-control" value="${Utils.hoyISO()}"></div>
                </div>
                <div class="alert alert-info"><span>Selecciona un contrato para cargar sus ítems pendientes de entrega.</span></div>
                <div id="hs-items-zona" style="display:none">
                    <div style="font-weight:700;margin-bottom:.75rem">Piezas a Entregar</div>
                    <table class="items-table-mini"><thead><tr>
                        <th>SKU</th><th>Descripción</th><th>Contratado</th><th>Ya Entregado</th><th>Pendiente</th><th>Stock Disp.</th><th>A Entregar</th>
                    </tr></thead><tbody id="hs-items-tbody"></tbody></table>
                </div>
                <div class="form-group mt-4"><label class="form-label">Notas</label>
                    <textarea id="hs-notas" class="form-control" placeholder="Observaciones…"></textarea></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-hs').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-hs">Guardar Hoja de Salida</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('hs-contrato').addEventListener('change', e => cargarItemsContrato(parseInt(e.target.value)));
        if (preselContrato) cargarItemsContrato(preselContrato);
        document.getElementById('btn-guardar-hs').addEventListener('click', guardarHS);
    }

    async function cargarItemsContrato(numContrato) {
        if (!numContrato) return;
        const cItems = ModContratos.getItems(numContrato);
        const zona = document.getElementById('hs-items-zona');
        const tbody = document.getElementById('hs-items-tbody');
        if (!cItems.length) { zona.style.display = 'none'; return; }
        zona.style.display = 'block';

        // Calcular ya entregado
        const allHsItems = [];
        hsData.filter(h => h.numero_contrato === numContrato).forEach(h => (h.items||[]).forEach(it => allHsItems.push(it)));
        const entregadoMap = {};
        allHsItems.forEach(it => { entregadoMap[it.sku] = (entregadoMap[it.sku] || 0) + Number(it.cantidad || 0); });

        // Stock disponible
        const inv = (await DB.getAll('inventario')) || [];
        const stockMap = {};
        inv.forEach(i => { stockMap[i.sku] = Number(i.cantidad_disponible || 0); });

        tbody.innerHTML = cItems.map((it, i) => {
            const yaEnt = entregadoMap[it.sku] || 0;
            const pend = Math.max(0, Number(it.cantidad) - yaEnt);
            const stock = stockMap[it.sku] || 0;
            const sugerido = Math.min(pend, stock);
            return `<tr>
                <td class="td-mono">${it.sku}</td><td>${Utils.escapeHtml(it.descripcion||'—')}</td>
                <td class="td-mono">${it.cantidad}</td><td class="td-mono">${yaEnt}</td>
                <td class="td-mono" style="font-weight:700;color:${pend>0?'var(--warning)':'var(--success)'}">${pend}</td>
                <td class="td-mono"><span class="badge ${stock<pend?'badge-danger':'badge-success'}">${stock}</span></td>
                <td><input type="number" class="form-control hs-cant" data-idx="${i}" data-sku="${it.sku}" data-desc="${it.descripcion||''}" data-max="${pend}" data-stock="${stock}" value="${sugerido}" min="0" max="${Math.min(pend,stock)}" style="width:80px;font-size:0.78rem" ${pend===0?'disabled':''}></td>
            </tr>`;
        }).join('');
    }

    async function guardarHS() {
        const numContrato = parseInt(document.getElementById('hs-contrato').value);
        if (!numContrato) { App.toast('Selecciona un contrato', 'danger'); return; }

        const contrato = ModContratos.getContratos().find(c => c.numero_contrato === numContrato);
        const itemsToSave = [];
        document.querySelectorAll('.hs-cant').forEach(inp => {
            const val = parseInt(inp.value) || 0;
            if (val > 0) {
                if (val > parseInt(inp.dataset.stock)) { App.toast('Cantidad supera stock en ' + inp.dataset.sku, 'danger'); return; }
                itemsToSave.push({ sku: inp.dataset.sku, descripcion: inp.dataset.desc, cantidad: val });
            }
        });
        if (!itemsToSave.length) { App.toast('No hay piezas para entregar', 'warning'); return; }

        const hs = {
            folio: document.getElementById('hs-folio').value,
            numero_contrato: numContrato,
            cliente: contrato?.cliente || '',
            obra: contrato?.obra || '',
            fecha: document.getElementById('hs-fecha').value,
            total_piezas: itemsToSave.reduce((s, i) => s + i.cantidad, 0),
            estatus: 'entregado',
            notas: document.getElementById('hs-notas').value.trim() || null,
        };
        const res = await DB.insert('hs', hs);
        if (res.error) { App.toast('Error: ' + res.error, 'danger'); return; }

        // Insertar items (triggers en BD actualizan inventario)
        for (const it of itemsToSave) {
            await DB.insert('hs_items', { hs_id: res.id, sku: it.sku, descripcion: it.descripcion, cantidad: it.cantidad });
        }

        document.getElementById('modal-hs').remove();
        App.toast(`HS ${hs.folio} registrada — inventario actualizado`, 'success');
        await cargarHS();
    }

    function verDetalle(hsId) {
        const h = hsData.find(x => x.id === hsId);
        if (!h) return;
        const ov = document.createElement('div');
        ov.className = 'modal-overlay'; ov.id = 'modal-hs-det';
        ov.innerHTML = `<div class="modal modal-lg">
            <div class="modal-header"><div><div class="modal-title">HS — ${h.folio}</div>
            <div class="modal-subtitle">${Utils.escapeHtml(h.cliente)} | Contrato: ${h.numero_contrato}</div></div>
            <button class="modal-close" onclick="document.getElementById('modal-hs-det').remove()">✕</button></div>
            <div class="modal-body">
                <div class="form-row cols-3 mb-4">
                    <div><span class="stat-label">Fecha</span><div>${Utils.fmtFecha(h.fecha)}</div></div>
                    <div><span class="stat-label">Obra</span><div>${Utils.escapeHtml(h.obra||'—')}</div></div>
                    <div><span class="stat-label">Piezas</span><div class="td-mono">${h.total_piezas}</div></div>
                </div>
                <table class="items-table-mini"><thead><tr><th>SKU</th><th>Descripción</th><th>Cantidad</th></tr></thead>
                <tbody>${(h.items||[]).map(i => `<tr><td class="td-mono">${i.sku}</td><td>${Utils.escapeHtml(i.descripcion||'—')}</td><td class="td-mono">${i.cantidad}</td></tr>`).join('')}</tbody></table>
                ${h.notas ? `<div class="alert alert-info mt-4"><span>${Utils.escapeHtml(h.notas)}</span></div>` : ''}
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById('modal-hs-det').remove()">Cerrar</button></div>
        </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }

    async function nextFolio() {
        const rows = (await DB.getAll('hs', { orderBy: 'id', ascending: false })) || [];
        let max = 0;
        rows.forEach(r => { const m = String(r.folio||'').match(/^HS-(\d+)$/); if (m) max = Math.max(max, parseInt(m[1])); });
        return `HS-${String(max + 1).padStart(3, '0')}`;
    }

    function abrirDesdeContrato(numContrato) { abrirModal(numContrato); }

    return { render, toggleExp, verDetalle, abrirDesdeContrato };
})();
