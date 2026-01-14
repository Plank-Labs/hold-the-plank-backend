import { Request, Response, NextFunction } from 'express';
import { PrivyClient } from '@privy-io/server-auth';
import User from '../models/User';

const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID || '',
  process.env.PRIVY_APP_SECRET || ''
);

/**
 * Middleware to verify Privy JWT token
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

    const token = authHeader.substring(7);

    // Verify the token with Privy
    const claims = await privyClient.verifyAuthToken(token);

    // Get user info from Privy to find email
    const privyUser = await privyClient.getUser(claims.userId);
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
      privyId: claims.userId,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};
