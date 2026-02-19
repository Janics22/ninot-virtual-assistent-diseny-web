const express = require('express');
const StripeController = require('../controllers/stripeController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/create-checkout-session', 
  authMiddleware, 
  StripeController.createCheckoutSession
);

// Webhook endpoint - raw body needed for signature verification
router.post('/webhook', 
  express.raw({ type: 'application/json' }), 
  StripeController.handleWebhook
);

module.exports = router;