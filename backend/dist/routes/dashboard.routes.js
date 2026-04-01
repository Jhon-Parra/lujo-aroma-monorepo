"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/summary', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.dashboard'), dashboard_controller_1.getDashboardSummary);
exports.default = router;
