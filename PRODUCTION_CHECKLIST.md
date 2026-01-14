# Production Deployment Checklist

## Pre-Deployment

### 1. Local Testing ✓ (Already Done)
- [x] Created `crypto_tables.sql` with all necessary tables
- [x] Tested locally (you already ran it)

### 2. Smart Contracts (Do This First)
- [ ] Deploy `PlankToken.sol` to Mantle Sepolia
  ```bash
  cd contracts
  forge script script/Deploy.s.sol --rpc-url $MANTLE_SEPOLIA_RPC --broadcast
  ```
- [ ] Deploy `Relics.sol` to Mantle Sepolia
- [ ] Verify contracts on MantleScan
- [ ] Save deployed contract addresses
- [ ] Create relayer wallet (for minting PLANK)
- [ ] Create signer wallet (for signing NFT mints)
- [ ] Grant MINTER_ROLE to relayer wallet on PlankToken
- [ ] Set signer address on Relics contract
- [ ] Fund relayer wallet with MNT for gas

### 3. Environment Setup
- [ ] Add to production `.env`:
  ```env
  # Blockchain
  MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
  MANTLE_CHAIN_ID=5003

  # Contracts (update with actual addresses)
  PLANK_TOKEN_ADDRESS=0x...
  RELICS_CONTRACT_ADDRESS=0x...

  # Relayer (KEEP SECRET!)
  RELAYER_PRIVATE_KEY=0x...
  RELAYER_ADDRESS=0x...

  # Signer (KEEP SECRET!)
  SIGNER_PRIVATE_KEY=0x...
  SIGNER_ADDRESS=0x...

  # Settings
  RELAYER_BATCH_SIZE=50
  RELAYER_BATCH_INTERVAL_SECONDS=300
  RELAYER_MAX_RETRIES=3
  ```

## Database Migration

### 4. Backup Production Database
```bash
# SSH into EC2
ssh your-ec2-instance

# Create backup
mkdir -p ~/db-backups
mysqldump -u plank_user -p hold_the_plank_prod > ~/db-backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Download backup locally (for safety)
exit
scp your-ec2-instance:~/db-backups/backup_*.sql ~/local-backups/
```

### 5. Deploy Database Changes

**Option A: Automated Script (Recommended)**
```bash
# Upload files to EC2
scp crypto_tables.sql scripts/deploy-crypto-tables.sh your-ec2-instance:~/hold-the-plank-backend/

# SSH and run
ssh your-ec2-instance
cd ~/hold-the-plank-backend
bash scripts/deploy-crypto-tables.sh
```

**Option B: Manual Deployment**
```bash
# Follow the detailed guide in CRYPTO_DEPLOYMENT.md
# Steps: backup → stop app → apply migration → verify → restart
```

### 6. Verify Database
```bash
# Check tables exist
mysql -u plank_user -p hold_the_plank_prod -e "SHOW TABLES;"

# Verify structure
mysql -u plank_user -p hold_the_plank_prod -e "DESCRIBE relayer_queue;"
mysql -u plank_user -p hold_the_plank_prod -e "DESCRIBE mint_signatures;"

# Check transaction enums
mysql -u plank_user -p hold_the_plank_prod -e "SHOW COLUMNS FROM transactions LIKE 'type';"
```

## Backend Implementation

### 7. Implement Relayer Service
- [ ] Create `src/services/relayer.ts`
  - [ ] Poll relayer_queue for pending mints
  - [ ] Batch process every 5 minutes or 50 items
  - [ ] Call PlankToken.mintBatch()
  - [ ] Update queue status
  - [ ] Insert transactions records
  - [ ] Handle retries and errors
- [ ] Add relayer as background job (cron or interval)
- [ ] Add health check endpoint: `GET /api/relayer/status`

### 8. Implement Signature Service
- [ ] Create `src/services/signatureService.ts`
  - [ ] Check eligibility (total plank time vs requirements)
  - [ ] Generate EIP-191 signature
  - [ ] Store in mint_signatures table
- [ ] Add endpoint: `POST /api/relics/request-signature`
- [ ] Add endpoint: `POST /api/relics/confirm-mint`

### 9. Update Existing Endpoints

**Session Completion**
- [ ] Update `POST /api/sessions/complete`
  - [ ] Calculate PLANK reward (1 PLANK per 20 seconds)
  - [ ] Insert into relayer_queue (not direct mint)
  - [ ] Return pending reward info to user

**Gym Check-in**
- [ ] Update `POST /api/gym/check-in`
  - [ ] Check if first-time gym link
  - [ ] If yes, insert 10 PLANK into relayer_queue
  - [ ] Mark gym_bonus_claimed = true

**New Endpoints**
- [ ] Add `GET /api/users/pending-rewards` (query relayer_queue)
- [ ] Add event webhooks for PlankMinted/RelicMinted events

