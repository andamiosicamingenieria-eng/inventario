/**
 * Módulo Estado de Cuenta — Desglose por obra/contrato
 * Muestra: contratado vs entregado vs recolectado vs en campo por SKU
 */
import { DB } from '../supabase-client.js';
import { Utils } from '../utils.js';

export const ModEstadoCuenta = (() => {
    let currentData = null;

    async function render(numContrato = null) {
        const mc = document.getElementById('module-content');

        if (!numContrato) {
            mc.innerHTML = `
            <div class="empty-state" style="max-width:500px;margin:4rem auto">
                <div style="font-size:4rem;margin-bottom:1.5rem">📊</div>
                <h3 style="font-size:1.5rem">Estado de Cuenta por Obra</h3>
                <p style="color:var(--text-secondary);margin-bottom:2rem">Ingresa el número de contrato para ver el desglose de equipo.</p>
                <div class="search-box no-border" style="background:var(--bg-alt);padding:0.5rem 1rem;border-radius:var(--radius);border:1px solid var(--border)">
                    <input id="ec-input" type="text" placeholder="Número de contrato (ej: 1234)" style="font-size:1.1rem;padding:0.75rem">
                    <button class="btn btn-primary" id="btn-ec-go">Consultar</button>
                </div>
            </div>`;
            document.getElementById('btn-ec-go').addEventListener('click', () => {
                const v = document.getElementById('ec-input').value.trim();
                if (v) App.navigate('estado_cuenta', v);
            });
            document.getElementById('ec-input').addEventListener('keypress', e => {
                if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) App.navigate('estado_cuenta', v); }
            });
            return;
        }

        mc.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
        const nc = parseInt(numContrato);

        // Cargar datos
        const [contratos, cItems, allHS, allHSi, allHE, allHEi] = await Promise.all([
            DB.getAll('contratos', { eq: { numero_contrato: nc } }),
            DB.getAll('contratos_items', { eq: { numero_contrato: nc } }),
            DB.getAll('hs', { eq: { numero_contrato: nc } }),
            DB.getAll('hs_items'),
            DB.getAll('he', { eq: { numero_contrato: nc } }),
            DB.getAll('he_items')
        ]);

        const contrato = (contratos || [])[0];
        if (!contrato) {
            mc.innerHTML = `<div class="container py-6">
                <div class="alert alert-danger">No se encontró el contrato: <strong>${nc}</strong></div>
                <button class="btn btn-secondary mt-4" onclick="App.navigate('estado_cuenta')">← Nueva Búsqueda</button>
            </div>`;
            return;
        }

        const items = cItems || [];
        const hsIds = new Set((allHS || []).map(h => h.id));
        const heIds = new Set((allHE || []).map(h => h.id));

        // Calcular despiece por SKU
        const despiece = {};
        items.forEach(it => {
            if (!despiece[it.sku]) despiece[it.sku] = { sku: it.sku, descripcion: it.descripcion, contratado: 0, entregado: 0, recolectado: 0 };
            despiece[it.sku].contratado += Number(it.cantidad || 0);
        });
        (allHSi || []).filter(it => hsIds.has(it.hs_id)).forEach(it => {
            if (!despiece[it.sku]) despiece[it.sku] = { sku: it.sku, descripcion: it.descripcion, contratado: 0, entregado: 0, recolectado: 0 };
            despiece[it.sku].entregado += Number(it.cantidad || 0);
        });
        (allHEi || []).filter(it => heIds.has(it.he_id)).forEach(it => {
            if (!despiece[it.sku]) despiece[it.sku] = { sku: it.sku, descripcion: it.descripcion, contratado: 0, entregado: 0, recolectado: 0 };
            despiece[it.sku].recolectado += Number(it.cantidad_recolectada || 0);
        });

        Object.values(despiece).forEach(d => { d.en_campo = d.entregado - d.recolectado; d.pend_entrega = d.contratado - d.entregado; });

        const totalContratado = Object.values(despiece).reduce((s, d) => s + d.contratado, 0);
        const totalEntregado = Object.values(despiece).reduce((s, d) => s + d.entregado, 0);
        const totalRecolectado = Object.values(despiece).reduce((s, d) => s + d.recolectado, 0);
        const totalEnCampo = totalEntregado - totalRecolectado;
        const importe = Number(contrato.subtotal || 0) + Number(contrato.iva || 0);

        currentData = { contrato, despiece, allHS: allHS || [], allHE: allHE || [] };

        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <button class="btn btn-secondary btn-sm" onclick="App.navigate('estado_cuenta')">← Nueva Búsqueda</button>
                <h2 style="margin:0 1rem;font-size:1.25rem">Contrato: <span style="color:var(--primary)">${nc}</span></h2>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-success" id="btn-ec-excel">📥 Exportar Excel</button>
            </div>
        </div>

        <div class="stats-grid mb-4">
            <div class="stat-card" style="border-left:4px solid var(--info)">
                <div class="stat-label">Cliente</div>
                <div class="stat-value" style="font-size:1rem">${Utils.escapeHtml(contrato.cliente)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${Utils.escapeHtml(contrato.obra || '—')}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--primary)">
                <div class="stat-label">Importe Total</div>
                <div class="stat-value">${Utils.fmtMoney(importe)}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--success)">
                <div class="stat-label">Pzas Entregadas</div>
                <div class="stat-value text-success">${totalEntregado} / ${totalContratado}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--danger)">
                <div class="stat-label">En Campo</div>
                <div class="stat-value text-danger">${totalEnCampo}</div>
            </div>
        </div>

        <div class="grid cols-2 gap-4">
            <div>
                <div class="section-header"><div class="section-title">📦 Despiece de Equipos</div></div>
                <div class="table-wrapper">
                    <table style="font-size:0.85rem"><thead><tr>
                        <th>SKU</th><th>Descripción</th><th>Contratado</th><th>Entregado</th><th>Recolectado</th><th>En Campo</th><th>Pend. Entrega</th>
                    </tr></thead><tbody>
                    ${Object.values(despiece).map(d => `<tr>
                        <td class="td-mono">${d.sku}</td>
                        <td>${Utils.escapeHtml(d.descripcion||'—')}</td>
                        <td class="text-center">${d.contratado}</td>
                        <td class="text-center text-info">${d.entregado}</td>
                        <td class="text-center text-success">${d.recolectado}</td>
                        <td class="text-center font-bold ${d.en_campo>0?'text-danger':'text-muted'}">${d.en_campo}</td>
                        <td class="text-center ${d.pend_entrega>0?'text-warning':''}">${d.pend_entrega}</td>
                    </tr>`).join('')}
                    </tbody></table>
                </div>
            </div>
            <div>
                <div class="section-header"><div class="section-title">📋 Datos del Contrato</div></div>
                <div class="estado-cuenta-box">
                    <div class="ec-row"><span>Sistema</span><strong>${Utils.escapeHtml(contrato.sistema||'—')}</strong></div>
                    <div class="ec-row"><span>Sucursal</span><strong>${Utils.escapeHtml(contrato.sucursal||'—')}</strong></div>
                    <div class="ec-row"><span>Encargado</span><strong>${Utils.escapeHtml(contrato.encargado||'—')}</strong></div>
                    <div class="ec-row"><span>Días de Renta</span><strong>${contrato.dias_renta||'—'}</strong></div>
                    <div class="ec-row"><span>Vendedor</span><strong>V${contrato.vendedor||'—'}</strong></div>
                    <div class="ec-row"><span>Subtotal</span><strong>${Utils.fmtMoney(contrato.subtotal)}</strong></div>
                    <div class="ec-row"><span>IVA</span><strong>${Utils.fmtMoney(contrato.iva)}</strong></div>
                    <div class="ec-row"><span><strong>Total</strong></span><strong>${Utils.fmtMoney(importe)}</strong></div>
                </div>

                <div class="section-header mt-4"><div class="section-title">🚛 Hojas de Salida (${(allHS||[]).length})</div></div>
                ${(allHS||[]).length ? `<div class="table-wrapper"><table style="font-size:0.8rem"><thead><tr><th>Folio</th><th>Fecha</th><th>Pzas</th></tr></thead><tbody>
                    ${(allHS||[]).map(h => `<tr><td class="td-mono">${h.folio}</td><td>${Utils.fmtFecha(h.fecha)}</td><td class="td-mono">${h.total_piezas}</td></tr>`).join('')}
                </tbody></table></div>` : '<p style="color:var(--text-muted);font-size:0.85rem">Sin hojas de salida</p>'}

                <div class="section-header mt-4"><div class="section-title">📥 Hojas de Entrada (${(allHE||[]).length})</div></div>
                ${(allHE||[]).length ? `<div class="table-wrapper"><table style="font-size:0.8rem"><thead><tr><th>Folio</th><th>Fecha</th><th>Pzas</th></tr></thead><tbody>
                    ${(allHE||[]).map(h => `<tr><td class="td-mono">${h.folio}</td><td>${Utils.fmtFecha(h.fecha)}</td><td class="td-mono">${h.total_piezas}</td></tr>`).join('')}
                </tbody></table></div>` : '<p style="color:var(--text-muted);font-size:0.85rem">Sin hojas de entrada</p>'}
            </div>
        </div>`;

        document.getElementById('btn-ec-excel').addEventListener('click', exportarExcel);
    }

    function exportarExcel() {
        if (!window.XLSX || !currentData) return;
        const { contrato, despiece } = currentData;
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['ESTADO DE CUENTA — Contrato ' + contrato.numero_contrato],
            ['Cliente:', contrato.cliente], ['Obra:', contrato.obra || '—'], [''],
            ['SKU', 'Descripción', 'Contratado', 'Entregado', 'Recolectado', 'En Campo', 'Pend. Entrega'],
            ...Object.values(despiece).map(d => [d.sku, d.descripcion, d.contratado, d.entregado, d.recolectado, d.en_campo, d.pend_entrega])
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Estado de Cuenta');
        XLSX.writeFile(wb, `Estado_Cuenta_${contrato.numero_contrato}_${Utils.hoyISO()}.xlsx`);
        App.toast('Excel exportado', 'success');
    }

    return { render };
})();
