"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAdminAction = void 0;
const database_1 = require("../config/database");
const logAdminAction = async (input) => {
    try {
        const ip = input.req?.ip ? String(input.req.ip) : null;
        const userAgent = input.req?.headers?.['user-agent']
            ? String(input.req.headers['user-agent']).slice(0, 300)
            : null;
        await database_1.pool.query(`INSERT INTO admin_audit_logs (actor_user_id, action, target, metadata, ip, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)`, [
            input.actorUserId,
            input.action,
            input.target || null,
            input.metadata ?? null,
            ip,
            userAgent
        ]);
    }
    catch (error) {
        console.warn('Audit log error:', error?.message || error);
    }
};
exports.logAdminAction = logAdminAction;
