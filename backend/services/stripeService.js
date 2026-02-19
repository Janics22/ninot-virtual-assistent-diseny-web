const Stripe = require('stripe');
const UserModel = require('../models/userModel');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  static async createCheckoutSession(userId, userEmail) {
    let user = await UserModel.findById(userId);
    let customerId = user.stripe_customer_id;

    // Verificar si el customer existe en Stripe
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        console.log('✅ Customer existente encontrado:', customerId);
      } catch (error) {
        // Si no existe, limpiarlo de la BD
        console.log('⚠️ Customer no existe en Stripe, limpiando:', customerId);
        customerId = null;
        await UserModel.updateStripeCustomer(userId, null);
      }
    }

    // Crear nuevo customer si es necesario
    if (!customerId) {
      console.log('🆕 Creando nuevo customer en Stripe...');
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId: userId.toString() }
      });
      customerId = customer.id;
      await UserModel.updateStripeCustomer(userId, customerId);
      console.log('✅ Nuevo customer creado:', customerId);
    }

    // Crear checkout session
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
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: { userId: userId.toString() }
    });

    return session;
  }

  static async handleWebhook(event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = parseInt(session.metadata.userId);
        const subscriptionId = session.subscription;

        await UserModel.updatePlan(userId, 'pro', subscriptionId);
        console.log(`✅ Usuario ${userId} → Plan PRO activado`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const user = await UserModel.findByStripeCustomer(subscription.customer);
        
        if (user) {
          await UserModel.updatePlan(user.id, 'free');
          console.log(`❌ Usuario ${user.id} → Suscripción cancelada`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const user = await UserModel.findByStripeCustomer(subscription.customer);

        if (user) {
          if (subscription.status === 'active') {
            await UserModel.updatePlan(user.id, 'pro', subscription.id);
          } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
            await UserModel.updatePlan(user.id, 'free');
          }
          console.log(`🔄 Usuario ${user.id} → Status: ${subscription.status}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const user = await UserModel.findByStripeCustomer(invoice.customer);
        
        if (user && user.plan === 'pro') {
          // Reset monthly counter on successful payment
          await UserModel.resetAnalysisCount(user.id);
          console.log(`♻️ Usuario ${user.id} → Contador reiniciado`);
        }
        break;
      }

      default:
        console.log(`⚠️ Evento no manejado: ${event.type}`);
    }
  }
}

module.exports = StripeService;