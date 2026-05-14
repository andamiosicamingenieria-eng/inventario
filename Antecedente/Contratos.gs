// ============================================================
// ICAM 360 — contratos.gs
// Archivo principal: menú + Panel_Contrato
// NOTA: onOpen() solo existe aquí — no en los otros archivos
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ICAM 360')
    .addItem('📋 Nuevo Contrato', 'abrirPanelContrato')
    .addItem('📊 Seguimiento', 'abrirPanelSeguimiento')
    .addItem('🚚 Hoja de Salida (HS)', 'abrirPanelHS')
    .addItem('📥 Hoja de Entrada (HE)', 'abrirPanelHE')
    .addItem('📊 Estado de Cuenta', 'abrirEstadoCuenta')
    .addSeparator()
    .addItem('🏭 Fabricación (OF)', 'abrirPanelFabricacion')
    .addItem('🛒 Compras', 'abrirPanelCompras')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('📎 Folio Raíz')
        .addItem('Recalcular TODO', 'recalcularTodo')
        .addItem('Recalcular solo vacíos', 'recalcularVacios')
        .addItem('Recalcular fila actual', 'recalcularFilaActual')
    )
    .addToUi();
}

function abrirPanelSeguimiento() {
  var html = HtmlService
    .createHtmlOutputFromFile('PanelSeguimiento')
    .setWidth(1100)
    .setHeight(700)
    .setTitle('Seguimiento de Contratos — ICAM 360');
  SpreadsheetApp.getUi().showModalDialog(html, 'Seguimiento de Contratos — ICAM 360');
}

function abrirPanelHS() {
  var html = HtmlService
    .createHtmlOutputFromFile('PanelHS')
    .setWidth(900)
    .setHeight(720)
    .setTitle('Hoja de Salida — ICAM 360');
  SpreadsheetApp.getUi().showModalDialog(html, 'Hoja de Salida — ICAM 360');
}

function abrirPanelContrato() {
  const html = HtmlService
    .createHtmlOutputFromFile('PanelContrato')
    .setWidth(960)
    .setHeight(780)
    .setTitle('Nuevo Contrato — ICAM 360');
  SpreadsheetApp.getUi().showModalDialog(html, 'Nuevo Contrato — ICAM 360');
}

// ── FUNCIONES DEL SERVIDOR (llamadas desde el HTML) ──────────

function getSiguienteFolio() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('_data_contratos');
  if (!sheet || sheet.getLastRow() < 2) return 1;
  const folios = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues()
    .map(r => parseInt(r[0])).filter(n => !isNaN(n) && n > 0);
  return folios.length > 0 ? Math.max(...folios) + 1 : 1;
}

function getClientes() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('_data_clientes');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  return datos
    .filter(r => r[1])
    .map(r => ({
      id           : r[0],
      razon_social : String(r[1]).trim(),
      rfc          : String(r[2] || '').trim(),
      direccion    : String(r[3] || '').trim(),
      tel_oficina  : String(r[4] || '').trim(),
      tel_movil    : String(r[5] || '').trim(),
      email        : String(r[6] || '').trim(),
    }));
}

function getProductos() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('_data_productos');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  return datos
    .filter(r => r[1] && String(r[8]).toUpperCase() === 'SI')
    .map(r => ({
      id               : r[0],
      sku              : String(r[1]).trim(),
      descripcion      : String(r[2]).trim(),
      categoria        : String(r[3]).trim(),
      unidad_medida    : String(r[4]).trim(),
      peso_unitario_kg : parseFloat(r[5]) || 0,
      tarifa_dia       : parseFloat(r[6]) || 0,
    }));
}


