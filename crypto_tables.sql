-- =====================================================
-- Conquer Plank - Crypto Backend Database Setup
-- =====================================================
-- This script creates the necessary tables for:
-- 1. Relayer queue (PLANK token minting)
-- 2. Mint signatures (Relic NFT minting)
-- 3. Transaction type enums
-- 4. Additional columns and indexes
-- =====================================================
-- IMPORTANT: Run this AFTER the main schema (Conquer Plank.sql)
-- =====================================================

-- =====================================================
-- 1. CREATE relayer_queue TABLE
-- =====================================================
-- Stores pending PLANK token mint requests for the relayer
CREATE TABLE IF NOT EXISTS relayer_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL COMMENT 'Amount in wei (18 decimals)',
    reason VARCHAR(50) NOT NULL COMMENT 'SESSION_REWARD, GYM_BONUS, STREAK_BONUS, etc.',
    session_id INT NULL,
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, processing, completed, failed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    tx_hash VARCHAR(66) NULL,
    error_message TEXT NULL,
    retry_count INT DEFAULT 0,
    INDEX idx_relayer_queue_status (status),
    INDEX idx_relayer_queue_user (user_id),
    CONSTRAINT fk_relayer_queue_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_relayer_queue_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Queue for relayer to batch mint PLANK tokens';

-- =====================================================
-- 2. CREATE mint_signatures TABLE
-- =====================================================
-- Stores backend-generated signatures for Relic NFT minting
CREATE TABLE IF NOT EXISTS mint_signatures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    token_id INT NOT NULL COMMENT 'Relic ID (1-5: Bronze Shield, Silver Helmet, Gold Sword, Diamond Crown, Kronos Slayer)',
    nonce INT NOT NULL,
    deadline TIMESTAMP NOT NULL,
    signature VARCHAR(132) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, used, expired',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP NULL,
    tx_hash VARCHAR(66) NULL,
    UNIQUE KEY unique_user_token (user_id, token_id),
    INDEX idx_mint_signatures_status (status),
    INDEX idx_mint_signatures_wallet (wallet_address),
    CONSTRAINT fk_mint_signatures_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Signatures for user-initiated Relic NFT minting';

-- =====================================================
-- 3. UPDATE TRANSACTION TYPE ENUMS
-- =====================================================
-- Current existing values in schema: 
--   'game_reward', 'guild_bonus', 'shop_purchase', 'withdrawal', 'gym_checkin'
-- Adding new crypto transaction types:
--   'session_mint', 'gym_bonus_mint', 'streak_bonus_mint', 'relic_mint'

-- Check current ENUM values (optional - for verification)
-- SHOW COLUMNS FROM transactions LIKE 'type';

-- Modify the ENUM to include all existing + new crypto transaction types
ALTER TABLE transactions
MODIFY COLUMN type ENUM(
    'game_reward',        -- EXISTING: off-chain game session rewards
    'guild_bonus',        -- EXISTING: guild-related bonuses
    'shop_purchase',      -- EXISTING: in-app shop purchases
    'withdrawal',         -- EXISTING: token withdrawals
    'gym_checkin',        -- EXISTING: gym check-in rewards
    'session_mint',       -- NEW: PLANK minted for session completion (via relayer)
    'gym_bonus_mint',     -- NEW: PLANK minted for gym signup bonus (via relayer)
    'streak_bonus_mint',  -- NEW: PLANK minted for streak milestone (via relayer)
    'relic_mint'          -- NEW: Relic NFT minted on-chain (user-initiated)
) COMMENT 'Transaction type - updated to include crypto minting types';

-- =====================================================
-- 4. ADD MISSING COLUMNS & INDEXES
-- =====================================================

-- Add gym_bonus_claimed to gym_checkins table
-- This tracks if user has claimed their one-time 10 PLANK gym signup bonus
-- Uses procedural check to avoid errors if column already exists
SET @dbname = DATABASE();
SET @tablename = 'gym_checkins';
SET @columnname = 'gym_bonus_claimed';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' BOOLEAN DEFAULT FALSE COMMENT ''Tracks if user claimed 10 PLANK gym signup bonus''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index on user_inventory for on-chain minting queries
-- Improves performance for checking which NFTs are minted on-chain vs off-chain
-- Check if index exists before creating
SET @tablename = 'user_inventory';
SET @indexname = 'idx_user_inventory_minted';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND INDEX_NAME = @indexname
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX ', @indexname, ' (minted_on_chain)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================
-- Uncomment these to verify the tables were created correctly:

