// ══════════════════════════════════════════════════════════════
// MÓDULO PDF — ICAM 360
// Estrategia: llenar hojas PLANTILLA_* → exportar PDF → limpiar
//
// Hojas requeridas en el workbook:
//   PLANTILLA_CONTRATO
//   PLANTILLA_HS
//   PLANTILLA_HE
//
// Carpetas Drive creadas automáticamente:
//   ICAM360_PDFs/Contratos/
//   ICAM360_PDFs/HS/
//   ICAM360_PDFs/HE/
// ══════════════════════════════════════════════════════════════

var PDF_ROOT   = 'ICAM360_PDFs';
var PDF_CONT   = 'Contratos';
var PDF_HS_DIR = 'HS';
var PDF_HE_DIR = 'HE';

// ── Utilidades Drive ──────────────────────────────────────────
function _getCarpetaPDF(sub) {
  var rootIt = DriveApp.getFoldersByName(PDF_ROOT);
  var root   = rootIt.hasNext() ? rootIt.next() : DriveApp.createFolder(PDF_ROOT);
  var subIt  = root.getFoldersByName(sub);
  return subIt.hasNext() ? subIt.next() : root.createFolder(sub);
}

function _exportarHojaComoPDF(nombreHoja, nombreArchivo, subcarpeta) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheetByName(nombreHoja);
  if (!sheet) throw new Error('No se encontró la hoja: ' + nombreHoja);

  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId()
    + '/export?format=pdf'
    + '&gid='        + sheet.getSheetId()
    + '&portrait=true'
    + '&fitw=true'
    + '&gridlines=false'
    + '&printtitle=false'
    + '&sheetnames=false'
    + '&pagenum=UNDEFINED'
    + '&attachment=true';

  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Error exportando PDF: ' + response.getResponseCode());
  }

  var pdfBlob = response.getBlob().setName(nombreArchivo + '.pdf');
  var carpeta = _getCarpetaPDF(subcarpeta);

  var iter = carpeta.getFilesByName(nombreArchivo + '.pdf');
  while (iter.hasNext()) { iter.next().setTrashed(true); }

  return carpeta.createFile(pdfBlob).getUrl();
}

function _limpiarCeldas(nombreHoja, rangos) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
  if (!sheet) return;
  rangos.forEach(function(r) {
    try { sheet.getRange(r).clearContent(); } catch(e) {}
  });
}

// ── Formateador de número a letras (MXN) ─────────────────────
function _numALetras(num) {
  var n = Math.abs(Math.round(num * 100) / 100);
  var entero    = Math.floor(n);
  var centavos  = Math.round((n - entero) * 100);
  var unidades  = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
                   'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS',
                   'DIECISIETE','DIECIOCHO','DIECINUEVE'];
  var decenas   = ['','DIEZ','VEINTE','TREINTA','CUARENTA','CINCUENTA',
                   'SESENTA','SETENTA','OCHENTA','NOVENTA'];
  var centenas  = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
                   'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];

  function grupo(n) {
    var s = '';
    if (n === 100) return 'CIEN';
    if (n > 100) s += centenas[Math.floor(n/100)] + ' ';
    n = n % 100;
    if (n < 20) {
      s += unidades[n];
    } else {
      s += decenas[Math.floor(n/10)];
      if (n % 10) s += ' Y ' + unidades[n % 10];
    }
    return s.trim();
  }

  var resultado = '';
  if (entero === 0) {
    resultado = 'CERO';
  } else if (entero < 1000) {
    resultado = grupo(entero);
  } else if (entero < 1000000) {
    var miles = Math.floor(entero / 1000);
    var resto = entero % 1000;
    resultado = (miles === 1 ? 'MIL' : grupo(miles) + ' MIL');
    if (resto > 0) resultado += ' ' + grupo(resto);
  } else {
    var millones = Math.floor(entero / 1000000);
    var resto2   = entero % 1000000;
    resultado = grupo(millones) + (millones === 1 ? ' MILLÓN' : ' MILLONES');
    if (resto2 >= 1000) {
      var miles2 = Math.floor(resto2 / 1000);
      resultado += ' ' + (miles2 === 1 ? 'MIL' : grupo(miles2) + ' MIL');
      if (resto2 % 1000 > 0) resultado += ' ' + grupo(resto2 % 1000);
    } else if (resto2 > 0) {
      resultado += ' ' + grupo(resto2);
    }
  }

  var centsStr = centavos > 0 ? centavos + '/100' : '00/100';
  return resultado + ' ' + centsStr + ' M.N.';
}

