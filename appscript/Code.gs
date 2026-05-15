/**
 * ICAM — Apps Script para Google Sheets
 * Formulario de contratos + Supabase + PDF
 *
 * INSTRUCCIONES:
 * 1. Abre tu Google Sheet con la plantilla CONTRATO
 * 2. Extensiones → Apps Script
 * 3. Pega este código en Code.gs
 * 4. Crea un archivo HTML llamado "Sidebar" y pega el HTML
 * 5. Guarda y recarga la hoja
 */

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN — Ajustar según tu proyecto
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  SUPABASE_URL: 'https://eftsuegjfqgwdrajkloc.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdHN1ZWdqZnFnd2RyYWprbG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQ5NDUsImV4cCI6MjA5NDM1MDk0NX0.qjtTRJk7oM3SQf5iat9OzbFmt2-VSneBNZ28TSUDXmE',

  // Nombres de hojas
  HOJA_CONTRATO: 'CONTRATO',
  HOJA_CLIENTES: '_data_clientes',
  HOJA_PRODUCTOS: '_data_productos',

  // Carpeta raíz en Drive para PDFs (ID de la carpeta)
  // Obtener de la URL: https://drive.google.com/drive/folders/ESTE_ID
  DRIVE_FOLDER_ID: '',  // Dejar vacío para guardar en raíz de Drive

  // Rango de items (productos) en la plantilla
  ITEMS_FILA_INICIO: 21,
  ITEMS_FILA_FIN: 51,
};

// ═══════════════════════════════════════════════════════════════
// MAPEO DE CELDAS — Según "Datos contratos.xlsx"
// Ajustar si la plantilla tiene celdas diferentes
// ═══════════════════════════════════════════════════════════════
const CELDAS = {
  // Datos del contrato (entrada del formulario)
  NUMERO_CONTRATO: 'B10',
  SUCURSAL: 'D10',
  RENTA_ANTERIOR: 'F10',
  RENTA_POSTERIOR: 'H10',
  TIPO_OPERACION: 'J10',
  CLIENTE_ID: 'C11', // Donde se escribe el ID
  CLIENTE_NOMBRE: 'D11', // Donde el VLOOKUP genera el nombre
  SISTEMA: 'K12',
  MEDIO_CONTACTO: 'K14',
  DIRECCION_PROYECTO: 'A15',
  REQUIERE_FLETE: 'K15',
  FLETE_A_CARGO: 'K16',
  PERSONA_RECIBE: 'C16',
  TEL_QUIEN_RECIBE: 'F16',
  DIAS_RENTA: 'C17',
  INICIO_RENTA: 'F17',
  FORMA_PAGO: 'C18',
  FECHA_PAGO: 'G18',
  FACTURA: 'J18',
  AGENTE: 'L18',
  DEPOSITO: 'C54',
  SUBTOTAL_EXTRA: 'D55',
  ENTREGA: 'D56',
  RECOLECCION: 'D57',
  ARMADO: 'D58',
  OTROS: 'D59',
  IVA_PORCENTAJE: 'F60',
  PAGARE: 'K156',

  // Celdas auto-resueltas por VLOOKUP (solo lectura para Supabase)
  DIRECCION_CLIENTE: 'C12',   // VLOOKUP desde _data_clientes
  TELEFONO_CLIENTE: 'C13',    // VLOOKUP desde _data_clientes
  ENCARGADO: 'K9',            // VLOOKUP o manual
  FIN_RENTA: 'J17',           // Calculado (C17+F17)
  SUBTOTAL: 'K63',            // Calculado
  IVA_MONTO: 'K64',           // Calculado
  TOTAL_CONTRATO: 'D62',
  CANTIDAD_TOTAL: 'A52',
};

// ═══════════════════════════════════════════════════════════════
// MENÚ Y SIDEBAR
// ═══════════════════════════════════════════════════════════════
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📄 ICAM Contratos')
    .addItem('📝 Nuevo Contrato', 'showFormModal')
    .addSeparator()
    .addItem('🔄 Limpiar Plantilla', 'limpiarPlantilla')
    .addToUi();
}

