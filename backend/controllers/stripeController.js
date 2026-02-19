const StripeService = require('../services/stripeService');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeController {
  static async createCheckoutSession(req, res, next) {
    try {
      const session = await StripeService.createCheckoutSession(
        req.user.userId,
        req.user.email
      );

      res.json({ 
        success: true,
        url: session.url,
        sessionId: session.id
      });

    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      await StripeService.handleWebhook(event);
      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Error procesando webhook' });
    }
  }
}

module.exports = StripeController;