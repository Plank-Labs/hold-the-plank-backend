# Conquer Plank - Implementation Plan

> **Target**: Mantle Sepolia Testnet | **Auth**: Privy (Social + Wallets) | **Detection**: Backend WebSocket

## Overview

This plan covers four major integrations for the Conquer Plank (kronos-hold) dApp:

| Phase | Feature | Priority |
|-------|---------|----------|
| 1 | Privy + Viem/Wagmi Integration | HIGH |
| 2 | Plank Detector Backend | HIGH |
| 3 | Gym QR Code Referral System | MEDIUM |
| 4 | Smart Contracts | HIGH |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Privy SDK   │  │ Wagmi/Viem  │  │ WebSocket Client    │  │
│  │ (Auth)      │  │ (Contracts) │  │ (Plank Detection)   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          ▼                ▼                   ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
   │ Privy Cloud  │  │ Mantle      │  │ FastAPI Backend      │
   │ (Social Auth)│  │ Sepolia RPC │  │ (plank_detector.py)  │
   └──────────────┘  └──────────────┘  └──────────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ Smart Contracts  │
                    │ • PlankToken.sol │
                    │ • Relics.sol     │
                    │ • GymRegistry.sol│
                    └──────────────────┘
```

---

# PHASE 1: Privy + Wagmi Integration

## 1.1 Dependencies

```bash
npm install @privy-io/react-auth @privy-io/wagmi viem@2.x wagmi@2.x
```

## 1.2 New Files to Create

### `src/lib/wagmi.ts` - Chain Configuration
- Define Mantle Sepolia chain (chainId: 5003)
- RPC URL: `https://rpc.sepolia.mantle.xyz`
- Block explorer: `https://sepolia.mantlescan.xyz`

