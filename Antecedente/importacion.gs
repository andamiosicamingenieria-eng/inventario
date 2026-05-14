// ============================================================
// ICAM 360 — Script de Migración de Datos Históricos
// Google Apps Script (V8 Runtime)
// ============================================================
// INSTRUCCIONES DE USO:
//
// 1. Abre el archivo ICAM360_Contratos en Google Sheets
// 2. Ve a Extensiones → Apps Script
// 3. Pega ESTE archivo completo en un nuevo archivo .gs
// 4. Sube el archivo ICAM360_Normalizado.xlsx a Google Sheets
//    y cópialo como una pestaña temporal llamada "migracion_raw"
//    (o ajusta SHEET_ORIGEN abajo)
// 5. Ejecuta primero: probarMigracion()  → revisa 10 filas
// 6. Si todo se ve bien: ejecutarMigracionCompleta()
//
// El script crea/llena las siguientes pestañas:
//   _data_contratos, _data_contrato_items
//   _data_hs, _data_hs_items, _data_he, _data_he_items
//   _data_clientes, _data_productos
// ============================================================

// ── CONFIGURACIÓN ────────────────────────────────────────────
// Nombre del archivo de origen (debe estar importado como pestaña en el mismo Sheets)
// Sube el ICAM360_Normalizado.xlsx y convierte cada sheet a pestaña aquí:
const ORIGEN = {
  contratos      : '_orig_contratos',       // renombra la pestaña así al importar
  items          : '_orig_contrato_items',
  hs             : '_orig_hs',
  hs_items       : '_orig_hs_items',
  he             : '_orig_he',
  he_items       : '_orig_he_items',
  clientes       : '_orig_clientes',
  productos      : '_orig_productos',
};

const DESTINO = {
  contratos      : '_data_contratos',
  items          : '_data_contrato_items',
  hs             : '_data_hs',
  hs_items       : '_data_hs_items',
  he             : '_data_he',
  he_items       : '_data_he_items',
  clientes       : '_data_clientes',
  productos      : '_data_productos',
};

// Encabezados exactos para cada tabla destino
const HEADERS = {
  contratos: [
    'id','folio_c','folio_raiz','renta_anterior','renta_posterior',
    'sucursal','estatus','tipo_operacion','cliente_id','razon_social',
    'obra','direccion_proyecto','ubicacion_entrega','quien_recibe','movil_recibe',
    'requiere_flete','flete_a_cargo_de','distancia_km','costo_flete','medio_contacto',
    'dias_renta','fecha_contrato','fecha_solicitada','fecha_inicio',
    'fecha_vencimiento_estimada','fecha_vencimiento_real',
    'anticipo','subtotal','costo_entrega','costo_recoleccion','costo_armado',
    'costo_desarmado','otros_cargos','iva','importe','renta_diaria','peso_total_kg',
    'forma_pago','fecha_pago','factura','agente',
    'pagare_monto','pagare_lugar','pagare_fecha',
    'folio_hs','folio_he','notas'
  ],
  items: [
    'id','folio_c','sku','descripcion','cantidad','unidad_medida',
    'peso_unitario_kg','peso_total_kg','tarifa_dia','subtotal_dia','notas'
  ],
  hs: [
    'id','folio_hs','folio_c','tipo','almacen_origen','fecha',
    'operador','unidad','num_cliente','expediente','ubicacion_destino',
    'vendedor','total_piezas','peso_total_kg','estatus','notas'
  ],
  hs_items: [
    'id','folio_hs','folio_c','sku','descripcion',
    'cantidad_enviada','peso_unitario_kg','peso_total_kg','notas'
  ],
  he: [
    'id','folio_he','folio_c','tipo','almacen_destino','fecha',
    'operador','unidad','num_cliente','expediente','ubicacion_origen',
    'total_piezas','peso_total_kg','estatus','notas'
  ],
  he_items: [
    'id','folio_he','folio_c','sku','descripcion',
    'cantidad_recibida','peso_unitario_kg','peso_total_kg','condicion','notas'
  ],
  clientes: [
    'id','razon_social','rfc','direccion','tel_oficina','tel_movil',
    'email','tipo_cliente','activo','notas'
  ],
  productos: [
    'id','sku','descripcion','categoria','unidad_medida',
    'peso_unitario_kg','tarifa_dia','precio_venta','activo','notas'
  ],
};
// ─────────────────────────────────────────────────────────────

