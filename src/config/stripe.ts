import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Stripe product IDs for different membership tiers
export const STRIPE_PRODUCTS = {
  BASIC: process.env.STRIPE_BASIC_PRODUCT_ID || 'prod_basic_membership',
  PREMIUM: process.env.STRIPE_PREMIUM_PRODUCT_ID || 'prod_premium_membership',
  ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRODUCT_ID || 'prod_enterprise_membership',
};

// Stripe price IDs for different membership tiers
export const STRIPE_PRICES = {
  BASIC: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic_monthly',
  PREMIUM: process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium_monthly',
  ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_monthly',
};

// Webhook events to handle
export const STRIPE_WEBHOOK_EVENTS = {
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  CUSTOMER_SUBSCRIPTION_CREATED: 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  CUSTOMER_SUBSCRIPTION_TRIAL_WILL_END: 'customer.subscription.trial_will_end',
};

// Create a customer in Stripe
export const createStripeCustomer = async (email: string, name: string) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'tapiceros_app',
      },
    });
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

// Create a checkout session for one-time payments
export const createCheckoutSession = async (params: {
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) => {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: {
              name: params.description,
            },
            unit_amount: params.amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Create a subscription
export const createSubscription = async (params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) => {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
    return session;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

// Cancel a subscription
export const cancelSubscription = async (subscriptionId: string) => {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// Create an invoice
export const createInvoice = async (params: {
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}) => {
  try {
    const invoice = await stripe.invoices.create({
      customer: params.customerId,
      currency: params.currency,
      metadata: params.metadata,
      collection_method: 'send_invoice',
      days_until_due: 30,
    });

    const invoiceItem = await stripe.invoiceItems.create({
      customer: params.customerId,
      invoice: invoice.id,
      amount: params.amount * 100, // Convert to cents
      currency: params.currency,
      description: params.description,
    });

    return invoice;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

// Send an invoice
export const sendInvoice = async (invoiceId: string) => {
  try {
    const invoice = await stripe.invoices.sendInvoice(invoiceId);
    return invoice;
  } catch (error) {
    console.error('Error sending invoice:', error);
    throw error;
  }
}; 