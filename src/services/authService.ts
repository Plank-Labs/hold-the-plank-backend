import privyClient from '../config/privy';
import User from '../models/User';

export interface AuthenticatedUser {
  id: number;
  privyId: string;
  email: string;
  walletAddress: string | null;
}

export interface AuthSuccess {
  success: true;
  user: AuthenticatedUser;
  dbUser: User;
}

export interface AuthFailure {
  success: false;
  error: string;
  status: number;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Verify a Privy auth token and get/create the user
 * Centralized auth logic used by both middleware and controller
 */
export const verifyAndGetUser = async (authHeader: string | undefined): Promise<AuthResult> => {
  console.log('[Auth] verifyAndGetUser called, hasHeader:', !!authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth] No token or invalid format');
    return { success: false, error: 'No token provided', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  console.log('[Auth] Token extracted, length:', token.length);

  // Verify token with Privy
  console.log('[Auth] Verifying token with Privy...');
  const verifiedClaims = await privyClient.verifyAuthToken(token);
  console.log('[Auth] Token verified, userId:', verifiedClaims.userId);
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
    return { success: false, error: 'Email not found in Privy user', status: 400 };
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

  return {
    success: true,
    user: {
      id: user.id,
      privyId: privyUserId,
      email: user.email,
      walletAddress: user.wallet_address,
    },
    dbUser: user,
  };
};
