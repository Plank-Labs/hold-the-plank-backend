import { PrivyClient } from '@privy-io/server-auth';
import dotenv from 'dotenv';

dotenv.config();

const appId = process.env.PRIVY_APP_ID || '';
const appSecret = process.env.PRIVY_APP_SECRET || '';

console.log('[Privy Config] App ID loaded:', appId ? `${appId.substring(0, 10)}...` : 'MISSING');
console.log('[Privy Config] App Secret loaded:', appSecret ? 'YES' : 'MISSING');

const privyClient = new PrivyClient(appId, appSecret);

export default privyClient;