// ══════════════════════════════════════════════════════════════
// PDF CONTRATO — PLANTILLA_CONTRATO
// ══════════════════════════════════════════════════════════════
function generarPdfContrato(datos, items, folioC) {
  datos  = datos  || {};
  items  = items  || [];
  folioC = folioC || '';

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PLANTILLA_CONTRATO');
  if (!sheet) { Logger.log('PLANTILLA_CONTRATO no encontrada'); return ''; }

  var tz  = Session.getScriptTimeZone();
  var fmt = function(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'dd/MM/yy');
    return String(v);
  };

  // ── Fila 9: folios anteriores/posteriores, fecha ──────────
  sheet.getRange('G9').setValue(fmt(datos.renta_anterior));
  sheet.getRange('F9').setValue(fmt(datos.renta_posterior));
  sheet.getRange('H9').setValue(fmt(datos.fecha_contrato));

  // ── Fila 10: número de contrato, sucursal ─────────────────
  sheet.getRange('B10').setValue(folioC);
  sheet.getRange('D10').setValue(fmt(datos.sucursal) || 'TORRES');

  // ── Filas 11-18: datos del cliente ────────────────────────
  sheet.getRange('C11').setValue(fmt(datos.razon_social));
  sheet.getRange('J11').setValue(fmt(datos.rfc));
  sheet.getRange('C12').setValue(fmt(datos.direccion_proyecto));
  sheet.getRange('C13').setValue(fmt(datos.telefono));
  sheet.getRange('F13').setValue(fmt(datos.movil_recibe));
  sheet.getRange('A15').setValue(fmt(datos.ubicacion_entrega));
  sheet.getRange('K15').setValue(fmt(datos.requiere_flete) || 'NO');
  sheet.getRange('K16').setValue(fmt(datos.flete_a_cargo_de));
  sheet.getRange('C16').setValue(fmt(datos.quien_recibe));
  sheet.getRange('F16').setValue(fmt(datos.movil_recibe));
  sheet.getRange('C17').setValue(fmt(datos.dias_renta));
  sheet.getRange('F17').setValue(fmt(datos.fecha_solicitada));
  sheet.getRange('J17').setValue(fmt(datos.fecha_vencimiento_estimada));
  sheet.getRange('C18').setValue(fmt(datos.forma_pago));
  sheet.getRange('F18').setValue(fmt(datos.fecha_pago));
  sheet.getRange('J18').setValue(fmt(datos.factura));
  sheet.getRange('L18').setValue(fmt(datos.agente));

  // ── Items: filas 21–51 ────────────────────────────────────
  var filaIni = 21;
  var maxF    = 31;
  if (sheet.getLastRow() >= filaIni) {
    sheet.getRange(filaIni, 1, maxF, 11).clearContent();
  }

  var totalPiezas = 0, totalPeso = 0;
  (items || []).slice(0, maxF).forEach(function(item, i) {
    var fila = filaIni + i;
    var qty  = parseFloat(item.cantidad)      || 0;
    var pu   = parseFloat(item.tarifa_dia)    || 0;
    var dias = parseFloat(datos.dias_renta)   || 1;
    var pt   = qty * pu * dias;
    var peso = parseFloat(item.peso_total_kg) || 0;
    totalPiezas += qty;
    totalPeso   += peso;
    sheet.getRange(fila, 1).setValue(qty);
    sheet.getRange(fila, 3).setValue(fmt(item.sku));
    sheet.getRange(fila, 5).setValue(fmt(item.descripcion));
    sheet.getRange(fila, 9).setValue(pu  > 0 ? pu  : '');
    sheet.getRange(fila, 11).setValue(pt > 0 ? pt  : '');
  });

  // ── Fila 52-53: totales piezas/peso, folios HS/HE ─────────
  sheet.getRange('A52').setValue(totalPiezas);
  sheet.getRange('K52').setValue(totalPeso > 0 ? totalPeso.toFixed(2) : '');
  sheet.getRange('F52').setValue(fmt(datos.folio_hs));
  sheet.getRange('F53').setValue(fmt(datos.folio_he));

  // ── Filas 55-64: financiero ───────────────────────────────
  sheet.getRange('D55').setValue(parseFloat(datos.subtotal)          || '');
  sheet.getRange('I56').setValue(parseFloat(datos.renta_diaria)      || '');
  sheet.getRange('D56').setValue(parseFloat(datos.costo_entrega)     || '');
  sheet.getRange('D57').setValue(parseFloat(datos.costo_recoleccion) || '');
  sheet.getRange('D58').setValue(parseFloat(datos.costo_armado)      || '');
  sheet.getRange('D59').setValue(parseFloat(datos.costo_desarmado)   || '');
  sheet.getRange('D60').setValue(parseFloat(datos.otros_cargos)      || '');
  sheet.getRange('D61').setValue(parseFloat(datos.iva)               || '');
  sheet.getRange('D62').setValue(parseFloat(datos.importe)           || '');
  sheet.getRange('D63').setValue(parseFloat(datos.anticipo)          || '');
  var resta = (parseFloat(datos.importe) || 0) - (parseFloat(datos.anticipo) || 0);
  sheet.getRange('D64').setValue(resta > 0 ? resta : 0);

  // ── Pagaré (filas 156, 168, 173, 174, 176) ───────────────
  var valorPagare = parseFloat(datos.importe) || 0;
  sheet.getRange('K156').setValue(valorPagare > 0 ? valorPagare : '');
  sheet.getRange('C168').setValue(
    valorPagare > 0 ? '$ ' + valorPagare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' (' + _numALetras(valorPagare) + ')' : ''
  );
  sheet.getRange('C173').setValue(fmt(datos.razon_social));
  sheet.getRange('C174').setValue(fmt(datos.direccion_proyecto));
  sheet.getRange('J176').setValue(fmt(datos.razon_social));

  SpreadsheetApp.flush();

  // ── Exportar PDF ──────────────────────────────────────────
  var url = '';
  try {
    url = _exportarHojaComoPDF('PLANTILLA_CONTRATO', folioC, PDF_CONT);
  } catch(e) {
    Logger.log('PDF Contrato error: ' + e.message);
  }

  // ── Limpiar celdas de datos ───────────────────────────────
  _limpiarCeldas('PLANTILLA_CONTRATO', [
    'G9','F9','H9','B10','D10',
    'C11','J11','C12','C13','F13',
    'A15','K15','K16','C16','F16',
    'C17','F17','J17',
    'C18','F18','J18','L18',
    'A52','K52','F52','F53',
    'D55','I56','D56','D57','D58','D59','D60','D61','D62','D63','D64',
    'K156','C168','C173','C174','J176',
  ]);
  if (sheet.getLastRow() >= filaIni) {
    sheet.getRange(filaIni, 1, maxF, 11).clearContent();
  }

  return url;
}

