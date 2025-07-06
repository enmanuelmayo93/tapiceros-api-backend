import { Request } from 'express';

// User types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

export interface UserProfile {
  id: string;
  auth0Id: string;
  email: string;
  name: string;
  picture?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  bio?: string;
  role: 'ADMIN' | 'USER' | 'PREMIUM';
  isVerified: boolean;
  isActive: boolean;
  fcmToken?: string;
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Request augmentation
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser | null;
    }
  }
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Validation error type
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Pagination types
export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

// Order types
export interface CreateOrderData {
  title: string;
  description?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  budget?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  startDate?: Date;
  endDate?: Date;
}

// Post types
export interface CreatePostData {
  content: string;
  images?: string[];
}

// Notification types
export interface NotificationData {
  title: string;
  body: string;
  type: 'ORDER_UPDATE' | 'PAYMENT_RECEIVED' | 'NEW_MESSAGE' | 'SYSTEM' | 'PROMOTIONAL';
  data?: Record<string, any>;
}

// Stripe types
export interface StripeCustomerData {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionData {
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

// Error types
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code || undefined;

    Error.captureStackTrace(this, this.constructor);
  }
} 