-- SELECT '=== Checking relayer_queue structure ===' AS '';
-- DESCRIBE relayer_queue;

-- SELECT '=== Checking mint_signatures structure ===' AS '';
-- DESCRIBE mint_signatures;

-- SELECT '=== Checking transactions enum values ===' AS '';
-- SHOW COLUMNS FROM transactions LIKE 'type';

-- SELECT '=== Verifying indexes on relayer_queue ===' AS '';
-- SHOW INDEX FROM relayer_queue WHERE Key_name IN ('idx_relayer_queue_status', 'idx_relayer_queue_user');

-- SELECT '=== Verifying indexes on mint_signatures ===' AS '';
-- SHOW INDEX FROM mint_signatures WHERE Key_name IN ('idx_mint_signatures_status', 'idx_mint_signatures_wallet', 'unique_user_token');

-- SELECT '=== Verifying indexes on user_inventory ===' AS '';
-- SHOW INDEX FROM user_inventory WHERE Key_name = 'idx_user_inventory_minted';

-- SELECT '=== Checking gym_checkins for gym_bonus_claimed column ===' AS '';
-- SHOW COLUMNS FROM gym_checkins LIKE 'gym_bonus_claimed';

-- =====================================================
-- 6. SAMPLE TEST DATA (OPTIONAL - FOR DEVELOPMENT)
-- =====================================================
-- Uncomment to insert test records for local development:

-- Test data for relayer_queue
-- INSERT INTO relayer_queue (user_id, wallet_address, amount, reason, session_id, status)
-- VALUES
--     (1, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 100.000000000000000000, 'SESSION_REWARD', 1, 'pending'),
--     (1, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 10.000000000000000000, 'GYM_BONUS', NULL, 'pending'),
--     (2, '0x1234567890123456789012345678901234567890', 50.000000000000000000, 'SESSION_REWARD', 2, 'completed');

-- Test data for mint_signatures
-- INSERT INTO mint_signatures (user_id, wallet_address, token_id, nonce, deadline, signature, status)
-- VALUES
--     (1, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 1, 0, DATE_ADD(NOW(), INTERVAL 1 HOUR), '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab', 'pending'),
--     (2, '0x1234567890123456789012345678901234567890', 2, 0, DATE_ADD(NOW(), INTERVAL 1 HOUR), '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12', 'used');

-- Query to verify test data
-- SELECT 'Test data inserted successfully' AS status;
-- SELECT COUNT(*) as relayer_queue_count FROM relayer_queue;
-- SELECT COUNT(*) as mint_signatures_count FROM mint_signatures;

-- =====================================================
-- 7. ROLLBACK SCRIPT (Use if you need to undo changes)
-- =====================================================
-- WARNING: This will delete all data in these tables!
-- Uncomment ONLY if you need to completely remove the crypto tables:

-- DROP TABLE IF EXISTS mint_signatures;
-- DROP TABLE IF EXISTS relayer_queue;

-- -- Remove the added column
-- ALTER TABLE gym_checkins DROP COLUMN IF EXISTS gym_bonus_claimed;

-- -- Remove the added index
-- DROP INDEX IF EXISTS idx_user_inventory_minted ON user_inventory;

-- -- Revert the transactions ENUM to original values
-- ALTER TABLE transactions
-- MODIFY COLUMN type ENUM(
--     'game_reward',
--     'guild_bonus',
--     'shop_purchase',
--     'withdrawal',
--     'gym_checkin'
-- );

-- =====================================================
-- END OF SCRIPT
-- =====================================================
-- Next steps:
-- 1. Update backend services to use these tables
-- 2. Implement relayer service (services/relayer.py)
-- 3. Implement signature service (services/signature_service.py)
-- 4. Deploy smart contracts (PlankToken.sol, Relics.sol)
-- =====================================================
