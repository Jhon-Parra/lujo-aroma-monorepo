"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderEmailLogsService = void 0;
const database_1 = require("../config/database");
exports.OrderEmailLogsService = {
    async listRecent(limit) {
        const max = Math.max(1, Math.min(200, Math.trunc(Number(limit || 50))));
        const [rows] = await database_1.pool.query(`SELECT id, order_id, status, to_email, from_email, subject, success, error_message, created_at
             FROM orderemaillogs
             ORDER BY created_at DESC
             LIMIT ?`, [max]);
        return rows || [];
    },
    async logSend(input) {
        try {
            await database_1.pool.query(`INSERT INTO orderemaillogs (order_id, status, to_email, from_email, subject, success, error_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                input.orderId,
                input.status,
                input.to,
                input.from || null,
                input.subject || null,
                input.success,
                input.errorMessage || null
            ]);
        }
        catch (e) {
            console.warn('[OrderEmailLogs] No se pudo registrar el envio:', e?.message || e);
        }
    }
};
