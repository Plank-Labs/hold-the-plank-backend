import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type Address,
  type Hex,
  keccak256,
  encodePacked,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Relic requirements in seconds
const RELIC_REQUIREMENTS = {
  1: 60,        // Bronze Shield - 1 minute
  2: 600,       // Silver Helmet - 10 minutes
  3: 3600,      // Gold Sword - 1 hour
  4: 36000,     // Diamond Crown - 10 hours
  5: 360000,    // Kronos Slayer - 100 hours
};

interface SignatureData {
  signature: Hex;
  deadline: bigint;
  nonce: bigint;
}

export class SignatureService {
  private account: ReturnType<typeof privateKeyToAccount>;
  private relicsContractAddress: Address;

  constructor(privateKey: string, relicsContractAddress: string) {
    this.account = privateKeyToAccount(privateKey as Hex);
    this.relicsContractAddress = relicsContractAddress as Address;
  }

  /**
   * Check if user is eligible for a specific relic
   */
  isEligibleForRelic(tokenId: number, totalTimeSeconds: number): boolean {
    const requirement = RELIC_REQUIREMENTS[tokenId as keyof typeof RELIC_REQUIREMENTS];
    if (!requirement) return false;
    return totalTimeSeconds >= requirement;
  }

  /**
   * Get the current nonce for a user from the Relics contract
   */
  async getUserNonce(userAddress: Address, publicClient: PublicClient): Promise<bigint> {
    const nonce = await publicClient.readContract({
      address: this.relicsContractAddress,
      abi: [
        {
          name: 'nonces',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'user', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'nonces',
      args: [userAddress],
    });
    return nonce as bigint;
  }

  /**
   * Check if user has already claimed a specific relic
   */
  async hasUserClaimedRelic(
    userAddress: Address,
    tokenId: number,
    publicClient: PublicClient
  ): Promise<boolean> {
    const hasClaimed = await publicClient.readContract({
      address: this.relicsContractAddress,
      abi: [
        {
          name: 'hasClaimed',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'user', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      functionName: 'hasClaimed',
      args: [userAddress, BigInt(tokenId)],
    });
    return hasClaimed as boolean;
  }

  /**
   * Generate a signature for minting a relic NFT
   */
  async generateMintSignature(
    userAddress: Address,
    tokenId: number,
    nonce: bigint,
    deadlineTimestamp: bigint
  ): Promise<SignatureData> {
    // Create the message hash matching the contract's getMessageHash function
    const messageHash = keccak256(
      encodePacked(
        ['address', 'uint256', 'uint256', 'uint256'],
        [userAddress, BigInt(tokenId), nonce, deadlineTimestamp]
      )
    );

    // Sign the hash
    const signature = await this.account.signMessage({
      message: { raw: messageHash },
    });

    return {
      signature,
      deadline: deadlineTimestamp,
      nonce,
    };
  }

  /**
   * Get the signer address
   */
  getSignerAddress(): Address {
    return this.account.address;
  }
}

export default SignatureService;
