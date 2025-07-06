import { Request, Response, NextFunction } from 'express';
import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import dotenv from 'dotenv';
import { AuthUser, CustomError } from '../types';
import { logger } from '../utils/logger';

dotenv.config();

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Auth0 JWT middleware
export const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env['AUTH0_DOMAIN']}/.well-known/jwks.json`
  }),
  audience: process.env['AUTH0_AUDIENCE'],
  issuer: process.env['AUTH0_ISSUER'],
  algorithms: ['RS256']
});

// Custom auth middleware that extracts user info
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  jwtCheck(req, res, (err: any) => {
    if (err) {
      logger.logAuth('token_validation', undefined, false);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: err.message
      });
    }

    // Extract user info from JWT payload
    const user = req.user as any;
    if (!user) {
      logger.logAuth('user_info_missing', undefined, false);
      return res.status(401).json({
        success: false,
        message: 'User information not found in token'
      });
    }

    // Add user info to request object
    const authUser: AuthUser = {
      id: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
      email_verified: user.email_verified
    };

    req.user = authUser;
    logger.logAuth('token_validation', authUser.id, true);
    next();
  });
};

// Optional auth middleware for routes that can work with or without auth
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  jwtCheck(req, res, (err: any) => {
    if (err) {
      // Continue without authentication
      req.user = null;
      logger.logAuth('optional_auth_skipped', undefined, false);
      return next();
    }

    // Extract user info from JWT payload
    const user = req.user as any;
    if (user) {
      const authUser: AuthUser = {
        id: user.sub,
        email: user.email,
        name: user.name,
        picture: user.picture,
        email_verified: user.email_verified
      };
      req.user = authUser;
      logger.logAuth('optional_auth_success', authUser.id, true);
    }

    next();
  });
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser;
    
    if (!user) {
      logger.logAuth('role_check_failed', undefined, false);
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user has required role
    // You might want to fetch user roles from database here
    if (!roles.includes(user.role || 'user')) {
      logger.logAuth('insufficient_permissions', user.id, false);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    logger.logAuth('role_check_success', user.id, true);
    next();
  };
};

// Admin-only middleware
export const requireAdmin = requireRole(['ADMIN']);

// Premium or admin middleware
export const requirePremium = requireRole(['PREMIUM', 'ADMIN']); 