// ══════════════════════════════════════════════════════════════
// getDatosSeguimiento — Panel de Seguimiento
// Devuelve: rentasActivas, rentasCompletadas, ventasPendientes, ventasCompletadas
// ══════════════════════════════════════════════════════════════
function getDatosSeguimiento() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var tz    = Session.getScriptTimeZone();
  var hoy   = new Date();
  hoy.setHours(0,0,0,0);

  var fmt = function(v) {
    if (!v && v !== 0) return '';
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'dd/MM/yyyy');
    return String(v);
  };

  var sheetC = ss.getSheetByName('_data_contratos');
  if (!sheetC || sheetC.getLastRow() < 2) return { rentasActivas:[], rentasCompletadas:[], ventasPendientes:[], ventasCompletadas:[] };

  var hdrs = sheetC.getRange(1,1,1,sheetC.getLastColumn()).getValues()[0];
  var idx  = function(n){ return hdrs.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
  var cols = {
    folio_c                   : idx('folio_c'),
    folio_raiz                : idx('folio_raiz'),
    renta_anterior            : idx('renta_anterior'),
    renta_posterior           : idx('renta_posterior'),
    tipo_operacion            : idx('tipo_operacion'),
    razon_social              : idx('razon_social'),
    obra                      : idx('obra'),
    agente                    : idx('agente'),
    estatus                   : idx('estatus'),
    fecha_contrato            : idx('fecha_contrato'),
    fecha_solicitada          : idx('fecha_solicitada'),
    fecha_vencimiento_estimada: idx('fecha_vencimiento_estimada'),
    dias_renta                : idx('dias_renta'),
    importe                   : idx('importe'),
    folio_hs                  : idx('folio_hs'),
    ubicacion_entrega         : idx('ubicacion_entrega'),
  };

  var datos = sheetC.getRange(2,1,sheetC.getLastRow()-1,sheetC.getLastColumn()).getValues();

  // Leer HS items para calcular piezas entregadas por folio (ventas)
  var entregadoMap = {}; // folio_c → total piezas entregadas
  var sheetHSI = ss.getSheetByName('_data_hs_items');
  if (sheetHSI && sheetHSI.getLastRow() > 1) {
    var hHSI = sheetHSI.getRange(1,1,1,sheetHSI.getLastColumn()).getValues()[0];
    var iHSI = function(n){ return hHSI.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
    var cFC = iHSI('folio_c'), cQty = iHSI('cantidad');
    if (cFC >= 0 && cQty >= 0) {
      sheetHSI.getRange(2,1,sheetHSI.getLastRow()-1,sheetHSI.getLastColumn()).getValues()
        .forEach(function(r) {
          var fc = String(r[cFC]).trim();
          if (fc) entregadoMap[fc] = (entregadoMap[fc] || 0) + (parseFloat(r[cQty]) || 0);
        });
    }
  }

  // Leer contrato_items para total piezas por folio
  var contratoItemsMap = {}; // folio_c → total piezas
  var sheetCI = ss.getSheetByName('_data_contrato_items');
  if (sheetCI && sheetCI.getLastRow() > 1) {
    var hCI = sheetCI.getRange(1,1,1,sheetCI.getLastColumn()).getValues()[0];
    var iCI = function(n){ return hCI.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
    var cCF = iCI('folio_c'), cCQ = iCI('cantidad');
    if (cCF >= 0 && cCQ >= 0) {
      sheetCI.getRange(2,1,sheetCI.getLastRow()-1,sheetCI.getLastColumn()).getValues()
        .forEach(function(r) {
          var fc = String(r[cCF]).trim();
          if (fc) contratoItemsMap[fc] = (contratoItemsMap[fc] || 0) + (parseFloat(r[cCQ]) || 0);
        });
    }
  }

  // Fecha última HS por folio (para ventas completadas)
  var ultimaHSMap = {}; // folio_c → fecha más reciente
  var sheetHS = ss.getSheetByName('_data_hs');
  if (sheetHS && sheetHS.getLastRow() > 1) {
    var hHS = sheetHS.getRange(1,1,1,sheetHS.getLastColumn()).getValues()[0];
    var iHS = function(n){ return hHS.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
    var cHF = iHS('folio_c'), cHFecha = iHS('fecha');
    if (cHF >= 0 && cHFecha >= 0) {
      sheetHS.getRange(2,1,sheetHS.getLastRow()-1,sheetHS.getLastColumn()).getValues()
        .forEach(function(r) {
          var fc = String(r[cHF]).trim();
          var fe = r[cHFecha];
          if (fc && fe instanceof Date) {
            if (!ultimaHSMap[fc] || fe > ultimaHSMap[fc]) ultimaHSMap[fc] = fe;
          }
        });
    }
  }

  var rentasActivas     = [];
  var rentasCompletadas = [];
  var ventasPendientes  = [];
  var ventasCompletadas = [];

  datos.forEach(function(r) {
    var tipo   = String(r[cols.tipo_operacion] || '').trim().toUpperCase();
    var est    = String(r[cols.estatus]        || '').trim().toUpperCase();
    var folioC = String(r[cols.folio_c]        || '').trim();
    if (!folioC) return;

    var vence     = r[cols.fecha_vencimiento_estimada];
    var fechaCont = r[cols.fecha_contrato];
    var diasRestantes = null;
    if (vence instanceof Date) {
      diasRestantes = Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
    }

    var obj = {
      folio_c       : folioC,
      folio_raiz    : fmt(r[cols.folio_raiz]),
      renta_anterior: fmt(r[cols.renta_anterior]),
      tipo_operacion: tipo,
      razon_social  : fmt(r[cols.razon_social]),
      obra          : fmt(r[cols.obra]),
      agente        : fmt(r[cols.agente]),
      estatus       : est,
      fecha_contrato: fmt(fechaCont),
      fecha_inicio  : fmt(r[cols.fecha_solicitada]),
      fecha_vence   : fmt(vence),
      dias_renta    : r[cols.dias_renta] || '',
      importe       : parseFloat(r[cols.importe]) || 0,
      folio_hs      : fmt(r[cols.folio_hs]),
      ubicacion     : fmt(r[cols.ubicacion_entrega]),
      dias_restantes: diasRestantes,
    };

    // ── RENTAS ─────────────────────────────────────────────────
    if (tipo === 'RENTA') {
      // Activas: ACTIVO o ENTREGA PARCIAL, sin renta_posterior (no renovado)
      if ((est === 'ACTIVO' || est === 'ENTREGA PARCIAL') && !r[cols.renta_posterior]) {
        rentasActivas.push(obj);
      }
      // Completadas: RECOLECTADO (últimas 10)
      if (est === 'RECOLECTADO') {
        rentasCompletadas.push(obj);
      }
    }

    // ── VENTAS ─────────────────────────────────────────────────
    if (tipo === 'VENTA') {
      var totalContrato  = contratoItemsMap[folioC] || 0;
      var totalEntregado = entregadoMap[folioC]     || 0;
      obj.total_contrato  = totalContrato;
      obj.total_entregado = totalEntregado;
      obj.pct_entregado   = totalContrato > 0 ? Math.round(totalEntregado / totalContrato * 100) : 0;

      // Pendiente: no está completamente entregado
      if (est !== 'RECOLECTADO' && (totalContrato === 0 || totalEntregado < totalContrato)) {
        ventasPendientes.push(obj);
      }
      // Completada: RECOLECTADO (últimas 10) + calcular días desde contrato a última HS
      if (est === 'RECOLECTADO') {
        var ultimaHS = ultimaHSMap[folioC];
        if (ultimaHS instanceof Date && fechaCont instanceof Date) {
          obj.dias_ciclo = Math.round((ultimaHS - fechaCont) / (1000 * 60 * 60 * 24));
        } else {
          obj.dias_ciclo = null;
        }
        obj.fecha_ultima_hs = ultimaHS ? fmt(ultimaHS) : '';
        ventasCompletadas.push(obj);
      }
    }
  });

  // Ordenar rentas activas: más atrasadas primero (dias_restantes más negativo)
  rentasActivas.sort(function(a, b) {
    var da = a.dias_restantes !== null ? a.dias_restantes : 9999;
    var db = b.dias_restantes !== null ? b.dias_restantes : 9999;
    return da - db;
  });

  // Completadas: más recientes primero, top 10
  rentasCompletadas.sort(function(a, b) { return String(b.folio_c).localeCompare(String(a.folio_c)); });
  rentasCompletadas = rentasCompletadas.slice(0, 10);

  ventasCompletadas.sort(function(a, b) { return String(b.folio_c).localeCompare(String(a.folio_c)); });
  ventasCompletadas = ventasCompletadas.slice(0, 10);

  return {
    rentasActivas    : rentasActivas,
    rentasCompletadas: rentasCompletadas,
    ventasPendientes : ventasPendientes,
    ventasCompletadas: ventasCompletadas,
  };
}

// ══════════════════════════════════════════════════════════════
// MIGRACIÓN: EN RENTA → ACTIVO
// Ejecutar UNA sola vez desde el editor de Apps Script
// ══════════════════════════════════════════════════════════════
function migrarEstatusEnRentaAActivo() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheet  = ss.getSheetByName('_data_contratos');
  if (!sheet || sheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('No hay datos en _data_contratos');
    return;
  }

  var headers  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var colEst   = headers.findIndex(function(h){ return String(h).trim().replace('* ','') === 'estatus'; });
  if (colEst < 0) { SpreadsheetApp.getUi().alert('Columna estatus no encontrada'); return; }

  var datos    = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  var migrados = 0;
  datos.forEach(function(r, i) {
    if (String(r[colEst]).trim() === 'EN RENTA') {
      sheet.getRange(i + 2, colEst + 1).setValue('ACTIVO');
      migrados++;
    }
    // También migrar ENTREGA TOTAL → ACTIVO (entrega completa sin recolectar)
    if (String(r[colEst]).trim() === 'ENTREGA TOTAL') {
      sheet.getRange(i + 2, colEst + 1).setValue('ACTIVO');
      migrados++;
    }
  });

  SpreadsheetApp.getUi().alert('✅ Migración completada: ' + migrados + ' contratos actualizados a ACTIVO');
}

// ══════════════════════════════════════════════════════════════
// getStockHS — devuelve para cada SKU del contrato:
//   stock_disponible, cantidad_contrato, ya_entregado, pendiente
// Llamado desde PanelHS al cambiar el SKU seleccionado
// ══════════════════════════════════════════════════════════════
function getStockHS(sku, folioContrato) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var resultado = { stock: 0, contrato: 0, entregado: 0, pendiente: 0 };

  // ── 1. Stock disponible en inventario ────────────────────────
  var sheetInv = ss.getSheetByName('_data_inventario');
  if (sheetInv && sheetInv.getLastRow() > 1) {
    var datosInv = sheetInv.getRange(2, 1, sheetInv.getLastRow() - 1, 6).getValues();
    // COL: 0=id, 1=sku, 2=desc, 3=ini, 4=stock_disponible, 5=stock_dañado
    var fInv = datosInv.find(function(r) {
      return String(r[1]).trim().toUpperCase() === String(sku).trim().toUpperCase();
    });
    if (fInv) resultado.stock = parseFloat(fInv[4]) || 0;
  }

  // ── 2. Cantidad comprometida en el contrato ───────────────────
  if (folioContrato) {
    var sheetCI = ss.getSheetByName('_data_contrato_items');
    if (sheetCI && sheetCI.getLastRow() > 1) {
      var hdrsCI = sheetCI.getRange(1,1,1,sheetCI.getLastColumn()).getValues()[0];
      var iCI = function(n){ return hdrsCI.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
      var colFolio = iCI('folio_c');
      var colSku   = iCI('sku');
      var colQty   = iCI('cantidad');
      if (colFolio >= 0 && colSku >= 0 && colQty >= 0) {
        var datosCI = sheetCI.getRange(2,1,sheetCI.getLastRow()-1,sheetCI.getLastColumn()).getValues();
        datosCI.forEach(function(r) {
          if (String(r[colFolio]).trim() === String(folioContrato).trim() &&
              String(r[colSku]).trim().toUpperCase() === String(sku).trim().toUpperCase()) {
            resultado.contrato += parseFloat(r[colQty]) || 0;
          }
        });
      }
    }
  }

  // ── 3. Ya entregado en HS anteriores del mismo contrato ───────
  var sheetHSI = ss.getSheetByName('_data_hs_items');
  if (sheetHSI && sheetHSI.getLastRow() > 1 && folioContrato) {
    var hdrsHSI  = sheetHSI.getRange(1,1,1,sheetHSI.getLastColumn()).getValues()[0];
    var iHSI = function(n){ return hdrsHSI.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
    var colHFolio = iHSI('folio_c');
    var colHSku   = iHSI('sku');
    var colHQty   = iHSI('cantidad');
    if (colHFolio >= 0 && colHSku >= 0 && colHQty >= 0) {
      var datosHSI = sheetHSI.getRange(2,1,sheetHSI.getLastRow()-1,sheetHSI.getLastColumn()).getValues();
      datosHSI.forEach(function(r) {
        if (String(r[colHFolio]).trim() === String(folioContrato).trim() &&
            String(r[colHSku]).trim().toUpperCase() === String(sku).trim().toUpperCase()) {
          resultado.entregado += parseFloat(r[colHQty]) || 0;
        }
      });
    }
  }

  resultado.pendiente = Math.max(0, resultado.contrato - resultado.entregado);
  return resultado;
}

// getStockLote — devuelve stock de todos los SKUs del contrato de una vez
// Más eficiente que N llamadas individuales
function getStockLoteHS(folioContrato) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var result = {}; // { sku: { stock, contrato, entregado, pendiente } }

  // ── Inventario: leer todo de una vez ─────────────────────────
  var invMap = {};
  var sheetInv = ss.getSheetByName('_data_inventario');
  if (sheetInv && sheetInv.getLastRow() > 1) {
    var datosInv = sheetInv.getRange(2,1,sheetInv.getLastRow()-1,6).getValues();
    datosInv.forEach(function(r) {
      var s = String(r[1]).trim().toUpperCase();
      if (s) invMap[s] = parseFloat(r[4]) || 0;
    });
  }

  // ── Items del contrato ────────────────────────────────────────
  var contratoMap = {};
  if (folioContrato) {
    var sheetCI = ss.getSheetByName('_data_contrato_items');
    if (sheetCI && sheetCI.getLastRow() > 1) {
      var hdrsCI = sheetCI.getRange(1,1,1,sheetCI.getLastColumn()).getValues()[0];
      var iCI = function(n){ return hdrsCI.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
      var cF = iCI('folio_c'), cS = iCI('sku'), cQ = iCI('cantidad');
      if (cF >= 0 && cS >= 0 && cQ >= 0) {
        var datosCI = sheetCI.getRange(2,1,sheetCI.getLastRow()-1,sheetCI.getLastColumn()).getValues();
        datosCI.forEach(function(r) {
          if (String(r[cF]).trim() !== String(folioContrato).trim()) return;
          var s = String(r[cS]).trim().toUpperCase();
          contratoMap[s] = (contratoMap[s] || 0) + (parseFloat(r[cQ]) || 0);
        });
      }
    }
  }

  // ── Ya entregado en HS ────────────────────────────────────────
  var entregadoMap = {};
  var sheetHSI = ss.getSheetByName('_data_hs_items');
  if (sheetHSI && sheetHSI.getLastRow() > 1 && folioContrato) {
    var hdrsHSI = sheetHSI.getRange(1,1,1,sheetHSI.getLastColumn()).getValues()[0];
    var iHSI = function(n){ return hdrsHSI.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
    var hF = iHSI('folio_c'), hS = iHSI('sku'), hQ = iHSI('cantidad');
    if (hF >= 0 && hS >= 0 && hQ >= 0) {
      var datosHSI = sheetHSI.getRange(2,1,sheetHSI.getLastRow()-1,sheetHSI.getLastColumn()).getValues();
      datosHSI.forEach(function(r) {
        if (String(r[hF]).trim() !== String(folioContrato).trim()) return;
        var s = String(r[hS]).trim().toUpperCase();
        entregadoMap[s] = (entregadoMap[s] || 0) + (parseFloat(r[hQ]) || 0);
      });
    }
  }

  // ── Consolidar ────────────────────────────────────────────────
  // Incluir todos los SKUs que aparecen en contrato o inventario
  var todosSkus = new Set(Object.keys(contratoMap).concat(Object.keys(invMap)));
  todosSkus.forEach(function(sku) {
    var stock     = invMap[sku]       || 0;
    var contrato  = contratoMap[sku]  || 0;
    var entregado = entregadoMap[sku] || 0;
    result[sku] = {
      stock    : stock,
      contrato : contrato,
      entregado: entregado,
      pendiente: Math.max(0, contrato - entregado),
    };
  });

  return result;
}

function guardarContrato(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetC = ss.getSheetByName('_data_contratos');
  if (!sheetC) throw new Error('Pestaña _data_contratos no encontrada.');

  const id = sheetC.getLastRow();

  sheetC.appendRow([
    id,
    datos.folio_c,
    datos.folio_raiz || datos.folio_c,
    datos.renta_anterior    || '',
    datos.renta_posterior   || '',
    'Torres',
    'ACTIVO',
    datos.tipo_operacion    || 'RENTA',
    datos.cliente_id        || '',
    datos.razon_social      || '',
    datos.obra              || '',
    datos.direccion_proyecto || '',
    datos.ubicacion_entrega || '',
    datos.quien_recibe      || '',
    datos.movil_recibe      || '',
    datos.requiere_flete    || 'NO',
    datos.flete_a_cargo_de  || '',
    datos.distancia_km      || '',
    datos.costo_flete       || '',
    datos.medio_contacto    || '',
    datos.dias_renta        || '',
    datos.fecha_contrato    || '',
    datos.fecha_solicitada  || '',
    '',
    datos.fecha_vencimiento_estimada || '',
    '',
    datos.anticipo          || '',
    datos.subtotal          || '',
    datos.costo_entrega     || '',
    datos.costo_recoleccion || '',
    datos.costo_armado      || '',
    datos.costo_desarmado   || '',
    datos.otros_cargos      || '',
    datos.iva               || '',
    datos.importe           || '',
    datos.renta_diaria      || '',
    datos.peso_total_kg     || '',
    datos.forma_pago        || '',
    datos.fecha_pago        || '',
    datos.factura           || '',
    datos.agente            || '',
    datos.pagare_monto      || '',
    datos.pagare_lugar      || 'Toluca, Estado de México',
    datos.pagare_fecha      || datos.fecha_contrato || '',
    '',
    '',
    datos.notas             || '',
  ]);

  const sheetI = ss.getSheetByName('_data_contrato_items');
  if (!sheetI) throw new Error('Pestaña _data_contrato_items no encontrada.');

  let itemId = sheetI.getLastRow();
  for (const item of datos.items) {
    itemId++;
    sheetI.appendRow([
      itemId,
      datos.folio_c,
      item.sku,
      item.descripcion,
      item.cantidad,
      item.unidad_medida      || 'PZA',
      item.peso_unitario_kg   || '',
      item.peso_total_kg      || '',
      item.tarifa_dia         || '',
      item.subtotal_dia       || '',
      '',
    ]);
  }

  if (datos.renta_anterior) {
    try { recalcularTodo(); } catch(e) {}
  }

  SpreadsheetApp.flush();

  // ── Generar PDF del contrato (pdf_module.gs) ──
  try { generarPdfContrato(datos, datos.items || [], datos.folio_c); } catch(e) { Logger.log('PDF Contrato: ' + e.message); }

  return { ok: true, folio: datos.folio_c };
}

// ── SEGUIMIENTO ───────────────────────────────────────────────

function getContratosParaSeguimiento() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_contratos');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var datos   = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  var idx = function(name) {
    var i = headers.findIndex(function(h) {
      return String(h).trim().replace('* ','') === name;
    });
    return i;
  };

  var cols = {
    folio_c                   : idx('folio_c'),
    folio_raiz                : idx('folio_raiz'),
    renta_anterior            : idx('renta_anterior'),
    estatus                   : idx('estatus'),
    tipo_operacion            : idx('tipo_operacion'),
    razon_social              : idx('razon_social'),
    obra                      : idx('obra'),
    ubicacion_entrega         : idx('ubicacion_entrega'),
    quien_recibe              : idx('quien_recibe'),
    movil_recibe              : idx('movil_recibe'),
    fecha_contrato            : idx('fecha_contrato'),
    fecha_solicitada          : idx('fecha_solicitada'),
    fecha_vencimiento_estimada: idx('fecha_vencimiento_estimada'),
    dias_renta                : idx('dias_renta'),
    importe                   : idx('importe'),
    anticipo                  : idx('anticipo'),
    forma_pago                : idx('forma_pago'),
    factura                   : idx('factura'),
    agente                    : idx('agente'),
    notas                     : idx('notas'),
  };

  return datos.map(function(r) {
    var obj = {};
    Object.keys(cols).forEach(function(k) {
      var v = cols[k] >= 0 ? r[cols[k]] : '';
      obj[k] = v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : v;
    });
    return obj;
  }).filter(function(r) { return r.folio_c; });
}

function actualizarEstatusContrato(folio, nuevoEstatus) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_contratos');
  if (!sheet) throw new Error('Pestaña _data_contratos no encontrada.');

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colEstatus = headers.findIndex(function(h) {
    return String(h).trim().replace('* ','') === 'estatus';
  });
  var colFolio = headers.findIndex(function(h) {
    return String(h).trim().replace('* ','') === 'folio_c';
  });
  if (colEstatus === -1 || colFolio === -1) throw new Error('Columnas no encontradas.');

  var datos = sheet.getRange(2, colFolio + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(folio).trim()) {
      sheet.getRange(i + 2, colEstatus + 1).setValue(nuevoEstatus);
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  throw new Error('Folio ' + folio + ' no encontrado.');
}

// ── HOJA DE SALIDA (HS) ───────────────────────────────────────

function getSiguienteHojaHS() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_hs');
  if (!sheet || sheet.getLastRow() < 2) return 'HS-0001';
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colFolio = headers.findIndex(function(h) {
    return String(h).trim().replace('* ','') === 'folio_hs';
  });
  if (colFolio === -1) return 'HS-0001';
  var datos = sheet.getRange(2, colFolio + 1, sheet.getLastRow() - 1, 1).getValues();
  var nums  = datos.map(function(r) {
    var v = String(r[0]).replace(/[^0-9]/g, '');
    return parseInt(v) || 0;
  }).filter(function(n) { return n > 0; });
  var siguiente = nums.length > 0 ? Math.max.apply(null, nums) + 1 : 1;
  return 'HS-' + String(siguiente).padStart(4, '0');
}

function getContratoParaHS(folio) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_contratos');
  if (!sheet || sheet.getLastRow() < 2) return null;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = function(name) {
    return headers.findIndex(function(h) {
      return String(h).trim().replace('* ','') === name;
    });
  };

  var cols = {
    folio_c           : idx('folio_c'),
    folio_raiz        : idx('folio_raiz'),
    tipo_operacion    : idx('tipo_operacion'),
    razon_social      : idx('razon_social'),
    dias_renta        : idx('dias_renta'),
    obra              : idx('obra'),
    ubicacion_entrega : idx('ubicacion_entrega'),
    quien_recibe      : idx('quien_recibe'),
  };

  var datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var fila  = datos.find(function(r) {
    return String(r[cols.folio_c]).trim() === String(folio).trim();
  });
  if (!fila) return null;

  var contrato = {};
  Object.keys(cols).forEach(function(k) {
    contrato[k] = cols[k] >= 0 ? fila[cols[k]] : '';
  });

  // ── 1. Leer despiece del contrato ──
  var itemsContrato = [];
  var sheetI = ss.getSheetByName('_data_contrato_items');
  if (sheetI && sheetI.getLastRow() > 1) {
    var headersI  = sheetI.getRange(1, 1, 1, sheetI.getLastColumn()).getValues()[0];
    var idxI = function(name) {
      return headersI.findIndex(function(h) { return String(h).trim().replace('* ','') === name; });
    };
    var colFolioI = idxI('folio_c');
    var colSku    = idxI('sku');
    var colDesc   = idxI('descripcion');
    var colQty    = idxI('cantidad');
    var colPesoU  = idxI('peso_unitario_kg');

    if (colFolioI >= 0) {
      var datosI = sheetI.getRange(2, 1, sheetI.getLastRow() - 1, sheetI.getLastColumn()).getValues();
      datosI.filter(function(r) {
        return String(r[colFolioI]).trim() === String(folio).trim();
      }).forEach(function(r) {
        itemsContrato.push({
          sku              : colSku   >= 0 ? String(r[colSku]).trim()   : '',
          descripcion      : colDesc  >= 0 ? String(r[colDesc]).trim()  : '',
          cantidad_contrato: colQty   >= 0 ? parseFloat(r[colQty]) || 0 : 0,
          peso_unitario_kg : colPesoU >= 0 ? parseFloat(r[colPesoU])|| 0: 0,
        });
      });
    }
  }

  // ── 2. Leer lo ya enviado en HS anteriores ──
  var enviado = {}; // { sku: cantidad_total_enviada }
  var sheetHSI = ss.getSheetByName('_data_hs_items');
  if (sheetHSI && sheetHSI.getLastRow() > 1) {
    var headersHSI  = sheetHSI.getRange(1, 1, 1, sheetHSI.getLastColumn()).getValues()[0];
    var idxHSI = function(name) {
      return headersHSI.findIndex(function(h) { return String(h).trim().replace('* ','') === name; });
    };
    var colFolioHSI = idxHSI('folio_c');
    var colSkuHSI   = idxHSI('sku');
    var colQtyHSI   = idxHSI('cantidad');

    if (colFolioHSI >= 0 && colSkuHSI >= 0 && colQtyHSI >= 0) {
      var datosHSI = sheetHSI.getRange(2, 1, sheetHSI.getLastRow() - 1, sheetHSI.getLastColumn()).getValues();
      datosHSI.filter(function(r) {
        return String(r[colFolioHSI]).trim() === String(folio).trim();
      }).forEach(function(r) {
        var sku = String(r[colSkuHSI]).trim();
        var qty = parseFloat(r[colQtyHSI]) || 0;
        enviado[sku] = (enviado[sku] || 0) + qty;
      });
    }
  }

  // ── 3. Calcular pendientes y armar lista ordenada ──
  var pendientes  = [];
  var completos   = [];

  itemsContrato.forEach(function(item) {
    var yaEnviado = enviado[item.sku] || 0;
    var pendiente = item.cantidad_contrato - yaEnviado;
    var itemOut   = {
      sku              : item.sku,
      descripcion      : item.descripcion,
      cantidad         : pendiente > 0 ? pendiente : 0,
      cantidad_contrato: item.cantidad_contrato,
      cantidad_enviada : yaEnviado,
      peso_unitario_kg : item.peso_unitario_kg,
      completo         : pendiente <= 0,
    };
    if (pendiente > 0) pendientes.push(itemOut);
    else               completos.push(itemOut);
  });

  contrato.items          = pendientes.concat(completos);
  contrato.hay_pendientes = pendientes.length > 0;
  contrato.hay_completos  = completos.length > 0;
  contrato.todo_enviado   = pendientes.length === 0 && completos.length > 0;

  return contrato;
}