function showFormModal() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setWidth(900)
    .setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, 'Nuevo Contrato');
}

// ═══════════════════════════════════════════════════════════════
// DATOS PARA EL FORMULARIO (llamados desde el sidebar)
// ═══════════════════════════════════════════════════════════════
// Ya no se cargan clientes masivamente, se busca individualmente por ID
function getNombreCliente(id) {
  if (!id) return '';
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJA_CLIENTES);
  if (!ws) return '';
  
  // Usar TextFinder para una búsqueda ultra rápida en la columna A
  const textFinder = ws.getRange('A:A').createTextFinder(String(id)).matchEntireCell(true);
  const cell = textFinder.findNext();
  
  if (cell) {
    // Retornar el valor de la columna B (nombre) en esa misma fila
    return String(ws.getRange(cell.getRow(), 2).getValue());
  }
  return '⚠️ Cliente no encontrado';
}

function getProductos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(CONFIG.HOJA_PRODUCTOS);
  if (!ws) return [];
  const data = ws.getRange(2, 2, ws.getLastRow() - 1, 1).getValues();
  return data.map(r => r[0]).filter(v => v !== '');
}

function getNextFolio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsData = ss.getSheetByName('_data_contratos');
  if (!wsData) return 1;

  const maxRow = wsData.getLastRow();
  if (maxRow < 2) return 1; // Si solo hay encabezados
  
  // Leer columna B (columna 2) desde la fila 2
  const values = wsData.getRange(2, 2, maxRow - 1, 1).getValues();
  let maxFolio = 0;
  
  for (let i = 0; i < values.length; i++) {
    const num = Number(values[i][0]);
    if (!isNaN(num) && num > maxFolio) {
      maxFolio = num;
    }
  }
  
  return maxFolio + 1;
}

