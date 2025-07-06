import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiResponse, ValidationError } from '../types';

// Validation middleware
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors: ValidationError[] = errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: (error as any).value
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      };

      return res.status(400).json(response);
    }

    next();
  };
};

// Pagination validation
export const validatePagination = () => {
  return validate([
    // Validation chains will be added by the calling function
  ]);
};

// Common validation rules
export const commonValidations = {
  pagination: {
    page: (optional = true) => optional 
      ? { optional: true, isInt: { min: 1 }, withMessage: 'Page must be a positive integer' }
      : { isInt: { min: 1 }, withMessage: 'Page must be a positive integer' },
    limit: (optional = true, max = 100) => optional
      ? { optional: true, isInt: { min: 1, max }, withMessage: `Limit must be between 1 and ${max}` }
      : { isInt: { min: 1, max }, withMessage: `Limit must be between 1 and ${max}` }
  },
  user: {
    name: { notEmpty: true, withMessage: 'Name is required' },
    email: { isEmail: true, withMessage: 'Valid email is required' },
    phone: { optional: true, isMobilePhone: 'any', withMessage: 'Valid phone number required' },
    bio: { optional: true, isLength: { max: 500 }, withMessage: 'Bio must be less than 500 characters' }
  },
  post: {
    content: { notEmpty: true, isLength: { max: 2000 }, withMessage: 'Content must be less than 2000 characters' },
    images: { optional: true, isArray: true, withMessage: 'Images must be an array' }
  },
  order: {
    title: { notEmpty: true, withMessage: 'Title is required' },
    clientName: { notEmpty: true, withMessage: 'Client name is required' },
    description: { optional: true, isLength: { max: 1000 }, withMessage: 'Description must be less than 1000 characters' },
    clientEmail: { optional: true, isEmail: true, withMessage: 'Valid email required' },
    clientPhone: { optional: true, isMobilePhone: 'any', withMessage: 'Valid phone number required' },
    budget: { optional: true, isFloat: { min: 0 }, withMessage: 'Budget must be a positive number' },
    priority: { optional: true, isIn: { options: [['LOW', 'MEDIUM', 'HIGH', 'URGENT']] }, withMessage: 'Invalid priority' },
    status: { optional: true, isIn: { options: [['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']] }, withMessage: 'Invalid status' },
    startDate: { optional: true, isISO8601: true, withMessage: 'Valid start date required' },
    endDate: { optional: true, isISO8601: true, withMessage: 'Valid end date required' }
  },
  notification: {
    title: { notEmpty: true, withMessage: 'Title is required' },
    body: { notEmpty: true, withMessage: 'Body is required' },
    type: { isIn: { options: [['ORDER_UPDATE', 'PAYMENT_RECEIVED', 'NEW_MESSAGE', 'SYSTEM', 'PROMOTIONAL']] }, withMessage: 'Invalid notification type' }
  }
}; 