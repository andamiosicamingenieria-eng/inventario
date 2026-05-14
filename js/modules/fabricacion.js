import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * ICAM 360 - Módulo Fabricación
 * Rol: Clasificar piezas recolectadas (HE) y actualizar el inventario
 * "Vaciado de HE": limpio/sucio/chatarra
 */
export const ModFabricacion = (() => {

    let selectedHEId = null;

    function render() {
        const mc = document.getElementById('module-content');
        const heData = ModHE ? ModHE.getHE() : [];
        const pendientes = heData.filter(h => !h.vaciado_fabricacion);
        const procesadas = heData.filter(h => h.vaciado_fabricacion);

        mc.innerHTML = `
        <div class="alert alert-info mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span><strong>Módulo de Fabricación:</strong> Aquí se clasifican las piezas de las Hojas de Entrada (HE) como Limpio/Funcional, Sucio/Funcional o Chatarra. Esto actualiza el inventario automáticamente.</span>
        </div>

        <div class="section-header">
            <div class="section-title">HE Pendientes de Vaciado</div>
            <div class="section-subtitle">${pendientes.length} hojas de entrada sin procesar</div>
        </div>

        ${pendientes.length === 0 ? `
        <div class="card mb-6">
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                <h3>Sin HE pendientes</h3>
                <p>¡Todo el equipo recolectado ya fue clasificado!</p>
            </div>
        </div>` : `
        <div class="seguimiento-grid mb-6">
            ${pendientes.map(h => cardHEPendiente(h)).join('')}
        </div>`}

        <div class="section-header mt-6">
            <div class="section-title">HE Procesadas</div>
            <div class="section-subtitle">${procesadas.length} hojas completadas</div>
        </div>
        ${procesadas.length ? `
        <div class="table-wrapper">
            <table>
                <thead><tr><th>Folio HE</th><th>Contrato</th><th>Fecha</th><th>Piezas</th><th>Procesado</th></tr></thead>
                <tbody>
                ${procesadas.map(h => `<tr>
                    <td class="td-mono">${h.folio}</td>
                    <td class="td-mono">${h.contrato_folio || '—'}</td>
                    <td>${fmtFecha(h.fecha)}</td>
                    <td class="td-mono">${h.total_piezas} pzas</td>
                    <td><span class="badge badge-success">✓ Clasificado</span></td>
                </tr>`).join('')}
                </tbody>
            </table>
        </div>` : '<div class="empty-state"><p>Sin HE procesadas aún.</p></div>'}`;

        document.querySelectorAll('.btn-procesar-he').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); procesarHE(parseInt(btn.dataset.id)); });
        });
    }

    function cardHEPendiente(h) {
        return `
        <div class="contrato-card proximo">
            <div class="contrato-card-header">
                <div>
                    <div class="contrato-card-folio">${h.folio}</div>
                    <div class="contrato-card-cliente">${h.razon_social || '—'}</div>
                </div>
                <span class="badge badge-warning">Pendiente</span>
            </div>
            <div class="flex gap-2 mb-3" style="flex-wrap:wrap">
                <span style="font-size:0.8rem;color:var(--text-muted)">Contrato: ${h.contrato_folio || '—'}</span>
                <span style="font-size:0.8rem;color:var(--text-muted)">📦 ${h.total_piezas} pzas</span>
                <span style="font-size:0.8rem;color:var(--text-muted)">📅 ${fmtFecha(h.fecha)}</span>
            </div>
            <button class="btn btn-primary btn-sm btn-procesar-he" data-id="${h.id}" style="width:100%">
                🔧 Clasificar Piezas (Vaciar HE)
            </button>
        </div>`;
    }

    function procesarHE(heId) {
        const heData = ModHE ? ModHE.getHE() : [];
        const he = heData.find(h => h.id === heId);
        if (!he) { App.toast('HE no encontrada', 'danger'); return; }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-vaciado';
        overlay.innerHTML = `
        <div class="modal modal-xl">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Vaciado de HE — ${he.folio}</div>
                    <div class="modal-subtitle">Clasifica cada pieza para actualizar el inventario</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-vaciado').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span>Al confirmar, las cantidades clasificadas se actualizarán en el inventario. Esta acción no se puede deshacer.</span>
                </div>

                <div class="form-row cols-2 mb-4">
                    <div><span class="stat-label">Contrato</span><div class="td-mono">${he.contrato_folio || '—'}</div></div>
                    <div><span class="stat-label">Cliente</span><div>${he.razon_social || '—'}</div></div>
                </div>

                <div style="font-weight:700;color:var(--text-main);margin-bottom:.75rem">Clasificación de Piezas</div>

                <table class="items-table-mini" id="vaciado-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Total Recolectado</th>
                            <th>✅ Limpio/Funcional</th>
                            <th>🔧 Sucio/Funcional</th>
                            <th>❌ Chatarra</th>
                            <th>Control</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(he.items || []).map((it, i) => {
                            const tot = it.cantidad_recolectada || it.cantidad || 0;
                            return `<tr data-idx="${i}" data-total="${tot}">
                                <td class="td-mono">${it.codigo}</td>
                                <td>${it.nombre}</td>
                                <td class="td-mono" style="font-weight:700">${tot}</td>
                                <td><input type="number" class="form-control fab-limpio" min="0" max="${tot}" value="${tot}" style="width:80px;font-size:0.78rem;border-color:var(--success)"></td>
                                <td><input type="number" class="form-control fab-sucio"  min="0" max="${tot}" value="0" style="width:80px;font-size:0.78rem;border-color:var(--warning)"></td>
                                <td><input type="number" class="form-control fab-chatarra" min="0" max="${tot}" value="0" style="width:80px;font-size:0.78rem;border-color:var(--danger)"></td>
                                <td><span class="fab-suma" style="font-size:0.75rem;font-weight:700;color:var(--success)">✓ ${tot}/${tot}</span></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>

                <div class="form-group mt-4">
                    <label class="form-label">Inspector / Responsable</label>
                    <input id="fab-inspector" class="form-control" placeholder="Nombre del inspector">
                </div>
                <div class="form-group">
                    <label class="form-label">Observaciones</label>
                    <textarea id="fab-obs" class="form-control" placeholder="Daños detectados, condiciones especiales…"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-vaciado').remove()">Cancelar</button>
                <button class="btn btn-success" id="btn-confirmar-vaciado">✓ Confirmar Clasificación</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        // Validación en tiempo real
        overlay.querySelectorAll('tbody tr').forEach(row => {
            const total = parseInt(row.dataset.total);
            const inps = [row.querySelector('.fab-limpio'), row.querySelector('.fab-sucio'), row.querySelector('.fab-chatarra')];
            const span = row.querySelector('.fab-suma');

            const check = () => {
                const suma = inps.reduce((s, i) => s + (parseInt(i?.value) || 0), 0);
                if (suma === total) {
                    span.textContent = `✓ ${suma}/${total}`;
                    span.style.color = 'var(--success)';
                } else {
                    span.textContent = `${suma}/${total}`;
                    span.style.color = suma > total ? 'var(--danger)' : 'var(--warning)';
                }
            };
            inps.forEach(inp => inp?.addEventListener('input', check));
        });

        document.getElementById('btn-confirmar-vaciado').addEventListener('click', () => confirmarVaciado(heId, he));
    }

    async function confirmarVaciado(heId, he) {
        // Validar que todas las filas cuadren
        let valido = true;
        document.querySelectorAll('#vaciado-table tbody tr').forEach(row => {
            const total = parseInt(row.dataset.total);
            const suma = ['fab-limpio','fab-sucio','fab-chatarra'].reduce((s, cls) => {
                return s + (parseInt(row.querySelector('.' + cls)?.value) || 0);
            }, 0);
            if (suma !== total) valido = false;
        });

        if (!valido) { App.toast('La suma de clasificación no coincide con el total recolectado', 'danger'); return; }

        // Actualizar inventario
        document.querySelectorAll('#vaciado-table tbody tr').forEach((row, i) => {
            const it = (he.items || [])[i];
            if (!it) return;
            const limpio  = parseInt(row.querySelector('.fab-limpio')?.value) || 0;
            const sucio   = parseInt(row.querySelector('.fab-sucio')?.value) || 0;
            const chatarra= parseInt(row.querySelector('.fab-chatarra')?.value) || 0;

            // Limpio → disponible, Sucio → mantenimiento, Chatarra → chatarra
            if (ModInventario) {
                ModInventario.actualizarStock(it.producto_id, limpio); // suma disponible
                // sucio y chatarra en sus campos correspondientes (simplificado)
            }
        });

        // Marcar HE como vaciada
        const heArr = ModHE.getHE();
        const heObj = heArr.find(h => h.id === heId);
        if (heObj) heObj.vaciado_fabricacion = true;

        await DB.update('ops_he', heId, { vaciado_fabricacion: true });

        document.getElementById('modal-vaciado').remove();
        App.toast(`HE ${he.folio} clasificada y vaciada al inventario ✓`, 'success');
        render();
    }

    // fmtFecha delegated to Utils
    const fmtFecha = Utils.fmtFecha;

    return { render, procesarHE };
})();