/**
 * PASO 1: Prueba con 10 registros primero.
 * Revisa la consola (Ver → Registros) para ver el resultado.
 */
function probarMigracion() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];

  try {
    log.push('=== PRUEBA DE MIGRACIÓN (10 registros) ===\n');

    // Probar contratos
    const srcContratos = ss.getSheetByName(ORIGEN.contratos);
    if (!srcContratos) throw new Error(`Pestaña "${ORIGEN.contratos}" no encontrada. ¿Importaste el xlsx?`);

    const datos = srcContratos.getDataRange().getValues();
    const headers = datos[0].map(h => String(h).trim().replace('* ', ''));
    log.push(`Pestaña origen "${ORIGEN.contratos}": ${datos.length - 1} filas, ${headers.length} columnas`);
    log.push(`Encabezados detectados: ${headers.slice(0, 8).join(', ')}...`);

    // Mostrar 3 filas de muestra
    for (let i = 1; i <= Math.min(3, datos.length - 1); i++) {
      const fila = mapearContrato(datos[i], headers, i);
      log.push(`\nFila ${i}: folio=${fila[1]}, raiz=${fila[2]}, estatus=${fila[6]}, tipo=${fila[7]}, importe=${fila[34]}`);
    }

    // Verificar otras pestañas
    ['items','hs','hs_items','he','he_items','clientes','productos'].forEach(key => {
      const s = ss.getSheetByName(ORIGEN[key]);
      log.push(`\nPestaña "${ORIGEN[key]}": ${s ? (s.getLastRow() - 1) + ' filas' : '❌ NO ENCONTRADA'}`);
    });

    log.push('\n✅ Prueba completada. Si todo se ve bien, ejecuta ejecutarMigracionCompleta()');
  } catch(err) {
    log.push(`\n❌ ERROR: ${err.message}`);
  }

  Logger.log(log.join('\n'));
  SpreadsheetApp.getUi().alert(log.join('\n'));
}

/**
 * PASO 2: Migración completa.
 * Crea/limpia las pestañas destino y escribe todos los datos.
 */
function ejecutarMigracionCompleta() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    'Migración completa',
    '¿Confirmas? Esto BORRARÁ el contenido actual de las pestañas _data_ y escribirá los datos del archivo normalizado.',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];
  const inicio = new Date();

  try {
    log.push(`Inicio: ${inicio.toLocaleTimeString()}\n`);

    migrarClientes(ss, log);
    migrarProductos(ss, log);
    migrarContratos(ss, log);
    migrarContratosItems(ss, log);
    migrarHS(ss, log);
    migrarHSItems(ss, log);
    migrarHE(ss, log);
    migrarHEItems(ss, log);

    const fin = new Date();
    const segundos = ((fin - inicio) / 1000).toFixed(1);
    log.push(`\n✅ Migración completada en ${segundos}s`);
    log.push(`Fin: ${fin.toLocaleTimeString()}`);

    Logger.log(log.join('\n'));
    ui.alert('✅ Migración exitosa\n\n' + log.join('\n'));

  } catch(err) {
    log.push(`\n❌ ERROR: ${err.message}`);
    Logger.log(log.join('\n'));
    ui.alert('❌ Error en migración:\n\n' + err.message + '\n\nRevisa el log en Ver → Registros');
  }
}

// ── FUNCIONES DE MIGRACIÓN POR TABLA ─────────────────────────

function migrarClientes(ss, log) {
  const src  = obtenerOrigen(ss, ORIGEN.clientes);
  const datos = src.getDataRange().getValues();
  const headers = limpiarHeaders(datos[0]);

  const filas = [];
  let id = 1;
  for (let i = 1; i < datos.length; i++) {
    const r = datos[i];
    if (!r[0] && !r[1]) continue; // fila vacía
    filas.push([
      id++,
      limpiar(r, headers, 'razon_social') || limpiar(r, headers, '* razon_social'),
      limpiar(r, headers, 'rfc'),
      limpiar(r, headers, 'direccion'),
      limpiar(r, headers, 'tel_oficina'),
      limpiar(r, headers, 'tel_movil'),
      limpiar(r, headers, 'email'),
      limpiar(r, headers, 'tipo_cliente'),
      normalizarBoolean(limpiar(r, headers, 'activo') || limpiar(r, headers, '* activo')),
      limpiar(r, headers, 'notas'),
    ]);
  }

  escribirDestino(ss, DESTINO.clientes, HEADERS.clientes, filas);
  log.push(`✓ _data_clientes: ${filas.length} clientes`);
}

