import { Request, Response } from 'express';
import { createPublicClient, http, type Address } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
import User from '../models/User';
import MintSignature from '../models/MintSignature';
import { SignatureService } from '../services/signatureService';

const RELIC_REQUIREMENTS = {
  1: 60,        // Bronze Shield - 1 minute
  2: 600,       // Silver Helmet - 10 minutes
  3: 3600,      // Gold Sword - 1 hour
  4: 36000,     // Diamond Crown - 10 hours
  5: 360000,    // Kronos Slayer - 100 hours
};

// Initialize signature service
const initSignatureService = () => {
  const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
  const relicsContractAddress = process.env.RELICS_CONTRACT_ADDRESS;

  if (!signerPrivateKey || !relicsContractAddress) {
    throw new Error('Missing SIGNER_PRIVATE_KEY or RELICS_CONTRACT_ADDRESS in environment');
  }

  return new SignatureService(signerPrivateKey, relicsContractAddress);
};

// Initialize public client
const getPublicClient = () => {
  const rpcUrl = process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
  return createPublicClient({
    chain: mantleSepoliaTestnet,
    transport: http(rpcUrl),
  });
};

/**
 * Request a signature to mint a Relic NFT
 * POST /api/relics/request-signature
 */
export const requestSignature = async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!tokenId || tokenId < 1 || tokenId > 5) {
      return res.status(400).json({ message: 'Invalid token ID. Must be between 1 and 5.' });
    }

    // Get user from database
    const user = await User.findByPk(userId);
    if (!user || !user.wallet_address) {
      return res.status(404).json({ message: 'User not found or wallet not connected' });
    }

    // Check eligibility based on total time
    const totalTimeSeconds = user.minutes_of_life_gained * 60;
    const requirement = RELIC_REQUIREMENTS[tokenId as keyof typeof RELIC_REQUIREMENTS];

    if (totalTimeSeconds < requirement) {
      return res.status(403).json({
        message: `Not eligible. Need ${requirement} seconds, have ${totalTimeSeconds} seconds.`,
        requirement,
        current: totalTimeSeconds,
      });
    }

    // Initialize services
    const signatureService = initSignatureService();
    const publicClient = getPublicClient();

    // Check if already claimed on-chain
    const hasClaimed = await signatureService.hasUserClaimedRelic(
      user.wallet_address as Address,
      tokenId,
      publicClient
    );

    if (hasClaimed) {
      return res.status(400).json({ message: 'Relic already claimed on-chain' });
    }

    // Check if signature already exists in database
    const existingSignature = await MintSignature.findOne({
      where: {
        user_id: userId,
        token_id: tokenId,
        status: 'pending',
      },
    });

    if (existingSignature) {
      // Check if signature is still valid (not expired)
      const now = new Date();
      if (existingSignature.deadline > now) {
        return res.json({
          signature: existingSignature.signature,
          deadline: BigInt(Math.floor(existingSignature.deadline.getTime() / 1000)),
          nonce: BigInt(existingSignature.nonce),
          tokenId,
        });
      } else {
        // Signature expired, mark it and generate a new one
        await existingSignature.update({ status: 'expired' });
      }
    }

    // Get current nonce from contract
    const nonce = await signatureService.getUserNonce(user.wallet_address as Address, publicClient);

    // Set deadline (1 hour from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Generate signature
    const signatureData = await signatureService.generateMintSignature(
      user.wallet_address as Address,
      tokenId,
      nonce,
      deadline
    );

    // Store signature in database
    await MintSignature.create({
      user_id: userId,
      wallet_address: user.wallet_address,
      token_id: tokenId,
      nonce: Number(signatureData.nonce),
      deadline: new Date(Number(signatureData.deadline) * 1000),
      signature: signatureData.signature,
      status: 'pending',
    });

    return res.json({
      signature: signatureData.signature,
      deadline: signatureData.deadline,
      nonce: signatureData.nonce,
      tokenId,
    });
  } catch (error) {
    console.error('Error generating signature:', error);
    return res.status(500).json({
      message: 'Failed to generate signature',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Mark a signature as used after successful mint
 * POST /api/relics/confirm-mint
 */
export const confirmMint = async (req: Request, res: Response) => {
  try {
    const { tokenId, txHash } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!tokenId || !txHash) {
      return res.status(400).json({ message: 'Missing tokenId or txHash' });
    }

    // Find and update the signature
    const signature = await MintSignature.findOne({
      where: {
        user_id: userId,
        token_id: tokenId,
        status: 'pending',
      },
    });

    if (!signature) {
      return res.status(404).json({ message: 'Signature not found' });
    }

    await signature.update({
      status: 'used',
      used_at: new Date(),
      tx_hash: txHash,
    });

    return res.json({ message: 'Mint confirmed successfully' });
  } catch (error) {
    console.error('Error confirming mint:', error);
    return res.status(500).json({
      message: 'Failed to confirm mint',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get all mint signatures for the authenticated user
 * GET /api/relics/signatures
 */
export const getUserSignatures = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const signatures = await MintSignature.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });

    return res.json({ signatures });
  } catch (error) {
    console.error('Error fetching signatures:', error);
    return res.status(500).json({
      message: 'Failed to fetch signatures',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
