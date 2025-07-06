import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: process.env['PORT'] || 4000,
  nodeEnv: process.env['NODE_ENV'] || 'development',
  
  // Database
  database: {
    url: process.env['DATABASE_URL'],
  },

  // Auth0
  auth0: {
    domain: process.env['AUTH0_DOMAIN'],
    audience: process.env['AUTH0_AUDIENCE'],
    issuer: process.env['AUTH0_ISSUER'],
  },

  // Stripe
  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'],
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
    basicProductId: process.env['STRIPE_BASIC_PRODUCT_ID'] || 'prod_basic_membership',
    premiumProductId: process.env['STRIPE_PREMIUM_PRODUCT_ID'] || 'prod_premium_membership',
    enterpriseProductId: process.env['STRIPE_ENTERPRISE_PRODUCT_ID'] || 'prod_enterprise_membership',
    basicPriceId: process.env['STRIPE_BASIC_PRICE_ID'] || 'price_basic_monthly',
    premiumPriceId: process.env['STRIPE_PREMIUM_PRICE_ID'] || 'price_premium_monthly',
    enterprisePriceId: process.env['STRIPE_ENTERPRISE_PRICE_ID'] || 'price_enterprise_monthly',
  },

  // Firebase
  firebase: {
    projectId: process.env['FIREBASE_PROJECT_ID'],
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
    privateKey: process.env['FIREBASE_PRIVATE_KEY'],
    privateKeyId: process.env['FIREBASE_PRIVATE_KEY_ID'],
    clientId: process.env['FIREBASE_CLIENT_ID'],
    authUri: process.env['FIREBASE_AUTH_URI'],
    tokenUri: process.env['FIREBASE_TOKEN_URI'],
    authProviderX509CertUrl: process.env['FIREBASE_AUTH_PROVIDER_X509_CERT_URL'],
    clientX509CertUrl: process.env['FIREBASE_CLIENT_X509_CERT_URL'],
  },

  // Security
  security: {
    corsOrigin: process.env['CORS_ORIGIN'] || '*',
    rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env['RATE_LIMIT_MAX'] || '100'), // 100 requests per window
  },

  // Logging
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    enableRequestLogging: process.env['ENABLE_REQUEST_LOGGING'] === 'true',
  },
} as const;

// Validation function to ensure all required config is present
export const validateConfig = (): void => {
  const requiredFields = [
    'DATABASE_URL',
    'AUTH0_DOMAIN',
    'AUTH0_AUDIENCE',
    'AUTH0_ISSUER',
  ];

  const missingFields = requiredFields.filter(field => !process.env[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
  }
};

// Helper function to check if we're in development
export const isDevelopment = (): boolean => config.nodeEnv === 'development';

// Helper function to check if we're in production
export const isProduction = (): boolean => config.nodeEnv === 'production'; 