function migrarProductos(ss, log) {
  const src   = obtenerOrigen(ss, ORIGEN.productos);
  const datos = src.getDataRange().getValues();
  const headers = limpiarHeaders(datos[0]);

  const filas = [];
  let id = 1;
  for (let i = 1; i < datos.length; i++) {
    const r = datos[i];
    if (!r[0] && !r[1]) continue;
    filas.push([
      id++,
      limpiar(r, headers, 'sku') || limpiar(r, headers, '* sku'),
      limpiar(r, headers, 'descripcion') || limpiar(r, headers, '* descripcion'),
      limpiar(r, headers, 'categoria') || limpiar(r, headers, '* categoria'),
      limpiar(r, headers, 'unidad_medida') || limpiar(r, headers, '* unidad_medida'),
      numero(r, headers, 'peso_unitario_kg') || numero(r, headers, '* peso_unitario_kg'),
      numero(r, headers, 'tarifa_dia') || numero(r, headers, '* tarifa_dia'),
      numero(r, headers, 'precio_venta') || numero(r, headers, '* precio_venta'),
      normalizarBoolean(limpiar(r, headers, 'activo') || limpiar(r, headers, '* activo')),
      limpiar(r, headers, 'notas'),
    ]);
  }

  escribirDestino(ss, DESTINO.productos, HEADERS.productos, filas);
  log.push(`✓ _data_productos: ${filas.length} productos`);
}

function migrarContratos(ss, log) {
  const src   = obtenerOrigen(ss, ORIGEN.contratos);
  const datos = src.getDataRange().getValues();
  const headers = limpiarHeaders(datos[0]);

  const filas = [];
  let id = 1;
  for (let i = 1; i < datos.length; i++) {
    const r = datos[i];
    const folio = limpiar(r, headers, 'folio_c') || limpiar(r, headers, '* folio_c');
    if (!folio) continue;
    filas.push(mapearContrato(r, headers, id++));
  }

  escribirDestino(ss, DESTINO.contratos, HEADERS.contratos, filas);
  log.push(`✓ _data_contratos: ${filas.length} contratos`);
}

function mapearContrato(r, headers, id) {
  // Normalizar tipo_operacion: puede venir como fórmula o texto
  let tipo = limpiar(r, headers, 'tipo_operacion');
  if (tipo && tipo.startsWith('=')) {
    const estatus = String(limpiar(r, headers, 'estatus') || '').toUpperCase();
    if (['RECOLECTADO','RENOVACION','EN RENTA'].includes(estatus)) tipo = 'RENTA';
    else if (estatus === 'VENTA') tipo = 'VENTA';
    else if (estatus === 'CANCELADO') tipo = 'CANCELADO';
    else tipo = '';
  }

  return [
    id,
    limpiar(r, headers, 'folio_c') || limpiar(r, headers, '* folio_c'),
    limpiar(r, headers, 'folio_raiz'),
    limpiar(r, headers, 'renta_anterior'),
    limpiar(r, headers, 'renta_posterior'),
    limpiar(r, headers, 'sucursal'),
    limpiar(r, headers, 'estatus') || limpiar(r, headers, '* estatus'),
    tipo,
    limpiar(r, headers, 'cliente_id'),
    limpiar(r, headers, 'razon_social') || limpiar(r, headers, '* razon_social'),
    limpiar(r, headers, 'obra'),
    limpiar(r, headers, 'direccion_proyecto'),
    limpiar(r, headers, 'ubicacion_entrega'),
    limpiar(r, headers, 'quien_recibe'),
    limpiar(r, headers, 'movil_recibe'),
    normalizarBoolean(limpiar(r, headers, 'requiere_flete')),
    limpiar(r, headers, 'flete_a_cargo_de'),
    numero(r, headers, 'distancia_km'),
    numero(r, headers, 'costo_flete'),
    limpiar(r, headers, 'medio_contacto'),
    numero(r, headers, 'dias_renta') || numero(r, headers, '* dias_renta'),
    fecha(r, headers, 'fecha_contrato') || fecha(r, headers, '* fecha_contrato'),
    fecha(r, headers, 'fecha_solicitada'),
    fecha(r, headers, 'fecha_inicio'),
    fecha(r, headers, 'fecha_vencimiento_estimada'),
    fecha(r, headers, 'fecha_vencimiento_real'),
    numero(r, headers, 'anticipo'),
    numero(r, headers, 'subtotal'),
    numero(r, headers, 'costo_entrega'),
    numero(r, headers, 'costo_recoleccion'),
    numero(r, headers, 'costo_armado'),
    numero(r, headers, 'costo_desarmado'),
    numero(r, headers, 'otros_cargos'),
    numero(r, headers, 'iva'),
    numero(r, headers, 'importe') || numero(r, headers, '* importe'),
    numero(r, headers, 'renta_diaria'),
    numero(r, headers, 'peso_total_kg'),
    limpiar(r, headers, 'forma_pago'),
    fecha(r, headers, 'fecha_pago'),
    limpiar(r, headers, 'factura'),
    limpiar(r, headers, 'agente'),
    numero(r, headers, 'pagare_monto'),
    limpiar(r, headers, 'pagare_lugar'),
    fecha(r, headers, 'pagare_fecha'),
    limpiar(r, headers, 'folio_hs'),
    limpiar(r, headers, 'folio_he'),
    limpiar(r, headers, 'notas'),
  ];
}

