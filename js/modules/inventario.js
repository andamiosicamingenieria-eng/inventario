/**
 * Módulo Inventario — Stock global por SKU
 * Datos auto-actualizados por triggers (hs_items / he_items)
 * Soporta ajustes manuales / conteos cíclicos
 */
import { DB } from '../supabase-client.js';
import { Utils } from '../utils.js';

export const ModInventario = (() => {
    let inventario = [];
    let filtro = '';

    async function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="inv-search" type="text" placeholder="Buscar SKU o descripción…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-secondary" id="btn-inv-excel">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Exportar Excel
                </button>
                <button class="btn btn-primary" id="btn-ajuste">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Conteo / Ajuste Manual
                </button>
            </div>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon" style="background:var(--success-light);color:var(--success)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
            </div><div class="stat-label">Disponible</div><div class="stat-value" id="kpi-disp">—</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:var(--info-light);color:var(--info)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/></svg>
            </div><div class="stat-label">En Obra</div><div class="stat-value" id="kpi-obra">—</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:var(--warning-light);color:var(--warning)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div><div class="stat-label">Mantenimiento</div><div class="stat-value" id="kpi-mto">—</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:var(--danger-light);color:var(--danger)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </div><div class="stat-label">Chatarra</div><div class="stat-value" id="kpi-chat">—</div></div>
        </div>
        <div class="table-wrapper">
            <table><thead><tr>
                <th>SKU</th><th>Descripción</th><th>Disponible</th><th>En Obra</th>
                <th>Mantenimiento</th><th>Chatarra</th><th>Total</th><th>Uso %</th>
            </tr></thead>
            <tbody id="inv-tbody"><tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr></tbody>
            </table>
        </div>`;
        document.getElementById('inv-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('btn-ajuste').addEventListener('click', abrirAjuste);
        document.getElementById('btn-inv-excel').addEventListener('click', exportarExcel);
        await cargar();
    }

    async function cargar() {
        inventario = (await DB.getAll('inventario', { orderBy: 'sku' })) || [];
        renderKPIs();
        renderTabla();
    }

    function renderKPIs() {
        const sum = (f) => inventario.reduce((s, i) => s + Number(i[f] || 0), 0);
        const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = Utils.fmtNum(v); };
        el('kpi-disp', sum('cantidad_disponible'));
        el('kpi-obra', sum('cantidad_en_obra'));
        el('kpi-mto', sum('cantidad_mantenimiento'));
        el('kpi-chat', sum('cantidad_chatarra'));
    }

    function renderTabla() {
        const tbody = document.getElementById('inv-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        const d = inventario.filter(i => (i.sku||'').toLowerCase().includes(f) || (i.descripcion||'').toLowerCase().includes(f));
        if (!d.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><h3>Sin registros</h3><p>El inventario se crea automáticamente al registrar HS/HE, o con un ajuste manual.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = d.map(i => {
            const disp = Number(i.cantidad_disponible||0), obra = Number(i.cantidad_en_obra||0);
            const mto = Number(i.cantidad_mantenimiento||0), chat = Number(i.cantidad_chatarra||0);
            const total = disp + obra + mto + chat;
            const uso = total > 0 ? Math.round((obra / total) * 100) : 0;
            const cls = uso >= 80 ? 'high' : uso >= 50 ? 'mid' : 'low';
            return `<tr>
                <td class="td-mono">${Utils.escapeHtml(i.sku)}</td>
                <td><strong style="color:var(--text-main)">${Utils.escapeHtml(i.descripcion||'—')}</strong></td>
                <td><span style="color:var(--success);font-weight:700">${disp}</span></td>
                <td><span style="color:var(--info);font-weight:700">${obra}</span></td>
                <td><span style="color:var(--warning);font-weight:700">${mto}</span></td>
                <td><span style="color:var(--danger);font-weight:700">${chat}</span></td>
                <td class="td-mono">${total}</td>
                <td style="min-width:120px"><div class="flex items-center gap-2">
                    <div class="progress-bar-container" style="flex:1"><div class="progress-bar ${cls}" style="width:${uso}%"></div></div>
                    <span style="font-size:0.75rem;font-weight:600;color:var(--text-muted)">${uso}%</span>
                </div></td>
            </tr>`;
        }).join('');
    }

    function abrirAjuste() {
        const ov = document.createElement('div');
        ov.className = 'modal-overlay'; ov.id = 'modal-ajuste';
        ov.innerHTML = `<div class="modal modal-md">
            <div class="modal-header"><div><div class="modal-title">Conteo Cíclico / Ajuste Manual</div>
            <div class="modal-subtitle">Corrección directa de cantidades en almacén</div></div>
            <button class="modal-close" onclick="document.getElementById('modal-ajuste').remove()">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label class="form-label">SKU <span class="required">*</span></label>
                    <input id="aj-sku-search" class="form-control" placeholder="Buscar SKU…" autocomplete="off">
                    <select id="aj-sku" class="form-control" style="margin-top:0.5rem">
                        <option value="">— Selecciona SKU —</option>
                        ${inventario.map(i => `<option value="${i.sku}">${i.sku} — ${i.descripcion||'Sin desc.'}</option>`).join('')}
                    </select>
                    <div class="alert alert-info mt-2"><span>Si el SKU no existe aún, escríbelo directamente en el campo de búsqueda.</span></div>
                </div>
                <div class="form-group"><label class="form-label">Descripción</label>
                    <input id="aj-desc" class="form-control" placeholder="Descripción del producto"></div>
                <div class="form-row cols-2">
                    <div class="form-group"><label class="form-label">Campo</label>
                        <select id="aj-campo" class="form-control">
                            <option value="cantidad_disponible">Disponible</option>
                            <option value="cantidad_en_obra">En Obra</option>
                            <option value="cantidad_mantenimiento">Mantenimiento</option>
                            <option value="cantidad_chatarra">Chatarra</option>
                        </select></div>
                    <div class="form-group"><label class="form-label">Nueva Cantidad</label>
                        <input id="aj-cant" type="number" class="form-control" placeholder="0" min="0"></div>
                </div>
                <div class="form-group"><label class="form-label">Motivo <span class="required">*</span></label>
                    <textarea id="aj-motivo" class="form-control" placeholder="Razón del ajuste…"></textarea></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-ajuste').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-apply-aj">Aplicar Ajuste</button>
            </div>
        </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });

        document.getElementById('aj-sku-search').addEventListener('input', e => {
            const txt = e.target.value.toLowerCase();
            const sel = document.getElementById('aj-sku');
            const filtered = inventario.filter(i => (i.sku||'').toLowerCase().includes(txt) || (i.descripcion||'').toLowerCase().includes(txt));
            sel.innerHTML = `<option value="">— Selecciona —</option>${filtered.map(i => `<option value="${i.sku}">${i.sku} — ${i.descripcion||''}</option>`).join('')}`;
            if (filtered.length === 1) { sel.value = filtered[0].sku; document.getElementById('aj-desc').value = filtered[0].descripcion || ''; }
        });
        document.getElementById('aj-sku').addEventListener('change', e => {
            const item = inventario.find(i => i.sku === e.target.value);
            if (item) document.getElementById('aj-desc').value = item.descripcion || '';
        });
        document.getElementById('btn-apply-aj').addEventListener('click', aplicarAjuste);
    }

    async function aplicarAjuste() {
        const selSku = document.getElementById('aj-sku').value;
        const searchSku = document.getElementById('aj-sku-search').value.trim();
        const sku = selSku || searchSku;
        const desc = document.getElementById('aj-desc').value.trim();
        const campo = document.getElementById('aj-campo').value;
        const cant = parseInt(document.getElementById('aj-cant').value);
        const motivo = document.getElementById('aj-motivo').value.trim();

        if (!sku || !motivo) { App.toast('Completa SKU y motivo', 'danger'); return; }
        if (isNaN(cant) || cant < 0) { App.toast('Cantidad inválida', 'danger'); return; }

        const existing = inventario.find(i => i.sku === sku);
        if (existing) {
            await DB.update('inventario', existing.id, { [campo]: cant, descripcion: desc || existing.descripcion });
        } else {
            await DB.upsert('inventario', { sku, descripcion: desc, almacen: 'Principal', [campo]: cant }, 'sku,almacen');
        }

        document.getElementById('modal-ajuste').remove();
        App.toast(`Inventario ajustado: ${sku} → ${campo} = ${cant}`, 'success');
        await cargar();
    }

    function exportarExcel() {
        if (!window.XLSX) { App.toast('Librería Excel cargando…', 'warning'); return; }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['SKU', 'Descripción', 'Disponible', 'En Obra', 'Mantenimiento', 'Chatarra', 'Total'],
            ...inventario.map(i => {
                const t = Number(i.cantidad_disponible||0)+Number(i.cantidad_en_obra||0)+Number(i.cantidad_mantenimiento||0)+Number(i.cantidad_chatarra||0);
                return [i.sku, i.descripcion, i.cantidad_disponible||0, i.cantidad_en_obra||0, i.cantidad_mantenimiento||0, i.cantidad_chatarra||0, t];
            })
        ]);
        ws['!cols'] = [{wch:14},{wch:35},{wch:12},{wch:10},{wch:14},{wch:10},{wch:10}];
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
        XLSX.writeFile(wb, `Inventario_${Utils.hoyISO()}.xlsx`);
        App.toast('Excel descargado', 'success');
    }

    return { render };
})();
