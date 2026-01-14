# Crypto Tables Production Deployment Guide

This guide covers deploying the crypto-related database changes (relayer_queue, mint_signatures, etc.) to production safely.

## Overview

The crypto tables enable:
- **Relayer Queue**: Backend-controlled PLANK token minting
- **Mint Signatures**: User-initiated Relic NFT minting
- **Transaction Types**: New blockchain transaction types
- **Gym Bonuses**: Tracking gym signup bonuses

## Pre-Deployment Checklist

Before deploying to production, ensure you have:

- [ ] Successfully tested in local environment
- [ ] Backup of production database
- [ ] SSH access to production EC2 instance
- [ ] Production database credentials
- [ ] Maintenance window scheduled (recommended: low-traffic period)
- [ ] Rollback plan ready

## Deployment Steps

### Step 1: Backup Production Database

**CRITICAL: Always backup before making schema changes!**

```bash
# SSH into your EC2 instance
ssh your-ec2-instance

# Create backup directory
mkdir -p ~/db-backups

# Backup the entire database
mysqldump -u plank_user -p hold_the_plank_prod > ~/db-backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup was created
ls -lh ~/db-backups/

# Optional: Download backup to local machine for extra safety
exit
scp your-ec2-instance:~/db-backups/backup_*.sql ~/local-backups/
```

### Step 2: Upload Migration Script

```bash
# From your local machine, upload the crypto_tables.sql file
scp /home/franco/projects/hold-the-plank-backend/crypto_tables.sql your-ec2-instance:~/hold-the-plank-backend/

# Or if using Git:
cd /home/franco/projects/hold-the-plank-backend
git add crypto_tables.sql
git commit -m "Add crypto tables migration script"
git push origin main

# Then on EC2:
ssh your-ec2-instance
cd ~/hold-the-plank-backend
git pull origin main
```

### Step 3: Review and Test the Migration

```bash
# SSH into EC2
ssh your-ec2-instance
cd ~/hold-the-plank-backend

# Review the migration script
cat crypto_tables.sql

# Test the migration on a local dev database first (optional but recommended)
# Create a test database
mysql -u root -p -e "CREATE DATABASE hold_the_plank_test;"
mysql -u root -p hold_the_plank_test < "Conquer Plank.sql"
mysql -u root -p hold_the_plank_test < crypto_tables.sql

# Verify test migration worked
mysql -u root -p hold_the_plank_test -e "SHOW TABLES;"
mysql -u root -p hold_the_plank_test -e "DESCRIBE relayer_queue;"
mysql -u root -p hold_the_plank_test -e "DESCRIBE mint_signatures;"

# Clean up test database
mysql -u root -p -e "DROP DATABASE hold_the_plank_test;"
```

### Step 4: Apply Migration to Production

```bash
# Stop your application (IMPORTANT: prevents inconsistent state)
pm2 stop hold-the-plank

# Apply the migration
mysql -u plank_user -p hold_the_plank_prod < crypto_tables.sql

# If prompted for password, use your production DB password
# You can find it in: cat /root/.hold-the-plank-db-credentials
```

### Step 5: Verify Migration Success

```bash
# Check that new tables exist
mysql -u plank_user -p hold_the_plank_prod -e "SHOW TABLES;"

# Verify relayer_queue structure
mysql -u plank_user -p hold_the_plank_prod -e "DESCRIBE relayer_queue;"

# Verify mint_signatures structure
mysql -u plank_user -p hold_the_plank_prod -e "DESCRIBE mint_signatures;"

# Verify transaction type enums were updated
mysql -u plank_user -p hold_the_plank_prod -e "SHOW COLUMNS FROM transactions LIKE 'type';"

# Check indexes
mysql -u plank_user -p hold_the_plank_prod -e "SHOW INDEX FROM relayer_queue;"
mysql -u plank_user -p hold_the_plank_prod -e "SHOW INDEX FROM mint_signatures;"

# Verify gym_bonus_claimed column
mysql -u plank_user -p hold_the_plank_prod -e "SHOW COLUMNS FROM gym_checkins LIKE 'gym_bonus_claimed';"
```

### Step 6: Update Environment Variables

You'll need to add new environment variables for the crypto functionality:

```bash
# Edit your production .env file
nano ~/hold-the-plank-backend/.env

# Add these new variables:
```

```env
# Blockchain Configuration
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
MANTLE_CHAIN_ID=5003

# Smart Contract Addresses (update after deployment)
PLANK_TOKEN_ADDRESS=0x...
RELICS_CONTRACT_ADDRESS=0x...

# Relayer Configuration (backend wallet for minting PLANK)
RELAYER_PRIVATE_KEY=0x...  # KEEP THIS SECRET!
RELAYER_ADDRESS=0x...

# Signature Service (backend wallet for signing NFT mints)
SIGNER_PRIVATE_KEY=0x...  # KEEP THIS SECRET!
SIGNER_ADDRESS=0x...

# Relayer Settings
RELAYER_BATCH_SIZE=50
RELAYER_BATCH_INTERVAL_SECONDS=300  # 5 minutes
RELAYER_MAX_RETRIES=3
```

### Step 7: Restart Application

```bash
# Restart your application
pm2 restart hold-the-plank

# Check logs for any errors
pm2 logs hold-the-plank --lines 100

# Verify application is running
pm2 status
curl http://localhost:3000/health
```

### Step 8: Smoke Testing

Test the new functionality:

