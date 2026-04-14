-- Dev seed for Docker local MySQL.
-- Runs only on first init of the mysql_data volume.

SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO configuracionglobal (
  id,
  hero_title,
  hero_subtitle,
  accent_color,
  show_banner,
  banner_text,
  hero_image_url,
  logo_url,
  whatsapp_number,
  whatsapp_message,
  show_instagram_section
) VALUES (
  1,
  'La Esencia del Lujo',
  'Descubre colecciones exclusivas creadas por maestros perfumistas de todo el mundo.',
  '#c379ac',
  TRUE,
  'ENVIO GRATIS EN PEDIDOS SUPERIORES A $400.000',
  '/assets/images/hero_bg.webp',
  '/assets/images/logo.png',
  '+573105133401',
  'Hola, quiero mas informacion sobre sus perfumes.',
  TRUE
)
ON DUPLICATE KEY UPDATE
  hero_title = VALUES(hero_title),
  hero_subtitle = VALUES(hero_subtitle),
  accent_color = VALUES(accent_color),
  show_banner = VALUES(show_banner),
  banner_text = VALUES(banner_text),
  hero_image_url = VALUES(hero_image_url),
  logo_url = VALUES(logo_url),
  whatsapp_number = VALUES(whatsapp_number),
  whatsapp_message = VALUES(whatsapp_message),
  show_instagram_section = VALUES(show_instagram_section);

INSERT IGNORE INTO categorias (id, nombre, slug, activo) VALUES
  (UUID(), 'Dama', 'dama', TRUE),
  (UUID(), 'Caballero', 'caballero', TRUE),
  (UUID(), 'Unisex', 'unisex', TRUE),
  (UUID(), 'Promociones', 'promociones', TRUE);

INSERT INTO promociones (
  id,
  nombre,
  descripcion,
  porcentaje_descuento,
  fecha_inicio,
  fecha_fin,
  activo,
  product_scope,
  audience_scope,
  discount_type,
  amount_discount,
  priority
) VALUES (
  UUID(),
  'Bienvenida',
  '20% de descuento por tiempo limitado',
  20.00,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 30 DAY),
  TRUE,
  'GLOBAL',
  'ALL',
  'PERCENT',
  NULL,
  10
);

INSERT INTO productos (
  id, nombre, genero, casa, descripcion, notas_olfativas,
  precio, stock, unidades_vendidas, imagen_url,
  es_nuevo, nuevo_hasta
) VALUES
  (UUID(), 'Chanel No. 5', 'mujer', 'Chanel', 'Perfume floral aldehidico iconico.', 'Rosa, jazmin, sandalo', 650000.00, 12, 35, '/assets/images/brand-banner.png', TRUE, DATE_ADD(NOW(), INTERVAL 45 DAY)),
  (UUID(), 'Dior Sauvage', 'hombre', 'Dior', 'Frescor radical con bergamota y ambroxan.', 'Bergamota, ambroxan, pimienta', 520000.00, 18, 48, '/assets/images/home_category_man_1774014820783.png', TRUE, DATE_ADD(NOW(), INTERVAL 30 DAY)),
  (UUID(), 'Tom Ford Black Orchid', 'unisex', 'Tom Ford', 'Oscuro, lujoso y envolvente.', 'Orquidea negra, trufa, ylang-ylang', 890000.00, 6, 22, '/assets/images/home_category_luxury_brands_1774014924837.png', FALSE, NULL),
  (UUID(), 'La Vie Est Belle', 'mujer', 'Lancome', 'Gourmand elegante con iris y vainilla.', 'Iris, pachuli, vainilla', 480000.00, 10, 29, '/assets/images/home_category_dama_v3_1774016281790.png', FALSE, NULL),
  (UUID(), 'Creed Aventus', 'hombre', 'Creed', 'Fresco y afrutado con personalidad.', 'Pina, abedul, pachuli', 1350000.00, 4, 15, '/assets/images/cat-bestsellers.png', FALSE, NULL),
  (UUID(), 'YSL Libre', 'mujer', 'Yves Saint Laurent', 'Lavanda francesa con flor de azahar.', 'Lavanda, azahar, vainilla', 590000.00, 9, 17, '/assets/images/cat-femme.png', TRUE, DATE_ADD(NOW(), INTERVAL 20 DAY)),
  (UUID(), 'Bleu de Chanel', 'hombre', 'Chanel', 'Aromatica amaderada. Limpia y elegante.', 'Toronja, incienso, cedro', 720000.00, 7, 19, '/assets/images/cat-homme.png', FALSE, NULL),
  (UUID(), 'Baccarat Rouge 540', 'unisex', 'MFK', 'Ambar floral con estela inconfundible.', 'Azafran, ambar, cedro', 1550000.00, 3, 12, '/assets/images/home_category_unisex_v2_1774016243719.png', FALSE, NULL),
  (UUID(), 'Club de Nuit Intense', 'hombre', 'Armaf', 'Inspiracion intensa y afrutada.', 'Limon, pina, abedul', 240000.00, 20, 55, '/assets/images/home_category_sale_promo_1774014946002.png', FALSE, NULL),
  (UUID(), 'Khamrah', 'unisex', 'Lattafa', 'Dulce especiado con vibra arabe.', 'Canela, vainilla, datiles', 260000.00, 14, 41, '/assets/images/home_category_arabe_v2_1774016227682.png', TRUE, DATE_ADD(NOW(), INTERVAL 60 DAY));

SET FOREIGN_KEY_CHECKS = 1;
