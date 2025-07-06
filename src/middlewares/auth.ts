import { Request, Response, NextFunction } from 'express';
import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import dotenv from 'dotenv';

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
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  jwtCheck(req, res, (err: any) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: err.message
      });
    }

    // Extract user info from JWT payload
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User information not found in token'
      });
    }

    // Add user info to request object
    req.user = {
      id: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
      email_verified: user.email_verified
    };

    next();
  });
};

// Optional auth middleware for routes that can work with or without auth
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  jwtCheck(req, res, (err: any) => {
    if (err) {
      // Continue without authentication
      req.user = null;
      return next();
    }

    // Extract user info from JWT payload
    const user = req.user as any;
    if (user) {
      req.user = {
        id: user.sub,
        email: user.email,
        name: user.name,
        picture: user.picture,
        email_verified: user.email_verified
      };
    }

    next();
  });
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user has required role
    // You might want to fetch user roles from database here
    if (!roles.includes(user.role || 'user')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}; 