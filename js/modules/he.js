/**
 * Módulo Hojas de Entrada (he + he_items)
 * Recolecciones de material desde obra. Trigger en BD actualiza inventario.
 */
import { DB } from '../supabase-client.js';
import { Utils } from '../utils.js';
import { ModContratos } from './contratos.js';

export const ModHE = (() => {
    let heData = [];
    let filtro = '';
    let expandedId = null;

    async function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="he-search" type="text" placeholder="Folio, contrato, cliente…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-primary" id="btn-nueva-he">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva Hoja de Entrada
                </button>
            </div>
        </div>
        <div class="table-wrapper">
            <table><thead><tr>
                <th>Folio HE</th><th>Contrato</th><th>Cliente</th><th>Obra</th>
                <th>Fecha</th><th>Piezas</th><th>Estatus</th><th></th>
            </tr></thead>
            <tbody id="he-tbody"><tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr></tbody>
            </table>
        </div>`;
        document.getElementById('he-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('btn-nueva-he').addEventListener('click', () => abrirModal());
        await cargarHE();
    }

    async function cargarHE() {
        const [raw, rawItems] = await Promise.all([
            DB.getAll('he', { orderBy: 'id', ascending: false }),
            DB.getAll('he_items')
        ]);
        const itemsMap = {};
        (rawItems || []).forEach(it => {
            if (!itemsMap[it.he_id]) itemsMap[it.he_id] = [];
            itemsMap[it.he_id].push(it);
        });
        heData = (raw || []).map(h => ({ ...h, items: itemsMap[h.id] || [] }));
        renderTabla();
    }

    function renderTabla() {
        const tbody = document.getElementById('he-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        const d = heData.filter(h =>
            (h.folio || '').toLowerCase().includes(f) ||
            String(h.numero_contrato).includes(f) ||
            (h.cliente || '').toLowerCase().includes(f)
        );
        if (!d.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><h3>Sin Hojas de Entrada</h3><p>Registra la primera recolección de equipo.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = d.map(h => {
            const isExp = expandedId === h.id;
            let html = `<tr onclick="ModHE.toggleExp(${h.id})" class="${isExp?'row-expanded':''}" style="cursor:pointer">
                <td class="td-mono">${h.folio}</td>
                <td class="td-mono">${h.numero_contrato}</td>
                <td><strong style="color:var(--text-main);font-size:0.8rem">${Utils.escapeHtml(h.cliente||'—')}</strong></td>
                <td style="font-size:0.8rem">${Utils.escapeHtml(h.obra||'—')}</td>
                <td>${Utils.fmtFecha(h.fecha)}</td>
                <td class="td-mono">${h.total_piezas||0} pzas</td>
                <td><span class="badge badge-info">${h.estatus||'recibido'}</span></td>
                <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();ModHE.verDetalle(${h.id})">🔍</button></td>
            </tr>`;
            if (isExp) {
                html += `<tr class="detail-row"><td colspan="8"><div class="expand-detail-panel">
                    <div class="expand-detail-title">📥 Detalle de Recolección</div>
                    <table class="items-table-mini"><thead><tr><th>SKU</th><th>Descripción</th><th>Recolectado</th><th>Estado</th></tr></thead>
                    <tbody>${(h.items||[]).map(it => `<tr><td class="td-mono">${it.sku}</td><td>${Utils.escapeHtml(it.descripcion||'—')}</td><td class="td-mono">${it.cantidad_recolectada}</td><td><span class="badge badge-gray">${(it.estado||'—').replace(/_/g,' ')}</span></td></tr>`).join('')}</tbody></table>
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

        const ov = document.createElement('div');
        ov.className = 'modal-overlay'; ov.id = 'modal-he';
        ov.innerHTML = `
        <div class="modal modal-xl">
            <div class="modal-header">
                <div><div class="modal-title">Nueva Hoja de Entrada</div>
                <div class="modal-subtitle">Recolección de equipo — regresa al almacén</div></div>
                <button class="modal-close" onclick="document.getElementById('modal-he').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row cols-3">
                    <div class="form-group"><label class="form-label">Folio HE</label>
                        <input id="he-folio" class="form-control td-mono" value="${folio}" readonly style="background:var(--bg-elevated)"></div>
                    <div class="form-group"><label class="form-label">Contrato <span class="required">*</span></label>
                        <select id="he-contrato" class="form-control">
                            <option value="">— Selecciona contrato —</option>
                            ${contratos.map(c => `<option value="${c.numero_contrato}" ${preselContrato==c.numero_contrato?'selected':''}>${c.numero_contrato} — ${c.cliente}</option>`).join('')}
                        </select></div>
                    <div class="form-group"><label class="form-label">Fecha</label>
                        <input id="he-fecha" type="date" class="form-control" value="${Utils.hoyISO()}"></div>
                </div>
                <div class="alert alert-success"><span>El equipo recolectado se sumará al inventario disponible automáticamente.</span></div>
                <div id="he-items-zona" style="display:none">
                    <div style="font-weight:700;margin-bottom:.75rem">Piezas a Recolectar</div>
                    <table class="items-table-mini"><thead><tr>
                        <th>SKU</th><th>Descripción</th><th>En Campo</th><th>A Recolectar</th><th>Estado</th>
                    </tr></thead><tbody id="he-items-tbody"></tbody></table>
                </div>
                <div class="form-row cols-2 mt-4">
                    <div class="form-group"><label class="form-label">Operador / Chofer</label>
                        <input id="he-operador" class="form-control" placeholder="Nombre"></div>
                    <div class="form-group"><label class="form-label">Notas</label>
                        <textarea id="he-notas" class="form-control" placeholder="Observaciones…"></textarea></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-he').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-he">Guardar Hoja de Entrada</button>
            </div>
        </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.getElementById('he-contrato').addEventListener('change', e => cargarItemsContratoHE(parseInt(e.target.value)));
        if (preselContrato) cargarItemsContratoHE(preselContrato);
        document.getElementById('btn-guardar-he').addEventListener('click', guardarHE);
    }

    async function cargarItemsContratoHE(numContrato) {
        if (!numContrato) return;
        const cItems = ModContratos.getItems(numContrato);
        const zona = document.getElementById('he-items-zona');
        const tbody = document.getElementById('he-items-tbody');
        if (!cItems.length) { zona.style.display = 'none'; return; }
        zona.style.display = 'block';

        // Calcular en campo: sum(hs_items) - sum(he_items)
        const [allHS, allHSi, allHEi] = await Promise.all([
            DB.getAll('hs', { eq: { numero_contrato: numContrato } }),
            DB.getAll('hs_items'),
            DB.getAll('he_items')
        ]);
        const hsIds = new Set((allHS || []).map(h => h.id));
        const heIds = new Set(heData.filter(h => h.numero_contrato === numContrato).map(h => h.id));

        const entMap = {}, recMap = {};
        (allHSi || []).filter(it => hsIds.has(it.hs_id)).forEach(it => { entMap[it.sku] = (entMap[it.sku] || 0) + Number(it.cantidad); });
        (allHEi || []).filter(it => heIds.has(it.he_id)).forEach(it => { recMap[it.sku] = (recMap[it.sku] || 0) + Number(it.cantidad_recolectada); });

        tbody.innerHTML = cItems.map((it, i) => {
            const enCampo = Math.max(0, (entMap[it.sku] || 0) - (recMap[it.sku] || 0));
            return `<tr>
                <td class="td-mono">${it.sku}</td><td>${Utils.escapeHtml(it.descripcion||'—')}</td>
                <td class="td-mono" style="font-weight:700;color:${enCampo>0?'var(--primary)':'var(--text-muted)'}">${enCampo}</td>
                <td><input type="number" class="form-control he-cant" data-sku="${it.sku}" data-desc="${it.descripcion||''}" min="0" max="${enCampo}" value="${enCampo}" style="width:80px;font-size:0.78rem" ${enCampo===0?'disabled':''}></td>
                <td><select class="form-control he-estado" style="font-size:0.78rem" ${enCampo===0?'disabled':''}>
                    <option value="pendiente_clasificacion">⏳ Pend. Clasif.</option>
                    <option value="limpio_funcional">✅ Limpio</option>
                    <option value="sucio_funcional">🔧 Sucio</option>
                    <option value="chatarra">❌ Chatarra</option>
                </select></td>
            </tr>`;
        }).join('');
    }

    async function guardarHE() {
        const numContrato = parseInt(document.getElementById('he-contrato').value);
        if (!numContrato) { App.toast('Selecciona un contrato', 'danger'); return; }
        const contrato = ModContratos.getContratos().find(c => c.numero_contrato === numContrato);

        const itemsToSave = [];
        document.querySelectorAll('.he-cant').forEach((inp, i) => {
            const val = parseInt(inp.value) || 0;
            const sel = document.querySelectorAll('.he-estado')[i];
            if (val > 0) itemsToSave.push({ sku: inp.dataset.sku, descripcion: inp.dataset.desc, cantidad_recolectada: val, estado: sel?.value || 'pendiente_clasificacion' });
        });
        if (!itemsToSave.length) { App.toast('No hay piezas para recolectar', 'warning'); return; }

        const he = {
            folio: document.getElementById('he-folio').value,
            numero_contrato: numContrato,
            cliente: contrato?.cliente || '',
            obra: contrato?.obra || '',
            fecha: document.getElementById('he-fecha').value,
            total_piezas: itemsToSave.reduce((s, i) => s + i.cantidad_recolectada, 0),
            estatus: 'recibido',
            operador: document.getElementById('he-operador').value.trim() || null,
            notas: document.getElementById('he-notas').value.trim() || null,
        };
        const res = await DB.insert('he', he);
        if (res.error) { App.toast('Error: ' + res.error, 'danger'); return; }

        for (const it of itemsToSave) {
            await DB.insert('he_items', { he_id: res.id, sku: it.sku, descripcion: it.descripcion, cantidad_recolectada: it.cantidad_recolectada, estado: it.estado });
        }

        document.getElementById('modal-he').remove();
        App.toast(`HE ${he.folio} registrada — inventario actualizado`, 'success');
        await cargarHE();
    }

    function verDetalle(heId) {
        const h = heData.find(x => x.id === heId);
        if (!h) return;
        const ov = document.createElement('div');
        ov.className = 'modal-overlay'; ov.id = 'modal-he-det';
        ov.innerHTML = `<div class="modal modal-lg">
            <div class="modal-header"><div><div class="modal-title">HE — ${h.folio}</div>
            <div class="modal-subtitle">${Utils.escapeHtml(h.cliente)} | Contrato: ${h.numero_contrato}</div></div>
            <button class="modal-close" onclick="document.getElementById('modal-he-det').remove()">✕</button></div>
            <div class="modal-body">
                <div class="form-row cols-3 mb-4">
                    <div><span class="stat-label">Fecha</span><div>${Utils.fmtFecha(h.fecha)}</div></div>
                    <div><span class="stat-label">Obra</span><div>${Utils.escapeHtml(h.obra||'—')}</div></div>
                    <div><span class="stat-label">Piezas</span><div class="td-mono">${h.total_piezas}</div></div>
                </div>
                <table class="items-table-mini"><thead><tr><th>SKU</th><th>Descripción</th><th>Recolectado</th><th>Estado</th></tr></thead>
                <tbody>${(h.items||[]).map(i => `<tr><td class="td-mono">${i.sku}</td><td>${Utils.escapeHtml(i.descripcion||'—')}</td><td class="td-mono">${i.cantidad_recolectada}</td><td><span class="badge badge-gray">${(i.estado||'—').replace(/_/g,' ')}</span></td></tr>`).join('')}</tbody></table>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById('modal-he-det').remove()">Cerrar</button></div>
        </div>`;
        document.body.appendChild(ov);
    }

    async function nextFolio() {
        const rows = (await DB.getAll('he', { orderBy: 'id', ascending: false })) || [];
        let max = 0;
        rows.forEach(r => { const m = String(r.folio||'').match(/^HE-(\d+)$/); if (m) max = Math.max(max, parseInt(m[1])); });
        return `HE-${String(max + 1).padStart(3, '0')}`;
    }

    function abrirDesdeContrato(n) { abrirModal(n); }

    return { render, toggleExp, verDetalle, abrirDesdeContrato };
})();
