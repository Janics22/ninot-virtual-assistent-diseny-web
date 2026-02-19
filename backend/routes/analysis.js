const express = require('express');
const AnalysisController = require('../controllers/analysisController');
const authMiddleware = require('../middleware/auth');
const { planControl, usageControl } = require('../middleware/planControl');

const router = express.Router();

// Local analysis - available for all authenticated users
router.post('/local', 
  authMiddleware, 
  AnalysisController.analyzeLocal
);

// AI analysis - requires PRO plan and usage check
router.post('/ai', 
  authMiddleware, 
  planControl('pro'),
  usageControl('pro'),
  AnalysisController.analyzeAI
);

module.exports = router;