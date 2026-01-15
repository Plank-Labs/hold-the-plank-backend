import { Request, Response } from 'express';
import privyClient from '../config/privy';
import User from '../models/User';

export const verifyAuth = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Privy
    const verifiedClaims = await privyClient.verifyAuthToken(token);
    const privyUserId = verifiedClaims.userId;

    // Get user info from Privy
    const privyUser = await privyClient.getUser(privyUserId);

    const email = privyUser.email?.address;

    // Get wallet address from multiple sources (embedded or linked)
    let walletAddress = privyUser.wallet?.address;
    if (!walletAddress && privyUser.linkedAccounts) {
      const linkedWallet = privyUser.linkedAccounts.find(
        (account: any) => account.type === 'wallet' || account.type === 'smart_wallet'
      );
      if (linkedWallet && 'address' in linkedWallet) {
        walletAddress = linkedWallet.address;
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Email not found in Privy user' });
    }

    // Find or create user in our database
    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({
        email,
        wallet_address: walletAddress || null,
        username: null,
      });
    } else if (walletAddress && user.wallet_address !== walletAddress) {
      // Update wallet if changed
      await user.update({ wallet_address: walletAddress });
    }

    const u = user.dataValues;

    return res.json({
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        walletAddress: u.wallet_address,
        guildId: u.guild_id,
        balancePlank: u.balance_plank,
        auraPoints: u.aura_points,
        minutesOfLifeGained: u.minutes_of_life_gained,
        isActive: u.is_active,
      },
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};