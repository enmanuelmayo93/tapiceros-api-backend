import { Router, Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middlewares/errorHandler';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all users (with pagination and search)
router.get('/', [
  authMiddleware,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isLength({ min: 2 }).withMessage('Search term must be at least 2 characters'),
  query('city').optional().notEmpty().withMessage('City cannot be empty'),
  query('state').optional().notEmpty().withMessage('State cannot be empty'),
  query('country').optional().notEmpty().withMessage('Country cannot be empty'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search as string;
  const city = req.query.city as string;
  const state = req.query.state as string;
  const country = req.query.country as string;

  const where: any = { isActive: true };
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { state: { contains: search, mode: 'insensitive' } },
      { country: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (state) where.state = { contains: state, mode: 'insensitive' };
  if (country) where.country = { contains: country, mode: 'insensitive' };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        picture: true,
        city: true,
        state: true,
        country: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            orders: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where })
  ]);

  res.json({
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }
  });
}));

// Get a specific user by ID
router.get('/:id', [
  authMiddleware,
], asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      picture: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      country: true,
      postalCode: true,
      bio: true,
      isVerified: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          orders: true,
          comments: true,
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

// Get user's public profile (for non-authenticated users)
router.get('/:id/public', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      picture: true,
      city: true,
      state: true,
      country: true,
      bio: true,
      isVerified: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
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
router.put('/:id', [
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

  const currentUserId = (req.user as any).id;
  const targetUserId = req.params.id;
  const { name, phone, address, city, state, country, postalCode, bio } = req.body;

  // Check if user is updating their own profile or is admin
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true }
  });

  if (currentUserId !== targetUserId && currentUser?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own profile'
    });
  }

  // Check if target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId }
  });

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (city !== undefined) updateData.city = city;
  if (state !== undefined) updateData.state = state;
  if (country !== undefined) updateData.country = country;
  if (postalCode !== undefined) updateData.postalCode = postalCode;
  if (bio !== undefined) updateData.bio = bio;

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: updateData,
    select: {
      id: true,
      name: true,
      picture: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      country: true,
      postalCode: true,
      bio: true,
      isVerified: true,
      updatedAt: true,
    }
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedUser
  });
}));

// Update user profile picture
router.put('/:id/picture', [
  authMiddleware,
  body('picture').isURL().withMessage('Valid picture URL required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const currentUserId = (req.user as any).id;
  const targetUserId = req.params.id;
  const { picture } = req.body;

  // Check if user is updating their own profile or is admin
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true }
  });

  if (currentUserId !== targetUserId && currentUser?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own profile'
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { picture },
    select: {
      id: true,
      name: true,
      picture: true,
    }
  });

  res.json({
    success: true,
    message: 'Profile picture updated successfully',
    data: updatedUser
  });
}));

// Get user's recent activity
router.get('/:id/activity', [
  authMiddleware,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = req.params.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Get recent posts and orders
  const [posts, orders] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId,
        isPublished: true
      },
      select: {
        id: true,
        content: true,
        images: true,
        likes: true,
        views: true,
        createdAt: true,
        _count: {
          select: {
            comments: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  ]);

  // Combine and sort activities
  const activities = [
    ...posts.map(post => ({
      type: 'post',
      id: post.id,
      title: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      data: post,
      createdAt: post.createdAt
    })),
    ...orders.map(order => ({
      type: 'order',
      id: order.id,
      title: order.title,
      data: order,
      createdAt: order.createdAt
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
   .slice(0, limit);

  res.json({
    success: true,
    data: {
      user,
      activities,
      pagination: {
        page,
        limit,
        total: activities.length,
      }
    }
  });
}));

// Get user statistics
router.get('/:id/stats', [
  authMiddleware,
], asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const stats = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: {
          posts: true,
          orders: true,
          comments: true,
          payments: true,
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
      user,
      totalPosts: stats._count.posts,
      totalOrders: stats._count.orders,
      totalComments: stats._count.comments,
      totalPayments: stats._count.payments,
      totalRevenue,
      completedOrders,
      totalBudget,
      averageOrderValue: completedOrders > 0 ? totalRevenue / completedOrders : 0,
    }
  });
}));

// Search users by location
router.get('/search/location', [
  authMiddleware,
  query('city').optional().notEmpty().withMessage('City cannot be empty'),
  query('state').optional().notEmpty().withMessage('State cannot be empty'),
  query('country').optional().notEmpty().withMessage('Country cannot be empty'),
  query('radius').optional().isFloat({ min: 0 }).withMessage('Radius must be a positive number'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { city, state, country, radius } = req.query;

  const where: any = { isActive: true };
  
  if (city) where.city = { contains: city as string, mode: 'insensitive' };
  if (state) where.state = { contains: state as string, mode: 'insensitive' };
  if (country) where.country = { contains: country as string, mode: 'insensitive' };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      picture: true,
      city: true,
      state: true,
      country: true,
      bio: true,
      isVerified: true,
      _count: {
        select: {
          posts: true,
          orders: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    success: true,
    data: users
  });
}));

export default router; 