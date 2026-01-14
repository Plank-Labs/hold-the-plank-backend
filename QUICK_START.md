# Quick Start Guide

## Local Development (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your MySQL credentials

# 3. Set up database automatically
npm run db:setup

# 4. Start development server
npm run dev
```

Visit: http://localhost:3000/health

## Production on EC2 (10 minutes)

```bash
# 1. SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 2. Clone repository
git clone https://github.com/your-username/hold-the-plank-backend.git
cd hold-the-plank-backend

# 3. Run automated production setup
sudo bash scripts/setup-production-db.sh

# 4. Update environment variables
cp .env.production .env
nano .env  # Update PRIVY credentials and FRONTEND_URL

# 5. Install and build
npm install
npm run build

# 6. Start with PM2
sudo npm install -g pm2
pm2 start dist/index.js --name hold-the-plank
pm2 save
pm2 startup systemd
```

## GitHub Actions

Add these secrets to your GitHub repository:
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`

Push to `main` or `develop` branch - CI/CD runs automatically!

## Full Documentation

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for complete instructions and troubleshooting.
