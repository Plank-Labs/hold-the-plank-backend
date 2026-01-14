import express from 'express';
import { requestSignature, confirmMint, getUserSignatures } from '../controllers/relicsController';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.post('/request-signature', verifyToken, requestSignature);
router.post('/confirm-mint', verifyToken, confirmMint);
router.get('/signatures', verifyToken, getUserSignatures);

export default router;
