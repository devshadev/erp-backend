import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGO_URI ,
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
}