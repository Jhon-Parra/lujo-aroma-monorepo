"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReviewSchema = void 0;
const zod_1 = require("zod");
exports.createReviewSchema = zod_1.z.object({
    product_id: zod_1.z.string().uuid(),
    order_id: zod_1.z.string().uuid().optional(),
    rating: zod_1.z.coerce.number().int().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional()
});
