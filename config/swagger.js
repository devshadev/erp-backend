import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Authentication API Documentation',
      version: '1.0.0',
      description: 'API documentation for authentication endpoints',
    },
    servers: [
      {
        url: 'https://erp-backend-xejp.onrender.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:5000', 
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
        },
      },
    },
  },
  apis: ['./routes/*.js'], 
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerUi, swaggerSpec };