import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK only if credentials are available
let firebaseAdmin: admin.app.App | null = null;

if (!admin.apps.length && process.env['FIREBASE_PROJECT_ID'] && process.env['FIREBASE_PRIVATE_KEY']) {
  try {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env['FIREBASE_PROJECT_ID'],
      private_key_id: process.env['FIREBASE_PRIVATE_KEY_ID'],
      private_key: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
      client_email: process.env['FIREBASE_CLIENT_EMAIL'],
      client_id: process.env['FIREBASE_CLIENT_ID'],
      auth_uri: process.env['FIREBASE_AUTH_URI'],
      token_uri: process.env['FIREBASE_TOKEN_URI'],
      auth_provider_x509_cert_url: process.env['FIREBASE_AUTH_PROVIDER_X509_CERT_URL'],
      client_x509_cert_url: process.env['FIREBASE_CLIENT_X509_CERT_URL'],
    };

    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.warn('Firebase Admin SDK initialization failed:', error);
    console.warn('Push notifications will be disabled');
  }
} else {
  console.warn('Firebase credentials not found. Push notifications will be disabled');
}

export { firebaseAdmin };

// Send notification to a single device
export const sendNotificationToDevice = async (
  token: string,
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  },
  data?: Record<string, string>
) => {
  if (!firebaseAdmin) {
    console.warn('Firebase not initialized. Notification not sent.');
    return null;
  }

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      data,
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await firebaseAdmin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

// Send notification to multiple devices
export const sendNotificationToMultipleDevices = async (
  tokens: string[],
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  },
  data?: Record<string, string>
) => {
  if (!firebaseAdmin) {
    console.warn('Firebase not initialized. Notifications not sent.');
    return null;
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data,
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await firebaseAdmin.messaging().sendMulticast(message);
    console.log('Successfully sent notifications:', response);
    return response;
  } catch (error) {
    console.error('Error sending notifications:', error);
    throw error;
  }
};

// Send notification to a topic
export const sendNotificationToTopic = async (
  topic: string,
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  },
  data?: Record<string, string>
) => {
  if (!firebaseAdmin) {
    console.warn('Firebase not initialized. Topic notification not sent.');
    return null;
  }

  try {
    const message: admin.messaging.Message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data,
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await firebaseAdmin.messaging().send(message);
    console.log('Successfully sent topic notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending topic notification:', error);
    throw error;
  }
};

// Subscribe a device to a topic
export const subscribeToTopic = async (tokens: string[], topic: string) => {
  if (!firebaseAdmin) {
    console.warn('Firebase not initialized. Topic subscription not performed.');
    return null;
  }

  try {
    const response = await firebaseAdmin.messaging().subscribeToTopic(tokens, topic);
    console.log('Successfully subscribed to topic:', response);
    return response;
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    throw error;
  }
};

// Unsubscribe a device from a topic
export const unsubscribeFromTopic = async (tokens: string[], topic: string) => {
  if (!firebaseAdmin) {
    console.warn('Firebase not initialized. Topic unsubscription not performed.');
    return null;
  }

  try {
    const response = await firebaseAdmin.messaging().unsubscribeFromTopic(tokens, topic);
    console.log('Successfully unsubscribed from topic:', response);
    return response;
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    throw error;
  }
};

// Notification templates
export const NOTIFICATION_TEMPLATES = {
  ORDER_UPDATE: (orderTitle: string, status: string) => ({
    title: 'Actualización de Orden',
    body: `Tu orden "${orderTitle}" ha sido actualizada a: ${status}`,
  }),
  PAYMENT_RECEIVED: (amount: number) => ({
    title: 'Pago Recibido',
    body: `Se ha recibido un pago de $${amount.toFixed(2)}`,
  }),
  NEW_MESSAGE: (senderName: string) => ({
    title: 'Nuevo Mensaje',
    body: `Tienes un nuevo mensaje de ${senderName}`,
  }),
  SYSTEM: (title: string, message: string) => ({
    title,
    body: message,
  }),
  PROMOTIONAL: (title: string, message: string) => ({
    title,
    body: message,
  }),
}; 