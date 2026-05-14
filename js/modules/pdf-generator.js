import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * Módulo para Generar PDF de Documentos Operativos (Contratos, Salidas, Entradas, Solicitudes)
 * Versión: Premium Logistics Edition
 */

const PDFGenerator = (() => {
    
    // Configuración de Marca y Estética
    const CONFIG = {
        colors: {
            primary: [0, 61, 112],    // Azul marino ICAM
            secondary: [255, 107, 53], // Naranja ICAM
            text: [45, 45, 45],
            textLight: [120, 120, 120],
            gray: [240, 240, 240],
            border: [200, 200, 200],
            white: [255, 255, 255]
        },
        margin: 15,
        rowHeight: 6,
        fontSize: {
            title: 16,
            subtitle: 10,
            label: 8,
            body: 8,
            footer: 7
        }
    };

    /**
     * Generar PDF según el tipo de documento
     * @param {string} type - 'CONTRATO', 'SOLICITUD_ENTREGA', 'SOLICITUD_RECOLECCION', 'HS', 'HE'
     * @param {Object} data - Datos del encabezado (contrato, folio, cliente, etc.)
     * @param {Array} items - Items a desglosar
     */
    function generate(type, data, items = []) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const state = { y: CONFIG.margin };

            // 1. Encabezado Premium
            drawHeader(doc, state, type, data);

            // 2. Información del Cliente y Obra
            drawClientInfo(doc, state, data);

            // 3. Tabla de Ítems (Configurada según tipo)
            drawItemsTable(doc, state, type, items);

            // 4. Firmas y Observaciones
            drawFooter(doc, state, type, data);

            // 5. Branding de Pie de Página
            drawPageNumber(doc);

            // Descargar
            const filename = `${type}_${data.folio || 'S_N'}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(filename);
            
            return true;
        } catch (e) {
            console.error('Error en PDFGenerator:', e);
            throw e;
        }
    }

    // --- FUNCIONES INTERNAS DE DIBUJO ---

    function drawHeader(doc, state, type, data) {
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Franja superior de marca
        doc.setFillColor(...CONFIG.colors.primary);
        doc.rect(0, 0, pageWidth, 25, 'F');

        // Logo / Nombre Empresa
        doc.setTextColor(...CONFIG.colors.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(CONFIG.fontSize.title);
        doc.text('ANDAMIOS ICAM', CONFIG.margin, 12);
        
        doc.setFontSize(CONFIG.fontSize.subtitle);
        doc.setFont('helvetica', 'normal');
        doc.text('SISTEMAS DE ALTURA Y CONSTRUCCIÓN', CONFIG.margin, 17);

        // Título del documento
        const titles = {
            'CONTRATO': 'CONTRATO DE ARRENDAMIENTO',
            'SOLICITUD_ENTREGA': 'SOLICITUD DE ENTREGA (ALMACÉN)',
            'SOLICITUD_RECOLECCION': 'SOLICITUD DE RECOLECCIÓN (OBRA)',
            'HS': 'HOJA DE SALIDA DE EQUIPO',
            'HE': 'HOJA DE ENTRADA DE EQUIPO'
        };
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(titles[type] || 'DOCUMENTO OPERATIVO', pageWidth - CONFIG.margin, 12, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Folio: ${data.folio || '—'}`, pageWidth - CONFIG.margin, 17, { align: 'right' });
        doc.text(`Fecha: ${Utils.formatDate(data.fecha || data.fecha_contrato)}`, pageWidth - CONFIG.margin, 21, { align: 'right' });

        state.y = 32;
    }

    function drawClientInfo(doc, state, data) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const colWidth = (pageWidth - 2 * CONFIG.margin) / 2;

        // Bloque Cliente (Izquierda)
        doc.setTextColor(...CONFIG.colors.primary);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('INFORMACIÓN DEL CLIENTE', CONFIG.margin, state.y);
        
        doc.setTextColor(...CONFIG.colors.text);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let curY = state.y + 5;
        
        doc.text(`Cliente: ${data.razon_social || '—'}`, CONFIG.margin, curY);
        curY += 4;
        doc.text(`RFC: ${data.rfc_cliente || '—'}`, CONFIG.margin, curY);
        curY += 4;
        doc.text(`Tel: ${data.telefono_cliente || '—'}`, CONFIG.margin, curY);

        // Bloque Obra/Entrega (Derecha)
        doc.setTextColor(...CONFIG.colors.primary);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DE OBRA / ENTREGA', CONFIG.margin + colWidth + 5, state.y);
        
        doc.setTextColor(...CONFIG.colors.text);
        doc.setFont('helvetica', 'normal');
        let curY2 = state.y + 5;
        doc.text(`Atención: ${data.contacto_entrega || '—'}`, CONFIG.margin + colWidth + 5, curY2);
        curY2 += 4;
        doc.text(`Tel: ${data.telefono_contacto_entrega || '—'}`, CONFIG.margin + colWidth + 5, curY2);
        curY2 += 4;
        
        const dir = data.direccion_entrega || data.direccion_servicio || '—';
        const lines = doc.splitTextToSize(`Dir: ${dir}`, colWidth - 5);
        doc.text(lines, CONFIG.margin + colWidth + 5, curY2);

        state.y = Math.max(curY, curY2 + (lines.length * 4)) + 8;
    }

    function drawItemsTable(doc, state, type, items) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - 2 * CONFIG.margin;

        // Título de sección de despiece
        doc.setFillColor(...CONFIG.colors.gray);
        doc.rect(CONFIG.margin, state.y, contentWidth, 6, 'F');
        doc.setTextColor(...CONFIG.colors.primary);
        doc.setFont('helvetica', 'bold');
        doc.text('DESGLOSE DE EQUIPO', CONFIG.margin + 2, state.y + 4.5);
        state.y += 6;

        // Configuración de columnas según tipo
        let columns = [
            { header: 'CANT', dataKey: 'cantidad', width: 15 },
            { header: 'CÓDIGO', dataKey: 'codigo', width: 25 },
            { header: 'DESCRIPCIÓN', dataKey: 'nombre', width: 80 }
        ];

        // Columnas especiales para verificaciones manuales
        if (type.includes('SOLICITUD')) {
            columns.push({ header: 'CHOFER', dataKey: 'empty', width: 25 });
            columns.push({ header: 'ALMACÉN', dataKey: 'empty', width: 25 });
        } else if (type === 'CONTRATO') {
            columns.push({ header: 'P.UNIT', dataKey: 'precio', width: 25 });
            columns.push({ header: 'TOTAL', dataKey: 'total', width: 25 });
        } else if (type === 'HE') {
            columns.push({ header: 'ESTADO', dataKey: 'estado', width: 30 });
        }

        // Dibujar Cabecera de Tabla
        doc.setFillColor(...CONFIG.colors.secondary);
        doc.setTextColor(...CONFIG.colors.white);
        let curX = CONFIG.margin;
        columns.forEach(col => {
            doc.rect(curX, state.y, col.width, 6, 'F');
            doc.text(col.header, curX + 2, state.y + 4);
            curX += col.width;
        });
        state.y += 6;

        // Dibujar Filas
        doc.setTextColor(...CONFIG.colors.text);
        doc.setFont('helvetica', 'normal');
        
        items.forEach((it, idx) => {
            if (state.y > 270) {
                doc.addPage();
                state.y = CONFIG.margin;
            }

            // Fondo alterno
            if (idx % 2 === 0) {
                doc.setFillColor(252, 252, 252);
                doc.rect(CONFIG.margin, state.y, contentWidth, 5, 'F');
            }

            curX = CONFIG.margin;
            columns.forEach(col => {
                doc.setDrawColor(...CONFIG.colors.border);
                doc.rect(curX, state.y, col.width, 5); // Borde de celda
                
                let val = '';
                if (col.dataKey === 'cantidad') val = String(it.cantidad || it.cantidad_hs || it.cantidad_recolectada || 0);
                else if (col.dataKey === 'empty') val = '';
                else if (col.dataKey === 'precio') val = `$${Number(it.precio_unitario || 0).toFixed(2)}`;
                else if (col.dataKey === 'total') val = `$${Number((it.cantidad || 0) * (it.precio_unitario || 0)).toFixed(2)}`;
                else val = String(it[col.dataKey] || '').substring(0, 45);

                doc.text(val, curX + 2, state.y + 3.5);
                curX += col.width;
            });
            state.y += 5;
        });

        state.y += 10;
    }

    function drawFooter(doc, state, type, data) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Área de Notas
        if (data.notas) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.text('OBSERVACIONES:', CONFIG.margin, state.y);
            const notes = doc.splitTextToSize(data.notas, pageWidth - 2 * CONFIG.margin);
            doc.text(notes, CONFIG.margin, state.y + 4);
            state.y += (notes.length * 4) + 12;
        }

        // Cuadros de Firma
        const firmaW = 50;
        const firmaY = pageHeight - 35;
        
        doc.setDrawColor(...CONFIG.colors.text);
        doc.setLineWidth(0.2);
        
        // Firma 1
        doc.line(CONFIG.margin, firmaY, CONFIG.margin + firmaW, firmaY);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('ENTREGA / CHOFER', CONFIG.margin + (firmaW / 2), firmaY + 4, { align: 'center' });

        // Firma 2
        doc.line(pageWidth / 2 - firmaW / 2, firmaY, pageWidth / 2 + firmaW / 2, firmaY);
        doc.text('ALMACÉN / REVISIÓN', pageWidth / 2, firmaY + 4, { align: 'center' });

        // Firma 3
        doc.line(pageWidth - CONFIG.margin - firmaW, firmaY, pageWidth - CONFIG.margin, firmaY);
        doc.text('CLIENTE (NOMBRE/FIRMA)', pageWidth - CONFIG.margin - (firmaW / 2), firmaY + 4, { align: 'center' });
    }

    function drawPageNumber(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        doc.setFontSize(6);
        doc.setTextColor(...CONFIG.colors.textLight);
        doc.text(`Generado por ICAM 360 ERP • ${new Date().toLocaleString()}`, CONFIG.margin, pageHeight - 8);
        doc.text(`Página 1`, pageWidth - CONFIG.margin, pageHeight - 8, { align: 'right' });
    }

    // API Pública
    return {
        generate: generate
    };
})();

export { PDFGenerator };
