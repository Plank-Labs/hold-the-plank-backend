import { Request, Response, NextFunction } from 'express';
import privyClient from '../config/privy';
import User from '../models/User';

/**
 * Middleware to verify Privy JWT token
 * Uses the same logic as authController.verifyAuth
 */
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Privy
    const verifiedClaims = await privyClient.verifyAuthToken(token);
    const privyUserId = verifiedClaims.userId;

    // Get user info from Privy
    const privyUser = await privyClient.getUser(privyUserId);
    const email = privyUser.email?.address;

    if (!email) {
      return res.status(401).json({ message: 'User email not found' });
    }

    // Find user in our database by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'User not found in database' });
    }

    // Attach database user ID to request
    (req as any).user = {
      id: user.id,
      privyId: privyUserId,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};