### 10. Deploy Backend Code
```bash
# Build and deploy
npm run build
pm2 restart hold-the-plank

# Check logs
pm2 logs hold-the-plank --lines 100

# Monitor relayer
watch -n 5 'mysql -u plank_user -p hold_the_plank_prod -e "SELECT status, COUNT(*) FROM relayer_queue GROUP BY status;"'
```

## Frontend Updates

### 11. Update Frontend Contracts Config
- [ ] Update `src/lib/contracts.ts` with deployed addresses
- [ ] Update ABIs with latest contract functions
- [ ] Remove old GymRegistry references
- [ ] Add event listeners for PlankMinted/RelicMinted

### 12. Update Frontend Components
- [ ] Update PlankResult page (show pending rewards)
- [ ] Update NFT claiming UI (signature flow)
- [ ] Add pending rewards display
- [ ] Handle new transaction types

### 13. Deploy Frontend
```bash
npm run build
# Deploy to your hosting (Vercel/Netlify/etc)
```

## Testing & Monitoring

### 14. End-to-End Testing
- [ ] Test session completion → reward queued → relayer mints
- [ ] Test gym check-in → bonus queued → relayer mints
- [ ] Test NFT signature request → user mints on-chain
- [ ] Test error cases (failed mints, retries)

### 15. Monitor Production
```bash
# Check relayer queue
mysql -u plank_user -p hold_the_plank_prod -e "SELECT status, COUNT(*) FROM relayer_queue GROUP BY status;"

# Check recent mints
mysql -u plank_user -p hold_the_plank_prod -e "SELECT * FROM relayer_queue WHERE status='completed' ORDER BY processed_at DESC LIMIT 10;"

# Check mint signatures
mysql -u plank_user -p hold_the_plank_prod -e "SELECT status, COUNT(*) FROM mint_signatures GROUP BY status;"

# Check transaction types
mysql -u plank_user -p hold_the_plank_prod -e "SELECT type, COUNT(*) FROM transactions GROUP BY type ORDER BY COUNT(*) DESC;"

# Monitor application logs
pm2 logs hold-the-plank

# Monitor relayer wallet balance
# (Make sure it has enough MNT for gas)
```

### 16. Setup Alerts
- [ ] Alert if relayer wallet balance < 0.1 MNT
- [ ] Alert if relayer queue > 100 pending items
- [ ] Alert if relayer has failed items
- [ ] Alert on database errors

## Security Checklist

- [ ] Private keys stored securely (not in Git)
- [ ] Production .env has restricted permissions (chmod 600)
- [ ] Database credentials are strong
- [ ] Relayer wallet has only necessary permissions
- [ ] Rate limiting on signature endpoints
- [ ] Input validation on all endpoints
- [ ] Audit logging enabled

## Rollback Plan

If anything goes wrong:

1. **Stop the app**: `pm2 stop hold-the-plank`
2. **Restore database**: `mysql -u plank_user -p hold_the_plank_prod < ~/db-backups/backup_YYYYMMDD_HHMMSS.sql`
3. **Revert code**: `git checkout previous-commit && npm run build`
4. **Restart app**: `pm2 restart hold-the-plank`

## Quick Commands Reference

```bash
# Backup database
mysqldump -u plank_user -p hold_the_plank_prod > backup.sql

# Apply migration
mysql -u plank_user -p hold_the_plank_prod < crypto_tables.sql

# Check relayer queue
mysql -u plank_user -p hold_the_plank_prod -e "SELECT * FROM relayer_queue ORDER BY created_at DESC LIMIT 10;"

# Check mint signatures
mysql -u plank_user -p hold_the_plank_prod -e "SELECT * FROM mint_signatures ORDER BY created_at DESC LIMIT 10;"

# Restart app
pm2 restart hold-the-plank

# View logs
pm2 logs hold-the-plank

# Monitor queue in real-time
watch -n 5 'mysql -u plank_user -p hold_the_plank_prod -e "SELECT status, COUNT(*) FROM relayer_queue GROUP BY status;"'
```

## Completion

Once everything is deployed and tested:

- [ ] Update documentation with production contract addresses
- [ ] Document any issues encountered
- [ ] Create post-deployment report
- [ ] Schedule follow-up monitoring check (24h, 7d)
- [ ] Celebrate! 🎉

## Support Contacts

- Database issues: Check MySQL logs at `/var/log/mysql/error.log`
- Application issues: Check PM2 logs with `pm2 logs`
- Blockchain issues: Check MantleScan for transaction status
- Emergency rollback: Follow rollback plan above

---

**Last Updated**: 2026-01-13
**Deployed By**: [Your Name]
**Deployment Date**: [Date]
