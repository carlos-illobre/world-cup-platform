#!/usr/bin/env python3
"""
Script para concatenar archivos del frontend (TypeScript, React, CSS, HTML)
Uso: python concat_frontend.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Configuración
SOURCE_DIR = "./dashboard/src"  # Directorio donde está tu código fuente
OUTPUT_FILE = "frontend_concat.txt"  # Archivo de salida

# Extensiones a incluir
EXTENSIONS = [
    "*.ts",      # TypeScript
    "*.tsx",     # React TypeScript
    "*.js",      # JavaScript
    "*.jsx",     # React JavaScript
    "*.html",    # HTML
    "*.css",     # CSS
    "*.scss",    # SCSS
    "*.sass",    # SASS
    "*.less",    # LESS
    "*.module.css",  # CSS Modules
    "*.module.scss", # SCSS Modules
]

# Directorios a excluir (se saltan estos directorios)
EXCLUDE_DIRS = [
    "node_modules",
    "dist",
    "build",
    ".next",
    "out",
    ".cache",
    "coverage",
    ".git",
    "__pycache__",
    ".vscode",
    ".idea",
]

# Archivos a excluir específicamente
EXCLUDE_FILES = [
    ".DS_Store",
    "thumbs.db",
]


def get_all_files(source_dir: Path) -> list:
    """Obtiene todos los archivos con las extensiones especificadas."""
    all_files = []
    
    for pattern in EXTENSIONS:
        # Buscar archivos recursivamente
        files = list(source_dir.glob(f"**/{pattern}"))
        
        # Filtrar archivos excluidos
        for file in files:
            # Verificar si está en directorio excluido
            should_exclude = False
            for exclude_dir in EXCLUDE_DIRS:
                if exclude_dir in file.parts:
                    should_exclude = True
                    break
            
            # Verificar si es archivo excluido
            if file.name in EXCLUDE_FILES:
                should_exclude = True
            
            if not should_exclude:
                all_files.append(file)
    
    # Ordenar por ruta para consistencia
    all_files.sort(key=lambda f: str(f))
    
    return all_files


def format_size(size: int) -> str:
    """Formatea el tamaño de archivo de forma legible."""
    for unit in ['bytes', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"


def read_file_content(file_path: Path) -> str:
    """Lee el contenido de un archivo con manejo de errores."""
    encodings = ['utf-8', 'latin-1', 'cp1252']
    
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                return f.read()
        except (UnicodeDecodeError, IOError):
            continue
    
    return f"[ERROR: No se pudo leer el archivo con las codificaciones probadas]"


def main():
    """Función principal."""
    print("=" * 60)
    print("CONCATENANDO ARCHIVOS DEL FRONTEND")
    print("=" * 60)
    
    # Verificar que el directorio fuente existe
    source_path = Path(SOURCE_DIR)
    if not source_path.exists():
        print(f"❌ Error: El directorio '{SOURCE_DIR}' no existe.")
        print(f"   Asegúrate de ejecutar el script desde la raíz del proyecto frontend.")
        sys.exit(1)
    
    # Obtener todos los archivos
    print(f"📁 Buscando archivos en: {source_path.absolute()}")
    all_files = get_all_files(source_path)
    
    if not all_files:
        print(f"⚠️  No se encontraron archivos con las extensiones: {', '.join(EXTENSIONS)}")
        print("   Revisa que SOURCE_DIR sea correcto.")
        sys.exit(1)
    
    print(f"📄 Encontrados {len(all_files)} archivos")
    
    # Preparar contenido de salida
    output_lines = []
    
    # Cabecera
    output_lines.append("=" * 80)
    output_lines.append("FRONTEND FILES CONCATENATED")
    output_lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output_lines.append(f"Source directory: {source_path.absolute()}")
    output_lines.append(f"Total files: {len(all_files)}")
    output_lines.append("=" * 80)
    output_lines.append("")
    
    # Procesar cada archivo
    for idx, file_path in enumerate(all_files, 1):
        # Obtener ruta relativa
        relative_path = file_path.relative_to(source_path)
        
        # Leer contenido
        content = read_file_content(file_path)
        
        # Agregar separador y contenido
        output_lines.append("")
        output_lines.append("#" * 80)
        output_lines.append(f"# FILE {idx} OF {len(all_files)}")
        output_lines.append(f"# NAME: {file_path.name}")
        output_lines.append(f"# PATH: {relative_path}")
        output_lines.append(f"# SIZE: {format_size(file_path.stat().st_size)}")
        output_lines.append(f"# EXTENSION: {file_path.suffix}")
        output_lines.append("#" * 80)
        output_lines.append("")
        output_lines.append(content)
        output_lines.append("")  # Línea en blanco al final
        
        # Progreso
        if idx % 10 == 0 or idx == len(all_files):
            print(f"   Procesado: {idx}/{len(all_files)}")
    
    # Guardar archivo
    output_path = Path(OUTPUT_FILE)
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(output_lines))
        print(f"\n✅ Archivo generado: {output_path.absolute()}")
        print(f"📊 Tamaño total: {format_size(output_path.stat().st_size)}")
        print(f"📝 Archivos procesados: {len(all_files)}")
    except Exception as e:
        print(f"❌ Error al guardar el archivo: {e}")
        sys.exit(1)
    
    # Mostrar resumen por tipo de archivo
    print("\n" + "=" * 60)
    print("RESUMEN POR EXTENSIÓN:")
    print("=" * 60)
    
    ext_count = {}
    for file_path in all_files:
        ext = file_path.suffix or "sin extensión"
        ext_count[ext] = ext_count.get(ext, 0) + 1
    
    for ext, count in sorted(ext_count.items()):
        print(f"  {ext:<12} : {count} archivos")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Proceso interrumpido por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)