function guardarHojaHS(datos) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheetHS = ss.getSheetByName('_data_hs');
  if (!sheetHS) throw new Error('Pestaña _data_hs no encontrada.');

  var folioHS = getSiguienteHojaHS();
  var id      = sheetHS.getLastRow();

  // Columnas _data_hs: id|folio_hs|folio_c|tipo|almacen_origen|fecha|operador|unidad|num_cliente|expediente|ubicacion_destino|vendedor|total_piezas|peso_total_kg|estatus|notas
  var totalPiezas = (datos.items || []).reduce(function(s, it) { return s + (parseFloat(it.cantidad) || 0); }, 0);
  var totalPeso   = (datos.items || []).reduce(function(s, it) { return s + (parseFloat(it.peso_total_kg) || 0); }, 0);
  var nextId      = sheetHS.getLastRow(); // fila anterior = id

  sheetHS.appendRow([
    nextId,                               // id
    folioHS,                              // folio_hs
    datos.folio_contrato   || '',         // folio_c
    datos.tipo_operacion   || 'RENTA',   // tipo
    '',                                   // almacen_origen
    datos.fecha_entrega    || '',         // fecha
    datos.operador         || '',         // operador
    '',                                   // unidad
    '',                                   // num_cliente
    '',                                   // expediente
    datos.ubicacion_entrega|| '',         // ubicacion_destino
    datos.agente           || '',         // vendedor
    totalPiezas,                          // total_piezas
    totalPeso.toFixed(2),                 // peso_total_kg
    datos.estatus_entrega  || 'EN RENTA',// estatus
    datos.notas            || '',         // notas
  ]);

  // Guardar items de la HS
  // Columnas _data_hs_items: id|folio_hs|folio_c|sku|descripcion|cantidad|peso_unitario_kg|peso_total_kg|notas
  var sheetHSI = ss.getSheetByName('_data_hs_items');
  if (sheetHSI) {
    var itemsFiltrados = (datos.items || []).filter(function(item) {
      return item.sku && parseFloat(item.cantidad) > 0;
    });
    if (itemsFiltrados.length > 0) {
      var primeraFilaLibre = sheetHSI.getLastRow() + 1;
      var filas = itemsFiltrados.map(function(item, i) {
        return [
          primeraFilaLibre + i,             // id
          folioHS,                           // folio_hs
          datos.folio_contrato  || '',       // folio_c
          item.sku              || '',       // sku
          item.descripcion      || '',       // descripcion
          parseFloat(item.cantidad)      || 0, // cantidad
          parseFloat(item.peso_unitario_kg) || 0, // peso_unitario_kg
          parseFloat(item.peso_total_kg)    || 0, // peso_total_kg
          '',                                // notas
        ];
      });
      sheetHSI.getRange(primeraFilaLibre, 1, filas.length, 9).setValues(filas);
    }
  }

  // Determinar estatus según pendientes
  var itemsContrato = [];
  var sheetCI = ss.getSheetByName('_data_contrato_items');
  if (sheetCI && sheetCI.getLastRow() > 1) {
    var hCI  = sheetCI.getRange(1, 1, 1, sheetCI.getLastColumn()).getValues()[0];
    var idxCI = function(n) { return hCI.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
    var cFolioCI = idxCI('folio_c'), cQtyCI = idxCI('cantidad');
    if (cFolioCI >= 0 && cQtyCI >= 0) {
      var dCI = sheetCI.getRange(2, 1, sheetCI.getLastRow() - 1, sheetCI.getLastColumn()).getValues();
      dCI.filter(function(r) { return String(r[cFolioCI]).trim() === String(datos.folio_contrato).trim(); })
        .forEach(function(r) { itemsContrato.push(parseFloat(r[cQtyCI]) || 0); });
    }
  }
  var totalContrato = itemsContrato.reduce(function(s, v) { return s + v; }, 0);

  // Sumar todo lo enviado (incluyendo esta HS)
  var totalEnviado = 0;
  if (sheetHSI && sheetHSI.getLastRow() > 1) {
    var hHSI2 = sheetHSI.getRange(1, 1, 1, sheetHSI.getLastColumn()).getValues()[0];
    var idxHSI2 = function(n) { return hHSI2.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
    var cFolioHSI2 = idxHSI2('folio_c'), cQtyHSI2 = idxHSI2('cantidad');
    if (cFolioHSI2 >= 0 && cQtyHSI2 >= 0) {
      var dHSI2 = sheetHSI.getRange(2, 1, sheetHSI.getLastRow() - 1, sheetHSI.getLastColumn()).getValues();
      dHSI2.filter(function(r) { return String(r[cFolioHSI2]).trim() === String(datos.folio_contrato).trim(); })
        .forEach(function(r) { totalEnviado += parseFloat(r[cQtyHSI2]) || 0; });
    }
  }

  var nuevoEstatus = totalContrato > 0 && totalEnviado >= totalContrato
    ? 'ACTIVO'          // entrega completa del contrato
    : 'ENTREGA PARCIAL'; // entrega parcial

  // Actualizar folio_hs y estatus en _data_contratos
  var sheetC = ss.getSheetByName('_data_contratos');
  if (sheetC && datos.folio_contrato) {
    var headers  = sheetC.getRange(1, 1, 1, sheetC.getLastColumn()).getValues()[0];
    var colFolio = headers.findIndex(function(h) { return String(h).trim().replace('* ','') === 'folio_c'; });
    var colHS    = headers.findIndex(function(h) { return String(h).trim().replace('* ','') === 'folio_hs'; });
    var colEst   = headers.findIndex(function(h) { return String(h).trim().replace('* ','') === 'estatus'; });
    var colVence = headers.findIndex(function(h) { return String(h).trim().replace('* ','') === 'fecha_vencimiento_estimada'; });
    if (colFolio >= 0) {
      var filas = sheetC.getRange(2, colFolio + 1, sheetC.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < filas.length; i++) {
        if (String(filas[i][0]).trim() === String(datos.folio_contrato).trim()) {
          var row = i + 2;
          if (colHS    >= 0) sheetC.getRange(row, colHS  + 1).setValue(folioHS);
          if (colEst   >= 0) sheetC.getRange(row, colEst + 1).setValue(nuevoEstatus);
          if (colVence >= 0 && datos.fecha_vencimiento_estimada)
            sheetC.getRange(row, colVence + 1).setValue(datos.fecha_vencimiento_estimada);
          break;
        }
      }
    }
  }

  // ── Actualizar inventario — restar lo que salió ──
  var itemsParaInv = (datos && datos.items) ? datos.items : [];
  actualizarInventario(itemsParaInv, folioHS, 'SALIDA_HS');

  SpreadsheetApp.flush();

  // ── Generar PDF de la HS (pdf_module.gs) ──
  try {
    var datosHsPdf = {
      razon_social     : datos.razon_social      || '',
      folio_contrato   : datos.folio_contrato    || '',
      tipo_operacion   : datos.tipo_operacion    || 'RENTA',
      fecha_entrega    : datos.fecha_entrega     || '',
      ubicacion_entrega: datos.ubicacion_entrega || '',
      movil_recibe     : datos.movil_recibe      || '',
      agente           : datos.agente            || '',
      cliente_id       : datos.cliente_id        || '',
      notas            : datos.notas             || '',
    };
    generarPdfHS(datosHsPdf, datos.items || [], folioHS);
  } catch(e) { Logger.log('PDF HS: ' + e.message); }

  return { ok: true, folio_hs: folioHS };
}

function getContratosRecientes() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_contratos');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = function(name) {
    return headers.findIndex(function(h) {
      return String(h).trim().replace('* ','') === name;
    });
  };

  var cols = {
    folio_c         : idx('folio_c'),
    razon_social    : idx('razon_social'),
    obra            : idx('obra'),
    fecha_contrato  : idx('fecha_contrato'),
    fecha_solicitada: idx('fecha_solicitada'),
    estatus         : idx('estatus'),
  };

  var datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  // Filtrar solo activos y tomar los últimos 5
  var activos = datos
    .filter(function(r) {
      var est = String(r[cols.estatus] || '').toUpperCase();
      return r[cols.folio_c] && est !== 'CANCELADO' && est !== 'RECOLECTADO';
    })
    .slice(-5)
    .reverse();

  return activos.map(function(r) {
    var fmt = function(v) {
      if (!v) return '';
      if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      return String(v);
    };
    return {
      folio_c         : fmt(r[cols.folio_c]),
      razon_social    : fmt(r[cols.razon_social]),
      obra            : fmt(r[cols.obra]),
      fecha_contrato  : fmt(r[cols.fecha_contrato]),
      fecha_solicitada: fmt(r[cols.fecha_solicitada]),
    };
  });
}

// ══════════════════════════════════════════════════════════════
// HOJA DE ENTRADA (HE)
// ══════════════════════════════════════════════════════════════

function abrirPanelHE() {
  var html = HtmlService
    .createHtmlOutputFromFile('PanelHE')
    .setWidth(960)
    .setHeight(760)
    .setTitle('Hoja de Entrada — ICAM 360');
  SpreadsheetApp.getUi().showModalDialog(html, 'Hoja de Entrada — ICAM 360');
}

function getSiguienteHojaHE() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_he');
  if (!sheet || sheet.getLastRow() < 2) return 'HE-0001';
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colFolio = headers.findIndex(function(h) {
    return String(h).trim().replace('* ','') === 'folio_he';
  });
  if (colFolio === -1) return 'HE-0001';
  var datos = sheet.getRange(2, colFolio + 1, sheet.getLastRow() - 1, 1).getValues();
  var nums  = datos.map(function(r) {
    var v = String(r[0]).replace(/[^0-9]/g, '');
    return parseInt(v) || 0;
  }).filter(function(n) { return n > 0; });
  var siguiente = nums.length > 0 ? Math.max.apply(null, nums) + 1 : 1;
  return 'HE-' + String(siguiente).padStart(4, '0');
}

// Contratos EN RENTA o ENTREGA TOTAL para recolección
function getContratosParaHE() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_contratos');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = function(name) {
    return headers.findIndex(function(h) {
      return String(h).trim().replace('* ','') === name;
    });
  };
  var cols = {
    folio_c                   : idx('folio_c'),
    razon_social              : idx('razon_social'),
    obra                      : idx('obra'),
    estatus                   : idx('estatus'),
    fecha_vencimiento_estimada: idx('fecha_vencimiento_estimada'),
    ubicacion_entrega         : idx('ubicacion_entrega'),
    folio_hs                  : idx('folio_hs'),
  };

  var datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var fmt   = function(v) {
    if (!v) return '';
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    return String(v);
  };

  return datos
    .filter(function(r) {
      var est = String(r[cols.estatus] || '').toUpperCase().trim();
      return r[cols.folio_c] && (est === 'EN RENTA' || est === 'ACTIVO' || est === 'ENTREGA PARCIAL');
    })
    .slice(-50).reverse()
    .map(function(r) {
      return {
        folio_c                   : fmt(r[cols.folio_c]),
        razon_social              : fmt(r[cols.razon_social]),
        obra                      : fmt(r[cols.obra]),
        estatus                   : fmt(r[cols.estatus]),
        fecha_vencimiento_estimada: fmt(r[cols.fecha_vencimiento_estimada]),
        ubicacion_entrega         : fmt(r[cols.ubicacion_entrega]),
        folio_hs                  : fmt(r[cols.folio_hs]),
      };
    });
}

