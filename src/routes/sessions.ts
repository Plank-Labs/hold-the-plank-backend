import express from 'express';
import { completeSession } from '../controllers/sessionsController';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Complete a plank session
router.post('/complete', verifyToken, completeSession);

export default router;
