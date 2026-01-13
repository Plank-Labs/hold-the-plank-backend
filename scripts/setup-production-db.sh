#!/bin/bash

# Production Database Setup Script for Hold The Plank Backend (EC2)
# This script sets up MySQL database on EC2 instance

set -e

echo "🚀 Hold The Plank - Production Database Setup (EC2)"
echo "===================================================="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs to install MySQL. Please run with sudo."
    echo "   sudo bash scripts/setup-production-db.sh"
    exit 1
fi

# Detect the actual user who ran sudo
ACTUAL_USER=${SUDO_USER:-$USER}

echo ""
echo "Step 1: Installing MySQL Server"
echo "--------------------------------"

# Update package list
apt-get update

# Install MySQL Server (non-interactive)
export DEBIAN_FRONTEND=noninteractive
apt-get install -y mysql-server

echo "✅ MySQL Server installed"

# Start MySQL service
systemctl start mysql
systemctl enable mysql

echo "✅ MySQL service started and enabled"

# Secure MySQL installation
echo ""
echo "Step 2: Securing MySQL Installation"
echo "------------------------------------"

# Generate a secure random password for production
DB_PASSWORD=$(openssl rand -base64 32)
DB_NAME="hold_the_plank_prod"
DB_USER="plank_user"

echo "Creating database and user..."

# Create database and user
mysql -u root <<EOF
-- Create database
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user with strong password
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;
EOF

echo "✅ Database and user created"

# Import schema
echo ""
echo "Step 3: Importing Database Schema"
echo "----------------------------------"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if tables already exist
TABLE_COUNT=$(mysql -u root -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME';")

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo "⚠️  Database already has $TABLE_COUNT tables. Skipping schema import."
    echo "   To reimport, drop the database first:"
    echo "   mysql -u root -p -e \"DROP DATABASE $DB_NAME;\""
elif [ -f "$PROJECT_DIR/Conquer Plank.sql" ]; then
    mysql -u root "$DB_NAME" < "$PROJECT_DIR/Conquer Plank.sql"
    echo "✅ Schema imported successfully"
else
    echo "⚠️  Schema file 'Conquer Plank.sql' not found"
    echo "   Please import it manually later"
fi

# Create production .env file
echo ""
echo "Step 4: Creating Production Environment File"
echo "---------------------------------------------"

ENV_FILE="$PROJECT_DIR/.env.production"

cat > "$ENV_FILE" <<EOF
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Privy Configuration (Update these with your actual values)
PRIVY_APP_ID=your_privy_app_id_here
PRIVY_APP_SECRET=your_privy_app_secret_here

# Frontend URL (Update with your actual frontend URL)
FRONTEND_URL=https://your-frontend-domain.com
EOF

# Set proper ownership
chown $ACTUAL_USER:$ACTUAL_USER "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "✅ Production .env file created at: $ENV_FILE"
echo "   ⚠️  IMPORTANT: Update PRIVY credentials and FRONTEND_URL!"

# Save credentials to a secure location
CREDENTIALS_FILE="/root/.hold-the-plank-db-credentials"
cat > "$CREDENTIALS_FILE" <<EOF
# Hold The Plank Database Credentials
# Generated on: $(date)
# KEEP THIS FILE SECURE!

Database Name: $DB_NAME
Database User: $DB_USER
Database Password: $DB_PASSWORD
Database Host: localhost
Database Port: 3306
EOF

chmod 600 "$CREDENTIALS_FILE"

echo ""
echo "Step 5: Configuring MySQL for Production"
echo "-----------------------------------------"

# Create custom MySQL configuration
cat > /etc/mysql/mysql.conf.d/production.cnf <<EOF
[mysqld]
# Performance tuning for production
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M

# Security settings
bind-address = 127.0.0.1
local-infile = 0

# Character set
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
EOF

# Restart MySQL to apply configuration
systemctl restart mysql

echo "✅ MySQL configured for production"

# Verify connection
echo ""
echo "Step 6: Verifying Database Setup"
echo "---------------------------------"

# Verify using root since we just created the user
TABLE_COUNT=$(mysql -u root -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME';")

echo "✅ Database connection verified"
echo "✅ Found $TABLE_COUNT tables in database"

# Final instructions
echo ""
echo "🎉 Production Database Setup Complete!"
echo "======================================"
echo ""
echo "Database Credentials (SAVE THESE SECURELY):"
echo "  Database Name: $DB_NAME"
echo "  Database User: $DB_USER"
echo "  Database Password: $DB_PASSWORD"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "  1. Credentials saved to: $CREDENTIALS_FILE"
echo "  2. Production .env created at: $ENV_FILE"
echo "  3. Update PRIVY_APP_ID and PRIVY_APP_SECRET in .env.production"
echo "  4. Update FRONTEND_URL with your actual domain"
echo "  5. NEVER commit .env.production to Git!"
echo ""
echo "Next Steps:"
echo "  1. Copy .env.production to .env for production use:"
echo "     cp .env.production .env"
echo "  2. Update the Privy credentials in .env"
echo "  3. Install Node.js and npm if not already installed"
echo "  4. Install application dependencies:"
echo "     npm install"
echo "  5. Build the application:"
echo "     npm run build"
echo "  6. Start the application with PM2:"
echo "     npm install -g pm2"
echo "     pm2 start dist/index.js --name hold-the-plank"
echo ""
