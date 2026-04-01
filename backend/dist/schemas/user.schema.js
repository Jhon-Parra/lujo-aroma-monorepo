"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSegmentSchema = exports.updateUserRoleSchema = void 0;
const zod_1 = require("zod");
exports.updateUserRoleSchema = zod_1.z.object({
    rol: zod_1.z.enum(['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS', 'CUSTOMER'])
});
exports.updateUserSegmentSchema = zod_1.z.object({
    segmento: zod_1.z.string().max(100).optional().nullable()
});
