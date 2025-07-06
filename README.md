# Tapiceros del Mundo - Backend API

Backend API para la aplicación móvil de Tapiceros del Mundo, construido con Node.js, Express, PostgreSQL, y TypeScript.

## 🚀 Características

- **Autenticación**: Integración con Auth0 para JWT
- **Base de datos**: PostgreSQL con Prisma ORM
- **Pagos**: Integración completa con Stripe
- **Notificaciones**: Firebase Admin SDK para push notifications
- **PDFs**: Generación de facturas y recibos con PDFKit
- **Feed social**: Sistema de publicaciones, comentarios y likes
- **Gestión de órdenes**: CRUD completo para órdenes de servicio
- **Membresías**: Sistema de suscripciones con Stripe
- **API RESTful**: Endpoints bien documentados y validados

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **Base de datos**: PostgreSQL
- **ORM**: Prisma
- **Autenticación**: Auth0
- **Pagos**: Stripe
- **Notificaciones**: Firebase Admin SDK
- **PDFs**: PDFKit
- **Validación**: Express Validator
- **Seguridad**: Helmet, CORS, Rate Limiting

## 📋 Prerrequisitos

- Node.js 18 o superior
- PostgreSQL 12 o superior
- Cuenta de Auth0
- Cuenta de Stripe
- Proyecto de Firebase

## 🔧 Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd tapiceros-api-backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
```

Editar el archivo `.env` con tus credenciales:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/tapiceros_db"

# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-identifier
AUTH0_ISSUER=https://your-domain.auth0.com/

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com
```

4. **Configurar la base de datos**
```bash
# Generar el cliente de Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# (Opcional) Abrir Prisma Studio
npm run prisma:studio
```

5. **Ejecutar el servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## 📚 Estructura del Proyecto

```
src/
├── config/           # Configuraciones de servicios externos
│   ├── auth.ts      # Configuración de Auth0
│   ├── stripe.ts    # Configuración de Stripe
│   └── firebase.ts  # Configuración de Firebase
├── routes/          # Rutas de la API
│   ├── auth.routes.ts
│   ├── users.routes.ts
│   ├── posts.routes.ts
│   ├── orders.routes.ts
│   ├── stripe.routes.ts
│   └── notifications.routes.ts
├── middlewares/     # Middlewares personalizados
│   ├── auth.ts
│   └── errorHandler.ts
├── utils/           # Utilidades
│   └── pdfGenerator.ts
└── index.ts         # Punto de entrada
```

