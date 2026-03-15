-- ---------------------------------------------------------
-- Datos Iniciales para Perfumissimo (PostgreSQL)
-- Ejecutar DESPUÉS de crear las tablas
-- ---------------------------------------------------------

-- Insertar configuración global
INSERT INTO ConfiguracionGlobal (id, hero_title, hero_subtitle, accent_color, show_banner, banner_text, hero_image_url)
VALUES (1, 'La Esencia del Lujo', 'Descubre colecciones exclusivas de perfumes de alta gama creados por los maestros perfumistas de todo el mundo.', '#c379ac', true, 'ENVÍO GRATÍS EN PEDIDOS MAYORES A $4000', '/assets/images/logo.png')
ON CONFLICT (id) DO NOTHING;

-- Insertar usuario admin (Password: Admin123$)
-- El hash es: $2b$10$w0aZlE.K/v8Fk6B1i.5bV.E0qK/2A7r4mZpG3gQ6jT9v5xK.6l1gq
INSERT INTO Usuarios (nombre, apellido, email, password_hash, rol)
VALUES ('Admin', 'Sistema', 'admin@perfumissimo.com', '$2b$10$w0aZlE.K/v8Fk6B1i.5bV.E0qK/2A7r4mZpG3gQ6jT9v5xK.6l1gq', 'ADMIN')
ON CONFLICT DO NOTHING;

-- Insertar productos de ejemplo
INSERT INTO Productos (nombre, genero, descripcion, notas_olfativas, precio, stock, unidades_vendidas)
VALUES 
('Chanel No. 5', 'mujer', 'El icónico perfume floral aldehídico que define la elegancia francesa. Una obra maestra atemporal que captura la esencia de la feminidad.', 'Rosa, jazmín, sándalo', 150.00, 10, 0),
('Dior Sauvage', 'hombre', 'Una interpretación moderna y audaz de la masculinidad. Frescor radical con notas de bergamota de Calabria y ambroxán.', 'Bergamota, ambroxán, pimientapimentón', 95.00, 15, 0),
('Tom Ford Black Orchid', 'unisex', 'Una fragrance oscura y lujosa que desafía las convenciones. Opulenta, sensual e inolvidable.', 'Orquídea negra, trufa negra, ylang-ylang', 180.00, 5, 0),
('La Vie Est Belle', 'mujer', 'La expresión de la felicidad optimista. Un gourmand elegante con notas de iris, java yPatchouli.', 'Iris, pachulí, vainilla', 110.00, 8, 0),
('Aventus', 'hombre', 'El perfume que define una generación. Fresco, afrutado y especiado con notas de piña, abedul y patchouli.', 'Piña, abedul, patchouli', 200.00, 3, 0)
ON CONFLICT DO NOTHING;

-- Insertar promoción de ejemplo
INSERT INTO Promociones (nombre, descripcion, porcentaje_descuento, fecha_inicio, fecha_fin, activo)
VALUES 
('Descuento de Bienvenida', '20% de descuento en tu primera compra', 20, NOW(), NOW() + INTERVAL '30 days', true)
ON CONFLICT DO NOTHING;
