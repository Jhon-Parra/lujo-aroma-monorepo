import { Request, Response } from 'express';
import { pool } from '../config/database';
import { supabase } from '../config/supabase';
import { sanitizeFilename } from '../middleware/upload.middleware';
import { encryptString } from '../utils/encryption.util';
import { logAdminAction } from '../services/audit.service';

interface SettingsRow {
    hero_title: string;
    hero_subtitle: string;
    accent_color: string;
    show_banner: boolean;
    banner_text: string;
    banner_accent_color?: string | null;
    hero_image_url: string;
    hero_media_type?: string | null;
    hero_media_url?: string | null;

    logo_url?: string | null;
    logo_height_mobile?: number | null;
    logo_height_desktop?: number | null;

    instagram_url?: string | null;
    facebook_url?: string | null;
    tiktok_url?: string | null;
    whatsapp_number?: string | null;
    whatsapp_message?: string | null;

    envio_prioritario_precio?: any;
    perfume_lujo_precio?: any;

    email_from_name?: string | null;
    email_from_address?: string | null;
    email_reply_to?: string | null;
    email_bcc_orders?: string | null;

    smtp_host?: string | null;
    smtp_port?: number | null;
    smtp_secure?: boolean | null;
    smtp_user?: string | null;
    smtp_from?: string | null;
    smtp_pass_enc?: string | null;
    smtp_pass_iv?: string | null;
    smtp_pass_tag?: string | null;

    boutique_title?: string | null;
    boutique_address_line1?: string | null;
    boutique_address_line2?: string | null;
    boutique_phone?: string | null;
    boutique_email?: string | null;

    seller_bank_name?: string | null;
    seller_bank_account_type?: string | null;
    seller_bank_account_number?: string | null;
    seller_bank_account_holder?: string | null;
    seller_bank_account_id?: string | null;
    seller_nequi_number?: string | null;
    seller_payment_notes?: string | null;

    wompi_env?: string | null;
    wompi_public_key?: string | null;

    wompi_private_key_enc?: string | null;
    wompi_private_key_iv?: string | null;
    wompi_private_key_tag?: string | null;

    alert_sales_delta_pct?: number | null;
    alert_abandoned_delta_pct?: number | null;
    alert_abandoned_value_threshold?: number | null;
    alert_negative_reviews_threshold?: number | null;
    alert_trend_growth_pct?: number | null;
    alert_trend_min_units?: number | null;
    alert_failed_login_threshold?: number | null;
    alert_abandoned_hours?: number | null;

    cart_recovery_enabled?: boolean | null;
    cart_recovery_message?: string | null;
    cart_recovery_discount_pct?: number | null;
    cart_recovery_countdown_seconds?: number | null;
    cart_recovery_button_text?: string | null;

    // server-side only (no exponer al frontend)
    instagram_feed_configured?: boolean;
    smtp_configured?: boolean;
}

const normalizeNullableString = (value: any, maxLen: number): string | null => {
    if (value === undefined || value === null) return null;
    const v = String(value).trim();
    if (!v) return null;
    return v.length > maxLen ? v.slice(0, maxLen) : v;
};

const normalizeMoney = (value: any): number => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
};

const normalizeInt = (value: any, min: number, max: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    const v = Math.trunc(n);
    if (v < min) return min;
    if (v > max) return max;
    return v;
};

type HeroMediaType = 'image' | 'gif' | 'video';
const normalizeHeroMediaType = (raw: any): HeroMediaType | null => {
    const v = String(raw ?? '').trim().toLowerCase();
    if (v === 'image' || v === 'gif' || v === 'video') return v as HeroMediaType;
    return null;
};

const inferHeroMediaTypeFromMime = (mime: string): HeroMediaType | null => {
    const m = String(mime || '').toLowerCase();
    if (m.startsWith('video/')) return 'video';
    if (m === 'image/gif') return 'gif';
    if (m.startsWith('image/')) return 'image';
    return null;
};

const MAX_HERO_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_HERO_VIDEO_BYTES = 30 * 1024 * 1024; // 30MB
const MAX_ADDON_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

