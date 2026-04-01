"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const social_controller_1 = require("../controllers/social.controller");
const router = (0, express_1.Router)();
router.get('/instagram/media', social_controller_1.getInstagramMedia);
exports.default = router;