function migrarContratosItems(ss, log) {
  const src   = obtenerOrigen(ss, ORIGEN.items);
  const datos = src.getDataRange().getValues();
  const headers = limpiarHeaders(datos[0]);

  const filas = [];
  let id = 1;
  for (let i = 1; i < datos.length; i++) {
    const r = datos[i];
    const folio = limpiar(r, headers, 'folio_c') || limpiar(r, headers, '* folio_c');
    if (!folio) continue;
    filas.push([
      id++,
      folio,
      limpiar(r, headers, 'sku') || limpiar(r, headers, '* sku'),
      limpiar(r, headers, 'descripcion') || limpiar(r, headers, '* descripcion'),
      numero(r, headers, 'cantidad') || numero(r, headers, '* cantidad'),
      limpiar(r, headers, 'unidad_medida'),
      numero(r, headers, 'peso_unitario_kg'),
      numero(r, headers, 'peso_total_kg'),
      numero(r, headers, 'tarifa_dia'),
      numero(r, headers, 'subtotal_dia'),
      limpiar(r, headers, 'notas'),
    ]);
  }

  escribirDestino(ss, DESTINO.items, HEADERS.items, filas);
  log.push(`✓ _data_contrato_items: ${filas.length} items`);
}

function migrarHS(ss, log) {
  const src   = obtenerOrigen(ss, ORIGEN.hs);
  const datos = src.getDataRange().getValues();
  const headers = limpiarHeaders(datos[0]);

  const filas = [];
  let id = 1;
  for (let i = 1; i < datos.length; i++) {
    const r = datos[i];
    const folioHs = limpiar(r, headers, 'folio_hs') || limpiar(r, headers, '* folio_hs');
    if (!folioHs) continue;
    filas.push([
      id++,
      folioHs,
      limpiar(r, headers, 'folio_c') || limpiar(r, headers, '* folio_c'),
      limpiar(r, headers, 'tipo') || limpiar(r, headers, '* tipo'),
      limpiar(r, headers, 'almacen_origen') || limpiar(r, headers, '* almacen_origen'),
      fecha(r, headers, 'fecha') || fecha(r, headers, '* fecha'),
      limpiar(r, headers, 'operador'),
      limpiar(r, headers, 'unidad'),
      limpiar(r, headers, 'num_cliente'),
      limpiar(r, headers, 'expediente'),
      limpiar(r, headers, 'ubicacion_destino'),
      limpiar(r, headers, 'vendedor'),
      numero(r, headers, 'total_piezas'),
      numero(r, headers, 'peso_total_kg'),
      limpiar(r, headers, 'estatus') || limpiar(r, headers, '* estatus'),
      limpiar(r, headers, 'notas'),
    ]);
  }

  escribirDestino(ss, DESTINO.hs, HEADERS.hs, filas);
  log.push(`✓ _data_hs: ${filas.length} hojas de salida`);
}

