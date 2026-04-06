import { z } from 'zod';

const emptyToUndefined = (val: any) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
};

const booleanCoerce = () =>
    z.preprocess((val) => {
        if (typeof val === 'string') {
            if (val.toLowerCase() === 'true') return true;
            if (val.toLowerCase() === 'false') return false;
        }
        return val;
    }, z.boolean());

const intOptional = (min: number, max: number) =>
    z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max)).optional();

const moneyOptional = () =>
    z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(99999999)).optional();

const toHex = (value: number) => {
    const safe = Math.min(255, Math.max(0, Math.round(value)));
    return safe.toString(16).padStart(2, '0');
};

const normalizeColor = (val: any) => {
    if (val === undefined || val === null) return val;
    if (typeof val !== 'string') return val;

    const raw = val.trim();
    if (!raw) return raw;

    if (raw.startsWith('#')) return raw;

    const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgbMatch) return raw;

    const parts = rgbMatch[1]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

    if (parts.length < 3) return raw;

    const nums = parts.slice(0, 3).map((p) => Number(p));
    if (nums.some((n) => Number.isNaN(n))) return raw;

    return `#${toHex(nums[0])}${toHex(nums[1])}${toHex(nums[2])}`;
};

const hexColorOptional = () =>
    z.preprocess(
        (val) => normalizeColor(emptyToUndefined(val)),
        z.string().regex(/^#[0-9A-Fa-f]{3,6}$/, 'Color debe ser formato hex (#FFF o #FF0000)')
    ).optional();

export const updateSettingsSchema = z.object({
    hero_title: z.string().max(255).optional(),
    hero_subtitle: z.string().max(500).optional(),
    hero_media_type: z.enum(['image', 'gif', 'video']).optional(),
    accent_color: hexColorOptional(),
    show_banner: booleanCoerce().optional(),
    banner_text: z.string().max(255).optional(),
    banner_accent_color: hexColorOptional(),

    // Home premium (JSON string)
    home_carousel: z.string().max(20000000).optional(),
    home_categories: z.string().max(20000000).optional(),

    logo_height_mobile: intOptional(24, 220),
    logo_height_desktop: intOptional(24, 260),

    instagram_url: z.string().max(500).optional(),
    instagram_access_token: z.string().max(500).optional(),
    show_instagram_section: booleanCoerce().optional(),
    facebook_url: z.string().max(500).optional(),
    tiktok_url: z.string().max(500).optional(),
    whatsapp_number: z.string().max(40).optional(),
    whatsapp_message: z.string().max(255).optional(),

    // Email sender (stored in DB; SMTP stays in .env)
    email_from_name: z.string().max(120).optional(),
    email_from_address: z.string().max(200).optional(),
    email_reply_to: z.string().max(200).optional(),
    email_bcc_orders: z.string().max(500).optional(),

    // Recovery
    cart_recovery_enabled: booleanCoerce().optional(),
    cart_recovery_message: z.string().max(2000).optional(),
    cart_recovery_discount_pct: intOptional(0, 100),
    cart_recovery_countdown_seconds: intOptional(0, 86400),
    cart_recovery_button_text: z.string().max(60).optional(),

    // Alerts
    alert_sales_delta_pct: intOptional(0, 100),
    alert_abandoned_delta_pct: intOptional(0, 100),
    alert_abandoned_value_threshold: moneyOptional(),
    alert_negative_reviews_threshold: intOptional(1, 50),
    alert_trend_growth_pct: intOptional(0, 300),
    alert_trend_min_units: intOptional(1, 2000),
    alert_failed_login_threshold: intOptional(3, 50),
    alert_abandoned_hours: intOptional(1, 240),

    // Extras checkout
    envio_prioritario_precio: moneyOptional(),
    perfume_lujo_precio: moneyOptional(),
    perfume_lujo_nombre: z.string().max(120).optional(),
    empaque_regalo_precio: moneyOptional(),
    envio_prioritario_image_url: z.string().max(500).optional(),
    perfume_lujo_image_url: z.string().max(500).optional(),
    empaque_regalo_image_url: z.string().max(500).optional(),

    boutique_title: z.string().max(120).optional(),
    boutique_address_line1: z.string().max(200).optional(),
    boutique_address_line2: z.string().max(200).optional(),
    boutique_phone: z.string().max(60).optional(),
    boutique_email: z.string().max(200).optional(),

    seller_bank_name: z.string().max(120).optional(),
    seller_bank_account_type: z.string().max(40).optional(),
    seller_bank_account_number: z.string().max(60).optional(),
    seller_bank_account_holder: z.string().max(120).optional(),
    seller_bank_account_id: z.string().max(40).optional(),
    seller_nequi_number: z.string().max(30).optional(),
    seller_payment_notes: z.string().max(500).optional(),

    // Email/SMTP y Wompi se configuran solo por variables de entorno (.env)
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