// ══════════════════════════════════════════════════════════════
// PDF HOJA DE SALIDA — PLANTILLA_HS
// Columnas items: A=cantidad / B=SKU / C=descripción / G=P.U / I=P.T
// ══════════════════════════════════════════════════════════════
function generarPdfHS(datos, items, folioHS) {
  datos  = datos  || {};
  items  = items  || [];
  folioHS = folioHS || '';

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PLANTILLA_HS');
  if (!sheet) { Logger.log('PLANTILLA_HS no encontrada'); return ''; }

  var tz  = Session.getScriptTimeZone();
  var fmt = function(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'dd/MM/yy');
    return String(v);
  };

  // ── Cabecera ──────────────────────────────────────────────
  sheet.getRange('B10').setValue(folioHS);
  sheet.getRange('E10').setValue(fmt(datos.tipo_operacion) || 'RENTA');
  sheet.getRange('I10').setValue(fmt(datos.folio_contrato));

  // ── Datos del cliente ─────────────────────────────────────
  sheet.getRange('B11').setValue(fmt(datos.razon_social));
  sheet.getRange('I11').setValue(
    datos.fecha_entrega
      ? Utilities.formatDate(new Date(datos.fecha_entrega), tz, 'dd/MM/yy')
      : Utilities.formatDate(new Date(), tz, 'dd/MM/yy')
  );
  sheet.getRange('I12').setValue(fmt(datos.ubicacion_entrega));
  sheet.getRange('B13').setValue(fmt(datos.movil_recibe));
  sheet.getRange('I13').setValue(fmt(datos.agente));

  // ── Items: filas 16–62 ────────────────────────────────────
  // A=cantidad / B=SKU / C=descripción / G=peso unitario / I=peso total
  var filaIni = 16;
  var maxF    = 47;
  if (sheet.getLastRow() >= filaIni) {
    sheet.getRange(filaIni, 1, maxF, 9).clearContent();
  }

  var totalPiezas = 0, totalPeso = 0;
  (items || []).slice(0, maxF).forEach(function(item, i) {
    var fila = filaIni + i;
    var qty  = parseFloat(item.cantidad)          || 0;
    var pu   = parseFloat(item.peso_unitario_kg)  || 0;
    var pt   = parseFloat(item.peso_total_kg)     || (qty * pu);
    totalPiezas += qty;
    totalPeso   += pt;
    sheet.getRange(fila, 1).setValue(qty);                   // A — cantidad
    sheet.getRange(fila, 2).setValue(fmt(item.sku));         // B — SKU
    sheet.getRange(fila, 3).setValue(fmt(item.descripcion)); // C — descripción
    sheet.getRange(fila, 7).setValue(pu > 0 ? pu : '');     // G — peso unitario
    sheet.getRange(fila, 9).setValue(pt > 0 ? pt : '');     // I — peso total
  });

  // ── Totales ───────────────────────────────────────────────
  sheet.getRange('A64').setValue(totalPiezas);
  sheet.getRange('I64').setValue(totalPeso > 0 ? totalPeso.toFixed(2) : '');
  sheet.getRange('B66').setValue(fmt(datos.notas));

  SpreadsheetApp.flush();

  // ── Exportar PDF ──────────────────────────────────────────
  var url = '';
  try {
    url = _exportarHojaComoPDF('PLANTILLA_HS', folioHS, PDF_HS_DIR);
  } catch(e) {
    Logger.log('PDF HS error: ' + e.message);
  }

  // ── Limpiar ───────────────────────────────────────────────
  _limpiarCeldas('PLANTILLA_HS', [
    'B10','E10','I10',
    'B11','I11','I12','B13','I13',
    'A64','I64','B66',
  ]);
  if (sheet.getLastRow() >= filaIni) {
    sheet.getRange(filaIni, 1, maxF, 9).clearContent();
  }

  return url;
}