// Cargar contrato + items enviados (de hs_items) para pre-llenar HE
function getContratoParaHE(folio) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Datos del contrato
  var sheetC = ss.getSheetByName('_data_contratos');
  if (!sheetC) return null;
  var headersC = sheetC.getRange(1, 1, 1, sheetC.getLastColumn()).getValues()[0];
  var idxC = function(n) {
    return headersC.findIndex(function(h) { return String(h).trim().replace('* ','') === n; });
  };
  var cols = {
    folio_c          : idxC('folio_c'),
    razon_social     : idxC('razon_social'),
    obra             : idxC('obra'),
    ubicacion_entrega: idxC('ubicacion_entrega'),
    quien_recibe     : idxC('quien_recibe'),
    tipo_operacion   : idxC('tipo_operacion'),
    agente           : idxC('agente'),
  };
  var datosC = sheetC.getRange(2, 1, sheetC.getLastRow() - 1, sheetC.getLastColumn()).getValues();
  var fila   = datosC.find(function(r) { return String(r[cols.folio_c]).trim() === String(folio).trim(); });
  if (!fila) return null;

  var contrato = {};
  Object.keys(cols).forEach(function(k) {
    var v = cols[k] >= 0 ? fila[cols[k]] : '';
    contrato[k] = v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v || '');
  });

  // Items enviados en HS — agrupados por SKU
  var enviados = {};
  var sheetHSI = ss.getSheetByName('_data_hs_items');
  if (sheetHSI && sheetHSI.getLastRow() > 1) {
    var hHSI = sheetHSI.getRange(1, 1, 1, sheetHSI.getLastColumn()).getValues()[0];
    var idxHSI = function(n) { return hHSI.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
    var cFolio = idxHSI('folio_c');
    var cSku   = idxHSI('sku');
    var cDesc  = idxHSI('descripcion');
    var cQty   = idxHSI('cantidad');
    var cPesoU = idxHSI('peso_unitario_kg');

    var dHSI = sheetHSI.getRange(2, 1, sheetHSI.getLastRow() - 1, sheetHSI.getLastColumn()).getValues();
    dHSI.filter(function(r) { return String(r[cFolio]).trim() === String(folio).trim(); })
      .forEach(function(r) {
        var sku = String(r[cSku]).trim();
        if (!sku) return;
        if (!enviados[sku]) {
          enviados[sku] = {
            sku             : sku,
            descripcion     : String(r[cDesc] || ''),
            cantidad_enviada: 0,
            peso_unitario_kg: parseFloat(r[cPesoU]) || 0,
          };
        }
        enviados[sku].cantidad_enviada += parseFloat(r[cQty]) || 0;
      });
  }

  contrato.items = Object.values(enviados);
  return contrato;
}

// Ordenes de fabricación abiertas para HE tipo FABRICACION
function getOrdenesFabricacion() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_fab_ordenes');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = function(n) { return headers.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
  var cols = {
    folio      : idx('folio'),
    producto   : idx('producto'),
    cantidad   : idx('cantidad'),
    estatus    : idx('estatus'),
    fecha_fin  : idx('fecha_fin_programada'),
  };
  if (cols.folio < 0) return [];

  var datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return datos
    .filter(function(r) {
      var est = String(r[cols.estatus] || '').toLowerCase();
      return r[cols.folio] && (est === 'completada' || est === 'en_proceso');
    })
    .map(function(r) {
      var fmt = function(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(v || ''); };
      return {
        folio    : fmt(r[cols.folio]),
        producto : fmt(r[cols.producto]),
        cantidad : parseFloat(r[cols.cantidad]) || 0,
        estatus  : fmt(r[cols.estatus]),
        fecha_fin: fmt(r[cols.fecha_fin]),
      };
    });
}