### `src/lib/privy.ts` - Privy Configuration
- Login methods: email, wallet, google, twitter
- Dark theme with gold accent (#C5A572)
- Embedded wallets for non-crypto users
- Default chain: Mantle Sepolia

### `src/lib/contracts.ts` - Contract ABIs and Addresses
- PlankToken (ERC-20): mint, transfer, balanceOf
- Relics (ERC-1155): mint, balanceOf, uri
- GymRegistry: registerGym, linkUserToGym, recordSession, claimSignupBonus

## 1.3 Files to Modify

### `src/App.tsx`
- Wrap with providers in order: QueryClientProvider > PrivyProvider > WagmiProvider > GameProvider

### `src/contexts/GameContext.tsx`
- Replace mock `connectWallet()` with Privy's `login()`
- Replace mock `claimPlank()` with real contract write using `useWriteContract`
- Replace mock `mintNFT()` with Relics ERC-1155 mint call
- Use `useAccount()` for real wallet address
- Add contract read hooks for token balances

### `src/components/WalletButton.tsx`
- Use `usePrivy()` hook for `login`, `logout`, `authenticated`, `user`
- Display linked accounts (email, social, wallet)
- Show Mantle network status

## 1.4 Verification
- [ ] Connect via social login (Google/Twitter/Email)
- [ ] Connect via MetaMask/WalletConnect
- [ ] Verify wallet address appears in UI
- [ ] Verify correct network (Mantle Sepolia)

---

# PHASE 2: Plank Detector Backend

## 2.1 Backend Structure

```
backend/
├── main.py           # FastAPI app with WebSocket endpoint
├── plank_detector.py # Copy from /plank-detection (modified)
├── models.py         # Pydantic response models
├── requirements.txt  # mediapipe, opencv-python, fastapi, uvicorn
└── Dockerfile
```

## 2.2 WebSocket Protocol

| Direction | Message Type | Payload |
|-----------|-------------|---------|
| Client → Server | `frame` | `{ type: "frame", frame: "<base64>" }` at ~15 FPS |
| Server → Client | `metrics` | `{ state, score, feedback, good_form_time, total_time, landmarks_visible }` |
| Client → Server | `end_session` | `{ type: "end_session" }` |
| Server → Client | `summary` | Session summary with final stats |

**Endpoint**: `ws://localhost:8000/ws/plank/{session_id}`

## 2.3 New Files to Create (Frontend)

### `src/hooks/usePlankDetection.ts`
- WebSocket connection management
- Video stream capture (640x480, front camera)
- Canvas for frame encoding (JPEG, 70% quality)
- Frame streaming at 15 FPS
- Real-time metrics state updates

### `src/components/CameraPreview.tsx`
- Video element for camera feed (can be hidden)
- Canvas for frame capture
- Connection status indicator

## 2.4 Files to Modify

### `src/pages/PlankSession.tsx`
- Replace simulated posture detection with real WebSocket-based detection
- Add camera permission request
- Use `usePlankDetection` hook for real metrics
- Display actual score, feedback, and form state from backend
- Handle connection errors gracefully

## 2.5 Verification
- [ ] Camera permission request works
- [ ] WebSocket connects to backend
- [ ] Metrics update in real-time (~15 FPS)
- [ ] Form feedback displays correctly
- [ ] Session summary returned on end

---

# PHASE 3: Gym QR Code Referral System

## 3.1 Data Model (Updated)

Add to `src/lib/gameData.ts`:

```typescript
interface Gym {
  id: number;              // Numeric ID to match backend
  name: string;
  address: string;         // For display purposes
  rewardAuraFixed: number; // Mapping from reward_aura_fixed
  isActive: boolean;
}

interface GymLink {
  gymId: number;
  linkedAt: string;        // ISO Date string
  lastCheckin: string;     // ISO Date string for daily validation
}
```

## 3.2 QR Code Format

```
https://conquerplank.app/gym/join?id={gymId}&ref={referralCode}
```

## 3.3 Authentication with Privy

- Use `usePrivy()` and `useUser()` hooks for authenticated user ID/wallet
- All check-in actions require user authentication first
- Get user ID via `user.id` or wallet address via embedded wallet

## 3.4 Backend API Integration (Off-Chain Check-ins)

| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/api/gym/check-in` | POST | `{ gymId, userId, qrSecret, userLocation }` | Success / Error |
| `/api/gym/{id}` | GET | - | Gym details |
| `/api/user/gym-link` | GET | - | User's linked gym info |

**Response Codes:**
- `200`: Check-in successful, returns aura reward
- `409`: Already checked in today
- `403`: Too far from gym location
- `404`: Invalid gym ID

## 3.5 New Files to Create

### `src/services/gymService.ts`
- `checkInToGym(gymId, qrSecret, location)` - POST to `/api/gym/check-in`
- `getGymDetails(gymId)` - GET gym info from backend
- `getUserGymLink()` - GET user's current gym link

### `src/pages/GymJoin.tsx`
- Parse URL params for gym ID and QR secret
- Require Privy authentication before check-in
- "Check In" button → calls `gymService.checkInToGym()`
- Handle responses: success, already checked in, too far
- Optional: "Claim Bonus" for on-chain signup bonus (10 PLANK)

### `src/pages/GymDashboard.tsx`
- For gym owners to view their gym
- Display linked users count
- Show accumulated points
- Generate QR codes

### `src/components/GymQRScanner.tsx`
- Camera-based QR scanning (use `@yudiel/react-qr-scanner`)
- Parse URL and extract gym ID + qrSecret
- Redirect to GymJoin page

## 3.4 Router Update

Add to `src/App.tsx`:
- Route: `/gym/join` → GymJoin
- Route: `/gym/dashboard` → GymDashboard

## 3.7 Verification
- [ ] Scan QR code successfully
- [ ] User must be authenticated via Privy to check in
- [ ] Check-in calls backend API (not on-chain)
- [ ] Handle "already checked in today" response
- [ ] Handle "too far from gym" response
- [ ] Optional: Claim signup bonus on-chain (10 PLANK)

## 3.6 Implementation Tasks

### 3.6.1 Data Model & Types
- [x] Add `Gym` interface to `src/lib/gameData.ts`
- [x] Add `GymLink` interface to `src/lib/gameData.ts`
- [ ] Add gym-related state to GameContext (linkedGym, gyms list)

### 3.6.2 QR Scanner Component
- [x] Install QR scanner dependency (`@yudiel/react-qr-scanner`)
- [x] Create `src/components/GymQRScanner.tsx`
  - [x] Camera permission handling
  - [x] QR code scanning with visual feedback
  - [x] Parse gym URL: `https://conquerplank.app/gym/join?id={gymId}&ref={referralCode}`
  - [x] Redirect to GymJoin page with parsed params

### 3.6.3 GymJoin Page
- [x] Create `src/pages/GymJoin.tsx`
  - [x] Parse URL params for gym ID and qrSecret
  - [x] Require Privy auth (`usePrivy` hook)
  - [x] Fetch gym details from backend API
  - [x] Display gym info card
  - [x] "Check In" button → calls `gymService.checkInToGym()`
  - [x] Handle API responses (success, already checked in, too far)
  - [ ] Optional: "Claim Bonus" for on-chain 10 PLANK

### 3.6.4 GymDashboard Page (Gym Owners)
- [x] Create `src/pages/GymDashboard.tsx`
  - [x] Gym owner registration form (`registerGym(name)`)
  - [x] Display gym stats: linked users, total points
  - [x] QR code generation (use `qrcode.react`)
  - [x] Copy link to clipboard functionality

### 3.6.5 Router & Navigation Updates
- [x] Add route `/gym/join` → GymJoin page
- [x] Add route `/gym/dashboard` → GymDashboard page
- [x] Add "Scan Gym QR" button to main menu/home
- [x] Add "My Gym" link for gym owners

### 3.6.6 API & Backend Integration
- [x] Create `src/services/gymService.ts` (implemented as `useGymApi.ts` hook):
  - [x] `checkInToGym(gymId, qrSecret, location)` - POST `/api/gym/check-in`
  - [x] `getGymDetails(gymId)` - GET `/api/gym/{id}`
  - [x] `getUserGymLink()` - GET `/api/user/gym-link`
- [x] Add Privy auth headers to API requests
- [ ] Optional contract integration:
  - [ ] `claimSignupBonus()` - On-chain 10 PLANK claim (if kept on-chain)

---

# PHASE 4: Smart Contracts

> **Architecture Decision**: Lean on-chain model. Gyms stay off-chain. Backend relayer mints PLANK. Users mint NFTs with backend signatures.

## 4.1 Contract Directory

```
contracts/
├── PlankToken.sol    # ERC-20 $PLANK token (relayer-minted)
├── Relics.sol        # ERC-1155 NFT collection (signature-minted)
└── scripts/
    └── deploy.ts     # Deployment script
```

> **Removed**: `GymRegistry.sol` - All gym logic stays in database (gyms, gym_checkins tables)

## 4.2 PlankToken.sol (ERC-20 with Relayer)

| Property | Value |
|----------|-------|
| Name | Plank Token |
| Symbol | PLANK |
| Decimals | 18 |
| Max Supply | 1,000,000,000 |
| Access Control | MINTER_ROLE (backend relayer only) |

| Function | Description |
|----------|-------------|
| `mint(to, amount, reason)` | Mint tokens with reason identifier |
| `mintBatch(recipients[], amounts[], reason)` | Gas-efficient batch minting |
| `balanceOf(account)` | Check balance |
| `totalMinted(account)` | Track total minted per user |

**Events**: `PlankMinted(to, amount, reason)`

**Reason Constants** (bytes32):
- `SESSION_REWARD` - Plank session completion
- `GYM_BONUS` - Gym signup bonus (10 PLANK)
- `STREAK_BONUS` - Streak milestone rewards
- `REFERRAL_BONUS` - User referral rewards

## 4.3 Relics.sol (ERC-1155 with Signature Verification)

| Token ID | Name | Requirement |
|----------|------|-------------|
| 1 | Bronze Shield | 1 minute total |
| 2 | Silver Helmet | 10 minutes total |
| 3 | Gold Sword | 1 hour total |
| 4 | Diamond Crown | 10 hours total |
| 5 | Kronos Slayer | 100 hours total |

| Function | Description |
|----------|-------------|
| `mintWithSignature(tokenId, deadline, signature)` | User mints with backend signature |
| `hasClaimed(user, tokenId)` | Check if user already minted this relic |
| `nonces(user)` | Get user's nonce for signature validation |
| `setSigner(newSigner)` | Update backend signer (owner only) |

**Signature Payload** (keccak256):
```
userAddress, tokenId, nonce, deadline, chainId, contractAddress
```

**Events**: `RelicMinted(to, tokenId, amount)`

- One mint per relic type per user (enforced on-chain)
- URI pattern: `{baseURI}/{id}.json`
- User pays gas (opt-in action)

## 4.4 New Database Tables

### `mint_signatures` - Relic signature tracking

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| user_id | INTEGER FK | References users(id) |
| wallet_address | VARCHAR(42) | User's wallet |
| token_id | INTEGER | Relic ID (1-5) |
| nonce | INTEGER | User's nonce at sign time |
| deadline | TIMESTAMP | Signature expiration |
| signature | VARCHAR(132) | Hex-encoded signature |
| status | VARCHAR(20) | pending / used / expired |
| created_at | TIMESTAMP | |
| used_at | TIMESTAMP | When minted on-chain |
| tx_hash | VARCHAR(66) | Transaction hash |

**Constraint**: UNIQUE(user_id, token_id)

### `relayer_queue` - PLANK mint queue

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| user_id | INTEGER FK | References users(id) |
| wallet_address | VARCHAR(42) | Recipient wallet |
| amount | DECIMAL(36,18) | Amount in wei |
| reason | VARCHAR(50) | SESSION_REWARD, GYM_BONUS, etc. |
| session_id | INTEGER FK | Optional: references sessions(id) |
| status | VARCHAR(20) | pending / processing / completed / failed |
| created_at | TIMESTAMP | |
| processed_at | TIMESTAMP | |
| tx_hash | VARCHAR(66) | |
| error_message | TEXT | |
| retry_count | INTEGER | Default 0 |

**Indexes**: `status`, `user_id`

## 4.5 Schema Modifications

### `transactions` table - New enum values
```sql
ALTER TYPE enum_transaction_type ADD VALUE 'session_mint';
ALTER TYPE enum_transaction_type ADD VALUE 'gym_bonus_mint';
ALTER TYPE enum_transaction_type ADD VALUE 'streak_bonus_mint';
ALTER TYPE enum_transaction_type ADD VALUE 'relic_mint';
```

### `user_inventory` table - Index for on-chain queries
```sql
CREATE INDEX idx_user_inventory_minted ON user_inventory(minted_on_chain);
```

## 4.6 Backend Services

### Relayer Service
- Polls `relayer_queue` for pending mints
- Batches mints every 5 minutes OR when queue reaches 50 items
- Updates queue status and records tx_hash
- Handles retries on failure (max 3 attempts)

### Signature Service
- Endpoint: `POST /api/relics/request-signature`
- Checks eligibility from sessions table
- Generates EIP-191 signature
- Stores in `mint_signatures` table
- Returns: `{ signature, deadline, nonce }`

## 4.7 Transaction Flows

### Session Reward Flow (Relayer)
1. User completes session → Backend validates
2. Backend inserts into `relayer_queue` (status: pending)
3. User sees immediate response with pending reward
4. Relayer batches and mints to PlankToken
5. On confirmation: update queue, insert `transactions`, update `users.balance_plank`

### Relic Mint Flow (Signature)
1. User requests signature via API
2. Backend checks eligibility (total time ≥ requirement)
3. Backend signs and stores in `mint_signatures`
4. User calls `Relics.mintWithSignature()` (pays gas)
5. On confirmation: update `mint_signatures`, `user_inventory`, insert `transactions`

### Gym Bonus Flow (Relayer)
1. User scans QR / links gym
2. Backend validates, checks if bonus claimed
3. Backend inserts into `relayer_queue` (reason: GYM_BONUS, amount: 10 PLANK)
4. Same relayer flow as session rewards

## 4.8 Deployment

- Network: Mantle Sepolia (chainId: 5003)
- Framework: Hardhat with `@nomicfoundation/hardhat-toolbox`
- Post-deploy:
  - Grant MINTER_ROLE to backend relayer wallet
  - Set signer address on Relics contract
  - Verify both contracts on MantleScan

## 4.9 Frontend Updates

### `src/lib/contracts.ts`
- [ ] Remove `gymRegistryAbi` entirely
- [ ] Remove `gymRegistry` from CONTRACT_ADDRESSES
- [ ] Update `relicsAbi` with signature minting functions
- [ ] Add `PlankMinted` and `RelicMinted` event ABIs

### `src/contexts/GameContext.tsx`
- [ ] Remove direct `mint()` calls to PlankToken
- [ ] Add `requestRelicSignature()` API call
- [ ] Add `mintRelicWithSignature()` using `useWriteContract`
- [ ] Listen for `PlankMinted` events to update balance

### `src/pages/PlankResult.tsx`
- [ ] Remove "Claim $PLANK" button (relayer handles automatically)
- [ ] Show "Reward pending..." status until relayer confirms
- [ ] Listen for PlankMinted event to show confirmation

## 4.10 Implementation Tasks

### 4.10.1 Smart Contract Development
- [x] Initialize Foundry project in `contracts/` directory (using Foundry instead of Hardhat)
- [x] Install dependencies: `@openzeppelin/contracts`, forge-std
- [x] Write `PlankToken.sol`:
  - [x] ERC-20 with AccessControl (OpenZeppelin)
  - [x] `MINTER_ROLE` constant
  - [x] `mint(to, amount, reason)` with role check
  - [x] `mintBatch(recipients[], amounts[], reason)` for gas efficiency
  - [x] `totalMinted` mapping for analytics
  - [x] `PlankMinted` event with indexed `to` and `reason`
  - [x] `totalMintedByReason` mapping for reason tracking
  - [x] `BatchMinted` event for batch operations
- [x] Write `Relics.sol`:
  - [x] ERC-1155 with Ownable (OpenZeppelin)
  - [x] ECDSA + MessageHashUtils for signature verification
  - [x] `signer` state variable (backend wallet address)
  - [x] `hasClaimed[user][tokenId]` mapping
  - [x] `nonces[user]` mapping for replay protection
  - [x] `mintWithSignature(tokenId, deadline, signature)` function
  - [x] Signature validation: `keccak256(user, tokenId, nonce, deadline, chainId, contractAddress)`
  - [x] `RelicMinted` event
  - [x] `setSigner(newSigner)` owner-only function
  - [x] `getClaimedRelics()` and `getRelicBalances()` helper functions
  - [x] `tokenRequirements` and `tokenNames` mappings
- [x] Write deployment script `script/Deploy.s.sol`:
  - [x] Deploy PlankToken with admin and relayer addresses
  - [x] Deploy Relics with owner and signer addresses
  - [x] Grant MINTER_ROLE to relayer wallet (done in constructor)
  - [x] Output deployed addresses for env config
  - [x] Local deployment script for Anvil testing
- [x] Write unit tests:
  - [x] PlankToken: mint, mintBatch, access control, events (18 tests)
  - [x] Relics: signature verification, double-claim prevention, nonce increment (25 tests)
  - [x] All 43 tests passing
- [ ] Deploy to Mantle Sepolia testnet
- [ ] Verify contracts on MantleScan

### 4.10.2 Database Migrations
- [ ] Create migration for `mint_signatures` table:
  ```sql
  CREATE TABLE mint_signatures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    token_id INTEGER NOT NULL,
    nonce INTEGER NOT NULL,
    deadline TIMESTAMP NOT NULL,
    signature VARCHAR(132) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP,
    tx_hash VARCHAR(66),
    UNIQUE(user_id, token_id)
  );
  ```
- [ ] Create migration for `relayer_queue` table:
  ```sql
  CREATE TABLE relayer_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    session_id INTEGER REFERENCES sessions(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    tx_hash VARCHAR(66),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
  );
  CREATE INDEX idx_relayer_queue_status ON relayer_queue(status);
  CREATE INDEX idx_relayer_queue_user ON relayer_queue(user_id);
  ```
- [ ] Add new transaction type enums:
  ```sql
  ALTER TYPE enum_transaction_type ADD VALUE 'session_mint';
  ALTER TYPE enum_transaction_type ADD VALUE 'gym_bonus_mint';
  ALTER TYPE enum_transaction_type ADD VALUE 'streak_bonus_mint';
  ALTER TYPE enum_transaction_type ADD VALUE 'relic_mint';
  ```
- [ ] Add `gym_bonus_claimed` column to `gym_checkins` table (if not exists)
- [ ] Add index on `user_inventory(minted_on_chain)`

### 4.10.3 Backend: Session Reward System (PLANK per session)
- [ ] Update `POST /api/sessions/complete` endpoint:
  - [ ] Validate session data (duration, proofs, integrity score)
  - [ ] Calculate PLANK reward: `floor(valid_seconds / 20)`
  - [ ] Calculate Aura Points: `floor(valid_seconds / 10)` (off-chain only)
  - [ ] Insert session record into `sessions` table
  - [ ] Insert into `relayer_queue`:
    ```python
    {
      "user_id": user.id,
      "wallet_address": user.wallet_address,
      "amount": plank_reward * 10**18,  # Convert to wei
      "reason": "SESSION_REWARD",
      "session_id": session.id,
      "status": "pending"
    }
    ```
  - [ ] Update `users.aura_points` (immediate, off-chain)
  - [ ] Return response with pending reward info
- [ ] Add `GET /api/users/pending-rewards` endpoint:
  - [ ] Query `relayer_queue` for user's pending mints
  - [ ] Return total pending PLANK amount

### 4.10.4 Backend: Relayer Service
- [ ] Create `services/relayer.py`:
  - [ ] Load relayer private key from `RELAYER_PRIVATE_KEY` env
  - [ ] Initialize Web3 connection to Mantle Sepolia
  - [ ] `process_queue()` function:
    - [ ] Query pending items: `SELECT * FROM relayer_queue WHERE status = 'pending' ORDER BY created_at LIMIT 50`
    - [ ] Group by reason for batch processing
    - [ ] For SESSION_REWARD: use `mintBatch()` if multiple users
    - [ ] For GYM_BONUS: can batch with session rewards
    - [ ] Update status to 'processing' before tx
    - [ ] Submit transaction to PlankToken contract
    - [ ] Wait for confirmation
    - [ ] Update queue: status='completed', tx_hash, processed_at
    - [ ] Insert into `transactions` table for each user
    - [ ] Update `users.balance_plank` for each user
  - [ ] Error handling:
    - [ ] On tx failure: increment `retry_count`, set status='pending' if retries < 3
    - [ ] On max retries: set status='failed', log error_message
  - [ ] Run as background task (every 5 minutes OR when queue > 50 items)
- [ ] Add health check endpoint: `GET /api/relayer/status`
  - [ ] Return queue depth, last processed time, relayer wallet balance

### 4.10.5 Backend: Gym Referral Bonus System
- [ ] Update `POST /api/gym/check-in` endpoint:
  - [ ] After successful check-in, check if first-time link
  - [ ] If first gym link AND bonus not claimed:
    - [ ] Insert into `relayer_queue`:
      ```python
      {
        "user_id": user.id,
        "wallet_address": user.wallet_address,
        "amount": 10 * 10**18,  # 10 PLANK in wei
        "reason": "GYM_BONUS",
        "status": "pending"
      }
      ```
    - [ ] Mark `gym_checkins.gym_bonus_claimed = true`
  - [ ] Return response indicating bonus pending
- [ ] Add gym owner reward tracking (10% share):
  - [ ] When session reward queued, calculate gym share: `floor(plank_reward * 0.1)`
  - [ ] If user linked to gym, queue additional mint for gym owner:
    ```python
    {
      "user_id": gym_owner.id,
      "wallet_address": gym_owner.wallet_address,
      "amount": gym_share * 10**18,
      "reason": "GYM_REFERRAL_SHARE",
      "session_id": session.id,
      "status": "pending"
    }
    ```
  - [ ] Update `gyms.total_plank_earned` for analytics

### 4.10.6 Backend: Relic Signature Service
- [ ] Create `POST /api/relics/request-signature` endpoint:
  - [ ] Require authentication (Privy JWT)
  - [ ] Input: `{ tokenId: number }`
  - [ ] Validate tokenId (1-5)
  - [ ] Check eligibility:
    ```python
    requirements = {1: 60, 2: 600, 3: 3600, 4: 36000, 5: 360000}
    total_time = SELECT SUM(duration_valid_seconds) FROM sessions WHERE user_id = ?
    if total_time < requirements[tokenId]:
        return 403, "Not eligible"
    ```
  - [ ] Check if already claimed (query `mint_signatures` or contract)
  - [ ] Get user's nonce from Relics contract: `nonces(userAddress)`
  - [ ] Generate signature:
    ```python
    deadline = int(time.time()) + 3600  # 1 hour validity
    message_hash = keccak256(encode_packed(
        user_address, tokenId, nonce, deadline, chain_id, contract_address
    ))
    signature = signer_wallet.sign_message(message_hash)
    ```
  - [ ] Store in `mint_signatures` table
  - [ ] Return: `{ signature, deadline, nonce, tokenId }`
- [ ] Create `POST /api/relics/confirm-mint` endpoint:
  - [ ] Input: `{ tokenId, txHash }`
  - [ ] Verify transaction on-chain (optional but recommended)
  - [ ] Update `mint_signatures`: status='used', tx_hash, used_at
  - [ ] Update `user_inventory`: minted_on_chain=true, token_id
  - [ ] Insert into `transactions` table

### 4.10.7 Frontend: Contract Integration Updates
- [x] Update `src/lib/contracts.ts`:
  - [x] Remove `gymRegistryAbi` export
  - [x] Remove `gymRegistry` from `CONTRACT_ADDRESSES`
  - [x] Update `plankTokenAbi`:
    - [x] Keep: `balanceOf`, `decimals`, `symbol`, `name`
    - [x] Remove: `mint` (users don't call this)
    - [x] Add: `totalMinted` view function
    - [x] Add: `remainingSupply` view function
    - [x] Add: `MAX_SUPPLY` view function
    - [x] Add: `PlankMinted` event ABI
    - [x] Add: `Transfer` event ABI
  - [x] Update `relicsAbi`:
    - [x] Keep: `balanceOf`, `balanceOfBatch`, `uri`
    - [x] Remove: direct `mint` function
    - [x] Add: `mintWithSignature(uint256 tokenId, uint256 deadline, bytes signature)`
    - [x] Add: `hasClaimed(address user, uint256 tokenId)` view
    - [x] Add: `nonces(address user)` view
    - [x] Add: `getClaimedRelics(address user)` view
    - [x] Add: `getRelicBalances(address user)` view
    - [x] Add: `tokenRequirements` and `tokenNames` views
    - [x] Add: `getMessageHash` view for testing
    - [x] Add: `RelicMinted` event ABI
    - [x] Add helper functions: `getEligibleRelics()`, `getNextRelic()`, `getRelicProgress()`
  - [x] Add TypeScript types: `RelicSignatureResponse`, `PendingReward`

### 4.10.8 Frontend: GameContext Updates
- [x] Update `src/contexts/GameContext.tsx`:
  - [x] Remove `claimPlank()` function (no longer user-initiated)
  - [x] Add `pendingRewards` state (fetched from API)
  - [x] Add `totalPendingPlank` computed value
  - [x] Add `fetchPendingRewards()` to poll `/api/users/pending-rewards`
  - [x] Add `isLoadingPendingRewards` state
  - [x] Update `mintNFT()` to `mintRelic()` using signature flow:
    - [x] Request signature from backend API
    - [x] Submit to contract with `mintWithSignature`
    - [x] Handle eligibility checks and already-claimed checks
    - [x] Add `mintingRelicId` state for UI loading states
  - [x] Add event listener for `PlankMinted`:
    - [x] Auto-refetch balance on PlankMinted event
    - [x] Auto-refresh pending rewards list
  - [x] Add event listener for `RelicMinted`:
    - [x] Auto-refetch claimed relics
    - [x] Reset minting state
  - [x] Add `claimedRelics` state from contract
  - [x] Add `fetchClaimedRelics()` function
  - [x] Update `completeSession()` to trigger pending rewards fetch

### 4.10.9 Frontend: PlankResult Page Updates
- [ ] Update `src/pages/PlankResult.tsx`:
  - [ ] Remove "Claim $PLANK" button entirely
  - [ ] Show reward status states:
    - [ ] "Reward queued" (immediately after session)
    - [ ] "Processing..." (when relayer picks it up)
    - [ ] "Received!" (when PlankMinted event detected)
  - [ ] Add pending reward display from `pendingRewards` state
  - [ ] Show estimated time until next relayer batch
  - [ ] Add link to view transaction on MantleScan when completed

### 4.10.10 Frontend: Relics/NFT Claiming UI
- [ ] Update NFT display component (Profile or dedicated page):
  - [ ] Show all 5 relics with unlock status
  - [ ] For locked relics: show progress bar (current time / requirement)
  - [ ] For unlocked but unclaimed: show "Claim" button
  - [ ] For claimed: show NFT image with checkmark
  - [ ] Claim flow:
    - [ ] Button click → "Requesting signature..."
    - [ ] Signature received → "Confirm in wallet..."
    - [ ] Tx submitted → "Minting..."
    - [ ] Tx confirmed → "Relic claimed!" with confetti
  - [ ] Handle errors: signature expired, already claimed, insufficient gas

### 4.10.11 Frontend: Gym Bonus Display
- [ ] Update `src/pages/GymJoin.tsx`:
  - [ ] After successful check-in, show bonus status:
    - [ ] First-time: "🎁 10 PLANK bonus queued!"
    - [ ] Returning: "Welcome back! Check-in recorded."
  - [ ] Show pending bonus in rewards section
- [ ] Update gym dashboard to show:
  - [ ] Total PLANK earned from referrals
  - [ ] Number of active members
  - [ ] Recent session activity

## 4.11 Verification Checklist
- [ ] PlankToken deployed and verified on MantleScan
- [ ] Relics deployed and verified on MantleScan
- [ ] MINTER_ROLE granted to relayer wallet
- [ ] Signer address set on Relics contract
- [ ] **Session Flow**: Complete session → queue entry → relayer mint → balance updated
- [ ] **Relic Flow**: Request signature → wallet confirm → NFT minted → inventory updated
- [ ] **Gym Bonus Flow**: First check-in → bonus queued → relayer mint → bonus received
- [ ] **Gym Share Flow**: User session → 10% queued for gym owner → owner receives share
- [ ] **Batch Minting**: Multiple pending rewards batched in single transaction
- [ ] **Event Listening**: Frontend updates on PlankMinted/RelicMinted events
- [ ] **Error Recovery**: Failed transactions retry correctly, max 3 attempts
- [ ] **Security**: Signature replay prevented, double-claim blocked, access control enforced

---

# Environment Variables

```env
# Frontend (.env)
VITE_PRIVY_APP_ID=<your-privy-app-id>
VITE_MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
VITE_PLANK_TOKEN_ADDRESS=<deployed-address>
VITE_RELICS_ADDRESS=<deployed-address>
VITE_WS_URL=ws://localhost:8000/ws/plank
VITE_API_URL=http://localhost:8000

# Backend (.env)
ALLOWED_ORIGINS=http://localhost:8080,https://conquerplank.app
RELAYER_PRIVATE_KEY=<relayer-wallet-private-key>
SIGNER_PRIVATE_KEY=<signature-wallet-private-key>
DATABASE_URL=<postgres-connection-string>
```

---

# Implementation Timeline

## Week 1: Foundation

| Day | Tasks |
|-----|-------|
| 1-2 | Phase 1: Privy + Wagmi setup |
| 3-4 | Phase 4: Write and test smart contracts |
| 5 | Phase 1 + 4: Contract integration with frontend |

## Week 2: Detection System

| Day | Tasks |
|-----|-------|
| 1-2 | Phase 2: Backend FastAPI WebSocket server |
| 3-4 | Phase 2: Frontend detection hook + PlankSession update |
| 5 | Integration testing |

## Week 3: Gym System + Polish

| Day | Tasks |
|-----|-------|
| 1-2 | Phase 3: Gym pages and QR scanner |
| 3-5 | End-to-end testing and polish |

---

# Token Economics

| Metric | Value |
|--------|-------|
| $PLANK Max Supply | 1,000,000,000 |
| Reward Rate | 1 PLANK per 20 seconds good form |
| Gym Referral Bonus | 10 PLANK (one-time) |
| Gym Session Share | 10% of user rewards |
| Aura Points | 1 per 10 seconds (off-chain) |

---

# Critical Files Summary

| File | Phase | Changes |
|------|-------|---------|
| `src/App.tsx` | 1, 3 | Add providers, add gym routes |
| `src/contexts/GameContext.tsx` | 1 | Replace mock with real wallet/contract calls |
| `src/components/WalletButton.tsx` | 1 | Use Privy for multi-auth login |
| `src/pages/PlankSession.tsx` | 2 | WebSocket integration for real detection |
| `src/pages/PlankResult.tsx` | 1 | Real token claiming via contract |
| `src/lib/gameData.ts` | 3 | Add Gym interface and types |
| `src/lib/wagmi.ts` | 1 | NEW - Chain configuration |
| `src/lib/privy.ts` | 1 | NEW - Privy configuration |
| `src/lib/contracts.ts` | 1 | NEW - Contract ABIs |
| `src/hooks/usePlankDetection.ts` | 2 | NEW - WebSocket hook |
| `src/pages/GymJoin.tsx` | 3 | NEW - QR landing page |
| `src/pages/GymDashboard.tsx` | 3 | NEW - Gym owner dashboard |
| `backend/main.py` | 2 | NEW - FastAPI server |
| `contracts/*.sol` | 4 | NEW - Smart contracts |
