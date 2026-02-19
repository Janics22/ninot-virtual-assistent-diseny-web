const express = require('express');
const CodeOptimizationController = require('../controllers/codeOptimizationController');
const authMiddleware = require('../middleware/auth');
const { planControl, usageControl } = require('../middleware/planControl');

const router = express.Router();

// Optimizar código - Requiere PRO
router.post('/optimize', 
  authMiddleware, 
  planControl('pro'),
  usageControl('pro'),
  CodeOptimizationController.optimizeCode
);

// Analizar accesibilidad - Requiere PRO
router.post('/accessibility', 
  authMiddleware, 
  planControl('pro'),
  usageControl('pro'),
  CodeOptimizationController.analyzeAccessibility
);

module.exports = router;