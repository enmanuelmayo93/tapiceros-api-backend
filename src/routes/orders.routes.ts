import { Router, Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middlewares/errorHandler';
import { authMiddleware } from '../middlewares/auth';
import { sendNotificationToDevice, NOTIFICATION_TEMPLATES } from '../config/firebase';

const router = Router();
const prisma = new PrismaClient();

// Get all orders for the authenticated user
router.get('/', authMiddleware, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status'),
  query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const status = req.query.status as string;
  const priority = req.query.priority as string;

  const where: any = { userId };
  if (status) where.status = status;
  if (priority) where.priority = priority;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
          }
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
          }
        },
        _count: {
          select: {
            payments: true,
            invoices: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where })
  ]);

  res.json({
    success: true,
    data: orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }
  });
}));

// Get a specific order by ID
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const orderId = req.params.id;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId
    },
    include: {
      payments: {
        orderBy: { createdAt: 'desc' }
      },
      invoices: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  res.json({
    success: true,
    data: order
  });
}));

// Create a new order
router.post('/', [
  authMiddleware,
  body('title').notEmpty().withMessage('Title is required'),
  body('clientName').notEmpty().withMessage('Client name is required'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('clientEmail').optional().isEmail().withMessage('Valid email required'),
  body('clientPhone').optional().isMobilePhone('any').withMessage('Valid phone number required'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const {
    title,
    description,
    clientName,
    clientEmail,
    clientPhone,
    address,
    city,
    state,
    country,
    postalCode,
    budget,
    priority,
    startDate,
    endDate
  } = req.body;

  const order = await prisma.order.create({
    data: {
      title,
      description,
      clientName,
      clientEmail,
      clientPhone,
      address,
      city,
      state,
      country,
      postalCode,
      budget: budget ? parseFloat(budget) : null,
      priority,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      userId
    },
    include: {
      payments: true,
      invoices: true,
    }
  });

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: order
  });
}));

// Update an order
router.put('/:id', [
  authMiddleware,
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('clientEmail').optional().isEmail().withMessage('Valid email required'),
  body('clientPhone').optional().isMobilePhone('any').withMessage('Valid phone number required'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
  body('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status'),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const orderId = req.params.id;
  const {
    title,
    description,
    clientName,
    clientEmail,
    clientPhone,
    address,
    city,
    state,
    country,
    postalCode,
    budget,
    priority,
    status,
    startDate,
    endDate
  } = req.body;

  // Check if order exists and belongs to user
  const existingOrder = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId
    }
  });

  if (!existingOrder) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  const updateData: any = {};
  if (title) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (clientName) updateData.clientName = clientName;
  if (clientEmail !== undefined) updateData.clientEmail = clientEmail;
  if (clientPhone !== undefined) updateData.clientPhone = clientPhone;
  if (address !== undefined) updateData.address = address;
  if (city !== undefined) updateData.city = city;
  if (state !== undefined) updateData.state = state;
  if (country !== undefined) updateData.country = country;
  if (postalCode !== undefined) updateData.postalCode = postalCode;
  if (budget !== undefined) updateData.budget = parseFloat(budget);
  if (priority) updateData.priority = priority;
  if (status) updateData.status = status;
  if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

  // If status is being updated to COMPLETED, set completedAt
  if (status === 'COMPLETED' && existingOrder.status !== 'COMPLETED') {
    updateData.completedAt = new Date();
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: {
      payments: true,
      invoices: true,
    }
  });

  // Send notification if status changed
  if (status && status !== existingOrder.status) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true }
      });

      if (user?.fcmToken) {
        const notification = NOTIFICATION_TEMPLATES.ORDER_UPDATE(title || existingOrder.title, status);
        await sendNotificationToDevice(user.fcmToken, notification, {
          orderId,
          status,
          type: 'ORDER_UPDATE'
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  res.json({
    success: true,
    message: 'Order updated successfully',
    data: updatedOrder
  });
}));

// Delete an order
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const orderId = req.params.id;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId
    }
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  if (order.status === 'IN_PROGRESS') {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete order in progress'
    });
  }

  await prisma.order.delete({
    where: { id: orderId }
  });

  res.json({
    success: true,
    message: 'Order deleted successfully'
  });
}));

// Get order statistics
router.get('/stats/overview', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  const stats = await prisma.order.groupBy({
    by: ['status'],
    where: { userId },
    _count: {
      id: true
    },
    _sum: {
      budget: true
    }
  });

  const totalOrders = await prisma.order.count({ where: { userId } });
  const totalRevenue = await prisma.payment.aggregate({
    where: {
      userId,
      status: 'COMPLETED',
      orderId: { not: null }
    },
    _sum: {
      amount: true
    }
  });

  const monthlyStats = await prisma.order.groupBy({
    by: ['status'],
    where: {
      userId,
      createdAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    },
    _count: {
      id: true
    }
  });

  res.json({
    success: true,
    data: {
      totalOrders,
      totalRevenue: totalRevenue._sum.amount || 0,
      statusBreakdown: stats,
      monthlyStats,
    }
  });
}));

export default router; 