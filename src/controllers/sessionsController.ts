import { Request, Response } from 'express';
import { parseUnits } from 'viem';
import User from '../models/User';
import RelayerQueue from '../models/RelayerQueue';

/**
 * Calculate PLANK reward: 1 PLANK per 20 seconds
 */
const calculatePlankReward = (validSeconds: number): string => {
  const plankAmount = validSeconds / 20;
  // Convert to wei (18 decimals)
  return parseUnits(plankAmount.toString(), 18).toString();
};

/**
 * Complete a plank session and queue rewards
 * POST /api/sessions/complete
 */
export const completeSession = async (req: Request, res: Response) => {
  try {
    const { validSeconds, auraPoints } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!validSeconds || validSeconds < 0) {
      return res.status(400).json({ message: 'Invalid session duration' });
    }

    // Get user from database
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.wallet_address) {
      return res.status(400).json({
        message: 'Wallet not connected. Please connect wallet to receive PLANK rewards.',
      });
    }

    // Calculate rewards
    const plankRewardWei = calculatePlankReward(validSeconds);
    const lifeTimeGained = validSeconds / 60; // minutes

    // Update user stats
    await user.update({
      aura_points: user.aura_points + (auraPoints || 0),
      minutes_of_life_gained: user.minutes_of_life_gained + lifeTimeGained,
    });

    // Queue PLANK reward for relayer to mint
    const queueEntry = await RelayerQueue.create({
      user_id: userId,
      wallet_address: user.wallet_address,
      amount: plankRewardWei,
      reason: 'SESSION_REWARD',
      session_id: null,
      status: 'pending',
    });

    return res.json({
      message: 'Session completed successfully',
      session: {
        validSeconds,
        auraPointsGained: auraPoints || 0,
        plankReward: plankRewardWei,
        lifeTimeGained,
      },
      reward: {
        id: queueEntry.id,
        amount: plankRewardWei,
        status: 'pending',
      },
      user: {
        totalAuraPoints: user.aura_points,
        totalTimeConquered: user.minutes_of_life_gained * 60,
      },
    });
  } catch (error) {
    console.error('Error completing session:', error);
    return res.status(500).json({
      message: 'Failed to complete session',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get pending rewards for the authenticated user
 * GET /api/users/pending-rewards
 */
export const getPendingRewards = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rewards = await RelayerQueue.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    return res.json({
      rewards: rewards.map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
        processedAt: r.processed_at,
        txHash: r.tx_hash,
      })),
    });
  } catch (error) {
    console.error('Error fetching pending rewards:', error);
    return res.status(500).json({
      message: 'Failed to fetch pending rewards',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