function migrarHSItems(ss, log) {
  const src   = obtenerOrigen(ss, ORIGEN.hs_items);
  const datos = src.getDataRange().getValues();
  const headers = limpiarHeaders(datos[0]);

  const filas = [];
  let id = 1;
  for (let i = 1; i < datos.length; i++) {
    const r = datos[i];
    const folioHs = limpiar(r, headers, 'folio_hs') || limpiar(r, headers, '* folio_hs');
    if (!folioHs) continue;
    filas.push([
      id++,
      folioHs,
      limpiar(r, headers, 'folio_c') || limpiar(r, headers, '* folio_c'),
      limpiar(r, headers, 'sku') || limpiar(r, headers, '* sku'),
      limpiar(r, headers, 'descripcion') || limpiar(r, headers, '* descripcion'),
      numero(r, headers, 'cantidad_enviada') || numero(r, headers, '* cantidad_enviada'),
      numero(r, headers, 'peso_unitario_kg'),
      numero(r, headers, 'peso_total_kg'),
      limpiar(r, headers, 'notas'),
    ]);
  }

  escribirDestino(ss, DESTINO.hs_items, HEADERS.hs_items, filas);
  log.push(`✓ _data_hs_items: ${filas.length} items`);
}

function migrarHE(ss, log) {
  const src   = obtenerOrigen(ss, ORIGEN.he);
  const datos = src.getDataRange().getValues();
  const headers = limpiarHeaders(datos[0]);

  const filas = [];
  let id = 1;
  for (let i = 1; i < datos.length; i++) {
    const r = datos[i];
    const folioHe = limpiar(r, headers, 'folio_he') || limpiar(r, headers, '* folio_he');
    if (!folioHe) continue;
    filas.push([
      id++,
      folioHe,
      limpiar(r, headers, 'folio_c'),
      limpiar(r, headers, 'tipo') || limpiar(r, headers, '* tipo'),
      limpiar(r, headers, 'almacen_destino') || limpiar(r, headers, '* almacen_destino'),
      fecha(r, headers, 'fecha') || fecha(r, headers, '* fecha'),
      limpiar(r, headers, 'operador'),
      limpiar(r, headers, 'unidad'),
      limpiar(r, headers, 'num_cliente'),
      limpiar(r, headers, 'expediente'),
      limpiar(r, headers, 'ubicacion_origen'),
      numero(r, headers, 'total_piezas'),
      numero(r, headers, 'peso_total_kg'),
      limpiar(r, headers, 'estatus') || limpiar(r, headers, '* estatus'),
      limpiar(r, headers, 'notas'),
    ]);
  }

  escribirDestino(ss, DESTINO.he, HEADERS.he, filas);
  log.push(`✓ _data_he: ${filas.length} hojas de entrada`);
}

function migrarHEItems(ss, log) {
  const src   = obtenerOrigen(ss, ORIGEN.he_items);
  const datos = src.getDataRange().getValues();
  const headers = limpiarHeaders(datos[0]);

  const filas = [];
  let id = 1;
  for (let i = 1; i < datos.length; i++) {
    const r = datos[i];
    const folioHe = limpiar(r, headers, 'folio_he') || limpiar(r, headers, '* folio_he');
    if (!folioHe) continue;
    filas.push([
      id++,
      folioHe,
      limpiar(r, headers, 'folio_c') || limpiar(r, headers, '* folio_c'),
      limpiar(r, headers, 'sku') || limpiar(r, headers, '* sku'),
      limpiar(r, headers, 'descripcion') || limpiar(r, headers, '* descripcion'),
      numero(r, headers, 'cantidad_recibida') || numero(r, headers, '* cantidad_recibida'),
      numero(r, headers, 'peso_unitario_kg'),
      numero(r, headers, 'peso_total_kg'),
      limpiar(r, headers, 'condicion'),
      limpiar(r, headers, 'notas'),
    ]);
  }

  escribirDestino(ss, DESTINO.he_items, HEADERS.he_items, filas);
  log.push(`✓ _data_he_items: ${filas.length} items`);
}

// ── FUNCIONES AUXILIARES ─────────────────────────────────────