// ══════════════════════════════════════════════════════════════
// PDF HOJA DE ENTRADA — PLANTILLA_HE
// Columnas items: A=cantidad / B=SKU / C=descripción / G=P.U / H=P.T
// ══════════════════════════════════════════════════════════════
function generarPdfHE(datos, items, folioHE) {
  // Guardia defensiva — normalizar parámetros
  datos  = datos  || {};
  items  = items  || [];
  folioHE = folioHE || '';

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PLANTILLA_HE');
  if (!sheet) { Logger.log('PLANTILLA_HE no encontrada'); return ''; }

  var tz  = Session.getScriptTimeZone();
  var fmt = function(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'dd/MM/yy');
    return String(v);
  };

  // ── Cabecera ──────────────────────────────────────────────
  sheet.getRange('B10').setValue(folioHE);
  sheet.getRange('E10').setValue(fmt(datos.tipo_entrada) || 'RECOLECCION');
  sheet.getRange('H10').setValue(fmt(datos.folio_contrato));

  // ── Datos del cliente ─────────────────────────────────────
  sheet.getRange('B11').setValue(fmt(datos.razon_social));
  sheet.getRange('K11').setValue(Utilities.formatDate(new Date(), tz, 'dd/MM/yy')); // fecha elaboración
  sheet.getRange('B12').setValue(fmt(datos.ubicacion_entrega || datos.ubicacion_origen));
  sheet.getRange('L12').setValue(fmt(datos.cliente_id));
  sheet.getRange('B13').setValue(fmt(datos.movil_recibe || datos.telefono));
  sheet.getRange('H13').setValue(fmt(datos.agente));

  // ── Items: filas 16–62 ────────────────────────────────────
  // A=cantidad / B=SKU / C=descripción / G=peso unitario / H=peso total
  var filaIni = 16;
  var maxF    = 47;
  if (sheet.getLastRow() >= filaIni) {
    sheet.getRange(filaIni, 1, maxF, 8).clearContent();
  }

  var totalPiezas = 0, totalPeso = 0;
  (items || []).slice(0, maxF).forEach(function(item, i) {
    var fila = filaIni + i;
    var qty  = parseFloat(item.cantidad_recibida) || parseFloat(item.cantidad) || 0;
    var pu   = parseFloat(item.peso_unitario_kg)  || 0;
    var pt   = parseFloat(item.peso_total_kg)     || (qty * pu);
    totalPiezas += qty;
    totalPeso   += pt;
    sheet.getRange(fila, 1).setValue(qty);                   // A — cantidad
    sheet.getRange(fila, 2).setValue(fmt(item.sku));         // B — SKU
    sheet.getRange(fila, 3).setValue(fmt(item.descripcion)); // C — descripción
    sheet.getRange(fila, 7).setValue(pu > 0 ? pu : '');     // G — peso unitario
    sheet.getRange(fila, 8).setValue(pt > 0 ? pt : '');     // H — peso total
  });

  // ── Totales ───────────────────────────────────────────────
  sheet.getRange('A64').setValue(totalPiezas);
  sheet.getRange('H64').setValue(totalPeso > 0 ? totalPeso.toFixed(2) : '');
  sheet.getRange('B66').setValue(fmt(datos.notas));

  SpreadsheetApp.flush();

  // ── Exportar PDF ──────────────────────────────────────────
  var url = '';
  try {
    url = _exportarHojaComoPDF('PLANTILLA_HE', folioHE, PDF_HE_DIR);
  } catch(e) {
    Logger.log('PDF HE error: ' + e.message);
  }

  // ── Limpiar ───────────────────────────────────────────────
  _limpiarCeldas('PLANTILLA_HE', [
    'B10','E10','H10',
    'B11','K11','B12','L12','B13','H13',
    'A64','H64','B66',
  ]);
  if (sheet.getLastRow() >= filaIni) {
    sheet.getRange(filaIni, 1, maxF, 8).clearContent();
  }

  return url;
}