// Guardar HE completa
function guardarHojaHE(datos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var folioHE = getSiguienteHojaHE();

  // ── 1. Guardar cabecera en _data_he ──
  // Columnas: id|folio_he|folio_c|tipo|almacen_destino|fecha|operador|unidad|num_cliente|expediente|ubicacion_origen|total_piezas|peso_total_kg|estatus|notas
  var sheetHE = ss.getSheetByName('_data_he');
  if (!sheetHE) throw new Error('Pestaña _data_he no encontrada.');

  var totalPiezas = (datos.items || []).reduce(function(s, it) { return s + (parseFloat(it.cantidad_recibida) || 0); }, 0);
  var totalPeso   = (datos.items || []).reduce(function(s, it) { return s + (parseFloat(it.peso_total_kg) || 0); }, 0);
  var nextId      = sheetHE.getLastRow();

  sheetHE.appendRow([
    nextId,                               // id
    folioHE,                              // folio_he
    datos.folio_contrato   || '',         // folio_c
    datos.tipo_entrada     || 'RECOLECCION', // tipo (RECOLECCION o FABRICACION)
    '',                                   // almacen_destino
    datos.fecha_entrada    || '',         // fecha
    datos.operador         || '',         // operador
    '',                                   // unidad
    '',                                   // num_cliente
    datos.folio_fab        || '',         // expediente (folio orden fab si aplica)
    datos.ubicacion_origen || '',         // ubicacion_origen
    totalPiezas,                          // total_piezas
    totalPeso.toFixed(2),                 // peso_total_kg
    'RECOLECTADO',                        // estatus
    datos.notas            || '',         // notas
  ]);

  // ── 2. Guardar items en _data_he_items ──
  Logger.log('HE Step 2 — items recibidos: ' + JSON.stringify(datos.items));
  var sheetHEI = ss.getSheetByName('_data_he_items');
  Logger.log('HE Step 2 — sheetHEI encontrada: ' + (sheetHEI ? 'SÍ' : 'NO'));
  if (sheetHEI) {
    var itemsFiltrados = (datos.items || []).filter(function(item) {
      return item.sku && parseFloat(item.cantidad_recibida) > 0;
    });
    if (itemsFiltrados.length > 0) {
      var primeraFilaLibre = sheetHEI.getLastRow() + 1;
      var filas = itemsFiltrados.map(function(item, i) {
        return [
          primeraFilaLibre + i,                    // id
          folioHE,                                  // folio_he
          datos.folio_contrato || '',               // folio_c
          item.sku             || '',               // sku
          item.descripcion     || '',               // descripcion
          parseFloat(item.cantidad_recibida) || 0,  // cantidad_recibida
          parseFloat(item.peso_unitario_kg)  || 0,  // peso_unitario_kg
          parseFloat(item.peso_total_kg)     || 0,  // peso_total_kg
          item.condicion       || 'Bueno',          // condicion
          item.notas           || '',               // notas
        ];
      });
      sheetHEI.getRange(primeraFilaLibre, 1, filas.length, 10).setValues(filas);
    }
  }

  // ── 3. Actualizar _data_contratos ──
  if (datos.tipo_entrada === 'RECOLECCION' && datos.folio_contrato) {
    var sheetC = ss.getSheetByName('_data_contratos');
    if (sheetC) {
      var hC      = sheetC.getRange(1, 1, 1, sheetC.getLastColumn()).getValues()[0];
      var idxC    = function(n) { return hC.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
      var cFolio  = idxC('folio_c');
      var cEst    = idxC('estatus');
      var cHE     = idxC('folio_he');
      var filasC  = sheetC.getRange(2, cFolio + 1, sheetC.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < filasC.length; i++) {
        if (String(filasC[i][0]).trim() === String(datos.folio_contrato).trim()) {
          var row = i + 2;
          if (cEst >= 0) sheetC.getRange(row, cEst + 1).setValue('RECOLECTADO');
          if (cHE  >= 0) sheetC.getRange(row, cHE  + 1).setValue(folioHE);
          break;
        }
      }
    }
  }

  // ── 4. Actualizar inventario en _data_inventario ──
  var tipoMov = datos.tipo_entrada === 'FABRICACION' ? 'ENTRADA_FAB' : 'ENTRADA_HE';
  actualizarInventario(datos.items || [], folioHE, tipoMov);

  SpreadsheetApp.flush();

  // ── 5. Generar PDF de la HE ──
  var urlPdfHE = '';
  try {
    // Recuperar datos del contrato para enriquecer el PDF
    var datosHePdf = {
      razon_social    : '',
      ubicacion_origen: datos.ubicacion_origen || '',
      telefono        : '',
      agente          : '',
      fecha_entrada   : datos.fecha_entrada || '',
      operador        : datos.operador      || '',
      tipo_entrada    : datos.tipo_entrada  || 'RECOLECCION',
      folio_contrato  : datos.folio_contrato || '',
      notas           : datos.notas         || '',
    };
    // Buscar razon_social del contrato si aplica
    if (datos.folio_contrato) {
      var ssHe  = SpreadsheetApp.getActiveSpreadsheet();
      var shHe  = ssHe.getSheetByName('_data_contratos');
      if (shHe) {
        var hHe  = shHe.getRange(1,1,1,shHe.getLastColumn()).getValues()[0];
        var iHe  = function(n){ return hHe.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
        var dHe  = shHe.getRange(2,1,shHe.getLastRow()-1,shHe.getLastColumn()).getValues();
        var fHe  = dHe.find(function(r){ return String(r[iHe('folio_c')]).trim()===String(datos.folio_contrato).trim(); });
        if (fHe) {
          datosHePdf.razon_social = String(fHe[iHe('razon_social')] || '');
          datosHePdf.agente       = String(fHe[iHe('agente')] || '');
          datosHePdf.telefono     = String(fHe[iHe('movil_recibe')] || '');
        }
      }
    }
    generarPdfHE(datosHePdf, datos.items || [], folioHE);
  } catch(e) { Logger.log('PDF HE error — ' + e.message + ' | stack: ' + e.stack + ' | datosHePdf: ' + JSON.stringify(datosHePdf)); }

  return { ok: true, folio_he: folioHE };
}

// ══════════════════════════════════════════════════════════════
// INVENTARIO — Actualización bidireccional
// Columnas: id|sku|descripcion|inventario_inicial|stock_disponible|
//           stock_dañado|stock_incompleto|ultima_entrada|ultima_salida|ultima_actualizacion
// ══════════════════════════════════════════════════════════════

// ── DIAGNÓSTICO INVENTARIO (ejecutar manualmente en Apps Script) ──
function testInventario() {
  var items = [
    { sku: 'TEST-001', descripcion: 'Prueba', cantidad_recibida: 5, peso_unitario_kg: 2.5, peso_total_kg: 12.5, condicion: 'Bueno' }
  ];
  actualizarInventario(items, 'HE-TEST', 'ENTRADA_HE');
  Logger.log('✓ testInventario completado — revisa _data_inventario');
}

function diagnosticoHE() {
  // Simula exactamente lo que manda el Panel HE
  var datos = {
    tipo_entrada    : 'RECOLECCION',
    folio_contrato  : 'TEST',
    folio_fab       : '',
    fecha_entrada   : '2026-01-01',
    operador        : 'Test',
    ubicacion_origen: 'Test',
    notas           : '',
    items: [
      { sku: 'AND-001', descripcion: 'Andamio tubular', cantidad_recibida: 3, peso_unitario_kg: 5, peso_total_kg: 15, condicion: 'Bueno' },
      { sku: 'AND-002', descripcion: 'Base niveladora',  cantidad_recibida: 2, peso_unitario_kg: 2, peso_total_kg: 4,  condicion: 'Dañado' },
    ]
  };
  Logger.log('Items enviados a actualizarInventario: ' + JSON.stringify(datos.items));
  var tipoMov = 'ENTRADA_HE';
  actualizarInventario(datos.items, 'HE-DIAG', tipoMov);
  Logger.log('✓ Diagnóstico completado');
}

// ══════════════════════════════════════════════════════════════
// INVENTARIO BIDIRECCIONAL
// Columnas FIJAS (A-J):
// A=id  B=sku  C=descripcion  D=inventario_inicial
// E=stock_disponible  F=stock_dañado  G=stock_incompleto
// H=ultima_entrada  I=ultima_salida  J=ultima_actualizacion
// ══════════════════════════════════════════════════════════════
function actualizarInventario(items, folioRef, tipoMovimiento) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_inventario');

  if (!sheet) {
    sheet = ss.insertSheet('_data_inventario');
    sheet.getRange(1, 1, 1, 10).setValues([[
      'id','sku','descripcion','inventario_inicial',
      'stock_disponible','stock_dañado','stock_incompleto',
      'ultima_entrada','ultima_salida','ultima_actualizacion'
    ]]);
    sheet.getRange(1,1,1,10).setBackground('#1f2937').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // Posiciones fijas — no dependen de nombres de encabezado
  var COL = { id:0, sku:1, desc:2, ini:3, disp:4, dan:5, inc:6, ultEnt:7, ultSal:8, ultAct:9 };

  var today     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var esEntrada = tipoMovimiento === 'ENTRADA_HE' || tipoMovimiento === 'ENTRADA_FAB';

  items.forEach(function(item) {
    var sku      = String(item.sku || '').trim();
    // Acepta cantidad_recibida (HE) o cantidad (HS) — defensivo
    var cantidad = esEntrada
      ? (parseFloat(item.cantidad_recibida) || parseFloat(item.cantidad) || 0)
      : (parseFloat(item.cantidad) || parseFloat(item.cantidad_recibida) || 0);
    var condicion = String(item.condicion || 'Bueno');
    if (!sku || cantidad <= 0) return;

    // Buscar SKU en columna B (col 2)
    var lastRow = sheet.getLastRow();
    var filaExis = -1;
    if (lastRow > 1) {
      var skuVals = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (var i = 0; i < skuVals.length; i++) {
        if (String(skuVals[i][0]).trim() === sku) { filaExis = i + 2; break; }
      }
    }

    if (filaExis > 0) {
      var row    = sheet.getRange(filaExis, 1, 1, 10).getValues()[0];
      var disp   = parseFloat(row[COL.disp]) || 0;
      var dan    = parseFloat(row[COL.dan])  || 0;
      var inc    = parseFloat(row[COL.inc])  || 0;

      if (esEntrada) {
        if      (condicion === 'Bueno')      disp += cantidad;
        else if (condicion === 'Dañado')     dan  += cantidad;
        else                                 inc  += cantidad;
        sheet.getRange(filaExis, COL.ultEnt + 1).setValue(folioRef);
      } else {
        disp = Math.max(0, disp - cantidad);
        sheet.getRange(filaExis, COL.ultSal + 1).setValue(folioRef);
      }

      sheet.getRange(filaExis, COL.disp   + 1).setValue(disp);
      sheet.getRange(filaExis, COL.dan    + 1).setValue(dan);
      sheet.getRange(filaExis, COL.inc    + 1).setValue(inc);
      sheet.getRange(filaExis, COL.ultAct + 1).setValue(today);

    } else if (esEntrada) {
      var dispN = condicion === 'Bueno'      ? cantidad : 0;
      var danN  = condicion === 'Dañado'     ? cantidad : 0;
      var incN  = condicion === 'Incompleto' ? cantidad : 0;
      sheet.appendRow([
        lastRow,             // id
        sku,                 // sku
        item.descripcion || '',  // descripcion
        0,                   // inventario_inicial (llenar manual)
        dispN,               // stock_disponible
        danN,                // stock_dañado
        incN,                // stock_incompleto
        folioRef,            // ultima_entrada
        '',                  // ultima_salida
        today,               // ultima_actualizacion
      ]);
    } else {
      Logger.log('AVISO: SKU ' + sku + ' no existe en inventario — salida ' + folioRef + ' no registrada');
    }
  });

  SpreadsheetApp.flush();
}

function testInventarioSalida() {
  var items = [
    { sku: 'TEST-001', descripcion: 'Prueba', cantidad: 2, peso_unitario_kg: 2.5, peso_total_kg: 5, condicion: 'Bueno' }
  ];
  actualizarInventario(items, 'HS-TEST', 'SALIDA_HS');
  Logger.log('✓ testInventarioSalida completado — revisa _data_inventario, TEST-001 debe bajar 2');
}

// ══════════════════════════════════════════════════════════════
// ESTADO DE CUENTA POR FOLIO RAÍZ
// ══════════════════════════════════════════════════════════════

function abrirEstadoCuenta() {
  var ui     = SpreadsheetApp.getUi();
  var result = ui.prompt(
    'Estado de Cuenta — ICAM 360',
    'Ingresa el Folio Raíz:',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;
  var folioRaiz = result.getResponseText().trim();
  if (!folioRaiz) { ui.alert('Folio raíz vacío.'); return; }
  generarEstadoCuenta(folioRaiz);
}

function generarEstadoCuenta(folioRaiz) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var tz  = Session.getScriptTimeZone();
  var fmt = function(v) {
    if (!v && v !== 0) return '';
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'dd/MM/yyyy');
    return String(v);
  };
  var fmtMon = function(v) {
    var n = parseFloat(v) || 0;
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // ── 1. Leer contratos de la cadena ──────────────────────────
  var sheetC = ss.getSheetByName('_data_contratos');
  if (!sheetC) { ui.alert('No se encontró _data_contratos.'); return; }

  var hdrsC = sheetC.getRange(1, 1, 1, sheetC.getLastColumn()).getValues()[0];
  var idxC  = function(n) {
    return hdrsC.findIndex(function(h) { return String(h).trim().replace('* ','') === n; });
  };
  var cc = {
    folio_c                   : idxC('folio_c'),
    folio_raiz                : idxC('folio_raiz'),
    renta_anterior            : idxC('renta_anterior'),
    razon_social              : idxC('razon_social'),
    obra                      : idxC('obra'),
    estatus                   : idxC('estatus'),
    tipo_operacion            : idxC('tipo_operacion'),
    fecha_contrato            : idxC('fecha_contrato'),
    fecha_solicitada          : idxC('fecha_solicitada'),
    fecha_vencimiento_estimada: idxC('fecha_vencimiento_estimada'),
    dias_renta                : idxC('dias_renta'),
    importe                   : idxC('importe'),
    anticipo                  : idxC('anticipo'),
    forma_pago                : idxC('forma_pago'),
    fecha_pago                : idxC('fecha_pago'),
    factura                   : idxC('factura'),
    agente                    : idxC('agente'),
    folio_hs                  : idxC('folio_hs'),
    folio_he                  : idxC('folio_he'),
    ubicacion_entrega         : idxC('ubicacion_entrega'),
    notas                     : idxC('notas'),
  };

  var datosC = sheetC.getLastRow() > 1
    ? sheetC.getRange(2, 1, sheetC.getLastRow() - 1, sheetC.getLastColumn()).getValues()
    : [];

  var contratos = datosC
    .filter(function(r) { return String(r[cc.folio_raiz] || '').trim() === folioRaiz; })
    .map(function(r) {
      var obj = {};
      Object.keys(cc).forEach(function(k) { obj[k] = cc[k] >= 0 ? r[cc[k]] : ''; });
      return obj;
    })
    .sort(function(a, b) { return String(a.folio_c).localeCompare(String(b.folio_c)); });

  if (contratos.length === 0) {
    ui.alert('No se encontraron contratos con folio raíz: ' + folioRaiz);
    return;
  }

  var cliente     = fmt(contratos[0].razon_social);
  var obra        = fmt(contratos[0].obra);
  var ubicacion   = fmt(contratos[0].ubicacion_entrega);

  // ── 2. Leer HS vinculadas ────────────────────────────────────
  var foliosC = contratos.map(function(c) { return String(c.folio_c).trim(); });

  var sheetHS = ss.getSheetByName('_data_hs');
  var hsRows  = [];
  if (sheetHS && sheetHS.getLastRow() > 1) {
    var hdrsHS = sheetHS.getRange(1, 1, 1, sheetHS.getLastColumn()).getValues()[0];
    var idxHS  = function(n) { return hdrsHS.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
    var hsc = {
      folio_hs : idxHS('folio_hs'),
      folio_c  : idxHS('folio_c'),
      fecha    : idxHS('fecha'),
      operador : idxHS('operador'),
      total_piezas : idxHS('total_piezas'),
      peso_total_kg: idxHS('peso_total_kg'),
      estatus  : idxHS('estatus'),
    };
    var datosHS = sheetHS.getRange(2, 1, sheetHS.getLastRow() - 1, sheetHS.getLastColumn()).getValues();
    hsRows = datosHS
      .filter(function(r) { return foliosC.indexOf(String(r[hsc.folio_c]).trim()) >= 0; })
      .map(function(r) { return {
        folio_hs    : fmt(r[hsc.folio_hs]),
        folio_c     : fmt(r[hsc.folio_c]),
        fecha       : fmt(r[hsc.fecha]),
        operador    : fmt(r[hsc.operador]),
        piezas      : r[hsc.total_piezas] || 0,
        peso        : r[hsc.peso_total_kg] || 0,
        estatus     : fmt(r[hsc.estatus]),
      }; });
  }

  // ── 3. Leer HE vinculadas ────────────────────────────────────
  var sheetHE = ss.getSheetByName('_data_he');
  var heRows  = [];
  if (sheetHE && sheetHE.getLastRow() > 1) {
    var hdrsHE = sheetHE.getRange(1, 1, 1, sheetHE.getLastColumn()).getValues()[0];
    var idxHE  = function(n) { return hdrsHE.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
    var hec = {
      folio_he : idxHE('folio_he'),
      folio_c  : idxHE('folio_c'),
      fecha    : idxHE('fecha'),
      operador : idxHE('operador'),
      total_piezas : idxHE('total_piezas'),
      peso_total_kg: idxHE('peso_total_kg'),
      estatus  : idxHE('estatus'),
    };
    var datosHE = sheetHE.getRange(2, 1, sheetHE.getLastRow() - 1, sheetHE.getLastColumn()).getValues();
    heRows = datosHE
      .filter(function(r) { return foliosC.indexOf(String(r[hec.folio_c]).trim()) >= 0; })
      .map(function(r) { return {
        folio_he : fmt(r[hec.folio_he]),
        folio_c  : fmt(r[hec.folio_c]),
        fecha    : fmt(r[hec.fecha]),
        operador : fmt(r[hec.operador]),
        piezas   : r[hec.total_piezas] || 0,
        peso     : r[hec.peso_total_kg] || 0,
        estatus  : fmt(r[hec.estatus]),
      }; });
  }

  // ── 4. Leer hs_items para balance por SKU ───────────────────
  var hsItemsMap = {}; // { sku: { descripcion, entregadas } }
  var sheetHSI = ss.getSheetByName('_data_hs_items');
  if (sheetHSI && sheetHSI.getLastRow() > 1) {
    var hdrsHSI = sheetHSI.getRange(1,1,1,sheetHSI.getLastColumn()).getValues()[0];
    var iHSI = function(n){ return hdrsHSI.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
    var hsiC = {
      folio_hs   : iHSI('folio_hs'),
      folio_c    : iHSI('folio_c'),
      sku        : iHSI('sku'),
      descripcion: iHSI('descripcion'),
      cantidad   : iHSI('cantidad'),
    };
    // Obtener folios HS vinculados a esta cadena
    var foliosHS = hsRows.map(function(h){ return h.folio_hs; });
    var datosHSI = sheetHSI.getRange(2,1,sheetHSI.getLastRow()-1,sheetHSI.getLastColumn()).getValues();
    datosHSI.forEach(function(r) {
      var folioHs = String(r[hsiC.folio_hs] || '').trim();
      var folioC  = String(r[hsiC.folio_c]  || '').trim();
      if (foliosHS.indexOf(folioHs) < 0 && foliosC.indexOf(folioC) < 0) return;
      var sku  = String(r[hsiC.sku]  || '').trim();
      var qty  = parseFloat(r[hsiC.cantidad]) || 0;
      var desc = String(r[hsiC.descripcion] || '');
      if (!sku) return;
      if (!hsItemsMap[sku]) hsItemsMap[sku] = { descripcion: desc, entregadas: 0, recolectadas: 0 };
      hsItemsMap[sku].entregadas += qty;
    });
  }

  // ── 5. Leer he_items para balance por SKU ───────────────────
  var sheetHEI = ss.getSheetByName('_data_he_items');
  if (sheetHEI && sheetHEI.getLastRow() > 1) {
    var hdrsHEI = sheetHEI.getRange(1,1,1,sheetHEI.getLastColumn()).getValues()[0];
    var iHEI = function(n){ return hdrsHEI.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
    var heiC = {
      folio_he         : iHEI('folio_he'),
      folio_c          : iHEI('folio_c'),
      sku              : iHEI('sku'),
      descripcion      : iHEI('descripcion'),
      cantidad_recibida: iHEI('cantidad_recibida'),
      condicion        : iHEI('condicion'),
    };
    var foliosHE = heRows.map(function(h){ return h.folio_he; });
    var datosHEI = sheetHEI.getRange(2,1,sheetHEI.getLastRow()-1,sheetHEI.getLastColumn()).getValues();
    datosHEI.forEach(function(r) {
      var folioHe = String(r[heiC.folio_he] || '').trim();
      var folioC  = String(r[heiC.folio_c]  || '').trim();
      if (foliosHE.indexOf(folioHe) < 0 && foliosC.indexOf(folioC) < 0) return;
      var sku  = String(r[heiC.sku]  || '').trim();
      var qty  = parseFloat(r[heiC.cantidad_recibida]) || 0;
      var desc = String(r[heiC.descripcion] || '');
      if (!sku) return;
      if (!hsItemsMap[sku]) hsItemsMap[sku] = { descripcion: desc, entregadas: 0, recolectadas: 0 };
      hsItemsMap[sku].recolectadas += qty;
    });
  }

  // ── 6. Crear o limpiar hoja de estado de cuenta ─────────────
  var nombreHoja = 'EC-' + folioRaiz;
  var sheetEC = ss.getSheetByName(nombreHoja);
  if (sheetEC) {
    sheetEC.clear();
    sheetEC.clearFormats();
  } else {
    sheetEC = ss.insertSheet(nombreHoja);
  }

  // Mover al final
  ss.setActiveSheet(sheetEC);
  sheetEC.setColumnWidth(1, 30);
  sheetEC.setColumnWidth(2, 120);
  sheetEC.setColumnWidth(3, 200);
  sheetEC.setColumnWidth(4, 130);
  sheetEC.setColumnWidth(5, 130);
  sheetEC.setColumnWidth(6, 100);
  sheetEC.setColumnWidth(7, 120);
  sheetEC.setColumnWidth(8, 120);
  sheetEC.setColumnWidth(9, 120);
  sheetEC.setColumnWidth(10, 150);

  var fila = 1;
  var AZUL_OSC  = '#1e3a5f';
  var AZUL_MED  = '#2563eb';
  var AZUL_CLAR = '#dbeafe';
  var GRIS_CLAR = '#f3f4f6';
  var VERDE     = '#dcfce7';
  var AMBAR     = '#fef9c3';
  var ROJO      = '#fee2e2';
  var BLANCO    = '#ffffff';

  var escribir = function(row, col, valor) {
    sheetEC.getRange(row, col).setValue(valor);
  };
  var rango = function(r, c, nr, nc) { return sheetEC.getRange(r, c, nr, nc); };

  // ── ENCABEZADO PRINCIPAL ─────────────────────────────────────
  rango(fila, 1, 1, 10).merge().setValue('ESTADO DE CUENTA — ICAM 360')
    .setBackground(AZUL_OSC).setFontColor(BLANCO).setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheetEC.setRowHeight(fila, 40);
  fila++;

  rango(fila, 1, 1, 10).merge()
    .setValue('Generado: ' + Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm'))
    .setBackground(AZUL_MED).setFontColor(BLANCO).setFontSize(10).setHorizontalAlignment('right');
  fila++;
  fila++;

  // ── DATOS DEL CLIENTE ────────────────────────────────────────
  rango(fila, 1, 1, 10).merge().setValue('DATOS DEL CLIENTE')
    .setBackground(AZUL_MED).setFontColor(BLANCO).setFontWeight('bold').setFontSize(11);
  fila++;

  var datosCliente = [
    ['Folio Raíz', folioRaiz, 'Cliente', cliente],
    ['Obra', obra, 'Ubicación', ubicacion],
    ['Agente', fmt(contratos[contratos.length-1].agente), 'Total contratos', contratos.length],
  ];
  datosCliente.forEach(function(row) {
    rango(fila, 2, 1, 1).setValue(row[0]).setFontWeight('bold').setBackground(GRIS_CLAR);
    rango(fila, 3, 1, 1).setValue(row[1]);
    rango(fila, 5, 1, 1).setValue(row[2]).setFontWeight('bold').setBackground(GRIS_CLAR);
    rango(fila, 6, 1, 4).merge().setValue(row[3]);
    fila++;
  });
  fila++;

  // ── TABLA DE CONTRATOS ───────────────────────────────────────
  rango(fila, 1, 1, 10).merge().setValue('HISTORIAL DE CONTRATOS')
    .setBackground(AZUL_MED).setFontColor(BLANCO).setFontWeight('bold').setFontSize(11);
  fila++;

  var hdrsContratos = ['Folio', 'Tipo', 'Estatus', 'Fecha Contrato', 'Vencimiento', 'Días', 'Importe', 'Anticipo', 'Saldo', 'Forma Pago'];
  rango(fila, 1, 1, 10).setValues([hdrsContratos])
    .setBackground(AZUL_CLAR).setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center');
  fila++;

  var totalImporte  = 0;
  var totalAnticipo = 0;

  contratos.forEach(function(c) {
    var importe  = parseFloat(c.importe)  || 0;
    var anticipo = parseFloat(c.anticipo) || 0;
    var saldo    = importe - anticipo;
    totalImporte  += importe;
    totalAnticipo += anticipo;

    var est     = String(c.estatus || '').toUpperCase();
    var bgColor = BLANCO;
    if (est === 'ENTREGA PARCIAL') bgColor = AMBAR;
    else if (est === 'ACTIVO') bgColor = '#dbeafe';
    else if (est === 'RECOLECTADO') bgColor = VERDE;
    else if (est === 'CANCELADO') bgColor = ROJO;

    var filaVals = [
      fmt(c.folio_c),
      fmt(c.tipo_operacion),
      fmt(c.estatus),
      fmt(c.fecha_contrato),
      fmt(c.fecha_vencimiento_estimada),
      fmt(c.dias_renta),
      fmtMon(importe),
      fmtMon(anticipo),
      fmtMon(saldo),
      fmt(c.forma_pago),
    ];
    rango(fila, 1, 1, 10).setValues([filaVals]).setBackground(bgColor);
    fila++;
  });

  // Totales contratos
  var totalSaldo = totalImporte - totalAnticipo;
  rango(fila, 1, 1, 6).merge().setValue('TOTALES').setFontWeight('bold').setBackground(AZUL_CLAR).setHorizontalAlignment('right');
  rango(fila, 7, 1, 1).setValue(fmtMon(totalImporte)).setFontWeight('bold').setBackground(AZUL_CLAR);
  rango(fila, 8, 1, 1).setValue(fmtMon(totalAnticipo)).setFontWeight('bold').setBackground(AZUL_CLAR);
  rango(fila, 9, 1, 1).setValue(fmtMon(totalSaldo)).setFontWeight('bold')
    .setBackground(totalSaldo > 0 ? ROJO : VERDE);
  fila += 2;

  // ── TABLA HS ─────────────────────────────────────────────────
  rango(fila, 1, 1, 10).merge().setValue('HOJAS DE SALIDA (ENTREGAS)')
    .setBackground(AZUL_MED).setFontColor(BLANCO).setFontWeight('bold').setFontSize(11);
  fila++;

  if (hsRows.length > 0) {
    var hdrsHS2 = ['Folio HS', 'Contrato', 'Fecha', 'Operador', 'Piezas', 'Peso Kg', 'Estatus', '', '', ''];
    rango(fila, 1, 1, 10).setValues([hdrsHS2])
      .setBackground(AZUL_CLAR).setFontWeight('bold').setHorizontalAlignment('center');
    fila++;
    hsRows.forEach(function(h) {
      rango(fila, 1, 1, 7).setValues([[h.folio_hs, h.folio_c, h.fecha, h.operador, h.piezas, h.peso, h.estatus]]);
      fila++;
    });
  } else {
    rango(fila, 1, 1, 10).merge().setValue('Sin hojas de salida registradas')
      .setFontColor('#9ca3af').setHorizontalAlignment('center');
    fila++;
  }
  fila++;

  // ── TABLA HE ─────────────────────────────────────────────────
  rango(fila, 1, 1, 10).merge().setValue('HOJAS DE ENTRADA (RECOLECCIONES)')
    .setBackground(AZUL_MED).setFontColor(BLANCO).setFontWeight('bold').setFontSize(11);
  fila++;

  if (heRows.length > 0) {
    var hdrsHE2 = ['Folio HE', 'Contrato', 'Fecha', 'Operador', 'Piezas', 'Peso Kg', 'Estatus', '', '', ''];
    rango(fila, 1, 1, 10).setValues([hdrsHE2])
      .setBackground(AZUL_CLAR).setFontWeight('bold').setHorizontalAlignment('center');
    fila++;
    heRows.forEach(function(h) {
      rango(fila, 1, 1, 7).setValues([[h.folio_he, h.folio_c, h.fecha, h.operador, h.piezas, h.peso, h.estatus]]);
      fila++;
    });
  } else {
    rango(fila, 1, 1, 10).merge().setValue('Sin hojas de entrada registradas')
      .setFontColor('#9ca3af').setHorizontalAlignment('center');
    fila++;
  }
  fila++;

  // ── BALANCE DE PIEZAS POR SKU ────────────────────────────────
  rango(fila, 1, 1, 10).merge().setValue('BALANCE DE EQUIPO EN CAMPO')
    .setBackground(AZUL_OSC).setFontColor(BLANCO).setFontWeight('bold').setFontSize(11);
  fila++;

  var skuKeys = Object.keys(hsItemsMap);
  if (skuKeys.length > 0) {
    // Headers
    var hdrsBalance = ['SKU', 'Descripción', 'Entregadas (HS)', 'Recolectadas (HE)', 'En campo', 'Estatus'];
    rango(fila, 1, 1, 6).setValues([hdrsBalance])
      .setBackground(AZUL_CLAR).setFontWeight('bold').setFontSize(10)
      .setHorizontalAlignment('center');
    fila++;

    var totalEntregadas   = 0;
    var totalRecolectadas = 0;

    skuKeys.sort().forEach(function(sku) {
      var d          = hsItemsMap[sku];
      var entregadas  = d.entregadas   || 0;
      var recolectadas= d.recolectadas || 0;
      var enCampo    = entregadas - recolectadas;
      totalEntregadas   += entregadas;
      totalRecolectadas += recolectadas;

      var bgSku   = BLANCO;
      var estatusSku = '';
      if (enCampo < 0) {
        bgSku = ROJO;
        estatusSku = '⚠ Exceso recolectado';
      } else if (enCampo === 0 && entregadas > 0) {
        bgSku = VERDE;
        estatusSku = '✓ Sin faltante';
      } else if (enCampo > 0) {
        bgSku = AMBAR;
        estatusSku = enCampo + ' pzas en campo';
      }

      rango(fila, 1, 1, 6).setValues([[
        sku,
        d.descripcion,
        entregadas,
        recolectadas,
        enCampo,
        estatusSku,
      ]]).setBackground(bgSku);

      // Resaltar en rojo si hay faltante (en campo > 0 y hay alguna HE)
      if (enCampo > 0 && recolectadas > 0) {
        rango(fila, 5, 1, 1).setFontWeight('bold').setFontColor('#b45309');
      } else if (enCampo > 0 && recolectadas === 0) {
        rango(fila, 5, 1, 1).setFontColor('#374151');
      }
      fila++;
    });

    // Fila de totales
    var totalEnCampo = totalEntregadas - totalRecolectadas;
    rango(fila, 1, 1, 2).merge().setValue('TOTALES').setFontWeight('bold').setBackground(AZUL_CLAR);
    rango(fila, 3, 1, 1).setValue(totalEntregadas).setFontWeight('bold').setBackground(AZUL_CLAR).setHorizontalAlignment('center');
    rango(fila, 4, 1, 1).setValue(totalRecolectadas).setFontWeight('bold').setBackground(AZUL_CLAR).setHorizontalAlignment('center');
    rango(fila, 5, 1, 1).setValue(totalEnCampo).setFontWeight('bold')
      .setBackground(totalEnCampo > 0 ? AMBAR : VERDE)
      .setHorizontalAlignment('center');
    rango(fila, 6, 1, 1).setValue(
      totalEnCampo > 0 ? totalEnCampo + ' pzas pendientes de recolectar' : '✓ Todo recolectado'
    ).setBackground(totalEnCampo > 0 ? AMBAR : VERDE);
    fila += 2;
  } else {
    rango(fila, 1, 1, 10).merge().setValue('Sin movimientos de equipo registrados')
      .setFontColor('#9ca3af').setHorizontalAlignment('center');
    fila += 2;
  }

  // ── RESUMEN FINANCIERO ───────────────────────────────────────
  rango(fila, 1, 1, 10).merge().setValue('RESUMEN FINANCIERO')
    .setBackground(AZUL_OSC).setFontColor(BLANCO).setFontWeight('bold').setFontSize(11);
  fila++;

  var resumenFin = [
    ['Total facturado',  fmtMon(totalImporte),  BLANCO],
    ['Total anticipo',   fmtMon(totalAnticipo), VERDE],
    ['Saldo pendiente',  fmtMon(totalSaldo),    totalSaldo > 0 ? ROJO : VERDE],
  ];
  resumenFin.forEach(function(row) {
    rango(fila, 2, 1, 3).merge().setValue(row[0]).setFontWeight('bold').setBackground(GRIS_CLAR);
    rango(fila, 5, 1, 3).merge().setValue(row[1]).setFontSize(13).setFontWeight('bold')
      .setBackground(row[2]).setHorizontalAlignment('center');
    fila++;
  });
  fila++;

  // ── NOTAS POR CONTRATO ───────────────────────────────────────
  var contratosConNotas = contratos.filter(function(c) { return fmt(c.notas); });
  if (contratosConNotas.length > 0) {
    rango(fila, 1, 1, 10).merge().setValue('NOTAS')
      .setBackground(AZUL_MED).setFontColor(BLANCO).setFontWeight('bold').setFontSize(11);
    fila++;
    contratosConNotas.forEach(function(c) {
      rango(fila, 2, 1, 1).setValue(fmt(c.folio_c)).setFontWeight('bold');
      rango(fila, 3, 1, 8).merge().setValue(fmt(c.notas));
      fila++;
    });
  }

  // Borde general
  rango(1, 1, fila - 1, 10).setBorder(true, true, true, true, true, true, '#d1d5db', SpreadsheetApp.BorderStyle.SOLID);

  SpreadsheetApp.flush();
  ui.alert('✅ Estado de cuenta generado en la hoja: ' + nombreHoja);
}

// ══════════════════════════════════════════════════════════════
// RENOVACIÓN DE CONTRATOS
// ══════════════════════════════════════════════════════════════

function abrirPanelRenovacion(folioAnterior) {
  // Guardar folio en PropertiesService para que el panel lo lea al iniciar
  if (folioAnterior) {
    PropertiesService.getScriptProperties().setProperty('FOLIO_RENOVACION_PENDIENTE', folioAnterior);
  }
  var html = HtmlService
    .createHtmlOutputFromFile('PanelRenovacion')
    .setWidth(980)
    .setHeight(780)
    .setTitle('Renovación de Contrato — ICAM 360');
  SpreadsheetApp.getUi().showModalDialog(html, 'Renovación — ICAM 360');
}

function getFolioRenovacionPendiente() {
  var props = PropertiesService.getScriptProperties();
  var folio = props.getProperty('FOLIO_RENOVACION_PENDIENTE') || '';
  props.deleteProperty('FOLIO_RENOVACION_PENDIENTE'); // limpiar después de leer
  return folio;
}

function getDatosParaRenovacion(folioAnterior) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Datos del contrato original ──
  var sheetC = ss.getSheetByName('_data_contratos');
  if (!sheetC) throw new Error('No se encontró _data_contratos');

  var hdrs = sheetC.getRange(1, 1, 1, sheetC.getLastColumn()).getValues()[0];
  var idx  = function(n) { return hdrs.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };

  var cols = {
    folio_c                   : idx('folio_c'),
    folio_raiz                : idx('folio_raiz'),
    razon_social              : idx('razon_social'),
    cliente_id                : idx('cliente_id'),
    obra                      : idx('obra'),
    direccion_proyecto        : idx('direccion_proyecto'),
    ubicacion_entrega         : idx('ubicacion_entrega'),
    quien_recibe              : idx('quien_recibe'),
    movil_recibe              : idx('movil_recibe'),
    requiere_flete            : idx('requiere_flete'),
    flete_a_cargo_de          : idx('flete_a_cargo_de'),
    distancia_km              : idx('distancia_km'),
    costo_flete               : idx('costo_flete'),
    medio_contacto            : idx('medio_contacto'),
    dias_renta                : idx('dias_renta'),
    importe                   : idx('importe'),
    anticipo                  : idx('anticipo'),
    subtotal                  : idx('subtotal'),
    iva                       : idx('iva'),
    renta_diaria              : idx('renta_diaria'),
    peso_total_kg             : idx('peso_total_kg'),
    forma_pago                : idx('forma_pago'),
    agente                    : idx('agente'),
    costo_entrega             : idx('costo_entrega'),
    costo_recoleccion         : idx('costo_recoleccion'),
    costo_armado              : idx('costo_armado'),
    costo_desarmado           : idx('costo_desarmado'),
    otros_cargos              : idx('otros_cargos'),
    pagare_lugar              : idx('pagare_lugar'),
    notas                     : idx('notas'),
    estatus                   : idx('estatus'),
  };

  var datos  = sheetC.getRange(2, 1, sheetC.getLastRow() - 1, sheetC.getLastColumn()).getValues();
  var fila   = datos.find(function(r) { return String(r[cols.folio_c]).trim() === String(folioAnterior).trim(); });
  if (!fila) throw new Error('Contrato ' + folioAnterior + ' no encontrado.');

  var fmt = function(v) {
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return v === null || v === undefined ? '' : String(v);
  };

  var contrato = {};
  Object.keys(cols).forEach(function(k) { contrato[k] = cols[k] >= 0 ? fmt(fila[cols[k]]) : ''; });

  // ── Items del contrato original ──
  var sheetI   = ss.getSheetByName('_data_contrato_items');
  var items    = [];
  if (sheetI && sheetI.getLastRow() > 1) {
    var hdrsI  = sheetI.getRange(1, 1, 1, sheetI.getLastColumn()).getValues()[0];
    var idxI   = function(n) { return hdrsI.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
    var ic = {
      folio_c         : idxI('folio_c'),
      sku             : idxI('sku'),
      descripcion     : idxI('descripcion'),
      cantidad        : idxI('cantidad'),
      unidad_medida   : idxI('unidad_medida'),
      peso_unitario_kg: idxI('peso_unitario_kg'),
      tarifa_dia      : idxI('tarifa_dia'),
    };
    var datosI = sheetI.getRange(2, 1, sheetI.getLastRow() - 1, sheetI.getLastColumn()).getValues();
    items = datosI
      .filter(function(r) { return String(r[ic.folio_c]).trim() === String(folioAnterior).trim(); })
      .map(function(r) { return {
        sku             : fmt(r[ic.sku]),
        descripcion     : fmt(r[ic.descripcion]),
        cantidad        : parseFloat(r[ic.cantidad]) || 0,
        unidad_medida   : fmt(r[ic.unidad_medida]) || 'PZA',
        peso_unitario_kg: parseFloat(r[ic.peso_unitario_kg]) || 0,
        peso_total_kg   : (parseFloat(r[ic.cantidad]) || 0) * (parseFloat(r[ic.peso_unitario_kg]) || 0),
        tarifa_dia      : parseFloat(r[ic.tarifa_dia]) || 0,
      }; });
  }

  // ── Siguiente folio ──
  var siguienteFolio = getSiguienteFolio();

  return {
    contrato       : contrato,
    items          : items,
    siguiente_folio: siguienteFolio,
  };
}

function guardarRenovacion(datos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = Session.getScriptTimeZone();

  // ── 1. Marcar contrato anterior como RENOVACION ──
  var sheetC = ss.getSheetByName('_data_contratos');
  var hdrs   = sheetC.getRange(1, 1, 1, sheetC.getLastColumn()).getValues()[0];
  var idx    = function(n) { return hdrs.findIndex(function(h) { return String(h).trim().replace('* ','') === n; }); };
  var cFolio = idx('folio_c');
  var cEst   = idx('estatus');
  var cRentaPost = idx('renta_posterior');

  var filas  = sheetC.getRange(2, cFolio + 1, sheetC.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i][0]).trim() === String(datos.renta_anterior).trim()) {
      var rowNum = i + 2;
      if (cEst       >= 0) sheetC.getRange(rowNum, cEst       + 1).setValue('RENOVACION');
      if (cRentaPost >= 0) sheetC.getRange(rowNum, cRentaPost + 1).setValue(datos.folio_c);
      break;
    }
  }

  // ── 2. Calcular folio_raiz ──
  var folioRaiz = datos.folio_c;
  var filaAnt   = filas.find(function(r) { return String(r[0]).trim() === String(datos.renta_anterior).trim(); });
  if (filaAnt) {
    var cRaiz = idx('folio_raiz');
    var raizAnt = cRaiz >= 0 ? String(sheetC.getRange(filas.indexOf(filaAnt) + 2, cRaiz + 1).getValue()) : '';
    if (raizAnt) folioRaiz = raizAnt;
  }

  // ── 3. Calcular fecha vencimiento ──
  var fechaInicio = datos.fecha_contrato || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var vence = '';
  if (fechaInicio && datos.dias_renta) {
    var d = new Date(fechaInicio + 'T12:00:00');
    d.setDate(d.getDate() + parseInt(datos.dias_renta));
    vence = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  }

  // ── 4. Guardar nuevo contrato vía guardarContrato ──
  var payload = {
    folio_c                   : datos.folio_c,
    folio_raiz                : folioRaiz,
    renta_anterior            : datos.renta_anterior,
    renta_posterior           : '',
    tipo_operacion            : 'RENTA',
    cliente_id                : datos.cliente_id || '',
    razon_social              : datos.razon_social,
    obra                      : datos.obra,
    direccion_proyecto        : datos.direccion_proyecto || '',
    ubicacion_entrega         : datos.ubicacion_entrega,
    quien_recibe              : datos.quien_recibe,
    movil_recibe              : datos.movil_recibe || '',
    requiere_flete            : datos.requiere_flete || 'NO',
    flete_a_cargo_de          : datos.flete_a_cargo_de || '',
    distancia_km              : datos.distancia_km || '',
    costo_flete               : datos.costo_flete || '',
    medio_contacto            : datos.medio_contacto || '',
    dias_renta                : datos.dias_renta,
    fecha_contrato            : datos.fecha_contrato,
    fecha_solicitada          : datos.fecha_solicitada || datos.fecha_contrato,
    fecha_vencimiento_estimada: vence,
    anticipo                  : datos.anticipo || '',
    subtotal                  : datos.subtotal || '',
    costo_entrega             : datos.costo_entrega || '',
    costo_recoleccion         : datos.costo_recoleccion || '',
    costo_armado              : datos.costo_armado || '',
    costo_desarmado           : datos.costo_desarmado || '',
    otros_cargos              : datos.otros_cargos || '',
    iva                       : datos.iva || '',
    importe                   : datos.importe || '',
    renta_diaria              : datos.renta_diaria || '',
    peso_total_kg             : datos.peso_total_kg || '',
    forma_pago                : datos.forma_pago || '',
    fecha_pago                : datos.fecha_pago || '',
    factura                   : datos.factura || '',
    agente                    : datos.agente || '',
    pagare_monto              : datos.pagare_monto || '',
    pagare_lugar              : datos.pagare_lugar || 'Toluca, Estado de México',
    pagare_fecha              : datos.fecha_contrato || '',
    notas                     : datos.notas || '',
    items                     : datos.items || [],
  };

  return guardarContrato(payload);
}

// ══════════════════════════════════════════════════════════════
// MÓDULO PAGOS
// Hoja: _data_pagos
// Cols: id | folio_c | fecha | tipo | monto | referencia | notas | registrado_por | created_at
// ══════════════════════════════════════════════════════════════

function _initPagos() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_pagos');
  if (!sheet) {
    sheet = ss.insertSheet('_data_pagos');
    var hdrs = ['id','folio_c','fecha','tipo','monto','referencia','notas','registrado_por','created_at'];
    sheet.getRange(1,1,1,hdrs.length).setValues([hdrs])
      .setBackground('#1f2937').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  return sheet;
}

function getPagosContrato(folioC) {
  var sheet = _initPagos();
  if (sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2,1,sheet.getLastRow()-1,9).getValues();
  var tz   = Session.getScriptTimeZone();
  return data
    .filter(function(r){ return String(r[1]).trim() === String(folioC).trim(); })
    .map(function(r){
      return {
        id         : r[0],
        folio_c    : r[1],
        fecha      : r[2] instanceof Date ? Utilities.formatDate(r[2],tz,'dd/MM/yyyy') : String(r[2]),
        tipo       : r[3],
        monto      : parseFloat(r[4]) || 0,
        referencia : r[5],
        notas      : r[6],
      };
    });
}

function registrarPago(folioC, pago) {
  var sheet = _initPagos();
  var id    = sheet.getLastRow(); // auto-increment
  var tz    = Session.getScriptTimeZone();
  var hoy   = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  sheet.appendRow([
    id,
    folioC,
    pago.fecha     || hoy,
    pago.tipo      || 'Abono parcial',
    parseFloat(pago.monto) || 0,
    pago.referencia || '',
    pago.notas      || '',
    Session.getEffectiveUser().getEmail(),
    hoy,
  ]);

  // Actualizar saldo en _data_contratos (columna saldo_pagado si existe)
  _actualizarSaldoContrato(folioC);

  return { ok: true };
}

function eliminarPago(folioC, pagoId) {
  var sheet = _initPagos();
  if (sheet.getLastRow() < 2) return { ok: false };
  var data  = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(pagoId)) {
      sheet.deleteRow(i + 2);
      _actualizarSaldoContrato(folioC);
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Pago no encontrado' };
}

function _actualizarSaldoContrato(folioC) {
  // Suma todos los pagos del folio y los deja disponibles para el panel
  // (el saldo se calcula en el cliente: importe - anticipo - sum(pagos))
  // No se modifica _data_contratos para no alterar columnas fijas
}

function getSaldoContrato(folioC) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheetC = ss.getSheetByName('_data_contratos');
  var importe = 0, anticipo = 0;
  if (sheetC && sheetC.getLastRow() > 1) {
    var hdrs = sheetC.getRange(1,1,1,sheetC.getLastColumn()).getValues()[0];
    var iF   = hdrs.findIndex(function(h){ return String(h).trim().replace('* ','') === 'folio_c'; });
    var iI   = hdrs.findIndex(function(h){ return String(h).trim().replace('* ','') === 'importe'; });
    var iA   = hdrs.findIndex(function(h){ return String(h).trim().replace('* ','') === 'anticipo'; });
    if (iF >= 0) {
      var rows = sheetC.getRange(2,1,sheetC.getLastRow()-1,sheetC.getLastColumn()).getValues();
      var fila = rows.find(function(r){ return String(r[iF]).trim() === String(folioC).trim(); });
      if (fila) {
        importe  = parseFloat(fila[iI]) || 0;
        anticipo = parseFloat(fila[iA]) || 0;
      }
    }
  }
  var pagos      = getPagosContrato(folioC);
  var sumaPagos  = pagos.reduce(function(s,p){ return s + p.monto; }, 0);
  var saldo      = importe - anticipo - sumaPagos;
  return {
    importe  : importe,
    anticipo : anticipo,
    pagado   : anticipo + sumaPagos,
    saldo    : Math.max(0, saldo),
    pagos    : pagos,
  };
}

// ══════════════════════════════════════════════════════════════
// MÓDULO REPORTE SEMANAL
// Hoja: _data_agentes  Cols: id | nombre | email | activo
// Trigger: sábado automático — envía a revisor de contratos
// Config en PropertiesService:
//   EMAIL_REVISOR  → correo del revisor de contratos
//   EMAIL_BCC      → tu correo (copia oculta)
// ══════════════════════════════════════════════════════════════

function _initAgentes() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_data_agentes');
  if (!sheet) {
    sheet = ss.insertSheet('_data_agentes');
    sheet.getRange(1,1,1,4).setValues([['id','nombre','email','activo']])
      .setBackground('#1f2937').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAgentes() {
  var sheet = _initAgentes();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues()
    .filter(function(r){ return r[0] && String(r[3]).toUpperCase() === 'SI'; })
    .map(function(r){ return { id:r[0], nombre:String(r[1]).trim(), email:String(r[2]).trim() }; });
}

function guardarAgente(ag) {
  var sheet = _initAgentes();
  if (ag.id) {
    // update
    var data = sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues();
    for (var i=0;i<data.length;i++) {
      if (String(data[i][0])===String(ag.id)) {
        sheet.getRange(i+2,1,1,4).setValues([[ag.id, ag.nombre, ag.email, ag.activo||'SI']]);
        return {ok:true};
      }
    }
  }
  var id = sheet.getLastRow();
  sheet.appendRow([id, ag.nombre, ag.email, ag.activo||'SI']);
  return {ok:true};
}

function getConfigReporte() {
  var props = PropertiesService.getScriptProperties();
  return {
    email_revisor: props.getProperty('EMAIL_REVISOR') || '',
    email_bcc    : props.getProperty('EMAIL_BCC')     || '',
  };
}

function guardarConfigReporte(cfg) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('EMAIL_REVISOR', cfg.email_revisor || '');
  props.setProperty('EMAIL_BCC',     cfg.email_bcc     || '');
  return {ok:true};
}

function _getReporteData() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var tz  = Session.getScriptTimeZone();
  var hoy = new Date(); hoy.setHours(0,0,0,0);

  // Rango semana: lunes pasado → próximo lunes
  var diaSemana = hoy.getDay(); // 0=dom, 1=lun...6=sab
  var diasDesde = diaSemana === 0 ? 6 : diaSemana - 1;
  var lunes     = new Date(hoy); lunes.setDate(hoy.getDate() - diasDesde);
  var proxLunes = new Date(lunes); proxLunes.setDate(lunes.getDate() + 7);

  var fmt = function(d) {
    if (!d || !(d instanceof Date)) return '—';
    return Utilities.formatDate(d, tz, 'dd/MM/yyyy');
  };

  var sheetC = ss.getSheetByName('_data_contratos');
  if (!sheetC || sheetC.getLastRow() < 2) return {};

  var hdrs = sheetC.getRange(1,1,1,sheetC.getLastColumn()).getValues()[0];
  var idx  = function(n){ return hdrs.findIndex(function(h){ return String(h).trim().replace('* ','')===n; }); };
  var cols = {
    folio_c       : idx('folio_c'),
    folio_raiz    : idx('folio_raiz'),
    renta_anterior: idx('renta_anterior'),
    tipo_operacion: idx('tipo_operacion'),
    razon_social  : idx('razon_social'),
    agente        : idx('agente'),
    estatus       : idx('estatus'),
    fecha_contrato: idx('fecha_contrato'),
    fecha_vence   : idx('fecha_vencimiento_estimada'),
    importe       : idx('importe'),
    anticipo      : idx('anticipo'),
  };

  var rows   = sheetC.getRange(2,1,sheetC.getLastRow()-1,sheetC.getLastColumn()).getValues();
  var pagos  = {};

  // Pre-cargar saldos
  var sheetP = ss.getSheetByName('_data_pagos');
  if (sheetP && sheetP.getLastRow() > 1) {
    sheetP.getRange(2,1,sheetP.getLastRow()-1,5).getValues().forEach(function(r){
      var fc = String(r[1]).trim();
      pagos[fc] = (pagos[fc]||0) + (parseFloat(r[4])||0);
    });
  }

  // Agrupar por agente
  var porAgente = {}; // { nombre: { adeudos, porVencer, nuevos, ventas } }

  rows.forEach(function(r) {
    var agente = String(r[cols.agente]||'').trim() || 'SIN AGENTE';
    var tipo   = String(r[cols.tipo_operacion]||'').trim().toUpperCase();
    var est    = String(r[cols.estatus]||'').trim().toUpperCase();
    var folio  = String(r[cols.folio_c]||'').trim();
    if (!folio) return;

    if (!porAgente[agente]) porAgente[agente] = { adeudos:[], porVencer:[], nuevos:[], ventas:[] };

    var importe  = parseFloat(r[cols.importe]) || 0;
    var anticipo = parseFloat(r[cols.anticipo]) || 0;
    var abonos   = pagos[folio] || 0;
    var saldo    = Math.max(0, importe - anticipo - abonos);

    var fechaCont = r[cols.fecha_contrato];
    var fechaVence= r[cols.fecha_vence];

    var obj = {
      folio     : folio,
      cliente   : String(r[cols.razon_social]||'').trim(),
      tipo      : tipo,
      estatus   : est,
      fecha_cont: fmt(fechaCont instanceof Date ? fechaCont : null),
      fecha_vence:fmt(fechaVence instanceof Date ? fechaVence : null),
      importe   : importe,
      saldo     : saldo,
    };

    // Adeudos: contratos activos con saldo > 0
    if ((est === 'ACTIVO' || est === 'ENTREGA PARCIAL') && saldo > 0) {
      porAgente[agente].adeudos.push(obj);
    }

    // Por vencer: fecha_vence entre hoy y próximo lunes
    if (fechaVence instanceof Date && fechaVence >= hoy && fechaVence < proxLunes &&
        (est === 'ACTIVO' || est === 'ENTREGA PARCIAL')) {
      porAgente[agente].porVencer.push(obj);
    }

    // Nuevos/renovados esta semana: fecha_contrato entre lunes y hoy
    if (fechaCont instanceof Date && fechaCont >= lunes && fechaCont <= hoy) {
      if (tipo === 'RENTA') porAgente[agente].nuevos.push(obj);
      if (tipo === 'VENTA' || tipo === 'VENTA PERDIDA') porAgente[agente].ventas.push(obj);
    }
  });

  return {
    porAgente : porAgente,
    semana    : fmt(lunes) + ' — ' + fmt(proxLunes),
    generado  : fmt(hoy),
  };
}

function _htmlReporteAgente(agente, data, semana) {
  var moneda = function(n) { return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',' ); };
  var th = 'style="padding:6px 10px;background:#1f2937;color:#fff;font-size:11px;text-align:left;"';
  var td = 'style="padding:6px 10px;font-size:12px;border-bottom:1px solid #e5e7eb;"';
  var tdR= 'style="padding:6px 10px;font-size:12px;border-bottom:1px solid #e5e7eb;text-align:right;"';

  function tabla(titulo, color, columnas, filas, vacia) {
    var h = '<h3 style="margin:16px 0 6px;font-size:13px;color:'+color+';">'+titulo+'</h3>';
    if (!filas || !filas.length) return h+'<p style="color:#9ca3af;font-size:12px;margin:0 0 12px;">'+vacia+'</p>';
    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">';
    h += '<thead><tr>'+columnas.map(function(c){ return '<th '+th+'>'+c+'</th>'; }).join('')+'</tr></thead><tbody>';
    filas.forEach(function(f){ h += '<tr>'+f+'</tr>'; });
    return h+'</tbody></table>';
  }

  var html = '<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">'
    + '<div style="background:#1e3a5f;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">'
    + '<h2 style="margin:0;font-size:16px;">Reporte Semanal — '+agente+'</h2>'
    + '<p style="margin:4px 0 0;font-size:12px;opacity:.8;">Semana: '+semana+'</p>'
    + '</div>'
    + '<div style="background:#f9fafb;padding:16px 20px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">';

  // Adeudos
  html += tabla('⚠️ Contratos con Adeudo','#b45309',
    ['Folio','Cliente','Importe','Saldo pendiente'],
    (data.adeudos||[]).map(function(c){
      return '<td '+td+'>'+c.folio+'</td><td '+td+'>'+c.cliente+'</td>'
        +'<td '+tdR+'>'+moneda(c.importe)+'</td>'
        +'<td '+tdR+' style="color:#dc2626;font-weight:700;">'+moneda(c.saldo)+'</td>';
    }),
    'Sin adeudos esta semana ✓'
  );

  // Por vencer
  html += tabla('📅 Por Vencer la Próxima Semana','#1d4ed8',
    ['Folio','Cliente','Vence','Días'],
    (data.porVencer||[]).map(function(c){
      var dias = c.fecha_vence !== '—'
        ? Math.round((new Date(c.fecha_vence.split('/').reverse().join('-')) - new Date()) / 86400000)
        : '—';
      return '<td '+td+'>'+c.folio+'</td><td '+td+'>'+c.cliente+'</td>'
        +'<td '+td+'>'+c.fecha_vence+'</td>'
        +'<td '+tdR+' style="color:#d97706;font-weight:700;">'+(typeof dias==='number'?dias+'d':dias)+'</td>';
    }),
    'Sin contratos por vencer esta semana'
  );

  // Nuevos/renovados
  html += tabla('🆕 Contratos Nuevos / Renovados','#059669',
    ['Folio','Cliente','Fecha','Importe'],
    (data.nuevos||[]).map(function(c){
      return '<td '+td+'>'+c.folio+'</td><td '+td+'>'+c.cliente+'</td>'
        +'<td '+td+'>'+c.fecha_cont+'</td><td '+tdR+'>'+moneda(c.importe)+'</td>';
    }),
    'Sin contratos nuevos esta semana'
  );

  // Ventas
  html += tabla('🛒 Ventas de la Semana','#7c3aed',
    ['Folio','Cliente','Fecha','Importe'],
    (data.ventas||[]).map(function(c){
      return '<td '+td+'>'+c.folio+'</td><td '+td+'>'+c.cliente+'</td>'
        +'<td '+td+'>'+c.fecha_cont+'</td><td '+tdR+'>'+moneda(c.importe)+'</td>';
    }),
    'Sin ventas esta semana'
  );

  html += '<p style="font-size:11px;color:#9ca3af;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:8px;">'
    +'Este reporte fue generado automáticamente por ICAM 360 ERP. '
    +'Por favor revisa y reenvía a cada agente según corresponda.</p>'
    +'</div></div>';
  return html;
}

function enviarReporteSemanal() {
  var props   = PropertiesService.getScriptProperties();
  var revisor = props.getProperty('EMAIL_REVISOR') || '';
  var bcc     = props.getProperty('EMAIL_BCC')     || '';

  if (!revisor) {
    Logger.log('EMAIL_REVISOR no configurado. Usa guardarConfigReporte().');
    return;
  }

  var reporte = _getReporteData();
  var semana  = reporte.semana || '';
  var enviados = 0;

  Object.keys(reporte.porAgente || {}).forEach(function(agente) {
    var data = reporte.porAgente[agente];
    var totalItems = (data.adeudos||[]).length + (data.porVencer||[]).length
                   + (data.nuevos||[]).length  + (data.ventas||[]).length;
    if (totalItems === 0) return; // no enviar si no hay nada

    var html = _htmlReporteAgente(agente, data, semana);
    var opts = { htmlBody: html };
    if (bcc) opts.bcc = bcc;

    GmailApp.sendEmail(
      revisor,
      '[ICAM 360] Reporte Semanal — ' + agente + ' — ' + semana,
      'Este correo requiere un cliente compatible con HTML.',
      opts
    );
    enviados++;
    Utilities.sleep(300);
  });

  Logger.log('✓ Reporte semanal enviado: ' + enviados + ' correos para ' + revisor);
}

// Instalar trigger semanal (ejecutar UNA vez desde editor)
function instalarTriggerSemanal() {
  // Eliminar triggers previos del mismo tipo
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'enviarReporteSemanal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarReporteSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SATURDAY)
    .atHour(8) // 8 AM
    .create();
  SpreadsheetApp.getUi().alert('✅ Trigger semanal instalado: sábados a las 8 AM');
}

// ══════════════════════════════════════════════════════════════
// MÓDULO VENTA POR PÉRDIDA
// Al guardar contrato tipo VENTA PERDIDA → genera HS automática
// folio HS: HSP-{folio_c}
// ══════════════════════════════════════════════════════════════

function guardarVentaPerdida(datos) {
  // 1. Guardar contrato normalmente
  datos.tipo_operacion = 'VENTA PERDIDA';
  var resultado = guardarContrato(datos);
  if (!resultado.ok) return resultado;

  // 2. Generar HS automática
  var folioHS = 'HSP-' + datos.folio_c;
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var tz      = Session.getScriptTimeZone();
  var hoy     = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  // Guardar en _data_hs
  var sheetHS = ss.getSheetByName('_data_hs');
  if (!sheetHS) throw new Error('Hoja _data_hs no encontrada');

  var totalPiezas = (datos.items||[]).reduce(function(s,i){ return s+(parseFloat(i.cantidad)||0); },0);
  var totalPeso   = (datos.items||[]).reduce(function(s,i){ return s+(parseFloat(i.peso_total_kg)||0); },0);

  sheetHS.appendRow([
    sheetHS.getLastRow(),
    folioHS,
    datos.folio_c,
    'VENTA PERDIDA',
    'BODEGA',
    hoy,
    'SISTEMA',
    '',
    datos.cliente_id || '',
    datos.folio_raiz || datos.folio_c,
    datos.ubicacion_entrega || '',
    datos.agente || '',
    totalPiezas,
    totalPeso,
    'ACTIVO',
    'Generado automáticamente por venta por pérdida',
  ]);

  // Guardar items en _data_hs_items
  var sheetHSI = ss.getSheetByName('_data_hs_items');
  if (!sheetHSI) throw new Error('Hoja _data_hs_items no encontrada');

  var idxHSI = sheetHSI.getLastRow();
  (datos.items||[]).forEach(function(item) {
    idxHSI++;
    sheetHSI.appendRow([
      idxHSI,
      folioHS,
      datos.folio_c,
      item.sku,
      item.descripcion,
      parseFloat(item.cantidad) || 0,
      parseFloat(item.peso_unitario_kg) || 0,
      parseFloat(item.peso_total_kg)    || 0,
      'Pérdida de equipo',
    ]);
  });

  // 3. Descontar inventario
  try {
    actualizarInventario(datos.items || [], folioHS, 'SALIDA_HS');
  } catch(e) { Logger.log('Inventario venta perdida: ' + e.message); }

  // 4. Actualizar estatus del contrato a ACTIVO (entrega inmediata)
  try { actualizarEstatusContrato(datos.folio_c, 'ACTIVO'); } catch(e) {}

  SpreadsheetApp.flush();

  return { ok: true, folio: datos.folio_c, folio_hs: folioHS };
}

// ══════════════════════════════════════════════════════════════
// APERTURA DE PANELES — helpers para PanelPagos y config
// ══════════════════════════════════════════════════════════════

function abrirPanelPagos(folioC, cliente) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('PANEL_PAGOS_FOLIO',   folioC  || '');
  props.setProperty('PANEL_PAGOS_CLIENTE', cliente || '');
  var html = HtmlService.createHtmlOutputFromFile('PanelPagos')
    .setWidth(580).setHeight(620).setTitle('Pagos — ' + folioC);
  SpreadsheetApp.getUi().showModalDialog(html, 'Pagos — ' + folioC);
}