```bash
# Check database connection
mysql -u plank_user -p hold_the_plank_prod -e "SELECT COUNT(*) FROM relayer_queue;"
mysql -u plank_user -p hold_the_plank_prod -e "SELECT COUNT(*) FROM mint_signatures;"

# Test inserting into relayer_queue (manual test)
mysql -u plank_user -p hold_the_plank_prod <<EOF
INSERT INTO relayer_queue (user_id, wallet_address, amount, reason, status)
VALUES (1, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 100.000000000000000000, 'SESSION_REWARD', 'pending');

SELECT * FROM relayer_queue;
DELETE FROM relayer_queue WHERE id = LAST_INSERT_ID();
EOF
```

## Rollback Procedure

If something goes wrong, you can rollback:

### Option 1: Remove New Tables Only

```bash
mysql -u plank_user -p hold_the_plank_prod <<EOF
DROP TABLE IF EXISTS mint_signatures;
DROP TABLE IF EXISTS relayer_queue;
ALTER TABLE gym_checkins DROP COLUMN IF EXISTS gym_bonus_claimed;
DROP INDEX IF EXISTS idx_user_inventory_minted ON user_inventory;
ALTER TABLE transactions
MODIFY COLUMN type ENUM(
    'game_reward',
    'guild_bonus',
    'shop_purchase',
    'withdrawal',
    'gym_checkin'
);
EOF
```

### Option 2: Full Database Restore

```bash
# Stop application
pm2 stop hold-the-plank

# Restore from backup
mysql -u plank_user -p hold_the_plank_prod < ~/db-backups/backup_YYYYMMDD_HHMMSS.sql

# Restart application
pm2 restart hold-the-plank
```

## Post-Deployment Tasks

After successful deployment:

1. **Monitor Logs**: Watch for any database errors
   ```bash
   pm2 logs hold-the-plank --lines 200
   tail -f /var/log/mysql/error.log
   ```

2. **Monitor Performance**: Check query performance
   ```bash
   mysql -u plank_user -p hold_the_plank_prod -e "SHOW PROCESSLIST;"
   ```

3. **Update Documentation**: Document the deployment date and any issues

4. **Deploy Smart Contracts**:
   - Deploy PlankToken.sol to Mantle Sepolia
   - Deploy Relics.sol to Mantle Sepolia
   - Grant MINTER_ROLE to relayer address
   - Update contract addresses in .env

5. **Implement Backend Services**:
   - Relayer service (for PLANK minting)
   - Signature service (for Relic NFT minting)
   - Update session completion endpoint
   - Update gym check-in endpoint

## Monitoring

After deployment, monitor these metrics:

```bash
# Check relayer queue size
mysql -u plank_user -p hold_the_plank_prod -e "SELECT status, COUNT(*) FROM relayer_queue GROUP BY status;"

# Check mint signature usage
mysql -u plank_user -p hold_the_plank_prod -e "SELECT status, COUNT(*) FROM mint_signatures GROUP BY status;"

# Check transaction types
mysql -u plank_user -p hold_the_plank_prod -e "SELECT type, COUNT(*) FROM transactions GROUP BY type;"
```

## Troubleshooting

### Issue: Foreign Key Constraint Fails

**Cause**: Referenced tables don't exist or have different structure

**Solution**:
```bash
# Check if users and sessions tables exist
mysql -u plank_user -p hold_the_plank_prod -e "SHOW TABLES LIKE 'users'; SHOW TABLES LIKE 'sessions';"

# If they don't exist, import base schema first
mysql -u plank_user -p hold_the_plank_prod < "Conquer Plank.sql"
```

### Issue: ENUM Modification Fails

**Cause**: Existing data in transactions table uses values not in new ENUM

**Solution**:
```bash
# Check for invalid values
mysql -u plank_user -p hold_the_plank_prod -e "SELECT DISTINCT type FROM transactions;"

# Update any invalid values before migration
# Then re-run the ALTER TABLE statement
```

### Issue: Column Already Exists

**Cause**: Migration was partially run before

**Solution**: The script handles this automatically with procedural checks. If you see warnings, it's safe to ignore them.

## Security Considerations

1. **Private Keys**: Never commit private keys to Git
2. **Database Credentials**: Keep production credentials secure
3. **Backup Encryption**: Consider encrypting database backups
4. **Access Control**: Limit who can access production database
5. **Audit Logging**: Enable MySQL audit logging for compliance

## Next Steps

After successful database migration:

1. [ ] Deploy smart contracts (PlankToken.sol, Relics.sol)
2. [ ] Implement relayer service in backend
3. [ ] Implement signature service in backend
4. [ ] Update session completion endpoint
5. [ ] Update gym check-in endpoint
6. [ ] Update frontend to use new transaction types
7. [ ] Test end-to-end flow in staging environment
8. [ ] Deploy to production

## Support

If you encounter issues:
- Check logs: `pm2 logs hold-the-plank`
- Check MySQL error log: `sudo tail -f /var/log/mysql/error.log`
- Review migration script for errors
- Rollback if necessary and investigate

## Quick Reference Commands

```bash
# Backup database
mysqldump -u plank_user -p hold_the_plank_prod > backup.sql

# Apply migration
mysql -u plank_user -p hold_the_plank_prod < crypto_tables.sql

# Verify tables
mysql -u plank_user -p hold_the_plank_prod -e "SHOW TABLES;"

# Check relayer queue
mysql -u plank_user -p hold_the_plank_prod -e "SELECT * FROM relayer_queue LIMIT 10;"

# Restart app
pm2 restart hold-the-plank

# View logs
pm2 logs hold-the-plank
```
