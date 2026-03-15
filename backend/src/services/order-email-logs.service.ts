import { pool } from '../config/database';
import { OrderEmailStatus } from './order-email-templates.service';

type OrderEmailLogInput = {
    orderId: string;
    status: OrderEmailStatus;
    to: string;
    from?: string | null;
    subject?: string | null;
    success: boolean;
    errorMessage?: string | null;
};

export const OrderEmailLogsService = {
    async listRecent(limit: number): Promise<any[]> {
        const max = Math.max(1, Math.min(200, Math.trunc(Number(limit || 50))));
        const [rows] = await pool.query<any[]>(
            `SELECT id, order_id, status, to_email, from_email, subject, success, error_message, created_at
             FROM OrderEmailLogs
             ORDER BY created_at DESC
             LIMIT $1`,
            [max]
        );
        return rows || [];
    },

    async logSend(input: OrderEmailLogInput): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO OrderEmailLogs (order_id, status, to_email, from_email, subject, success, error_message)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    input.orderId,
                    input.status,
                    input.to,
                    input.from || null,
                    input.subject || null,
                    input.success,
                    input.errorMessage || null
                ]
            );
        } catch (e: any) {
            console.warn('[OrderEmailLogs] No se pudo registrar el envio:', e?.message || e);
        }
    }
};
