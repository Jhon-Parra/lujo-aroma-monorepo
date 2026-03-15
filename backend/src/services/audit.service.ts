import { Request } from 'express';
import { pool } from '../config/database';

type AuditInput = {
    actorUserId: string;
    action: string;
    target?: string | null;
    metadata?: any;
    req?: Request;
};

export const logAdminAction = async (input: AuditInput): Promise<void> => {
    try {
        const ip = input.req?.ip ? String(input.req.ip) : null;
        const userAgent = input.req?.headers?.['user-agent']
            ? String(input.req.headers['user-agent']).slice(0, 300)
            : null;

        await pool.query(
            `INSERT INTO admin_audit_logs (actor_user_id, action, target, metadata, ip, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                input.actorUserId,
                input.action,
                input.target || null,
                input.metadata ?? null,
                ip,
                userAgent
            ]
        );
    } catch (error) {
        console.warn('Audit log error:', (error as any)?.message || error);
    }
};