// ═══════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: Guardar Contrato
// ═══════════════════════════════════════════════════════════════
function guardarContrato(formData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(CONFIG.HOJA_CONTRATO);
  if (!ws) return { ok: false, error: 'Hoja CONTRATO no encontrada' };

  try {
    // 1. Escribir datos en las celdas
    escribirEnPlantilla(ws, formData);

    // 2. Forzar recálculo de VLOOKUPs
    SpreadsheetApp.flush();
    Utilities.sleep(1000);

    // 3. Leer datos resueltos (incluyendo VLOOKUPs)
    const datosCompletos = leerDatosResueltos(ws, formData);

    // 3.5. Guardar en pestaña _data_contratos
    try {
      guardarEnDataContratos(ss, datosCompletos, formData);
    } catch (e) {
      Logger.log('Error Data Contratos: ' + e.message);
    }

    // 4. Enviar a Supabase
    let supabaseOk = false;
    try {
      supabaseOk = enviarASupabase(datosCompletos);
    } catch (e) {
      Logger.log('Error Supabase: ' + e.message);
    }

    // 5. Generar PDF
    let pdfUrl = '';
    try {
      pdfUrl = generarPDF(ss, ws, datosCompletos);
    } catch (e) {
      Logger.log('Error PDF: ' + e.message);
    }

    // 6. Limpiar plantilla
    limpiarCeldas(ws);

    // 7. Incrementar folio
    const nuevoFolio = Number(formData.numero_contrato) + 1;
    ws.getRange(CELDAS.NUMERO_CONTRATO).setValue(nuevoFolio);

    ss.toast('Contrato ' + formData.numero_contrato + ' guardado', 'Éxito ✓', 5);

    return {
      ok: true,
      folio: formData.numero_contrato,
      supabase: supabaseOk,
      pdfUrl: pdfUrl,
      nuevoFolio: nuevoFolio,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// ESCRIBIR EN PLANTILLA
// ═══════════════════════════════════════════════════════════════
function escribirEnPlantilla(ws, d) {
  const set = (cell, val) => { if (val !== undefined && val !== null && val !== '') ws.getRange(cell).setValue(val); };

  set(CELDAS.NUMERO_CONTRATO, Number(d.numero_contrato));
  set(CELDAS.SUCURSAL, d.sucursal);
  set(CELDAS.RENTA_ANTERIOR, d.renta_anterior);
  set(CELDAS.RENTA_POSTERIOR, d.renta_posterior);
  set(CELDAS.TIPO_OPERACION, d.tipo_operacion || 'Renta');
  set(CELDAS.CLIENTE_ID, d.cliente); // Escribe el ID en C11
  set(CELDAS.SISTEMA, d.sistema);
  set(CELDAS.MEDIO_CONTACTO, d.medio_contacto);
  set(CELDAS.DIRECCION_PROYECTO, d.direccion_proyecto);
  set(CELDAS.REQUIERE_FLETE, d.requiere_flete);
  set(CELDAS.FLETE_A_CARGO, d.flete_a_cargo);
  set(CELDAS.PERSONA_RECIBE, d.persona_recibe);
  set(CELDAS.TEL_QUIEN_RECIBE, d.tel_quien_recibe);
  set(CELDAS.DIAS_RENTA, Number(d.dias_renta) || 0);
  set(CELDAS.INICIO_RENTA, d.inicio_renta ? new Date(d.inicio_renta) : '');
  set(CELDAS.FORMA_PAGO, d.forma_pago);
  set(CELDAS.FECHA_PAGO, d.fecha_pago ? new Date(d.fecha_pago) : '');
  set(CELDAS.FACTURA, d.factura);
  set(CELDAS.AGENTE, d.agente);
  set(CELDAS.DEPOSITO, Number(d.deposito) || 0);
  set(CELDAS.SUBTOTAL_EXTRA, Number(d.subtotal_extra) || 0);
  set(CELDAS.ENTREGA, Number(d.entrega) || 0);
  set(CELDAS.RECOLECCION, Number(d.recoleccion) || 0);
  set(CELDAS.ARMADO, Number(d.armado) || 0);
  set(CELDAS.OTROS, Number(d.otros) || 0);
  set(CELDAS.IVA_PORCENTAJE, d.iva_porcentaje);
  set(CELDAS.PAGARE, Number(d.pagare) || 0);

  // Items (productos)
  if (d.items && d.items.length > 0) {
    for (let i = 0; i < d.items.length && i < 31; i++) {
      const fila = CONFIG.ITEMS_FILA_INICIO + i;
      ws.getRange('A' + fila).setValue(Number(d.items[i].cantidad) || 0);
      ws.getRange('C' + fila).setValue(d.items[i].producto);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// LEER DATOS RESUELTOS (post-VLOOKUP)
// ═══════════════════════════════════════════════════════════════
function leerDatosResueltos(ws, formData) {
  const get = (cell) => ws.getRange(cell).getValue();
  const getDate = (cell) => {
    const v = get(cell);
    if (!v) return null;
    try { return Utilities.formatDate(new Date(v), 'America/Mexico_City', 'yyyy-MM-dd'); }
    catch (e) { return String(v); }
  };

  // Items resueltos
  const items = [];
  for (let i = CONFIG.ITEMS_FILA_INICIO; i <= CONFIG.ITEMS_FILA_FIN; i++) {
    const cant = get('A' + i);
    if (cant && cant !== '' && cant !== 0) {
      items.push({
        cantidad: Number(cant) || 0,
        sku: String(get('C' + i) || ''),
        descripcion: String(get('E' + i) || ''),
        peso_unitario: Number(get('I' + i)) || 0,
        peso_total: Number(get('K' + i)) || 0,
      });
    }
  }

  return {
    numero_contrato: Number(get(CELDAS.NUMERO_CONTRATO)),
    cliente: String(get(CELDAS.CLIENTE_NOMBRE) || ''), // Lee el nombre resuelto de D11
    direccion_cliente: String(get(CELDAS.DIRECCION_CLIENTE) || ''),
    telefono: String(get(CELDAS.TELEFONO_CLIENTE) || ''),
    obra: String(get(CELDAS.DIRECCION_PROYECTO) || ''),
    encargado: String(get(CELDAS.ENCARGADO) || ''),
    vendedor: Number(get(CELDAS.AGENTE)) || 0,
    sucursal: String(get(CELDAS.SUCURSAL) || ''),
    fecha_pago: getDate(CELDAS.FECHA_PAGO),
    fecha_inicio_renta: getDate(CELDAS.INICIO_RENTA),
    quien_recibe: String(get(CELDAS.PERSONA_RECIBE) || ''),
    movil_quien_recibe: String(get(CELDAS.TEL_QUIEN_RECIBE) || ''),
    factura: String(get(CELDAS.FACTURA) || ''),
    forma_pago: String(get(CELDAS.FORMA_PAGO) || ''),
    medio_contacto: String(get(CELDAS.MEDIO_CONTACTO) || ''),
    dias_renta: Number(get(CELDAS.DIAS_RENTA)) || 0,
    fecha_fin_renta: getDate(CELDAS.FIN_RENTA),
    subtotal: Number(get(CELDAS.SUBTOTAL)) || 0,
    iva: Number(get(CELDAS.IVA_MONTO)) || 0,
    total_contrato: Number(get(CELDAS.TOTAL_CONTRATO)) || 0,
    cantidad_total: Number(get(CELDAS.CANTIDAD_TOTAL)) || 0,
    tipo: String(get(CELDAS.TIPO_OPERACION) || 'Renta'),
    sistema: String(get(CELDAS.SISTEMA) || ''),
    items: items,
  };
}

// ═══════════════════════════════════════════════════════════════
// GUARDAR EN HOJA _data_contratos
// ═══════════════════════════════════════════════════════════════
function guardarEnDataContratos(ss, datos, formData) {
  let ws = ss.getSheetByName('_data_contratos');
  if (!ws) return; // Si no existe, no hace nada
  
  // Mapeo: A=0... AF=31 -> 32 columnas
  const row = new Array(32).fill('');
  
  row[1] = datos.numero_contrato;          // B: Folio
  row[3] = formData.renta_anterior || 0;   // D: RENTA ANTERIOR
  row[4] = formData.renta_posterior || 0;  // E: RENTA POSTERIOR
  row[5] = new Date();                     // F: FECHA DE CREACION (TIMESTAMP)
  row[6] = datos.cliente;                  // G: CLIENTE
  row[7] = datos.dias_renta;               // H: DIAS DE RENTA
  row[8] = datos.fecha_inicio_renta;       // I: FECHA INICIO (Asumimos I)
  row[9] = datos.fecha_fin_renta;          // J: FECHA TERMINO
  row[13] = datos.total_contrato;          // N: TOTAL (D62)
  row[24] = datos.sucursal;                // Y: SUCURSAL
  row[26] = datos.cantidad_total;          // AA: CANTIDAD TOTAL (A52)
  row[29] = datos.vendedor;                // AD: Wait, AGENTE is AE. Let's map exactly: Z=25, AA=26, AB=27, AC=28, AD=29, AE=30, AF=31
  row[30] = datos.vendedor;                // AE: AGENTE
  row[31] = datos.medio_contacto;          // AF: MEDIO DE CONTACTO
  
  ws.appendRow(row);
}

// ═══════════════════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════════════════
function enviarASupabase(datos) {
  const url = CONFIG.SUPABASE_URL + '/rest/v1/';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
    'apikey': CONFIG.SUPABASE_KEY,
    'Prefer': 'return=representation',
  };

  // Contrato
  const contrato = { ...datos };
  delete contrato.items;
  // Estos campos son solo para Google Sheets, Supabase no los tiene en su tabla:
  delete contrato.fecha_fin_renta;
  delete contrato.total_contrato;
  delete contrato.cantidad_total;
  
  contrato.fecha_registro = new Date().toISOString();

  const resp = UrlFetchApp.fetch(url + 'contratos', {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(contrato),
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() >= 400) {
    Logger.log('Supabase contrato error: ' + resp.getContentText());
    return false;
  }

  // Items
  for (const item of datos.items) {
    const payload = {
      numero_contrato: datos.numero_contrato,
      cantidad: item.cantidad,
      sku: item.sku,
      descripcion: item.descripcion,
      peso_unitario: item.peso_unitario,
      peso_total: item.peso_total,
    };
    UrlFetchApp.fetch(url + 'contratos_items', {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// GENERAR PDF — Guardar en Drive por Año/Mes/Vendedor
// ═══════════════════════════════════════════════════════════════
function generarPDF(ss, ws, datos) {
  const sheetId = ws.getSheetId();
  const ssId = ss.getId();

  // Construir URL de exportación PDF
  const pdfUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?' +
    'format=pdf&size=letter&portrait=true&fitw=true&gridlines=false' +
    '&printtitle=false&sheetnames=false&pagenum=false&fzr=false' +
    '&gid=' + sheetId;

  const token = ScriptApp.getOAuthToken();
  const pdfBlob = UrlFetchApp.fetch(pdfUrl, {
    headers: { 'Authorization': 'Bearer ' + token },
  }).getBlob();

  // Nombre del archivo
  const fecha = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyMMdd');
  const folio = ('0000' + datos.numero_contrato).slice(-4);
  const vendedor = 'V' + (datos.vendedor || '0');
  const nombrePDF = 'C-' + folio + '-' + vendedor + '-' + fecha + '.pdf';
  pdfBlob.setName(nombrePDF);

  // Crear carpeta: Año / Mes
  const ahora = new Date();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const anio = String(ahora.getFullYear());
  const mes = meses[ahora.getMonth()];

  let carpetaRaiz;
  if (CONFIG.DRIVE_FOLDER_ID) {
    carpetaRaiz = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  } else {
    carpetaRaiz = DriveApp.getRootFolder();
  }

  // Año
  let carpetaAnio = buscarOCrearSubcarpeta(carpetaRaiz, anio);
  // Mes
  let carpetaMes = buscarOCrearSubcarpeta(carpetaAnio, mes);
  // Vendedor (opcional)
  let carpetaFinal = buscarOCrearSubcarpeta(carpetaMes, vendedor);

  const archivo = carpetaFinal.createFile(pdfBlob);
  return archivo.getUrl();
}

function buscarOCrearSubcarpeta(padre, nombre) {
  const iter = padre.getFoldersByName(nombre);
  return iter.hasNext() ? iter.next() : padre.createFolder(nombre);
}

// ═══════════════════════════════════════════════════════════════
// LIMPIAR CELDAS
// ═══════════════════════════════════════════════════════════════
function limpiarPlantilla() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJA_CONTRATO);
  if (ws) limpiarCeldas(ws);
}

function limpiarCeldas(ws) {
  const clear = (range) => { try { ws.getRange(range).clearContent(); } catch(e) {} };

  clear(CELDAS.CLIENTE_ID);
  clear(CELDAS.DIRECCION_PROYECTO);
  clear(CELDAS.PERSONA_RECIBE);
  clear(CELDAS.TEL_QUIEN_RECIBE);
  clear(CELDAS.MEDIO_CONTACTO);
  clear(CELDAS.REQUIERE_FLETE);
  clear(CELDAS.FLETE_A_CARGO);
  clear(CELDAS.DIAS_RENTA);
  clear(CELDAS.INICIO_RENTA);
  clear(CELDAS.FORMA_PAGO);
  clear(CELDAS.FECHA_PAGO);
  clear(CELDAS.FACTURA);
  clear(CELDAS.RENTA_ANTERIOR);
  clear(CELDAS.RENTA_POSTERIOR);
  clear(CELDAS.SISTEMA);
  clear(CELDAS.DEPOSITO);
  clear(CELDAS.SUBTOTAL_EXTRA);
  clear(CELDAS.ENTREGA);
  clear(CELDAS.RECOLECCION);
  clear(CELDAS.ARMADO);
  clear(CELDAS.OTROS);
  clear(CELDAS.PAGARE);

  // Limpiar items (A21:A51 y C21:C51)
  ws.getRange('A' + CONFIG.ITEMS_FILA_INICIO + ':A' + CONFIG.ITEMS_FILA_FIN).clearContent();
  ws.getRange('C' + CONFIG.ITEMS_FILA_INICIO + ':C' + CONFIG.ITEMS_FILA_FIN).clearContent();
}