function getPanelPagosParams() {
  var props = PropertiesService.getUserProperties();
  return {
    folio_c: props.getProperty('PANEL_PAGOS_FOLIO')   || '',
    cliente: props.getProperty('PANEL_PAGOS_CLIENTE') || '',
  };
}

// Panel de configuración de agentes y emails (abre modal simple)
function abrirConfigReporte() {
  var ui   = SpreadsheetApp.getUi();
  var cfg  = getConfigReporte();
  var resp = ui.prompt('Reporte Semanal — Email revisor',
    'Email actual: ' + (cfg.email_revisor||'(vacío)') + '\nIngresa el nuevo email del revisor de contratos:',
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var revisor = resp.getResponseText().trim();
  if (!revisor) { ui.alert('Email no puede estar vacío'); return; }

  var resp2 = ui.prompt('Reporte Semanal — Email BCC (copia oculta)',
    'Email BCC actual: ' + (cfg.email_bcc||'(vacío)') + '\nIngresa tu email para copia oculta:',
    ui.ButtonSet.OK_CANCEL);
  var bcc = resp2.getSelectedButton() === ui.Button.OK ? resp2.getResponseText().trim() : '';

  guardarConfigReporte({ email_revisor: revisor, email_bcc: bcc });
  ui.alert('✅ Configuración guardada.\nRevisor: ' + revisor + (bcc ? '\nBCC: ' + bcc : ''));
}

// Menú del sistema — llama a esto desde onOpen
function agregarMenuReportes(menu) {
  menu.addItem('📧 Configurar emails reporte semanal', 'abrirConfigReporte')
      .addItem('📧 Instalar trigger sábado', 'instalarTriggerSemanal')
      .addItem('📧 Enviar reporte ahora (prueba)', 'enviarReporteSemanal');
}

// ══════════════════════════════════════════════════════════════
// UTILIDADES DE LIMPIEZA
// ══════════════════════════════════════════════════════════════

// Elimina un contrato de prueba de TODAS las hojas relacionadas
// Ejecutar desde el editor: eliminarContratoPrueba('20000')
function eliminarContratoPrueba(folioC) {
  if (!folioC) {
    SpreadsheetApp.getUi().alert('Indica el folio a eliminar');
    return;
  }
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var folio  = String(folioC).trim();
  var resumen = [];

  var hojas = [
    '_data_contratos',
    '_data_contrato_items',
    '_data_hs',
    '_data_hs_items',
    '_data_he',
    '_data_he_items',
    '_data_pagos',
  ];

  hojas.forEach(function(nombre) {
    var sheet = ss.getSheetByName(nombre);
    if (!sheet || sheet.getLastRow() < 2) return;

    var datos   = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var hdrs    = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    // Buscar columna folio_c o folio (según la hoja)
    var colFolio = hdrs.findIndex(function(h) {
      var n = String(h).trim().replace('* ','').toLowerCase();
      return n === 'folio_c' || n === 'folio';
    });
    if (colFolio < 0) return;

    // Recorrer de abajo hacia arriba para no alterar índices al borrar
    var eliminadas = 0;
    for (var i = datos.length - 1; i >= 0; i--) {
      if (String(datos[i][colFolio]).trim() === folio) {
        sheet.deleteRow(i + 2);
        eliminadas++;
      }
    }
    if (eliminadas > 0) resumen.push(nombre + ': ' + eliminadas + ' fila(s)');
  });

  // También limpiar folio_raiz en contratos que apuntaban a este folio como renta_anterior
  var sheetC = ss.getSheetByName('_data_contratos');
  if (sheetC && sheetC.getLastRow() > 1) {
    var hdrsC   = sheetC.getRange(1,1,1,sheetC.getLastColumn()).getValues()[0];
    var iRA     = hdrsC.findIndex(function(h){ return String(h).trim().replace('* ','') === 'renta_anterior'; });
    if (iRA >= 0) {
      var datosC = sheetC.getRange(2,1,sheetC.getLastRow()-1,sheetC.getLastColumn()).getValues();
      datosC.forEach(function(r, i) {
        if (String(r[iRA]).trim() === folio) {
          sheetC.getRange(i + 2, iRA + 1).setValue('');
        }
      });
    }
  }

  var msg = resumen.length > 0
    ? '✅ Folio ' + folio + ' eliminado de:\n' + resumen.join('\n')
    : '⚠ No se encontró el folio ' + folio + ' en ninguna hoja';
  SpreadsheetApp.getUi().alert(msg);
  Logger.log(msg);
}