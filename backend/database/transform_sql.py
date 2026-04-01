import re
import sys

# Regex para detectar UUIDs v4/v1 en el volcado SQL
uuid_pattern = re.compile(r"'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'", re.IGNORECASE)

def transform_sql(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f_in:
        with open(output_path, 'w', encoding='utf-8') as f_out:
            # Desactivar checks de FK para facilitar la inserción masiva
            f_out.write("SET FOREIGN_KEY_CHECKS = 0;\n")
            f_out.write("SET NAMES utf8mb4;\n\n")
            
            for line in f_in:
                # Reemplazar 'uuid-string' por UNHEX(REPLACE('uuid-string', '-', ''))
                # Nota: Esto transformará todas las columnas que parezcan UUIDs (IDs y FKs)
                new_line = uuid_pattern.sub(r"UNHEX(REPLACE('\1', '-', ''))", line)
                f_out.write(new_line)
                
            f_out.write("\nSET FOREIGN_KEY_CHECKS = 1;\n")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python transform_sql.py input.sql output.sql")
        sys.exit(1)
    transform_sql(sys.argv[1], sys.argv[2])
