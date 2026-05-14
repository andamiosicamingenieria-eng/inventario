#!/usr/bin/env python3
"""
🔍 Script de Verificación del Proyecto ICAM 360
Verifica que todos los archivos necesarios existan y la configuración sea correcta
"""

import os
import sys
from pathlib import Path
import json

def check_file(path, description=""):
    """Verifica si un archivo existe"""
    exists = os.path.isfile(path)
    status = "✓" if exists else "✗"
    print(f"  {status} {path:50} {'OK' if exists else '❌ FALTA'}")
    return exists

def check_dir(path, description=""):
    """Verifica si un directorio existe"""
    exists = os.path.isdir(path)
    status = "✓" if exists else "✗"
    print(f"  {status} {path:50} {'OK' if exists else '❌ FALTA'}")
    return exists

def check_content(filepath, search_string, description=""):
    """Verifica si un archivo contiene una cadena específica"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            found = search_string in content
            status = "✓" if found else "✗"
            print(f"  {status} {description:50} {'OK' if found else '❌ NO ENCONTRADO'}")
            return found
    except Exception as e:
        print(f"  ✗ {description:50} ❌ ERROR: {e}")
        return False

def main():
    os.chdir(Path(__file__).parent)
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║     🔍 VERIFICACIÓN DE PROYECTO - ICAM 360                  ║
╚══════════════════════════════════════════════════════════════╝
    """)

    all_good = True

    # 1. Verificar estructura de carpetas
    print("\n📁 ESTRUCTURA DE CARPETAS:")
    print("-" * 60)
    all_good &= check_dir("css", "Carpeta CSS")
    all_good &= check_dir("js", "Carpeta JavaScript")
    all_good &= check_dir("js/modules", "Carpeta de módulos")
    all_good &= check_dir("Antecedente", "Carpeta de antecedentes")

    # 2. Verificar archivos principales
    print("\n📄 ARCHIVOS PRINCIPALES:")
    print("-" * 60)
    all_good &= check_file("index.html", "Página principal")
    all_good &= check_file("server.py", "Servidor local")
    all_good &= check_file("migrate.py", "Script de migración")
    all_good &= check_file("css/styles.css", "Estilos CSS")

    # 3. Verificar archivos JavaScript
    print("\n🔧 ARCHIVOS JAVASCRIPT:")
    print("-" * 60)
    all_good &= check_file("js/main.js", "Entry point")
    all_good &= check_file("js/app.js", "App principal")
    all_good &= check_file("js/auth.js", "Autenticación")
    all_good &= check_file("js/supabase-client.js", "Cliente Supabase")
    all_good &= check_file("js/utils.js", "Utilidades")

    print("\n🧩 MÓDULOS JAVASCRIPT:")
    print("-" * 60)
    modules = [
        "clientes.js", "contratos.js", "productos.js", "pagos.js",
        "seguimiento.js", "hs.js", "he.js", "inventario.js",
        "fabricacion.js", "subarr.js", "estado-cuenta.js", "pdf-generator.js"
    ]
    for mod in modules:
        all_good &= check_file(f"js/modules/{mod}", f"Módulo: {mod}")

    # 4. Verificar configuración
    print("\n⚙️  CONFIGURACIÓN:")
    print("-" * 60)
    all_good &= check_content("index.html", "js/main.js", "Main.js importado en index.html")
    all_good &= check_content("js/supabase-client.js", "SUPABASE_URL", "URL de Supabase configurada")
    all_good &= check_content("js/supabase-client.js", "DEMO_MODE", "Modo Demo definido")

    # 5. Verificar modo demo
    print("\n🎮 ESTADO DEL MODO DEMO:")
    print("-" * 60)
    try:
        with open("js/supabase-client.js", 'r', encoding='utf-8') as f:
            content = f.read()
            if "export const DEMO_MODE = true" in content:
                print("  ✓ MODO DEMO ACTIVADO (Recomendado para desarrollo)")
            elif "export const DEMO_MODE = false" in content:
                print("  ⚠ MODO DEMO DESACTIVADO (Usando Supabase)")
            else:
                print("  ❌ MODO DEMO NO DETECTADO")
                all_good = False
    except Exception as e:
        print(f"  ❌ Error al verificar DEMO_MODE: {e}")
        all_good = False

    # 6. Verificar credenciales Supabase
    print("\n🔐 CREDENCIALES SUPABASE:")
    print("-" * 60)
    try:
        with open("js/supabase-client.js", 'r', encoding='utf-8') as f:
            content = f.read()
            if "qpvhqiyxzdgtuentzwtr" in content:
                print("  ⚠ CREDENCIALES POR DEFECTO DETECTADAS")
                print("    Estas credenciales pueden no estar disponibles")
                print("    Para usar Supabase real, actualiza con tus credenciales")
            else:
                print("  ✓ Credenciales personalizadas detectadas")
    except Exception as e:
        print(f"  ❌ Error al verificar credenciales: {e}")

    # 7. Resumen
    print("\n" + "=" * 60)
    if all_good:
        print("✅ VERIFICACIÓN COMPLETADA - TODO OK")
        print("\n🚀 Próximos pasos:")
        print("   1. python server.py")
        print("   2. Abre http://localhost:8000 en el navegador")
        print("   3. Login: admin@icam360.com / demo123")
        return 0
    else:
        print("❌ VERIFICACIÓN COMPLETADA - HAY PROBLEMAS")
        print("\n📝 Revisa los archivos marcados con ✗")
        return 1

if __name__ == "__main__":
    sys.exit(main())
