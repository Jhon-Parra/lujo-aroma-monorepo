"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sitemap_controller_1 = require("../controllers/sitemap.controller");
const router = (0, express_1.Router)();
router.get('/', sitemap_controller_1.getSitemap);
exports.default = router;
