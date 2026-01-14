#!/bin/bash

# Crypto Tables Deployment Script for Hold The Plank Backend
# This script safely deploys crypto-related database changes to production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Hold The Plank - Crypto Tables Deployment${NC}"
echo "=============================================="
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    source "$PROJECT_DIR/.env"
else
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "   Please create .env file with database credentials"
    exit 1
fi

# Check if running in production
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}⚠️  Warning: NODE_ENV is not set to 'production'${NC}"
    read -p "Continue anyway? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# Verify migration file exists
MIGRATION_FILE="$PROJECT_DIR/crypto_tables.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Error: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration file found${NC}"
echo ""

# Display database info
echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠️  This will modify your production database!${NC}"
read -p "Have you backed up the database? (yes/no): " BACKUP_CONFIRM
if [ "$BACKUP_CONFIRM" != "yes" ]; then
    echo ""
    echo -e "${BLUE}📦 Let's create a backup first...${NC}"

    # Create backup directory
    BACKUP_DIR="$HOME/db-backups"
    mkdir -p "$BACKUP_DIR"

    # Create backup
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "Creating backup: $BACKUP_FILE"

    mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backup created successfully${NC}"
        echo "   Location: $BACKUP_FILE"
        echo ""
    else
        echo -e "${RED}❌ Backup failed!${NC}"
        exit 1
    fi
fi

# Final confirmation
read -p "Ready to deploy? This will modify database tables. (yes/no): " DEPLOY_CONFIRM
if [ "$DEPLOY_CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}🚀 Starting deployment...${NC}"
echo ""

# Stop PM2 process if running
echo "Step 1: Stopping application..."
if command -v pm2 &> /dev/null; then
    pm2 stop hold-the-plank 2>/dev/null || echo "   (app not running in PM2)"
else
    echo "   (PM2 not installed, skipping)"
fi
echo -e "${GREEN}✅ Application stopped${NC}"
echo ""

# Apply migration
echo "Step 2: Applying database migration..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration applied successfully${NC}"
else
    echo -e "${RED}❌ Migration failed!${NC}"
    echo "   Please check errors above and restore from backup if needed"
    exit 1
fi
echo ""

# Verify new tables
echo "Step 3: Verifying database changes..."

# Check relayer_queue table
RELAYER_QUEUE_EXISTS=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -sN -e "SHOW TABLES LIKE 'relayer_queue';" | wc -l)
if [ "$RELAYER_QUEUE_EXISTS" -eq 1 ]; then
    echo -e "${GREEN}✅ relayer_queue table created${NC}"
else
    echo -e "${RED}❌ relayer_queue table not found${NC}"
fi

# Check mint_signatures table
MINT_SIG_EXISTS=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -sN -e "SHOW TABLES LIKE 'mint_signatures';" | wc -l)
if [ "$MINT_SIG_EXISTS" -eq 1 ]; then
    echo -e "${GREEN}✅ mint_signatures table created${NC}"
else
    echo -e "${RED}❌ mint_signatures table not found${NC}"
fi

# Check gym_bonus_claimed column
GYM_BONUS_EXISTS=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -sN -e "SHOW COLUMNS FROM gym_checkins LIKE 'gym_bonus_claimed';" | wc -l)
if [ "$GYM_BONUS_EXISTS" -eq 1 ]; then
    echo -e "${GREEN}✅ gym_bonus_claimed column added${NC}"
else
    echo -e "${RED}❌ gym_bonus_claimed column not found${NC}"
fi

# Verify transaction type enums
echo ""
echo "Transaction type enums:"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW COLUMNS FROM transactions LIKE 'type';" | grep -o "'[^']*'" | sed "s/'//g" | tail -n +2

echo ""

# Restart application
echo "Step 4: Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 restart hold-the-plank 2>/dev/null || echo "   (app not in PM2, start it manually)"
    sleep 2
    pm2 status
else
    echo "   Please start your application manually"
fi
echo ""

# Final summary
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "======================================"
echo ""
echo "What was deployed:"
echo "  ✓ relayer_queue table (PLANK token minting queue)"
echo "  ✓ mint_signatures table (Relic NFT signatures)"
echo "  ✓ Updated transaction type enums"
echo "  ✓ gym_bonus_claimed column"
echo "  ✓ Database indexes optimized"
echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "  1. Deploy smart contracts (PlankToken.sol, Relics.sol)"
echo "  2. Add contract addresses to .env file"
echo "  3. Add relayer/signer private keys to .env file"
echo "  4. Implement relayer service in backend"
echo "  5. Implement signature service in backend"
echo "  6. Test end-to-end flow"
echo ""
echo -e "${BLUE}📝 Environment variables needed:${NC}"
echo "  MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz"
echo "  PLANK_TOKEN_ADDRESS=0x..."
echo "  RELICS_CONTRACT_ADDRESS=0x..."
echo "  RELAYER_PRIVATE_KEY=0x..."
echo "  SIGNER_PRIVATE_KEY=0x..."
echo ""
echo -e "${GREEN}Check logs:${NC} pm2 logs hold-the-plank"
echo -e "${GREEN}Monitor queue:${NC} mysql -u $DB_USER -p $DB_NAME -e 'SELECT * FROM relayer_queue LIMIT 10;'"
echo ""
