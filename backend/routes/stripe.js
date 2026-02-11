const express = require('express');
const Stripe = require('stripe');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT email, stripe_customer_id FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: req.user.userId.toString()
        }
      });
      customerId = customer.id;

      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, req.user.userId]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cancel`,
      metadata: {
        userId: req.user.userId.toString()
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creando sesión de checkout:', error);
    res.status(500).json({ error: 'Error al crear sesión de pago' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Error verificando webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;

        await pool.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['premium', userId]
        );

        console.log(`Usuario ${userId} actualizado a premium`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await pool.query(
          'UPDATE users SET role = $1 WHERE stripe_customer_id = $2',
          ['free', customerId]
        );

        console.log(`Suscripción cancelada para customer ${customerId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        if (subscription.status === 'active') {
          await pool.query(
            'UPDATE users SET role = $1 WHERE stripe_customer_id = $2',
            ['premium', customerId]
          );
        } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
          await pool.query(
            'UPDATE users SET role = $1 WHERE stripe_customer_id = $2',
            ['free', customerId]
          );
        }

        console.log(`Suscripción actualizada para customer ${customerId}: ${subscription.status}`);
        break;
      }

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

module.exports = router;