function obtenerOrigen(ss, nombre) {
  const sheet = ss.getSheetByName(nombre);
  if (!sheet) throw new Error(
    `Pestaña de origen "${nombre}" no encontrada.\n\n` +
    `Instrucciones:\n` +
    `1. Sube el archivo ICAM360_Normalizado.xlsx a Google Drive\n` +
    `2. Ábrelo como Google Sheets\n` +
    `3. Copia cada pestaña al archivo ICAM360_Contratos\n` +
    `4. Renombra las pestañas con los nombres en la sección ORIGEN del script`
  );
  return sheet;
}

function limpiarHeaders(row) {
  return row.map(h => String(h).trim());
}

function getIdx(headers, campo) {
  const i = headers.findIndex(h => h === campo || h === '* ' + campo);
  return i;
}

function limpiar(row, headers, campo) {
  const i = getIdx(headers, campo);
  if (i === -1) return '';
  const v = row[i];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function numero(row, headers, campo) {
  const i = getIdx(headers, campo);
  if (i === -1) return '';
  const v = row[i];
  if (v === null || v === undefined || v === '') return '';
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? '' : n;
}

function fecha(row, headers, campo) {
  const i = getIdx(headers, campo);
  if (i === -1) return '';
  const v = row[i];
  if (!v) return '';
  if (v instanceof Date) {
    // Formato YYYY-MM-DD
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

function normalizarBoolean(valor) {
  if (!valor) return '';
  const v = String(valor).toUpperCase().trim();
  if (['SI','SÍ','S','YES','1','TRUE','ACTIVO','VIGENTE'].includes(v)) return 'SI';
  if (['NO','N','0','FALSE','INACTIVO','BAJA'].includes(v)) return 'NO';
  return valor;
}

/**
 * Crea o limpia una pestaña destino y escribe los datos en batch.
 */
function escribirDestino(ss, nombre, headers, filas) {
  let sheet = ss.getSheetByName(nombre);

  if (!sheet) {
    // Crear la pestaña si no existe
    sheet = ss.insertSheet(nombre);
  } else {
    // Limpiar contenido existente (excepto protecciones)
    sheet.clearContents();
  }

  // Escribir encabezado
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Escribir datos en batch
  if (filas.length > 0) {
    // Asegurar que todas las filas tengan la misma longitud
    const normalized = filas.map(fila => {
      const row = [...fila];
      while (row.length < headers.length) row.push('');
      return row.slice(0, headers.length);
    });
    sheet.getRange(2, 1, normalized.length, headers.length).setValues(normalized);
  }

  // Formato de encabezado
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1a73e8');
  headerRange.setFontColor('#ffffff');

  // Congelar fila de encabezado
  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();
}

// ── FUNCIÓN DE ACTUALIZACIÓN DE PRECIOS (para cuando subas la lista) ──

/**
 * Actualiza precio_venta en _data_productos desde una pestaña temporal.
 * Crea una pestaña llamada "_tmp_precios" con columnas: sku | precio_venta
 * Luego ejecuta esta función.
 */
function actualizarPreciosVenta() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const tmpSheet = ss.getSheetByName('_tmp_precios');
  if (!tmpSheet) {
    SpreadsheetApp.getUi().alert(
      'Crea una pestaña "_tmp_precios" con columnas:\n  sku | precio_venta\n\nY pega tu lista de precios ahí.'
    );
    return;
  }

  const precios = {};
  const tmpDatos = tmpSheet.getDataRange().getValues();
  for (let i = 1; i < tmpDatos.length; i++) {
    const sku   = String(tmpDatos[i][0]).trim();
    const precio = parseFloat(tmpDatos[i][1]);
    if (sku && !isNaN(precio)) precios[sku] = precio;
  }

  const prodSheet = ss.getSheetByName(DESTINO.productos);
  const prodDatos = prodSheet.getDataRange().getValues();
  const headers   = limpiarHeaders(prodDatos[0]);
  const colSku    = getIdx(headers, 'sku');
  const colPrecio = getIdx(headers, 'precio_venta');

  let actualizados = 0;
  for (let i = 1; i < prodDatos.length; i++) {
    const sku = String(prodDatos[i][colSku]).trim();
    if (precios[sku] !== undefined) {
      prodSheet.getRange(i + 1, colPrecio + 1).setValue(precios[sku]);
      actualizados++;
    }
  }

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(`✅ Precios actualizados: ${actualizados} de ${Object.keys(precios).length} SKUs en la lista.`);
}