## 🔌 Endpoints de la API

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/profile` - Obtener perfil del usuario
- `PUT /api/auth/profile` - Actualizar perfil
- `POST /api/auth/fcm-token` - Actualizar token FCM
- `DELETE /api/auth/account` - Eliminar cuenta
- `GET /api/auth/stats` - Estadísticas del usuario

### Usuarios
- `GET /api/users` - Listar usuarios
- `GET /api/users/:id` - Obtener usuario específico
- `GET /api/users/:id/public` - Perfil público
- `PUT /api/users/:id` - Actualizar usuario
- `PUT /api/users/:id/picture` - Actualizar foto de perfil
- `GET /api/users/:id/activity` - Actividad reciente
- `GET /api/users/:id/stats` - Estadísticas del usuario
- `GET /api/users/search/location` - Buscar por ubicación

### Publicaciones (Feed)
- `GET /api/posts` - Obtener publicaciones
- `GET /api/posts/:id` - Obtener publicación específica
- `POST /api/posts` - Crear publicación
- `PUT /api/posts/:id` - Actualizar publicación
- `DELETE /api/posts/:id` - Eliminar publicación
- `POST /api/posts/:id/like` - Like/unlike publicación
- `POST /api/posts/:id/comments` - Comentar publicación
- `DELETE /api/posts/comments/:commentId` - Eliminar comentario
- `GET /api/posts/user/:userId` - Publicaciones de un usuario

### Órdenes
- `GET /api/orders` - Listar órdenes
- `GET /api/orders/:id` - Obtener orden específica
- `POST /api/orders` - Crear orden
- `PUT /api/orders/:id` - Actualizar orden
- `DELETE /api/orders/:id` - Eliminar orden
- `GET /api/orders/stats/overview` - Estadísticas de órdenes

### Pagos (Stripe)
- `POST /api/stripe/create-checkout-session` - Crear sesión de pago
- `POST /api/stripe/create-subscription` - Crear suscripción
- `POST /api/stripe/cancel-subscription` - Cancelar suscripción
- `POST /api/stripe/create-invoice` - Crear factura
- `POST /api/stripe/send-invoice/:invoiceId` - Enviar factura
- `GET /api/stripe/payments` - Historial de pagos
- `GET /api/stripe/subscription` - Estado de suscripción
- `POST /api/stripe/webhook` - Webhook de Stripe

### Notificaciones
- `GET /api/notifications` - Obtener notificaciones
- `GET /api/notifications/unread-count` - Contar no leídas
- `PUT /api/notifications/:id/read` - Marcar como leída
- `PUT /api/notifications/mark-all-read` - Marcar todas como leídas
- `DELETE /api/notifications/:id` - Eliminar notificación
- `DELETE /api/notifications` - Eliminar todas
- `POST /api/notifications/test` - Enviar notificación de prueba
- `POST /api/notifications/send` - Enviar a múltiples usuarios (admin)
- `GET /api/notifications/stats` - Estadísticas de notificaciones
- `PUT /api/notifications/fcm-token` - Actualizar token FCM

## 🔐 Configuración de Auth0

1. Crear una cuenta en [Auth0](https://auth0.com)
2. Crear una nueva aplicación (API)
3. Configurar los siguientes parámetros:
   - **Allowed Callback URLs**: `http://localhost:3000/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`
4. Copiar las credenciales al archivo `.env`

## 💳 Configuración de Stripe

1. Crear una cuenta en [Stripe](https://stripe.com)
2. Obtener las claves de API desde el dashboard
3. Configurar productos y precios para las membresías
4. Configurar webhooks para recibir eventos
5. Copiar las credenciales al archivo `.env`

## 🔥 Configuración de Firebase

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar Cloud Messaging
3. Generar una clave de servicio
4. Descargar el archivo JSON de credenciales
5. Copiar las credenciales al archivo `.env`

## 📊 Base de Datos

El esquema de la base de datos incluye las siguientes entidades principales:

- **Users**: Usuarios del sistema
- **Posts**: Publicaciones del feed
- **Comments**: Comentarios en publicaciones
- **Orders**: Órdenes de servicio
- **Payments**: Pagos procesados
- **Memberships**: Membresías de usuarios
- **Invoices**: Facturas generadas
- **Notifications**: Notificaciones push

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Ejecutar tests en modo watch
npm run test:watch
```

## 🚀 Despliegue

### Heroku
```bash
# Crear aplicación en Heroku
heroku create your-app-name

# Configurar variables de entorno
heroku config:set NODE_ENV=production
heroku config:set DATABASE_URL=your_postgresql_url
# ... otras variables

# Desplegar
git push heroku main
```

### Docker
```bash
# Construir imagen
docker build -t tapiceros-api .

# Ejecutar contenedor
docker run -p 3000:3000 tapiceros-api
```

## 📝 Scripts Disponibles

- `npm run dev` - Ejecutar en modo desarrollo
- `npm run build` - Compilar TypeScript
- `npm start` - Ejecutar en producción
- `npm run prisma:generate` - Generar cliente Prisma
- `npm run prisma:migrate` - Ejecutar migraciones
- `npm run prisma:studio` - Abrir Prisma Studio
- `npm test` - Ejecutar tests

## 🔒 Seguridad

- Autenticación JWT con Auth0
- Validación de entrada con Express Validator
- Rate limiting para prevenir abuso
- Headers de seguridad con Helmet
- CORS configurado
- Sanitización de datos

## 📞 Soporte

Para soporte técnico o preguntas, contactar:
- Email: soporte@tapicerosdelmundo.com
- Documentación: [docs.tapicerosdelmundo.com](https://docs.tapicerosdelmundo.com)

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

---

**Tapiceros del Mundo** - Conectando artesanos con el mundo 🌍