const detectColumns = async (columns: string[]): Promise<Record<string, boolean>> => {
    try {
        console.log('[DEBUG] detectColumns query starting...');
        // MySQL uses IN (?) for arrays, and we need to provide each value
        const [rows] = await pool.query<any[]>(
            `SELECT column_name
             FROM information_schema.columns
             WHERE lower(table_name) = 'configuracionglobal'
               AND column_name IN (${columns.map(() => '?').join(', ')})`,
            columns
        );
        console.log(`[DEBUG] detectColumns query finished, found ${rows?.length || 0} rows`);

        const found = new Set((rows || []).map((r: any) => String(r.column_name)));
        const result: Record<string, boolean> = {};
        for (const c of columns) result[c] = found.has(c);
        return result;
    } catch (error) {
        console.error('[ERROR] detectColumns failed:', error);
        const result: Record<string, boolean> = {};
        for (const c of columns) result[c] = false;
        return result;
    }
};

export const getSettings = async (req: Request, res: Response): Promise<void> => {
    console.log('[DEBUG] getSettings called');
    try {
        const cols = await detectColumns([
            'banner_accent_color',
            'logo_url',
            'logo_height_mobile',
            'logo_height_desktop',
            'instagram_url',
            'show_instagram_section',
            'facebook_url',
            'tiktok_url',
            'whatsapp_number',
            'whatsapp_message',

            'envio_prioritario_precio',
            'perfume_lujo_precio',
            'envio_prioritario_image_url',
            'perfume_lujo_image_url',
            'email_from_name',
            'email_from_address',
            'email_reply_to',
            'email_bcc_orders',
            'smtp_host',
            'smtp_port',
            'smtp_secure',
            'smtp_user',
            'smtp_from',
            'smtp_pass_enc',
            'smtp_pass_iv',
            'smtp_pass_tag',
            'instagram_access_token',
            'boutique_title',
            'boutique_address_line1',
            'boutique_address_line2',
            'boutique_phone',
            'boutique_email',

            'seller_bank_name',
            'seller_bank_account_type',
            'seller_bank_account_number',
            'seller_bank_account_holder',
            'seller_bank_account_id',
            'seller_nequi_number',
            'seller_payment_notes',

            'wompi_env',
            'wompi_public_key',
            'wompi_private_key_enc',
            'wompi_private_key_iv',
            'wompi_private_key_tag',
            'hero_media_type',
            'hero_media_url',

            'alert_sales_delta_pct',
            'alert_abandoned_delta_pct',
            'alert_abandoned_value_threshold',
            'alert_negative_reviews_threshold',
            'alert_trend_growth_pct',
            'alert_trend_min_units',
            'alert_failed_login_threshold',
            'alert_abandoned_hours',

            'cart_recovery_enabled',
            'cart_recovery_message',
            'cart_recovery_discount_pct',
            'cart_recovery_countdown_seconds',
            'cart_recovery_button_text'
        ]);

        const selectParts = [
            'hero_title',
            'hero_subtitle',
            'accent_color',
            'show_banner',
            'banner_text',
            'hero_image_url'
        ];

        if (cols.hero_media_type) selectParts.push('hero_media_type');
        if (cols.hero_media_url) selectParts.push('hero_media_url');
        if (cols.logo_url) selectParts.push('logo_url');
        if (cols.logo_height_mobile) selectParts.push('logo_height_mobile');
        if (cols.logo_height_desktop) selectParts.push('logo_height_desktop');

        if (cols.instagram_url) selectParts.push('instagram_url');
        if (cols.show_instagram_section) selectParts.push('show_instagram_section');
        if (cols.facebook_url) selectParts.push('facebook_url');
        if (cols.tiktok_url) selectParts.push('tiktok_url');
        if (cols.whatsapp_number) selectParts.push('whatsapp_number');
        if (cols.whatsapp_message) selectParts.push('whatsapp_message');

        if (cols.banner_accent_color) selectParts.push('banner_accent_color');

        if (cols.envio_prioritario_precio) selectParts.push('envio_prioritario_precio');
        if (cols.perfume_lujo_precio) selectParts.push('perfume_lujo_precio');
        if (cols.envio_prioritario_image_url) selectParts.push('envio_prioritario_image_url');
        if (cols.perfume_lujo_image_url) selectParts.push('perfume_lujo_image_url');
        if (cols.email_from_name) selectParts.push('email_from_name');
        if (cols.email_from_address) selectParts.push('email_from_address');
        if (cols.email_reply_to) selectParts.push('email_reply_to');
        if (cols.email_bcc_orders) selectParts.push('email_bcc_orders');

        if (cols.smtp_host) selectParts.push('smtp_host');
        if (cols.smtp_port) selectParts.push('smtp_port');
        if (cols.smtp_secure) selectParts.push('smtp_secure');
        if (cols.smtp_user) selectParts.push('smtp_user');
        if (cols.smtp_from) selectParts.push('smtp_from');

        if (cols.boutique_title) selectParts.push('boutique_title');
        if (cols.boutique_address_line1) selectParts.push('boutique_address_line1');
        if (cols.boutique_address_line2) selectParts.push('boutique_address_line2');
        if (cols.boutique_phone) selectParts.push('boutique_phone');
        if (cols.boutique_email) selectParts.push('boutique_email');

        if (cols.seller_bank_name) selectParts.push('seller_bank_name');
        if (cols.seller_bank_account_type) selectParts.push('seller_bank_account_type');
        if (cols.seller_bank_account_number) selectParts.push('seller_bank_account_number');
        if (cols.seller_bank_account_holder) selectParts.push('seller_bank_account_holder');
        if (cols.seller_bank_account_id) selectParts.push('seller_bank_account_id');
        if (cols.seller_nequi_number) selectParts.push('seller_nequi_number');
        if (cols.seller_payment_notes) selectParts.push('seller_payment_notes');

        if (cols.wompi_env) selectParts.push('wompi_env');

        if (cols.alert_sales_delta_pct) selectParts.push('alert_sales_delta_pct');
        if (cols.alert_abandoned_delta_pct) selectParts.push('alert_abandoned_delta_pct');
        if (cols.alert_abandoned_value_threshold) selectParts.push('alert_abandoned_value_threshold');
        if (cols.alert_negative_reviews_threshold) selectParts.push('alert_negative_reviews_threshold');
        if (cols.alert_trend_growth_pct) selectParts.push('alert_trend_growth_pct');
        if (cols.alert_trend_min_units) selectParts.push('alert_trend_min_units');
        if (cols.alert_failed_login_threshold) selectParts.push('alert_failed_login_threshold');
        if (cols.alert_abandoned_hours) selectParts.push('alert_abandoned_hours');

        if (cols.cart_recovery_enabled) selectParts.push('cart_recovery_enabled');
        if (cols.cart_recovery_message) selectParts.push('cart_recovery_message');
        if (cols.cart_recovery_discount_pct) selectParts.push('cart_recovery_discount_pct');
        if (cols.cart_recovery_countdown_seconds) selectParts.push('cart_recovery_countdown_seconds');
        if (cols.cart_recovery_button_text) selectParts.push('cart_recovery_button_text');

        const [rows] = await pool.query<SettingsRow[]>(
            `SELECT ${selectParts.join(', ')} FROM ConfiguracionGlobal WHERE id = 1`
        );

        if (rows.length === 0) {
            res.status(404).json({ error: 'Configuración no encontrada' });
            return;
        }

        const settings: any = {
            ...rows[0],
            show_banner: !!rows[0].show_banner,
            instagram_feed_configured: false,
            smtp_configured: false
        };

        if (cols.instagram_access_token) {
            try {
                const [cfgRows] = await pool.query<any[]>(
                    'SELECT (instagram_access_token IS NOT NULL AND LENGTH(TRIM(instagram_access_token)) > 0) AS configured FROM ConfiguracionGlobal WHERE id = 1'
                );
                settings.instagram_feed_configured = !!cfgRows?.[0]?.configured;
            } catch {
                settings.instagram_feed_configured = false;
            }
        }

        if (cols.smtp_host && cols.smtp_user && cols.smtp_from && cols.smtp_pass_enc) {
            try {
                const [smtpRows] = await pool.query<any[]>(
                    'SELECT smtp_pass_enc FROM ConfiguracionGlobal WHERE id = 1'
                );
                settings.smtp_configured = !!(
                    String((rows[0] as any)?.smtp_host || '').trim() &&
                    String((rows[0] as any)?.smtp_user || '').trim() &&
                    String((rows[0] as any)?.smtp_from || '').trim() &&
                    String(smtpRows?.[0]?.smtp_pass_enc || '').trim()
                );
            } catch {
                settings.smtp_configured = false;
            }
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Error al obtener la configuración' });
    }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const [currentRows] = await pool.query<SettingsRow[]>(
            'SELECT hero_title, hero_subtitle, accent_color, show_banner, banner_text, logo_height_mobile, logo_height_desktop FROM ConfiguracionGlobal WHERE id = 1'
        );

        if (currentRows.length === 0) {
            res.status(404).json({ error: 'Configuración base no encontrada' });
            return;
        }

        const current = currentRows[0];

        const {
            hero_title = current.hero_title,
            hero_subtitle = current.hero_subtitle,
            hero_media_type,
            accent_color = current.accent_color,
            show_banner = current.show_banner,
            banner_text = current.banner_text,
            banner_accent_color,
            logo_height_mobile,
            logo_height_desktop,
            instagram_url,
            instagram_access_token,
            show_instagram_section,
            facebook_url,
            tiktok_url,
            whatsapp_number,
            whatsapp_message,

            alert_sales_delta_pct,
            alert_abandoned_delta_pct,
            alert_abandoned_value_threshold,
            alert_negative_reviews_threshold,
            alert_trend_growth_pct,
            alert_trend_min_units,
            alert_failed_login_threshold,
            alert_abandoned_hours,

            envio_prioritario_precio,
            perfume_lujo_precio,
            email_from_name,
            email_from_address,
            email_reply_to,
            email_bcc_orders,
            smtp_host,
            smtp_port,
            smtp_secure,
            smtp_user,
            smtp_from,
            smtp_pass,

            boutique_title,
            boutique_address_line1,
            boutique_address_line2,
            boutique_phone,
            boutique_email,

            seller_bank_name,
            seller_bank_account_type,
            seller_bank_account_number,
            seller_bank_account_holder,
            seller_bank_account_id,
            seller_nequi_number,
            seller_payment_notes,

            wompi_env,
            wompi_public_key,
            wompi_private_key,

            cart_recovery_enabled,
            cart_recovery_message,
            cart_recovery_discount_pct,
            cart_recovery_countdown_seconds,
            cart_recovery_button_text
        } = req.body;

        const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
        const heroFile = files?.['hero_image']?.[0];
        const heroMediaFile = files?.['hero_media']?.[0];
        const logoFile = files?.['logo_image']?.[0];
        const envioFile = files?.['envio_prioritario_image']?.[0];
        const lujoFile = files?.['perfume_lujo_image']?.[0];

        let hero_image_url: string | undefined = undefined;
        let hero_media_url: string | undefined = undefined;
        let hero_media_type_final: HeroMediaType | undefined = undefined;
        const requestedType = normalizeHeroMediaType(hero_media_type);

        // Subida tradicional (solo imagen)
        if (heroFile) {
            const uniqueFilename = sanitizeFilename(heroFile.originalname);
            const { error } = await supabase.storage
                .from('perfumissimo_bucket')
                .upload(`settings/${uniqueFilename}`, heroFile.buffer, {
                    contentType: heroFile.mimetype,
                    upsert: true
                });

            if (error) {
                console.error('Supabase upload error (hero_image):', error);
                throw new Error('Error subiendo la imagen a Supabase');
            }

            const { data: publicData } = supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`settings/${uniqueFilename}`);

            hero_image_url = publicData.publicUrl;
        }

        // Subida nueva (multimedia: imagen, gif, video)
        if (heroMediaFile) {
            const actualType = inferHeroMediaTypeFromMime(heroMediaFile.mimetype);
            if (!actualType) {
                res.status(400).json({ error: 'Tipo de archivo invalido para el banner.' });
                return;
            }

            // Validar si el tipo enviado coincide con el archivo
            if (requestedType === 'video' && actualType !== 'video') {
                res.status(400).json({ error: 'Seleccionaste "video" pero el archivo no es un video.' });
                return;
            }
            if (requestedType === 'gif' && heroMediaFile.mimetype !== 'image/gif') {
                res.status(400).json({ error: 'Seleccionaste "gif" pero el archivo no es GIF.' });
                return;
            }
            if (requestedType === 'image' && actualType === 'video') {
                res.status(400).json({ error: 'Seleccionaste "imagen" pero el archivo es un video.' });
                return;
            }

            const maxBytes = actualType === 'video' ? MAX_HERO_VIDEO_BYTES : MAX_HERO_IMAGE_BYTES;
            if (heroMediaFile.size > maxBytes) {
                res.status(400).json({
                    error: actualType === 'video' ? 'El video supera el limite de 30MB.' : 'El archivo supera el limite de 10MB.'
                });
                return;
            }

            const uniqueFilename = sanitizeFilename(heroMediaFile.originalname);
            const { error } = await supabase.storage
                .from('perfumissimo_bucket')
                .upload(`settings/${uniqueFilename}`, heroMediaFile.buffer, {
                    contentType: heroMediaFile.mimetype,
                    upsert: true
                });

            if (error) {
                console.error('Supabase upload error (hero_media):', error);
                throw new Error('Error subiendo el archivo multimedia a Supabase');
            }

            const { data: publicData } = supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`settings/${uniqueFilename}`);

            hero_media_url = publicData.publicUrl;
            hero_media_type_final = actualType;

            // Mantener compatibilidad: si no es video, actualizar hero_image_url también
            if (actualType !== 'video') {
                hero_image_url = hero_media_url;
            }
        }

        let logo_url: string | undefined = undefined;
        if (logoFile) {
            const uniqueFilename = sanitizeFilename(logoFile.originalname);
            // Evitar cache agresivo en el navegador/CDN usando un path unico por subida
            const logoPath = `settings/logo/${Date.now()}_${uniqueFilename}`;
            const { error } = await supabase.storage
                .from('perfumissimo_bucket')
                .upload(logoPath, logoFile.buffer, {
                    contentType: logoFile.mimetype,
                    upsert: true
                });

            if (error) {
                console.error('Supabase upload error (logo):', error);
                throw new Error('Error subiendo el logo a Supabase');
            }

            const { data: publicData } = supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(logoPath);

            logo_url = publicData.publicUrl;
        }

        let envio_prioritario_image_url: string | undefined = undefined;
        if (envioFile) {
            if (envioFile.size > MAX_ADDON_IMAGE_BYTES) {
                res.status(400).json({ error: 'La imagen de Envio prioritario es demasiado grande. Limite: 8MB.' });
                return;
            }
            const uniqueFilename = sanitizeFilename(envioFile.originalname);
            const filePath = `settings/addons/${Date.now()}_envio_${uniqueFilename}`;
            const { error } = await supabase.storage
                .from('perfumissimo_bucket')
                .upload(filePath, envioFile.buffer, {
                    contentType: envioFile.mimetype,
                    upsert: true
                });
            if (error) {
                console.error('Supabase upload error (envio_prioritario_image):', error);
                throw new Error('Error subiendo la imagen de Envio prioritario a Supabase');
            }
            const { data: publicData } = supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(filePath);
            envio_prioritario_image_url = publicData.publicUrl;
        }

        let perfume_lujo_image_url: string | undefined = undefined;
        if (lujoFile) {
            if (lujoFile.size > MAX_ADDON_IMAGE_BYTES) {
                res.status(400).json({ error: 'La imagen de Perfume de lujo es demasiado grande. Limite: 8MB.' });
                return;
            }
            const uniqueFilename = sanitizeFilename(lujoFile.originalname);
            const filePath = `settings/addons/${Date.now()}_lujo_${uniqueFilename}`;
            const { error } = await supabase.storage
                .from('perfumissimo_bucket')
                .upload(filePath, lujoFile.buffer, {
                    contentType: lujoFile.mimetype,
                    upsert: true
                });
            if (error) {
                console.error('Supabase upload error (perfume_lujo_image):', error);
                throw new Error('Error subiendo la imagen de Perfume de lujo a Supabase');
            }
            const { data: publicData } = supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(filePath);
            perfume_lujo_image_url = publicData.publicUrl;
        }

        const columns = await detectColumns([
            'banner_accent_color',
            'logo_url',
            'logo_height_mobile',
            'logo_height_desktop',
            'instagram_url',
            'show_instagram_section',
            'facebook_url',
            'tiktok_url',
            'whatsapp_number',
            'whatsapp_message',

            'envio_prioritario_precio',
            'perfume_lujo_precio',
            'envio_prioritario_image_url',
            'perfume_lujo_image_url',
            'instagram_access_token',
            'email_from_name',
            'email_from_address',
            'email_reply_to',
            'email_bcc_orders',
            'smtp_host',
            'smtp_port',
            'smtp_secure',
            'smtp_user',
            'smtp_from',
            'smtp_pass_enc',
            'smtp_pass_iv',
            'smtp_pass_tag',
            'boutique_title',
            'boutique_address_line1',
            'boutique_address_line2',
            'boutique_phone',
            'boutique_email',
            'seller_bank_name',
            'seller_bank_account_type',
            'seller_bank_account_number',
            'seller_bank_account_holder',
            'seller_bank_account_id',
            'seller_nequi_number',
            'seller_payment_notes',
            'wompi_env',
            'wompi_public_key',
            'wompi_private_key_enc',
            'wompi_private_key_iv',
            'wompi_private_key_tag',
            'hero_media_type',
            'hero_media_url',

            'alert_sales_delta_pct',
            'alert_abandoned_delta_pct',
            'alert_abandoned_value_threshold',
            'alert_negative_reviews_threshold',
            'alert_trend_growth_pct',
            'alert_trend_min_units',
            'alert_failed_login_threshold',
            'alert_abandoned_hours',

            'cart_recovery_enabled',
            'cart_recovery_message',
            'cart_recovery_discount_pct',
            'cart_recovery_countdown_seconds',
            'cart_recovery_button_text'
        ]);

        // Si el frontend envia extras pero la DB no tiene columnas, devolver error claro.
        const wantsExtras = envio_prioritario_precio !== undefined || perfume_lujo_precio !== undefined;
        if (wantsExtras && (!columns.envio_prioritario_precio || !columns.perfume_lujo_precio)) {
            res.status(400).json({
                error: 'Tu base de datos no soporta extras de checkout. Ejecuta database/migrations/20260312_settings_checkout_addons.sql en Supabase y vuelve a intentar.'
            });
            return;
        }

        const wantsBannerAccent = banner_accent_color !== undefined;
        if (wantsBannerAccent && !columns.banner_accent_color) {
            res.status(400).json({
                error: 'Tu base de datos no soporta color del banner. Ejecuta database/migrations/20260312_settings_banner_accent_color.sql en Supabase y vuelve a intentar.'
            });
            return;
        }

        let query = `UPDATE ConfiguracionGlobal SET hero_title = ?, hero_subtitle = ?, accent_color = ?, show_banner = ?, banner_text = ?`;
        const params: any[] = [hero_title, hero_subtitle, accent_color, !!show_banner, banner_text];

        if (columns.banner_accent_color && banner_accent_color !== undefined) {
            query += `, banner_accent_color = ?`;
            params.push(normalizeNullableString(banner_accent_color, 50));
        }

        if (columns.logo_height_mobile && logo_height_mobile !== undefined) {
            query += `, logo_height_mobile = ?`;
            params.push(logo_height_mobile === null ? null : Number(logo_height_mobile));
        }
        if (columns.logo_height_desktop && logo_height_desktop !== undefined) {
            query += `, logo_height_desktop = ?`;
            params.push(logo_height_desktop === null ? null : Number(logo_height_desktop));
        }

        if (columns.instagram_url) {
            query += `, instagram_url = ?`;
            params.push(normalizeNullableString(instagram_url, 500));
        }
        if (columns.facebook_url) {
            query += `, facebook_url = ?`;
            params.push(normalizeNullableString(facebook_url, 500));
        }
        if (columns.tiktok_url) {
            query += `, tiktok_url = ?`;
            params.push(normalizeNullableString(tiktok_url, 500));
        }
        if (columns.whatsapp_number) {
            query += `, whatsapp_number = ?`;
            params.push(normalizeNullableString(whatsapp_number, 40));
        }
        if (columns.whatsapp_message) {
            query += `, whatsapp_message = ?`;
            params.push(normalizeNullableString(whatsapp_message, 255));
        }
        if (columns.show_instagram_section && show_instagram_section !== undefined) {
            query += `, show_instagram_section = ?`;
            params.push(!!show_instagram_section);
        }

        if (columns.alert_sales_delta_pct && alert_sales_delta_pct !== undefined) {
            query += `, alert_sales_delta_pct = ?`;
            params.push(normalizeInt(alert_sales_delta_pct, 0, 100));
        }
        if (columns.alert_abandoned_delta_pct && alert_abandoned_delta_pct !== undefined) {
            query += `, alert_abandoned_delta_pct = ?`;
            params.push(normalizeInt(alert_abandoned_delta_pct, 0, 100));
        }
        if (columns.alert_abandoned_value_threshold && alert_abandoned_value_threshold !== undefined) {
            query += `, alert_abandoned_value_threshold = ?`;
            params.push(normalizeMoney(alert_abandoned_value_threshold));
        }
        if (columns.alert_negative_reviews_threshold && alert_negative_reviews_threshold !== undefined) {
            query += `, alert_negative_reviews_threshold = ?`;
            params.push(normalizeInt(alert_negative_reviews_threshold, 1, 50));
        }
        if (columns.alert_trend_growth_pct && alert_trend_growth_pct !== undefined) {
            query += `, alert_trend_growth_pct = ?`;
            params.push(normalizeInt(alert_trend_growth_pct, 0, 300));
        }
        if (columns.alert_trend_min_units && alert_trend_min_units !== undefined) {
            query += `, alert_trend_min_units = ?`;
            params.push(normalizeInt(alert_trend_min_units, 1, 2000));
        }
        if (columns.alert_failed_login_threshold && alert_failed_login_threshold !== undefined) {
            query += `, alert_failed_login_threshold = ?`;
            params.push(normalizeInt(alert_failed_login_threshold, 3, 50));
        }
        if (columns.alert_abandoned_hours && alert_abandoned_hours !== undefined) {
            query += `, alert_abandoned_hours = ?`;
            params.push(normalizeInt(alert_abandoned_hours, 1, 240));
        }

        if (columns.cart_recovery_enabled && cart_recovery_enabled !== undefined) {
            query += `, cart_recovery_enabled = ?`;
            params.push(!!cart_recovery_enabled);
        }
        if (columns.cart_recovery_message && cart_recovery_message !== undefined) {
            query += `, cart_recovery_message = ?`;
            params.push(normalizeNullableString(cart_recovery_message, 2000));
        }
        if (columns.cart_recovery_discount_pct && cart_recovery_discount_pct !== undefined) {
            query += `, cart_recovery_discount_pct = ?`;
            params.push(normalizeInt(cart_recovery_discount_pct, 0, 80));
        }
        if (columns.cart_recovery_countdown_seconds && cart_recovery_countdown_seconds !== undefined) {
            query += `, cart_recovery_countdown_seconds = ?`;
            params.push(normalizeInt(cart_recovery_countdown_seconds, 10, 900));
        }
        if (columns.cart_recovery_button_text && cart_recovery_button_text !== undefined) {
            query += `, cart_recovery_button_text = ?`;
            params.push(normalizeNullableString(cart_recovery_button_text, 60));
        }

        if (columns.envio_prioritario_precio && envio_prioritario_precio !== undefined) {
            query += `, envio_prioritario_precio = ?`;
            params.push(normalizeMoney(envio_prioritario_precio));
        }
        if (columns.perfume_lujo_precio && perfume_lujo_precio !== undefined) {
            query += `, perfume_lujo_precio = ?`;
            params.push(normalizeMoney(perfume_lujo_precio));
        }

        if (envio_prioritario_image_url !== undefined) {
            if (!columns.envio_prioritario_image_url) {
                res.status(400).json({
                    error: 'Tu base de datos no soporta imagenes de extras. Ejecuta database/migrations/20260312_settings_checkout_addons_images.sql en Supabase y vuelve a intentar.'
                });
                return;
            }
            query += `, envio_prioritario_image_url = ?`;
            params.push(envio_prioritario_image_url);
        }

        if (perfume_lujo_image_url !== undefined) {
            if (!columns.perfume_lujo_image_url) {
                res.status(400).json({
                    error: 'Tu base de datos no soporta imagenes de extras. Ejecuta database/migrations/20260312_settings_checkout_addons_images.sql en Supabase y vuelve a intentar.'
                });
                return;
            }
            query += `, perfume_lujo_image_url = ?`;
            params.push(perfume_lujo_image_url);
        }

        if (instagram_access_token !== undefined && columns.instagram_access_token) {
            query += `, instagram_access_token = ?`;
            params.push(normalizeNullableString(instagram_access_token, 500));
        }

        if (columns.email_from_name) {
            query += `, email_from_name = ?, email_from_address = ?, email_reply_to = ?, email_bcc_orders = ?`;
            params.push(
                normalizeNullableString(email_from_name, 120),
                normalizeNullableString(email_from_address, 200),
                normalizeNullableString(email_reply_to, 200),
                normalizeNullableString(email_bcc_orders, 500)
            );
        }

        if (columns.smtp_host) {
            query += `, smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?, smtp_from = ?`;
            const portValue = smtp_port !== undefined && smtp_port !== null && String(smtp_port).trim()
                ? Math.max(1, Number(smtp_port))
                : null;
            params.push(
                normalizeNullableString(smtp_host, 255),
                Number.isFinite(portValue as number) ? portValue : null,
                smtp_secure === undefined ? null : String(smtp_secure) === 'true',
                normalizeNullableString(smtp_user, 200),
                normalizeNullableString(smtp_from, 255)
            );
        }

        if (smtp_pass !== undefined) {
            if (!columns.smtp_pass_enc) {
                res.status(400).json({
                    error: 'Tu base de datos no soporta credenciales SMTP. Ejecuta database/migrations/20260313_settings_smtp_config.sql en Supabase y vuelve a intentar.'
                });
                return;
            }

            const passRaw = String(smtp_pass || '').trim();
            if (!passRaw) {
                query += `, smtp_pass_enc = ?, smtp_pass_iv = ?, smtp_pass_tag = ?`;
                params.push(null, null, null);
            } else {
                try {
                    const payload = encryptString(passRaw);
                    query += `, smtp_pass_enc = ?, smtp_pass_iv = ?, smtp_pass_tag = ?`;
                    params.push(payload.enc, payload.iv, payload.tag);
                } catch (e: any) {
                    res.status(400).json({
                        error: e?.message || 'No se pudo cifrar la clave SMTP. Configura SETTINGS_ENCRYPTION_KEY en backend/.env'
                    });
                    return;
                }
            }
        }

        if (columns.boutique_title) {
            query += `, boutique_title = ?, boutique_address_line1 = ?, boutique_address_line2 = ?, boutique_phone = ?, boutique_email = ?`;
            params.push(
                normalizeNullableString(boutique_title, 120),
                normalizeNullableString(boutique_address_line1, 200),
                normalizeNullableString(boutique_address_line2, 200),
                normalizeNullableString(boutique_phone, 60),
                normalizeNullableString(boutique_email, 200)
            );
        }

        if (columns.seller_bank_name) {
            query += `, seller_bank_name = ?, seller_bank_account_type = ?, seller_bank_account_number = ?, seller_bank_account_holder = ?, seller_bank_account_id = ?, seller_nequi_number = ?, seller_payment_notes = ?`;
            params.push(
                normalizeNullableString(seller_bank_name, 120),
                normalizeNullableString(seller_bank_account_type, 40),
                normalizeNullableString(seller_bank_account_number, 60),
                normalizeNullableString(seller_bank_account_holder, 120),
                normalizeNullableString(seller_bank_account_id, 40),
                normalizeNullableString(seller_nequi_number, 30),
                normalizeNullableString(seller_payment_notes, 500)
            );
        }

        if (wompi_env !== undefined && columns.wompi_env) {
            query += `, wompi_env = ?`;
            params.push(wompi_env);
        }
        if (wompi_public_key !== undefined && columns.wompi_public_key) {
            query += `, wompi_public_key = ?`;
            params.push(normalizeNullableString(wompi_public_key, 200));
        }

        if (wompi_private_key !== undefined && columns.wompi_private_key_enc) {
            if (!wompi_private_key.trim()) {
                query += `, wompi_private_key_enc = ?, wompi_private_key_iv = ?, wompi_private_key_tag = ?`;
                params.push(null, null, null);
            } else {
                const payload = encryptString(wompi_private_key.trim());
                query += `, wompi_private_key_enc = ?, wompi_private_key_iv = ?, wompi_private_key_tag = ?`;
                params.push(payload.enc, payload.iv, payload.tag);
            }
        }

        if (hero_image_url) {
            query += `, hero_image_url = ?`;
            params.push(hero_image_url);
        }

        if (hero_media_url && columns.hero_media_url) {
            query += `, hero_media_url = ?`;
            params.push(hero_media_url);
        }
        // Si no subió archivo pero cambió el tipo (requestedType), aplicarlo si hay columnas
        if (columns.hero_media_type) {
            const finalType = hero_media_type_final || requestedType || 'image';
            query += `, hero_media_type = ?`;
            params.push(finalType);
        }

        if (logo_url && columns.logo_url) {
            query += `, logo_url = ?`;
            params.push(logo_url);
        }

        query += ` WHERE id = 1`;

        const [result] = await pool.query<any>(query, params);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'No se pudo actualizar la configuración' });
            return;
        }

        const actorUserId = String((req as any)?.user?.id || '').trim();
        if (actorUserId) {
            const excluded = new Set(['instagram_access_token', 'smtp_pass', 'wompi_private_key']);
            const fields = Object.keys(req.body || {}).filter((k) => !excluded.has(k));
            await logAdminAction({
                actorUserId,
                action: 'settings.update',
                target: 'ConfiguracionGlobal',
                metadata: { fields },
                req
            });
        }

        res.status(200).json({
            message: 'Configuración actualizada exitosamente',
            hero_image_url,
            hero_media_url,
            hero_media_type: hero_media_type_final || requestedType || undefined,
            logo_url,
            envio_prioritario_image_url,
            perfume_lujo_image_url,
            banner_accent_color: banner_accent_color !== undefined ? banner_accent_color : undefined
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Error al actualizar la configuración' });
    }
};
