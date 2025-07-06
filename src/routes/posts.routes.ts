import { Router, Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middlewares/errorHandler';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all posts (public feed)
router.get('/', [
  optionalAuthMiddleware,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('userId').optional().isUUID().withMessage('Valid user ID required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const currentUserId = (req.user as any)?.id;
  const page = parseInt(req.query['page'] as string) || 1;
  const limit = parseInt(req.query['limit'] as string) || 10;
  const skip = (page - 1) * limit;
  const userId = req.query['userId'] as string;

  const where: any = { isPublished: true };
  if (userId) where.userId = userId;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            picture: true,
            city: true,
            state: true,
            country: true,
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                picture: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 3, // Only get latest 3 comments
        },
        _count: {
          select: {
            comments: true,
            likes_users: true,
          }
        },
        likes_users: currentUserId ? {
          where: { userId: currentUserId }
        } : false,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({ where })
  ]);

  // Transform posts to include if current user liked them
  const transformedPosts = posts.map((post: any) => ({
    ...post,
    isLiked: post.likes_users && post.likes_users.length > 0,
    likes_users: undefined, // Remove the likes_users array from response
  }));

  res.json({
    success: true,
    data: transformedPosts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }
  });
}));

// Get a specific post by ID
router.get('/:id', [
  optionalAuthMiddleware,
], asyncHandler(async (req: Request, res: Response) => {
  const currentUserId = (req.user as any)?.id;
  const postId = req.params['id'];

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      isPublished: true
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          picture: true,
          city: true,
          state: true,
          country: true,
          bio: true,
        }
      },
      comments: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              picture: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          comments: true,
          likes_users: true,
        }
      },
      likes_users: currentUserId ? {
        where: { userId: currentUserId }
      } : false,
    }
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  // Increment view count
  await prisma.post.update({
    where: { id: postId },
    data: { views: { increment: 1 } }
  });

  const transformedPost = {
    ...post,
    isLiked: post.likes_users && post.likes_users.length > 0,
    likes_users: undefined,
  };

  res.json({
    success: true,
    data: transformedPost
  });
}));

// Create a new post
router.post('/', [
  authMiddleware,
  body('content').notEmpty().withMessage('Content is required').isLength({ max: 2000 }).withMessage('Content must be less than 2000 characters'),
  body('images').optional().isArray().withMessage('Images must be an array'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const { content, images = [] } = req.body;

  const post = await prisma.post.create({
    data: {
      content,
      images,
      userId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          picture: true,
          city: true,
          state: true,
          country: true,
        }
      },
      _count: {
        select: {
          comments: true,
          likes_users: true,
        }
      }
    }
  });

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    data: post
  });
}));

// Update a post
router.put('/:id', [
  authMiddleware,
  body('content').optional().notEmpty().withMessage('Content cannot be empty').isLength({ max: 2000 }).withMessage('Content must be less than 2000 characters'),
  body('images').optional().isArray().withMessage('Images must be an array'),
  body('isPublished').optional().isBoolean().withMessage('isPublished must be a boolean'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const postId = req.params['id'];
  const { content, images, isPublished } = req.body;

  // Check if post exists and belongs to user
  const existingPost = await prisma.post.findFirst({
    where: {
      id: postId,
      userId
    }
  });

  if (!existingPost) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  const updateData: any = {};
  if (content !== undefined) updateData.content = content;
  if (images !== undefined) updateData.images = images;
  if (isPublished !== undefined) updateData.isPublished = isPublished;

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          picture: true,
          city: true,
          state: true,
          country: true,
        }
      },
      _count: {
        select: {
          comments: true,
          likes_users: true,
        }
      }
    }
  });

  res.json({
    success: true,
    message: 'Post updated successfully',
    data: updatedPost
  });
}));

// Delete a post
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const postId = req.params['id'];

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      userId
    }
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  await prisma.post.delete({
    where: { id: postId }
  });

  res.json({
    success: true,
    message: 'Post deleted successfully'
  });
}));

// Like/unlike a post
router.post('/:id/like', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const postId = req.params.id;

  // Check if post exists
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      isPublished: true
    }
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  // Check if user already liked the post
  const existingLike = await prisma.postLike.findUnique({
    where: {
      postId_userId: {
        postId,
        userId
      }
    }
  });

  if (existingLike) {
    // Unlike the post
    await prisma.postLike.delete({
      where: {
        postId_userId: {
          postId,
          userId
        }
      }
    });

    // Decrement like count
    await prisma.post.update({
      where: { id: postId },
      data: { likes: { decrement: 1 } }
    });

    res.json({
      success: true,
      message: 'Post unliked successfully',
      data: { liked: false }
    });
  } else {
    // Like the post
    await prisma.postLike.create({
      data: {
        postId,
        userId
      }
    });

    // Increment like count
    await prisma.post.update({
      where: { id: postId },
      data: { likes: { increment: 1 } }
    });

    res.json({
      success: true,
      message: 'Post liked successfully',
      data: { liked: true }
    });
  }
}));

// Add a comment to a post
router.post('/:id/comments', [
  authMiddleware,
  body('content').notEmpty().withMessage('Comment content is required').isLength({ max: 500 }).withMessage('Comment must be less than 500 characters'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const userId = (req.user as any).id;
  const postId = req.params.id;
  const { content } = req.body;

  // Check if post exists
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      isPublished: true
    }
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      postId,
      userId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          picture: true,
        }
      }
    }
  });

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: comment
  });
}));

// Delete a comment
router.delete('/comments/:commentId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const commentId = req.params.commentId;

  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      userId
    }
  });

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found'
    });
  }

  await prisma.comment.delete({
    where: { id: commentId }
  });

  res.json({
    success: true,
    message: 'Comment deleted successfully'
  });
}));

// Get user's posts
router.get('/user/:userId', [
  optionalAuthMiddleware,
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

  const currentUserId = (req.user as any)?.id;
  const userId = req.params.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, picture: true }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId,
        isPublished: true
      },
      include: {
        _count: {
          select: {
            comments: true,
            likes_users: true,
          }
        },
        likes_users: currentUserId ? {
          where: { userId: currentUserId }
        } : false,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({
      where: {
        userId,
        isPublished: true
      }
    })
  ]);

  const transformedPosts = posts.map(post => ({
    ...post,
    isLiked: post.likes_users && post.likes_users.length > 0,
    likes_users: undefined,
  }));

  res.json({
    success: true,
    data: {
      user,
      posts: transformedPosts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    }
  });
}));

export default router; 