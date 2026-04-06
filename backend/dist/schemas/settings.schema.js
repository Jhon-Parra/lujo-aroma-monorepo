"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettingsSchema = void 0;
const zod_1 = require("zod");
const emptyToUndefined = (val) => {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === 'string' && val.trim() === '')
        return undefined;
    return val;
};
const booleanCoerce = () => zod_1.z.preprocess((val) => {
    if (typeof val === 'string') {
        if (val.toLowerCase() === 'true')
            return true;
        if (val.toLowerCase() === 'false')
            return false;
    }
    return val;
}, zod_1.z.boolean());
const intOptional = (min, max) => zod_1.z.preprocess(emptyToUndefined, zod_1.z.coerce.number().int().min(min).max(max)).optional();
const moneyOptional = () => zod_1.z.preprocess(emptyToUndefined, zod_1.z.coerce.number().min(0).max(99999999)).optional();
const toHex = (value) => {
    const safe = Math.min(255, Math.max(0, Math.round(value)));
    return safe.toString(16).padStart(2, '0');
};
const normalizeColor = (val) => {
    if (val === undefined || val === null)
        return val;
    if (typeof val !== 'string')
        return val;
    const raw = val.trim();
    if (!raw)
        return raw;
    if (raw.startsWith('#'))
        return raw;
    const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgbMatch)
        return raw;
    const parts = rgbMatch[1]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 3)
        return raw;
    const nums = parts.slice(0, 3).map((p) => Number(p));
    if (nums.some((n) => Number.isNaN(n)))
        return raw;
    return `#${toHex(nums[0])}${toHex(nums[1])}${toHex(nums[2])}`;
};
const hexColorOptional = () => zod_1.z.preprocess((val) => normalizeColor(emptyToUndefined(val)), zod_1.z.string().regex(/^#[0-9A-Fa-f]{3,6}$/, 'Color debe ser formato hex (#FFF o #FF0000)')).optional();
exports.updateSettingsSchema = zod_1.z.object({
    hero_title: zod_1.z.string().max(255).optional(),
    hero_subtitle: zod_1.z.string().max(500).optional(),
    hero_media_type: zod_1.z.enum(['image', 'gif', 'video']).optional(),
    accent_color: hexColorOptional(),
    show_banner: booleanCoerce().optional(),
    banner_text: zod_1.z.string().max(255).optional(),
    banner_accent_color: hexColorOptional(),
    // Home premium (JSON string)
    home_carousel: zod_1.z.string().max(20000000).optional(),
    home_categories: zod_1.z.string().max(20000000).optional(),
    logo_height_mobile: intOptional(24, 220),
    logo_height_desktop: intOptional(24, 260),
    instagram_url: zod_1.z.string().max(500).optional(),
    instagram_access_token: zod_1.z.string().max(500).optional(),
    show_instagram_section: booleanCoerce().optional(),
    facebook_url: zod_1.z.string().max(500).optional(),
    tiktok_url: zod_1.z.string().max(500).optional(),
    whatsapp_number: zod_1.z.string().max(40).optional(),
    whatsapp_message: zod_1.z.string().max(255).optional(),
    // Email sender (stored in DB; SMTP stays in .env)
    email_from_name: zod_1.z.string().max(120).optional(),
    email_from_address: zod_1.z.string().max(200).optional(),
    email_reply_to: zod_1.z.string().max(200).optional(),
    email_bcc_orders: zod_1.z.string().max(500).optional(),
    // Recovery
    cart_recovery_enabled: booleanCoerce().optional(),
    cart_recovery_message: zod_1.z.string().max(2000).optional(),
    cart_recovery_discount_pct: intOptional(0, 100),
    cart_recovery_countdown_seconds: intOptional(0, 86400),
    cart_recovery_button_text: zod_1.z.string().max(60).optional(),
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
    perfume_lujo_nombre: zod_1.z.string().max(120).optional(),
    empaque_regalo_precio: moneyOptional(),
    envio_prioritario_image_url: zod_1.z.string().max(500).optional(),
    perfume_lujo_image_url: zod_1.z.string().max(500).optional(),
    empaque_regalo_image_url: zod_1.z.string().max(500).optional(),
    boutique_title: zod_1.z.string().max(120).optional(),
    boutique_address_line1: zod_1.z.string().max(200).optional(),
    boutique_address_line2: zod_1.z.string().max(200).optional(),
    boutique_phone: zod_1.z.string().max(60).optional(),
    boutique_email: zod_1.z.string().max(200).optional(),
    seller_bank_name: zod_1.z.string().max(120).optional(),
    seller_bank_account_type: zod_1.z.string().max(40).optional(),
    seller_bank_account_number: zod_1.z.string().max(60).optional(),
    seller_bank_account_holder: zod_1.z.string().max(120).optional(),
    seller_bank_account_id: zod_1.z.string().max(40).optional(),
    seller_nequi_number: zod_1.z.string().max(30).optional(),
    seller_payment_notes: zod_1.z.string().max(500).optional(),
    // Email/SMTP y Wompi se configuran solo por variables de entorno (.env)
});
