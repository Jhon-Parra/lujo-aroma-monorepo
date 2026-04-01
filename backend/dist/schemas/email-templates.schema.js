"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderEmailTemplateSchema = void 0;
const zod_1 = require("zod");
exports.updateOrderEmailTemplateSchema = zod_1.z.object({
    subject: zod_1.z.string().min(3).max(200),
    body_text: zod_1.z.string().min(20).max(20000),
    body_html: zod_1.z.string().max(20000).optional().or(zod_1.z.literal(''))
});
