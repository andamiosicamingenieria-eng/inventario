import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * ICAM 360 - Módulo de Estado de Cuenta Consolidado
 * Agrupa contratos que comparten el mismo folio_raiz y calcula balance financiero y despiece.
 */
export const ModEstadoCuenta = (() => {
    let currentData = { familia: [], hs: [], he: [], folioRaiz: '' };

    async function render(folioRaiz = null) {
        const mc = document.getElementById('module-content');
        
        if (!folioRaiz) {
            mc.innerHTML = `
            <div class="empty-state" style="max-width:500px; margin: 4rem auto">
                <div style="font-size:4rem;margin-bottom:1.5rem">📑</div>
                <h3 style="font-size:1.5rem">Consulta de Estado de Cuenta</h3>
                <p style="color:var(--text-secondary);margin-bottom:2rem">Ingresa el Folio Raíz para generar el consolidado financiero y técnico.</p>
                <div class="search-box no-border" style="background:var(--bg-alt); padding:0.5rem 1rem; border-radius:var(--radius); border:1px solid var(--border)">
                    <input id="ec-search-input" type="text" placeholder="Escribe el Folio Raíz (ej: 20001)" style="font-size:1.1rem; padding:0.75rem">
                    <button class="btn btn-primary" id="btn-ec-consultar">Consultar</button>
                </div>
                <div style="margin-top:2rem">
                    <button class="btn btn-secondary btn-sm" onclick="App.navigate('seguimiento')">← Volver a Seguimiento</button>
                </div>
            </div>`;
            
            document.getElementById('btn-ec-consultar').addEventListener('click', () => {
                const val = document.getElementById('ec-search-input').value.trim();
                if (val) App.navigate('estado_cuenta', val);
            });
            document.getElementById('ec-search-input').addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    const val = e.target.value.trim();
                    if (val) App.navigate('estado_cuenta', val);
                }
            });
            return;
        }

        // Cargar todos los datos
        const [contratos, hs, he] = await Promise.all([
            DB.getAll('ops_contratos'),
            DB.getAll('ops_hs'),
            DB.getAll('ops_he')
        ]);

        const familia = (contratos || []).filter(c => c.folio_raiz === folioRaiz || c.folio === folioRaiz);
        familia.sort((a,b) => (parseInt(a.folio) || 0) - (parseInt(b.folio) || 0));

        if (!familia.length) {
            mc.innerHTML = `
            <div class="container py-6">
                <div class="alert alert-danger">No se encontraron contratos vinculados al folio raíz: <strong>${Utils.escapeHtml(folioRaiz)}</strong></div>
                <button class="btn btn-secondary mt-4" onclick="App.navigate('estado_cuenta')">Nueva Búsqueda</button>
            </div>`;
            return;
        }

        const foliosFamilia = familia.map(c => c.folio);
        const familiaHS = (hs || []).filter(h => foliosFamilia.includes(h.contrato_folio));
        const familiaHE = (he || []).filter(h => foliosFamilia.includes(h.contrato_folio));

        // Guardar para exportación
        currentData = { familia, hs: familiaHS, he: familiaHE, folioRaiz };

        // Cálculos Financieros
        const totalImporte = familia.reduce((s, c) => s + (parseFloat(c.monto_total) || 0), 0);
        const totalAnticipos = familia.reduce((s, c) => s + (parseFloat(c.anticipo) || 0), 0);
        const saldoTotal = totalImporte - totalAnticipos;
        const cliente = familia[0].razon_social || 'Cliente desconocido';

        // Consolidación de Despiece (Materiales)
        const despiece = consolidarDespiece(familia, familiaHS, familiaHE);

        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <button class="btn btn-secondary btn-sm" onclick="App.navigate('estado_cuenta')">← Nueva Búsqueda</button>
                <h2 style="margin:0 1rem;font-size:1.25rem">Consolidado: <span style="color:var(--primary)">${Utils.escapeHtml(folioRaiz)}</span></h2>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-success" id="btn-ec-excel">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Exportar Excel Consolidado
                </button>
            </div>
        </div>

        <div class="stats-grid mb-6">
            <div class="stat-card" style="border-left:4px solid var(--info)">
                <div class="stat-label">Cliente Principal</div>
                <div class="stat-value" style="font-size:1.1rem">${Utils.escapeHtml(cliente)}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--primary)">
                <div class="stat-label">Importe Total</div>
                <div class="stat-value">$${Number(totalImporte).toLocaleString('es-MX')}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--success)">
                <div class="stat-label">Pagado</div>
                <div class="stat-value text-success">$${Number(totalAnticipos).toLocaleString('es-MX')}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--danger)">
                <div class="stat-label">Saldo Neto</div>
                <div class="stat-value text-danger">$${Number(saldoTotal).toLocaleString('es-MX')}</div>
            </div>
        </div>

        <div class="grid cols-2 gap-4">
            <!-- Columna Izquierda: Flujo de Contratos -->
            <div>
                <div class="section-header">
                    <div class="section-title">🔗 Cadena de Folios</div>
                </div>
                <div class="table-wrapper">
                    <table style="font-size:0.85rem">
                        <thead>
                            <tr>
                                <th>Folio</th>
                                <th>Tipo</th>
                                <th>Importe</th>
                                <th>Saldo</th>
                                <th>Estatus</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${familia.map(c => {
                                const s = (parseFloat(c.monto_total)||0)-(parseFloat(c.anticipo)||0);
                                return `
                                <tr>
                                    <td class="td-mono">${c.folio}</td>
                                    <td>${c.tipo_contrato}</td>
                                    <td class="td-mono">$${Number(c.monto_total||0).toLocaleString()}</td>
                                    <td class="td-mono ${s>0?'text-danger':''}">$${Number(s).toLocaleString()}</td>
                                    <td>${getBadgeEstatus(c.estatus)}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Columna Derecha: Despiece consolidado -->
            <div>
                <div class="section-header">
                    <div class="section-title">🏗 Despiece (Equipos en Campo)</div>
                </div>
                <div class="table-wrapper">
                    <table style="font-size:0.85rem">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Contratado</th>
                                <th>Salió (HS)</th>
                                <th>Entró (HE)</th>
                                <th>Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.values(despiece).map(d => `
                            <tr>
                                <td>
                                    <div style="font-weight:600">${d.nombre}</div>
                                    <div class="text-xs text-muted">${d.codigo}</div>
                                </td>
                                <td class="text-center">${d.cant_cont}</td>
                                <td class="text-center text-info">${d.cant_hs}</td>
                                <td class="text-center text-success">${d.cant_he}</td>
                                <td class="text-center font-bold ${d.saldo > 0 ? 'text-danger':'text-muted'}">${d.saldo}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;

        document.getElementById('btn-ec-excel').addEventListener('click', exportarExcel);
    }

    function consolidarDespiece(familia, familiaHS, familiaHE) {
        const mapa = {};
        const asegurar = (it) => {
            if (!mapa[it.producto_id]) {
                mapa[it.producto_id] = { id: it.producto_id, codigo: it.codigo, nombre: it.nombre, cant_cont: 0, cant_hs: 0, cant_he: 0 };
            }
        };

        // Cantidad contratada
        familia.forEach(c => {
            (c.items || []).forEach(it => {
                asegurar(it);
                mapa[it.producto_id].cant_cont += (parseFloat(it.cantidad) || 0);
            });
        });

        // Cantidad Salida (HS)
        familiaHS.forEach(h => {
            (h.items || []).forEach(it => {
                asegurar(it);
                mapa[it.producto_id].cant_hs += (parseFloat(it.cantidad_hs || it.cantidad) || 0);
            });
        });

        // Cantidad Entrada (HE)
        familiaHE.forEach(h => {
            (h.items || []).forEach(it => {
                asegurar(it);
                mapa[it.producto_id].cant_he += (parseFloat(it.cantidad_recolectada || it.cantidad) || 0);
            });
        });

        // Calcular Saldo (lo que debería estar en campo)
        Object.values(mapa).forEach(v => {
            v.saldo = v.cant_hs - v.cant_he;
        });

        return mapa;
    }

    function exportarExcel() {
        if (!window.XLSX) { App.toast('Librería Excel no cargada', 'danger'); return; }
        const { familia, hs, he, folioRaiz } = currentData;
        
        const wb = XLSX.utils.book_new();

        // Hoja 1: Resumen Financiero
        const totalImp = familia.reduce((s, c) => s + (parseFloat(c.monto_total) || 0), 0);
        const totalAnt = familia.reduce((s, c) => s + (parseFloat(c.anticipo) || 0), 0);
        
        const wsResData = [
            ['REPORTE CONSOLIDADO DE ESTADO DE CUENTA'],
            ['Folio Raíz:', folioRaiz],
            ['Cliente:', familia[0].razon_social],
            ['Fecha de Reporte:', new Date().toLocaleString()],
            [''],
            ['RESUMEN FINANCIERO'],
            ['Métrica', 'Monto'],
            ['Importe Total Acumulado', totalImp],
            ['Total Pagado / Anticipos', totalAnt],
            ['Saldo Neto Pendiente', totalImp - totalAnt],
            [''],
            ['LISTADO DE CONTRATOS'],
            ['Folio', 'Fecha', 'Tipo', 'Estatus', 'Importe', 'Pagado', 'Saldo']
        ];
        
        familia.forEach(c => {
            wsResData.push([
                c.folio, 
                c.fecha_contrato, 
                c.tipo_contrato, 
                c.estatus, 
                parseFloat(c.monto_total)||0, 
                parseFloat(c.anticipo)||0, 
                (parseFloat(c.monto_total)||0) - (parseFloat(c.anticipo)||0)
            ]);
        });

        const wsRes = XLSX.utils.aoa_to_sheet(wsResData);
        XLSX.utils.book_append_sheet(wb, wsRes, 'Estado de Cuenta');

        // Hoja 2: Despiece Consolidado
        const despiece = consolidarDespiece(familia, hs, he);
        const wsMatData = [
            ['CONSOLIDADO DE MATERIALES (DESPIECE)'],
            ['Folio Raíz:', folioRaiz],
            [''],
            ['Código', 'Producto', 'Cant. Contratada', 'Salida Real (HS)', 'Retorno Real (HE)', 'Saldo en Obra']
        ];
        
        Object.values(despiece).forEach(d => {
            wsMatData.push([d.codigo, d.nombre, d.cant_cont, d.cant_hs, d.cant_he, d.saldo]);
        });
        
        const wsMat = XLSX.utils.aoa_to_sheet(wsMatData);
        XLSX.utils.book_append_sheet(wb, wsMat, 'Despiece de Material');

        // Descargar
        XLSX.writeFile(wb, `Estado_Cuenta_${folioRaiz}_${new Date().toISOString().split('T')[0]}.xlsx`);
        App.toast('Excel exportado exitosamente', 'success');
    }

    function getBadgeEstatus(e) {
        const map = { activo:'badge-success', entrega_parcial:'badge-warning', recolectado:'badge-success', borrador:'badge-gray', renovacion:'badge-primary', cancelado:'badge-gray' };
        return `<span class="badge ${map[e]||'badge-gray'}">${(e||'—').replace('_',' ')}</span>`;
    }

    return { render };
})();
