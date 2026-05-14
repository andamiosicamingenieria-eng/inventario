import urllib.request
import urllib.error
import json
import ssl

url = "https://xmovgvxjvgxxoqywyagm.supabase.co/rest/v1"
apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtb3Zndnhqdmd4eG9xeXd5YWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzM1NDYsImV4cCI6MjA4ODIwOTU0Nn0.zth8wzqmvPSUpx9HEmioSsvMbvFTLJn0K27y6NGaBW0"

headers = {
    "apikey": apikey,
    "Authorization": f"Bearer {apikey}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def insert_data(table, data):
    req = urllib.request.Request(f"{url}/{table}", data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, context=ctx) as response:
            print(f"[{table}] Insert OK: {response.status}")
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"[{table}] Error: {e.code} - {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"[{table}] Fatal Error: {e}")
        return None

# DATA
insumos = [
    {"codigo": "INS-001", "nombre": "Tubo Redondo 1.5", "tipo": "Materia Prima", "unidad_medida": "Tramo", "stock_minimo": 50, "stock_actual": 120, "costo_unitario": 350.50, "activo": True},
    {"codigo": "INS-002", "nombre": "Soldadura E6013 1/8", "tipo": "Consumible", "unidad_medida": "Caja", "stock_minimo": 5, "stock_actual": 12, "costo_unitario": 1200.00, "activo": True},
    {"codigo": "INS-004", "nombre": "Placa de Acero 1/4", "tipo": "Materia Prima", "unidad_medida": "Hoja", "stock_minimo": 10, "stock_actual": 18, "costo_unitario": 2100.00, "activo": True}
]

print("Inserting Insumos...")
insert_data("fab_insumos", insumos)

# Insert product to satisfy FK if not exist
produto = [{"codigo": "AND-001", "nombre": "ANDAMIO TUBULAR 1.56x1.00m", "categoria": "Andamios", "unidad_medida": "PZA", "tipo_producto": "RENTA_VENTA"}]
print("Inserting Producto Base...")
prod_res = insert_data("cat_productos", produto)

print("Getting ID of M156-200...")
try:
    req_get = urllib.request.Request(f"{url}/cat_productos?codigo=eq.M156-200", headers=headers)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req_get, context=ctx) as response:
        rows = json.loads(response.read().decode())
        if rows:
            prod_id = rows[0]["id"]
            
            ordenes = [
                {"folio": "OP-2603-01", "producto_id": prod_id, "cantidad": 50, "estatus": "en_proceso"},
                {"folio": "OP-2603-02", "producto_id": prod_id, "cantidad": 120, "estatus": "programada"}
            ]
            print("Inserting Ordenes...")
            insert_data("fab_ordenes", ordenes)
            
except Exception as e:
    print(f"Failed to get product: {e}")

externos = [
    {"proveedor": "ACEROS DEL VALLE SA DE CV", "tipo_servicio": "Compra Material", "descripcion": "Suministro", "monto": 45000.00, "orden_compra": "OC-2026-045", "estatus": "solicitado"},
    {"proveedor": "PINTURAS MEX", "tipo_servicio": "Servicio Externo", "descripcion": "Maquila pintura", "monto": 12500.50, "orden_compra": "OC-2026-048", "estatus": "en_proceso"}
]
print("Inserting Externos...")
insert_data("fab_externos", externos)
