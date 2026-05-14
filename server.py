#!/usr/bin/env python3
"""
Servidor web simple para ICAM 360
Ejecuta en la carpeta Contratos-inv: python server.py
Luego abre: http://localhost:8000
"""

import http.server
import socketserver
import os
from pathlib import Path

# Configuración
PORT = 8000
DIRECTORY = Path(__file__).parent

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        # Permitir CORS para localhost
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super().end_headers()
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║           SERVIDOR LOCAL ICAM 360                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  🌐 Abre en el navegador:                                   ║
║     → http://localhost:{PORT}                               ║
║                                                              ║
║  📁 Sirviendo archivos desde:                               ║
║     → {DIRECTORY}                       ║
║                                                              ║
║  ⏹️  Para detener: presiona Ctrl+C                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        """)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✓ Servidor detenido")
