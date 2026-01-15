import sequelize from './src/config/database';
import { up } from './migrations/001_alter_relayer_queue_amount_type';

async function runMigration() {
  try {
    console.log('Running migration: alter_relayer_queue_amount_type');
    await up(sequelize.getQueryInterface());
    console.log('Migration completed successfully');
    await sequelize.close();
  } catch (error) {
    console.error('Migration failed:', error);
    await sequelize.close();
    process.exit(1);
  }
}

runMigration();