// ══════════════════════════════════════════════════════════════
// FUNCIONES DE PRUEBA — ejecutar desde el editor Apps Script
// ══════════════════════════════════════════════════════════════
function testPdfContrato() {
  var datos = {
    razon_social              : 'CONSTRUCTORA PRUEBA SA DE CV',
    rfc                       : 'CPR010101ABC',
    renta_anterior            : '',
    renta_posterior           : '',
    fecha_contrato            : '04/03/26',
    sucursal                  : 'TORRES',
    tipo_operacion            : 'RENTA',
    forma_pago                : 'Transferencia',
    fecha_pago                : '04/03/26',
    factura                   : '',
    agente                    : 'JUAN PEREZ',
    requiere_flete            : 'SI',
    flete_a_cargo_de          : 'CLIENTE',
    direccion_proyecto        : 'Toluca Centro',
    ubicacion_entrega         : 'Av. Reforma 500, Toluca',
    quien_recibe              : 'RESIDENTE OBRA',
    movil_recibe              : '7221234567',
    dias_renta                : 30,
    fecha_solicitada          : '04/03/26',
    fecha_vencimiento_estimada: '03/04/26',
    subtotal                  : 5000,
    costo_entrega             : 800,
    costo_recoleccion         : 800,
    costo_armado              : 0,
    costo_desarmado           : 0,
    otros_cargos              : 0,
    iva                       : 928,
    importe                   : 7528,
    anticipo                  : 3000,
    renta_diaria              : 166.67,
    folio_hs                  : '',
    folio_he                  : '',
  };
  var items = [
    { sku: 'AND-001', descripcion: 'ANDAMIO TUBULAR 1x1', cantidad: 10, tarifa_dia: 5, peso_total_kg: 85 },
    { sku: 'AND-002', descripcion: 'DIAGONAL 1.0M',       cantidad: 20, tarifa_dia: 2, peso_total_kg: 40 },
  ];
  var url = generarPdfContrato(datos, items, 'TEST-19999');
  Logger.log('PDF Contrato: ' + url);
  SpreadsheetApp.getUi().alert('✅ PDF generado:\n' + url);
}

