# Production Deployment Troubleshooting Guide

Quick solutions to common issues during crypto tables deployment.

## 🚨 Common Issues & Solutions

### Issue #1: Foreign Key Constraint Fails

**Error Message:**
```
ERROR 1452: Cannot add or update a child row: a foreign key constraint fails
```

**Cause:** The `users` or `sessions` tables don't exist yet.

**Solution:**
```bash
# Import base schema first
mysql -u plank_user -p hold_the_plank_prod < "Conquer Plank.sql"

# Then run crypto tables migration
mysql -u plank_user -p hold_the_plank_prod < crypto_tables.sql
```

---

### Issue #2: ENUM Values Don't Match

**Error Message:**
```
ERROR 1265: Data truncated for column 'type' at row X
```

**Cause:** Existing data in `transactions` table has values not in the new ENUM.

**Solution:**
```bash
# Check existing values
mysql -u plank_user -p hold_the_plank_prod -e "SELECT DISTINCT type FROM transactions;"

# If you see unexpected values, update them first:
mysql -u plank_user -p hold_the_plank_prod <<EOF
UPDATE transactions SET type = 'game_reward' WHERE type = 'old_value';
EOF

# Then re-run the migration
mysql -u plank_user -p hold_the_plank_prod < crypto_tables.sql
```

---

### Issue #3: Column Already Exists

**Error Message:**
```
ERROR 1060: Duplicate column name 'gym_bonus_claimed'
```

**Cause:** Migration was run before, or column exists from previous version.

**Solution:**
This is actually OK! The script uses `IF NOT EXISTS` checks. You can safely ignore this warning, or:

```bash
# Check if it's already there
mysql -u plank_user -p hold_the_plank_prod -e "SHOW COLUMNS FROM gym_checkins LIKE 'gym_bonus_claimed';"

# If it exists, just skip that part of the migration
```

---

### Issue #4: Can't Connect to Database

**Error Message:**
```
ERROR 2002: Can't connect to local MySQL server through socket
```

**Cause:** MySQL service is not running.

**Solution:**
```bash
# Start MySQL
sudo systemctl start mysql

# Enable on boot
sudo systemctl enable mysql

# Check status
sudo systemctl status mysql
```

---

### Issue #5: Access Denied for User

**Error Message:**
```
ERROR 1045: Access denied for user 'plank_user'@'localhost'
```

**Cause:** Wrong password or user doesn't have permissions.

**Solution:**
```bash
# Check your .env file for correct credentials
cat .env | grep DB_

# Or find saved credentials
cat /root/.hold-the-plank-db-credentials

# If needed, reset password
mysql -u root -p <<EOF
ALTER USER 'plank_user'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
EOF

# Update .env with new password
```

---

### Issue #6: Application Won't Start After Migration

**Error Message:**
```
Error: Unknown column 'relayer_queue.xyz' in 'field list'
```

**Cause:** Application code references columns that don't exist yet, or migration didn't complete.

**Solution:**
```bash
# Check if tables were created
mysql -u plank_user -p hold_the_plank_prod -e "SHOW TABLES;"

# Check specific table structure
mysql -u plank_user -p hold_the_plank_prod -e "DESCRIBE relayer_queue;"

# If tables missing, re-run migration
mysql -u plank_user -p hold_the_plank_prod < crypto_tables.sql

# Check application logs
pm2 logs hold-the-plank --lines 50
```

---

### Issue #7: Migration Hangs/Freezes

**Symptom:** Migration script runs but never completes.

**Cause:** Table is locked by another process, or large table modification.

**Solution:**
```bash
# Check for locks
mysql -u plank_user -p hold_the_plank_prod -e "SHOW PROCESSLIST;"

# Kill blocking queries if needed
mysql -u plank_user -p hold_the_plank_prod -e "KILL <process_id>;"

# Make sure application is stopped
pm2 stop hold-the-plank

# Try migration again
mysql -u plank_user -p hold_the_plank_prod < crypto_tables.sql
```

---

### Issue #8: Backup Fails

**Error Message:**
```
mysqldump: Got error: 1044: Access denied for user
```

**Cause:** User doesn't have backup privileges.

**Solution:**
```bash
# Use root user for backup
mysqldump -u root -p hold_the_plank_prod > backup.sql

# Or grant privileges to plank_user
mysql -u root -p <<EOF
GRANT SELECT, LOCK TABLES, SHOW VIEW ON hold_the_plank_prod.* TO 'plank_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

---

### Issue #9: Insufficient Disk Space

**Error Message:**
```
ERROR 1114: The table is full
```

**Cause:** Not enough disk space for migration.

**Solution:**
```bash
# Check disk space
df -h

