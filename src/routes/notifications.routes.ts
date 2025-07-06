import { Router, Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middlewares/errorHandler';
import { authMiddleware } from '../middlewares/auth';
import { sendNotificationToDevice, sendNotificationToMultipleDevices } from '../config/firebase';

const router = Router();
const prisma = new PrismaClient();

// Get user's notifications
router.get('/', [
  authMiddleware,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn(['ORDER_UPDATE', 'PAYMENT_RECEIVED', 'NEW_MESSAGE', 'SYSTEM', 'PROMOTIONAL']).withMessage('Invalid notification type'),
  query('isRead').optional().isBoolean().withMessage('isRead must be a boolean'),
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
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const type = req.query.type as string;
  const isRead = req.query.isRead as string;

  const where: any = { userId };
  if (type) where.type = type;
  if (isRead !== undefined) where.isRead = isRead === 'true';

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where })
  ]);

  res.json({
    success: true,
    data: notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }
  });
}));

// Get unread notifications count
router.get('/unread-count', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false
    }
  });

  res.json({
    success: true,
    data: { count }
  });
}));

// Mark notification as read
router.put('/:id/read', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const notificationId = req.params.id;

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId
    }
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true }
  });

  res.json({
    success: true,
    message: 'Notification marked as read'
  });
}));

// Mark all notifications as read
router.put('/mark-all-read', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: { isRead: true }
  });

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
}));

// Delete a notification
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const notificationId = req.params.id;

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId
    }
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await prisma.notification.delete({
    where: { id: notificationId }
  });

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
}));

// Delete all notifications
router.delete('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  await prisma.notification.deleteMany({
    where: { userId }
  });

  res.json({
    success: true,
    message: 'All notifications deleted successfully'
  });
}));

// Send test notification to current user
router.post('/test', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmToken: true, name: true }
  });

  if (!user?.fcmToken) {
    return res.status(400).json({
      success: false,
      message: 'No FCM token found for user'
    });
  }

  try {
    await sendNotificationToDevice(user.fcmToken, {
      title: 'Test Notification',
      body: `Hello ${user.name}! This is a test notification from Tapiceros del Mundo.`
    }, {
      type: 'TEST',
      userId
    });

    // Save notification to database
    await prisma.notification.create({
      data: {
        title: 'Test Notification',
        body: `Hello ${user.name}! This is a test notification from Tapiceros del Mundo.`,
        type: 'SYSTEM',
        userId,
        sentAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test notification'
    });
  }
}));

// Send notification to specific users (admin only)
router.post('/send', [
  authMiddleware,
  body('userIds').isArray().withMessage('User IDs must be an array'),
  body('title').notEmpty().withMessage('Title is required'),
  body('body').notEmpty().withMessage('Body is required'),
  body('type').isIn(['ORDER_UPDATE', 'PAYMENT_RECEIVED', 'NEW_MESSAGE', 'SYSTEM', 'PROMOTIONAL']).withMessage('Invalid notification type'),
  body('data').optional().isObject().withMessage('Data must be an object'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const currentUserId = (req.user as any).id;
  const { userIds, title, body, type, data } = req.body;

  // Check if current user is admin
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true }
  });

  if (currentUser?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can send notifications to multiple users'
    });
  }

  // Get users with FCM tokens
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      fcmToken: { not: null },
      isActive: true
    },
    select: {
      id: true,
      fcmToken: true,
      name: true
    }
  });

  if (users.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No users found with FCM tokens'
    });
  }

  const fcmTokens = users.map(user => user.fcmToken!);

  try {
    // Send push notifications
    const result = await sendNotificationToMultipleDevices(fcmTokens, {
      title,
      body
    }, data);

    // Save notifications to database
    const notifications = users.map(user => ({
      title,
      body,
      type,
      userId: user.id,
      data: data || {},
      sentAt: new Date()
    }));

    await prisma.notification.createMany({
      data: notifications
    });

    res.json({
      success: true,
      message: `Notification sent to ${result.successCount} users`,
      data: {
        successCount: result.successCount,
        failureCount: result.failureCount,
        totalUsers: users.length
      }
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notifications'
    });
  }
}));

// Get notification statistics
router.get('/stats', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;

  const stats = await prisma.notification.groupBy({
    by: ['type'],
    where: { userId },
    _count: {
      id: true
    }
  });

  const totalNotifications = await prisma.notification.count({
    where: { userId }
  });

  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      isRead: false
    }
  });

  const todayNotifications = await prisma.notification.count({
    where: {
      userId,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  });

  res.json({
    success: true,
    data: {
      total: totalNotifications,
      unread: unreadCount,
      today: todayNotifications,
      byType: stats
    }
  });
}));

// Update FCM token
router.put('/fcm-token', [
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

export default router; 