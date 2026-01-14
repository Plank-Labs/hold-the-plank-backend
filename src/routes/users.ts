import express from 'express';
import { getPendingRewards } from '../controllers/sessionsController';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Get pending rewards for authenticated user
router.get('/pending-rewards', verifyToken, getPendingRewards);

export default router;