# Clean up if needed
# Remove old logs
sudo journalctl --vacuum-time=3d

# Remove old backups (keep last 3)
ls -lt ~/db-backups/ | tail -n +4 | awk '{print $9}' | xargs rm

# Clean package cache
sudo apt-get clean
```

---

### Issue #10: PM2 Won't Restart App

**Error Message:**
```
PM2 | App [hold-the-plank] errored
```

**Cause:** Application crashes on startup due to missing env variables or code errors.

**Solution:**
```bash
# Check detailed logs
pm2 logs hold-the-plank --err --lines 100

# Check if all required env variables are set
cat .env

# Try starting manually to see error
cd ~/hold-the-plank-backend
npm start

# If it's env variables, add them:
nano .env
# Add missing variables

# Restart PM2
pm2 restart hold-the-plank
```

---

## 🔍 Diagnostic Commands

### Check Database Connection
```bash
mysql -u plank_user -p hold_the_plank_prod -e "SELECT 1;"
```

### Verify All Tables Exist
```bash
mysql -u plank_user -p hold_the_plank_prod <<EOF
SELECT TABLE_NAME, CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'hold_the_plank_prod'
ORDER BY CREATE_TIME DESC;
EOF
```

### Check Table Sizes
```bash
mysql -u plank_user -p hold_the_plank_prod <<EOF
SELECT
    TABLE_NAME,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'hold_the_plank_prod'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;
EOF
```

### Verify Relayer Queue
```bash
mysql -u plank_user -p hold_the_plank_prod <<EOF
SELECT
    status,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM relayer_queue
GROUP BY status;
EOF
```

### Check Recent Activity
```bash
mysql -u plank_user -p hold_the_plank_prod <<EOF
SELECT
    'relayer_queue' as table_name,
    COUNT(*) as total_rows
FROM relayer_queue
UNION ALL
SELECT
    'mint_signatures' as table_name,
    COUNT(*) as total_rows
FROM mint_signatures;
EOF
```

---

## 🛟 Emergency Rollback

If everything goes wrong and you need to rollback immediately:

```bash
# 1. Stop the application
pm2 stop hold-the-plank

# 2. Restore from backup
mysql -u plank_user -p hold_the_plank_prod < ~/db-backups/backup_YYYYMMDD_HHMMSS.sql

# 3. Verify restoration
mysql -u plank_user -p hold_the_plank_prod -e "SHOW TABLES;"

# 4. Restart application
pm2 restart hold-the-plank

# 5. Verify it's working
curl http://localhost:3000/health
pm2 logs hold-the-plank --lines 50
```

---

## 📞 When to Ask for Help

Contact your team/support if:

1. **Data Loss**: Tables dropped or data missing after migration
2. **Cannot Rollback**: Backup restore fails
3. **Production Down >30min**: Can't get app running
4. **Database Corruption**: MySQL won't start
5. **Security Breach**: Private keys exposed

---

## 🔧 Useful Debug Commands

### Test Connection with All Details
```bash
mysql -u plank_user -p hold_the_plank_prod \
  -e "SELECT
    DATABASE() as current_db,
    USER() as current_user,
    NOW() as current_time,
    VERSION() as mysql_version;"
```

### Check Foreign Keys
```bash
mysql -u plank_user -p hold_the_plank_prod <<EOF
SELECT
    TABLE_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'hold_the_plank_prod'
    AND TABLE_NAME IN ('relayer_queue', 'mint_signatures');
EOF
```

### Check Indexes
```bash
mysql -u plank_user -p hold_the_plank_prod <<EOF
SELECT
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'hold_the_plank_prod'
    AND TABLE_NAME IN ('relayer_queue', 'mint_signatures', 'user_inventory')
GROUP BY TABLE_NAME, INDEX_NAME;
EOF
```

### Monitor MySQL Performance
```bash
# Watch active queries
watch -n 2 'mysql -u plank_user -p"$DB_PASSWORD" hold_the_plank_prod -e "SHOW PROCESSLIST;"'

# Check slow queries
mysql -u plank_user -p hold_the_plank_prod -e "SHOW VARIABLES LIKE 'slow_query%';"
```

---

## 📚 Additional Resources

- [MySQL Error Codes](https://dev.mysql.com/doc/mysql-errors/8.0/en/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Node.js MySQL Best Practices](https://github.com/mysqljs/mysql#readme)

---

**Still stuck?** Check the detailed guide in [CRYPTO_DEPLOYMENT.md](CRYPTO_DEPLOYMENT.md) or ask for help!
