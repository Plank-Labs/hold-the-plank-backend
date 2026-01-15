import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize from './config/database';
import authRoutes from './routes/auth';
import relicsRoutes from './routes/relics';
import sessionsRoutes from './routes/sessions';
import usersRoutes from './routes/users';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/api/relics', relicsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/users', usersRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test database connection and start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Only sync in development - use migrations in production
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync();
      console.log('✅ Models synchronized');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    process.exit(1);
  }
};

startServer();