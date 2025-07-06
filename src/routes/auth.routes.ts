import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middlewares/errorHandler';
import { authMiddleware } from '../middlewares/auth';
import { createStripeCustomer } from '../config/stripe';

const router = Router();
const prisma = new PrismaClient();

// Register user (called after Auth0 authentication)
router.post('/register', [
  body('auth0Id').notEmpty().withMessage('Auth0 ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('name').notEmpty().withMessage('Name is required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { auth0Id, email, name, picture, phone, address, city, state, country, postalCode, bio } = req.body;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { auth0Id },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create Stripe customer
    let stripeCustomerId = null;
    try {
      const stripeCustomer = await createStripeCustomer(email, name);
      stripeCustomerId = stripeCustomer.id;
    } catch (stripeError) {
      console.error('Error creating Stripe customer:', stripeError);
      // Continue without Stripe customer for now
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        auth0Id,
        email,
        name,
        picture,
        phone,
        address,
        city,
        state,
        country,
        postalCode,
        bio,
        stripeCustomerId,
      }
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user'
    });
  }
}));

// Get current user profile
router.get('/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      country: true,
      postalCode: true,
      bio: true,
      role: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          posts: true,
          orders: true,
          payments: true,
          memberships: true,
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: user
  });
}));

// Update user profile
router.put('/profile', [
  authMiddleware,
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number required'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const { name, phone, address, city, state, country, postalCode, bio } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      phone,
      address,
      city,
      state,
      country,
      postalCode,
      bio,
    },
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      country: true,
      postalCode: true,
      bio: true,
      role: true,
      isVerified: true,
      isActive: true,
      updatedAt: true,
    }
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedUser
  });
}));

// Update FCM token for push notifications
router.post('/fcm-token', [
  authMiddleware,
  body('fcmToken').notEmpty().withMessage('FCM token is required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const { fcmToken } = req.body;

  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken }
  });

  res.json({
    success: true,
    message: 'FCM token updated successfully'
  });
}));

// Delete user account
router.delete('/account', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  // Check if user has active orders
  const activeOrders = await prisma.order.findFirst({
    where: {
      userId,
      status: {
        in: ['PENDING', 'IN_PROGRESS']
      }
    }
  });

  if (activeOrders) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete account with active orders'
    });
  }

  // Soft delete by setting isActive to false
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false }
  });

  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
}));

// Get user statistics
router.get('/stats', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  const stats = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: {
          posts: true,
          orders: true,
          payments: true,
          memberships: true,
        }
      },
      orders: {
        select: {
          status: true,
          budget: true,
        }
      },
      payments: {
        select: {
          amount: true,
          status: true,
        }
      }
    }
  });

  if (!stats) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Calculate additional statistics
  const totalRevenue = stats.payments
    .filter((p: any) => p.status === 'COMPLETED')
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const completedOrders = stats.orders.filter((o: any) => o.status === 'COMPLETED').length;
  const totalBudget = stats.orders
    .filter((o: any) => o.budget)
    .reduce((sum: number, o: any) => sum + Number(o.budget), 0);

  res.json({
    success: true,
    data: {
      totalPosts: stats._count.posts,
      totalOrders: stats._count.orders,
      totalPayments: stats._count.payments,
      totalMemberships: stats._count.memberships,
      totalRevenue,
      completedOrders,
      totalBudget,
      averageOrderValue: completedOrders > 0 ? totalRevenue / completedOrders : 0,
    }
  });
}));

export default router; 