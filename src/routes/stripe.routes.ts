import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middlewares/errorHandler';
import { authMiddleware } from '../middlewares/auth';
import { 
  stripe, 
  createCheckoutSession, 
  createSubscription, 
  cancelSubscription,
  createInvoice,
  sendInvoice,
  STRIPE_PRICES,
  STRIPE_WEBHOOK_EVENTS
} from '../config/stripe';
import { sendNotificationToDevice, NOTIFICATION_TEMPLATES } from '../config/firebase';

const router = Router();
const prisma = new PrismaClient();

// Create checkout session for one-time payment
router.post('/create-checkout-session', [
  authMiddleware,
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
  body('currency').optional().isIn(['USD', 'EUR', 'MXN']).withMessage('Valid currency required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('orderId').optional().isUUID().withMessage('Valid order ID required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const { amount, currency = 'USD', description, orderId } = req.body;

  try {
    // Get user with Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true, name: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create Stripe customer if not exists
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId }
      });
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId }
      });
    }

    const session = await createCheckoutSession({
      customerId,
      amount: parseFloat(amount),
      currency,
      description,
      successUrl: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: {
        userId,
        orderId: orderId || '',
        type: 'one_time_payment'
      }
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment session'
    });
  }
}));

// Create subscription checkout session
router.post('/create-subscription', [
  authMiddleware,
  body('membershipType').isIn(['BASIC', 'PREMIUM', 'ENTERPRISE']).withMessage('Valid membership type required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const { membershipType } = req.body;

  try {
    // Get user with Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true, name: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create Stripe customer if not exists
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId }
      });
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId }
      });
    }

    const priceId = STRIPE_PRICES[membershipType as keyof typeof STRIPE_PRICES];
    if (!priceId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership type'
      });
    }

    const session = await createSubscription({
      customerId,
      priceId,
      successUrl: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId,
        membershipType,
        type: 'subscription'
      }
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subscription'
    });
  }
}));

// Cancel subscription
router.post('/cancel-subscription', [
  authMiddleware,
  body('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const { subscriptionId } = req.body;

  try {
    // Verify subscription belongs to user
    const membership = await prisma.membership.findFirst({
      where: {
        stripeSubscriptionId: subscriptionId,
        userId
      }
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Cancel subscription in Stripe
    await cancelSubscription(subscriptionId);

    // Update membership status
    await prisma.membership.update({
      where: { id: membership.id },
      data: { 
        status: 'CANCELLED',
        endDate: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling subscription'
    });
  }
}));

// Create invoice for an order
router.post('/create-invoice', [
  authMiddleware,
  body('orderId').isUUID().withMessage('Valid order ID required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
  body('description').notEmpty().withMessage('Description is required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const { orderId, amount, description } = req.body;

  try {
    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        user: {
          select: { stripeCustomerId: true, email: true, name: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'User does not have a Stripe customer account'
      });
    }

    // Create invoice in Stripe
    const stripeInvoice = await createInvoice({
      customerId: order.user.stripeCustomerId,
      amount: parseFloat(amount),
      currency: 'USD',
      description,
      metadata: {
        orderId,
        userId
      }
    });

    // Create invoice record in database
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: stripeInvoice.number || `INV-${Date.now()}`,
        amount: parseFloat(amount),
        currency: 'USD',
        status: 'DRAFT',
        orderId
      }
    });

    res.json({
      success: true,
      message: 'Invoice created successfully',
      data: {
        invoiceId: invoice.id,
        stripeInvoiceId: stripeInvoice.id,
        invoiceNumber: invoice.invoiceNumber
      }
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating invoice'
    });
  }
}));

// Send invoice
router.post('/send-invoice/:invoiceId', [
  authMiddleware,
], asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const { invoiceId } = req.params;

  try {
    // Verify invoice belongs to user's order
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        order: {
          userId
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Send invoice via Stripe
    await sendInvoice(invoiceId);

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'SENT' }
    });

    res.json({
      success: true,
      message: 'Invoice sent successfully'
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending invoice'
    });
  }
}));

// Get user's payment history
router.get('/payments', [
  authMiddleware,
], asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      include: {
        order: {
          select: {
            id: true,
            title: true,
            clientName: true
          }
        },
        membership: {
          select: {
            id: true,
            type: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { userId } })
  ]);

  res.json({
    success: true,
    data: payments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }
  });
}));

// Get user's subscription status
router.get('/subscription', [
  authMiddleware,
], asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      status: 'ACTIVE'
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({
    success: true,
    data: membership
  });
}));

// Stripe webhook handler
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return res.status(500).json({
      success: false,
      message: 'Webhook secret not configured'
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({
      success: false,
      message: 'Invalid signature'
    });
  }

  try {
    switch (event.type) {
      case STRIPE_WEBHOOK_EVENTS.PAYMENT_INTENT_SUCCEEDED:
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED:
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      
      case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_CREATED:
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_DELETED:
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing webhook'
    });
  }
}));

// Webhook handlers
async function handlePaymentSucceeded(paymentIntent: any) {
  const { id, amount, currency, metadata } = paymentIntent;
  
  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      amount: amount / 100, // Convert from cents
      currency,
      status: 'COMPLETED',
      stripePaymentId: id,
      description: metadata.description || 'Payment',
      userId: metadata.userId,
      orderId: metadata.orderId || null,
    }
  });

  // Send notification
  try {
    const user = await prisma.user.findUnique({
      where: { id: metadata.userId },
      select: { fcmToken: true }
    });

    if (user?.fcmToken) {
      const notification = NOTIFICATION_TEMPLATES.PAYMENT_RECEIVED(amount / 100);
      await sendNotificationToDevice(user.fcmToken, notification, {
        paymentId: payment.id,
        amount: (amount / 100).toString(),
        type: 'PAYMENT_RECEIVED'
      });
    }
  } catch (error) {
    console.error('Error sending payment notification:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  // Update invoice status
  await prisma.invoice.updateMany({
    where: { stripeInvoiceId: invoice.id },
    data: { status: 'PAID' }
  });
}

async function handleSubscriptionCreated(subscription: any) {
  const { id, customer, metadata } = subscription;
  
  // Create membership record
  await prisma.membership.create({
    data: {
      type: metadata.membershipType,
      status: 'ACTIVE',
      stripeSubscriptionId: id,
      stripePriceId: subscription.items.data[0].price.id,
      userId: metadata.userId,
    }
  });
}

async function handleSubscriptionUpdated(subscription: any) {
  const { id, status } = subscription;
  
  // Update membership status
  await prisma.membership.updateMany({
    where: { stripeSubscriptionId: id },
    data: { 
      status: status === 'active' ? 'ACTIVE' : 'CANCELLED',
      endDate: status === 'canceled' ? new Date() : null
    }
  });
}

async function handleSubscriptionDeleted(subscription: any) {
  const { id } = subscription;
  
  // Update membership status
  await prisma.membership.updateMany({
    where: { stripeSubscriptionId: id },
    data: { 
      status: 'CANCELLED',
      endDate: new Date()
    }
  });
}

export default router; 