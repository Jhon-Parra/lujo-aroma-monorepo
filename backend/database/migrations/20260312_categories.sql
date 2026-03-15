-- Categorias dinamicas administrables

CREATE TABLE IF NOT EXISTS Categorias (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unicos (case-insensitive por nombre)
CREATE UNIQUE INDEX IF NOT EXISTS categorias_nombre_unique_ci ON Categorias (LOWER(nombre));
CREATE UNIQUE INDEX IF NOT EXISTS categorias_slug_unique_ci ON Categorias (LOWER(slug));

-- Seed inicial (equivalente al genero actual)
INSERT INTO Categorias (nombre, slug)
VALUES
    ('Mujer', 'mujer'),
    ('Hombre', 'hombre'),
    ('Unisex', 'unisex')
ON CONFLICT DO NOTHING;

-- Quitar constraint fija en Productos.genero para permitir categorias dinamicas
ALTER TABLE Productos
    DROP CONSTRAINT IF EXISTS productos_genero_check;