function testPdfHS() {
  var datos = {
    razon_social      : 'CLIENTE DE PRUEBA SA DE CV',
    folio_contrato    : '19999',
    tipo_operacion    : 'RENTA',
    fecha_entrega     : new Date(),
    ubicacion_entrega : 'Av. Principal 123, Toluca',
    movil_recibe      : '7221234567',
    agente            : 'JUAN PEREZ',
    notas             : 'Prueba de generación PDF',
  };
  var items = [
    { sku: 'AND-001', descripcion: 'ANDAMIO TUBULAR', cantidad: 10, peso_unitario_kg: 8.5, peso_total_kg: 85 },
    { sku: 'AND-002', descripcion: 'DIAGONAL 1.0M',   cantidad: 20, peso_unitario_kg: 2.0, peso_total_kg: 40 },
  ];
  var url = generarPdfHS(datos, items, 'HS-TEST-001');
  Logger.log('PDF HS: ' + url);
  SpreadsheetApp.getUi().alert('✅ PDF generado:\n' + url);
}

function testPdfHE() {
  var datos = {
    razon_social      : 'CLIENTE DE PRUEBA SA DE CV',
    folio_contrato    : '19999',
    tipo_entrada      : 'RECOLECCION',
    ubicacion_entrega : 'Av. Principal 123, Toluca',
    movil_recibe      : '7221234567',
    agente            : 'JUAN PEREZ',
    cliente_id        : 'C-001',
    notas             : 'Prueba HE',
  };
  var items = [
    { sku: 'AND-001', descripcion: 'ANDAMIO TUBULAR', cantidad_recibida: 10, peso_unitario_kg: 8.5, peso_total_kg: 85 },
    { sku: 'AND-002', descripcion: 'DIAGONAL 1.0M',   cantidad_recibida: 18, peso_unitario_kg: 2.0, peso_total_kg: 36 },
  ];
  var url = generarPdfHE(datos, items, 'HE-TEST-001');
  Logger.log('PDF HE: ' + url);
  SpreadsheetApp.getUi().alert('✅ PDF generado:\n' + url);
}