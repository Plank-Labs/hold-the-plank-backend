# Crypto Tables - Production Deployment Summary

## 🎯 What You Just Did (Local)

✅ **Created crypto_tables.sql** - Database migration script with:
- `relayer_queue` table (for backend-controlled PLANK minting)
- `mint_signatures` table (for user-controlled NFT minting)
- Updated transaction type enums
- New columns and indexes

✅ **Applied to local database** - Your local dev database now has the crypto infrastructure

## 🚀 How to Deploy to Production

### Quick Start (3 Steps)

```bash
# 1. Upload files to your EC2 instance
scp crypto_tables.sql scripts/deploy-crypto-tables.sh your-ec2:~/hold-the-plank-backend/

# 2. SSH and run the deployment script
ssh your-ec2
cd ~/hold-the-plank-backend
bash scripts/deploy-crypto-tables.sh

# 3. Monitor and verify
pm2 logs hold-the-plank
```

### Detailed Step-by-Step

1. **Deploy Smart Contracts First** (Prerequisites)
   ```bash
   # Deploy PlankToken.sol and Relics.sol to Mantle Sepolia
   # Save the contract addresses
   # Grant MINTER_ROLE to relayer wallet
   ```

2. **Backup Production Database**
   ```bash
   mysqldump -u plank_user -p hold_the_plank_prod > backup_$(date +%Y%m%d).sql
   ```

3. **Run Deployment Script**
   ```bash
   bash scripts/deploy-crypto-tables.sh
   # This will:
   # - Create backup (if not done)
   # - Stop application
   # - Apply migration
   # - Verify tables
   # - Restart application
   ```

4. **Add Environment Variables**
   ```env
   PLANK_TOKEN_ADDRESS=0x...
   RELICS_CONTRACT_ADDRESS=0x...
   RELAYER_PRIVATE_KEY=0x...
   SIGNER_PRIVATE_KEY=0x...
   ```

5. **Implement Backend Services**
   - Relayer service (batch mint PLANK tokens)
   - Signature service (sign NFT mint requests)
   - Update session/gym endpoints

## 📁 Files Created

| File | Purpose | Action Required |
|------|---------|-----------------|
| `crypto_tables.sql` | Database migration script | Upload to EC2 |
| `scripts/deploy-crypto-tables.sh` | Automated deployment script | Upload & run on EC2 |
| `CRYPTO_DEPLOYMENT.md` | Detailed deployment guide | Reference during deployment |
| `PRODUCTION_CHECKLIST.md` | Complete checklist | Follow step-by-step |
| `DEPLOYMENT_SUMMARY.md` | This file - quick reference | Keep handy |

## 🗄️ What Changed in Database

### New Tables

**relayer_queue**
```sql
Purpose: Queue for backend to batch mint PLANK tokens
Columns: user_id, wallet_address, amount, reason, status, tx_hash
Reason types: SESSION_REWARD, GYM_BONUS, STREAK_BONUS
```

**mint_signatures**
```sql
Purpose: Store signatures for users to mint Relic NFTs
Columns: user_id, wallet_address, token_id, nonce, deadline, signature
Relic IDs: 1-5 (Bronze Shield to Kronos Slayer)
```

### Modified Tables

**transactions**
- Added transaction types: `session_mint`, `gym_bonus_mint`, `streak_bonus_mint`, `relic_mint`

**gym_checkins**
- Added column: `gym_bonus_claimed` (tracks if user got 10 PLANK bonus)

**user_inventory**
- Added index: `idx_user_inventory_minted` (for on-chain NFT queries)

## 🔄 Data Flow After Deployment

### Session Completion Flow
```
User completes session
    ↓
Backend validates & calculates reward (1 PLANK per 20 sec)
    ↓
Insert into relayer_queue (status: pending)
    ↓
User sees "Reward pending..."
    ↓
Relayer service picks up (every 5 min or 50 items)
    ↓
Batch mint to PlankToken contract
    ↓
Update queue (status: completed, tx_hash)
    ↓
User sees "Reward received!" + tx link
```

### Relic NFT Minting Flow
```
User requests NFT mint
    ↓
Backend checks eligibility (total plank time)
    ↓
Backend generates signature & stores in mint_signatures
    ↓
User receives signature + deadline
    ↓
User calls Relics.mintWithSignature() (pays gas)
    ↓
Smart contract verifies signature
    ↓
NFT minted to user's wallet
    ↓
User confirms mint via API
    ↓
Update mint_signatures (status: used)
```

### Gym Bonus Flow
```
User scans gym QR for first time
    ↓
Backend validates location & QR code
    ↓
Insert 10 PLANK into relayer_queue
    ↓
Mark gym_checkins.gym_bonus_claimed = true
    ↓
Relayer mints bonus to user
```

## ⚠️ Important Notes

1. **Deploy contracts BEFORE database migration** (you need contract addresses)
2. **Always backup database before migration**
3. **Test on staging/dev environment first** (if you have one)
4. **Keep private keys secure** (never commit to Git)
5. **Monitor relayer wallet balance** (needs MNT for gas)

## 🔍 Monitoring Commands

```bash
# Check pending rewards
mysql -u plank_user -p hold_the_plank_prod -e \
  "SELECT status, COUNT(*) FROM relayer_queue GROUP BY status;"

# Check recent mints
mysql -u plank_user -p hold_the_plank_prod -e \
  "SELECT * FROM relayer_queue WHERE status='completed' ORDER BY processed_at DESC LIMIT 10;"

# Check mint signatures
mysql -u plank_user -p hold_the_plank_prod -e \
  "SELECT status, COUNT(*) FROM mint_signatures GROUP BY status;"

# Monitor in real-time
watch -n 5 'mysql -u plank_user -p"$DB_PASSWORD" hold_the_plank_prod \
  -e "SELECT status, COUNT(*) FROM relayer_queue GROUP BY status;"'
```

## 🛟 Rollback (If Needed)

```bash
# Stop application
pm2 stop hold-the-plank

# Restore from backup
mysql -u plank_user -p hold_the_plank_prod < ~/db-backups/backup_YYYYMMDD_HHMMSS.sql

# Restart application
pm2 restart hold-the-plank
```

## 📋 Next Steps Checklist

- [ ] Deploy smart contracts (PlankToken.sol, Relics.sol)
- [ ] Upload migration files to EC2
- [ ] Backup production database
- [ ] Run deployment script
- [ ] Add environment variables
- [ ] Implement relayer service
- [ ] Implement signature service
- [ ] Update session endpoints
- [ ] Update gym endpoints
- [ ] Test end-to-end
- [ ] Monitor for 24 hours

## 🆘 Getting Help

- **Deployment Issues**: See [CRYPTO_DEPLOYMENT.md](CRYPTO_DEPLOYMENT.md)
- **Database Errors**: Check `/var/log/mysql/error.log`
- **Application Errors**: Check `pm2 logs hold-the-plank`
- **Contract Issues**: Check MantleScan for transactions

## 🎉 Success Criteria

You'll know it's working when:
- ✅ New tables exist in production database
- ✅ Application starts without errors
- ✅ Session completion creates relayer_queue entry
- ✅ Relayer service processes queue
- ✅ PLANK tokens are minted on-chain
- ✅ Users can request NFT signatures
- ✅ Users can mint Relic NFTs

---

**Ready to deploy?** Start with [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for the complete walkthrough!

**Need details?** See [CRYPTO_DEPLOYMENT.md](CRYPTO_DEPLOYMENT.md) for the comprehensive guide!

**Questions?** Check the implementation plan in [implementation-plan.md](implementation-plan.md)!
