import sequelize from '../src/config/database';
import dotenv from 'dotenv';

dotenv.config();

interface IndexInfo {
  Table: string;
  Non_unique: number;
  Key_name: string;
  Seq_in_index: number;
  Column_name: string;
  Collation: string;
  Cardinality: number;
  Sub_part: null | number;
  Packed: null | string;
  Null: string;
  Index_type: string;
  Comment: string;
  Index_comment: string;
}

async function analyzeIndexes() {
  try {
    console.log('🔍 Analyzing indexes on users table...\n');

    // Get all indexes
    const [indexes] = await sequelize.query('SHOW INDEX FROM users;') as [IndexInfo[], unknown];

    console.log(`Found ${indexes.length} index entries\n`);

    // Group indexes by key name
    const indexGroups = new Map<string, IndexInfo[]>();
    indexes.forEach((idx) => {
      if (!indexGroups.has(idx.Key_name)) {
        indexGroups.set(idx.Key_name, []);
      }
      indexGroups.get(idx.Key_name)!.push(idx);
    });

    console.log('📊 Index Summary:');
    console.log('='.repeat(80));

    const uniqueIndexes: string[] = [];
    const duplicateIndexes: string[] = [];

    indexGroups.forEach((group, keyName) => {
      const isUnique = group[0].Non_unique === 0;
      const columns = group.map(g => g.Column_name).join(', ');

      console.log(`\n${keyName}:`);
      console.log(`  Type: ${isUnique ? 'UNIQUE' : 'INDEX'}`);
      console.log(`  Columns: ${columns}`);
      console.log(`  Index Type: ${group[0].Index_type}`);

      // Check for duplicates on email column
      if (columns === 'email' && keyName !== 'PRIMARY') {
        if (isUnique) {
          uniqueIndexes.push(keyName);
        }
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n📈 Total unique indexes: ${indexGroups.size}`);
    console.log(`⚠️  MySQL limit: 64 indexes per table\n`);

    // Identify duplicates
    if (uniqueIndexes.length > 1) {
      console.log('🚨 DUPLICATE UNIQUE INDEXES FOUND ON EMAIL COLUMN:');
      uniqueIndexes.forEach((idx, i) => {
        if (i === 0) {
          console.log(`  ✅ ${idx} (keep this one)`);
        } else {
          console.log(`  ❌ ${idx} (safe to remove)`);
          duplicateIndexes.push(idx);
        }
      });
    }

    return { duplicateIndexes, totalIndexes: indexGroups.size };

  } catch (error) {
    console.error('❌ Error analyzing indexes:', error);
    throw error;
  }
}

async function cleanupDuplicateIndexes(duplicateIndexes: string[]) {
  if (duplicateIndexes.length === 0) {
    console.log('\n✅ No duplicate indexes to clean up!');
    return;
  }

  console.log('\n🧹 Cleaning up duplicate indexes...\n');

  for (const indexName of duplicateIndexes) {
    try {
      console.log(`  Dropping index: ${indexName}`);
      await sequelize.query(`ALTER TABLE users DROP INDEX \`${indexName}\`;`);
      console.log(`  ✅ Successfully dropped ${indexName}`);
    } catch (error: any) {
      console.error(`  ❌ Failed to drop ${indexName}:`, error.message);
    }
  }

  console.log('\n✅ Cleanup complete!');
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    const { duplicateIndexes, totalIndexes } = await analyzeIndexes();

    // Check if we should proceed with cleanup
    if (duplicateIndexes.length > 0) {
      console.log('\n⚠️  WARNING: This will permanently drop duplicate indexes from your database!');
      console.log('Make sure you have a backup before proceeding.\n');

      // In a real scenario, you'd want to add a confirmation prompt here
      // For now, we'll require a command line flag
      const shouldCleanup = process.argv.includes('--cleanup');

      if (shouldCleanup) {
        await cleanupDuplicateIndexes(duplicateIndexes);

        // Verify cleanup
        console.log('\n🔍 Verifying cleanup...');
        const { totalIndexes: newTotal } = await analyzeIndexes();
        console.log(`\n📊 Indexes before: ${totalIndexes}`);
        console.log(`📊 Indexes after: ${newTotal}`);
        console.log(`📊 Removed: ${totalIndexes - newTotal}`);
      } else {
        console.log('\n💡 To clean up duplicate indexes, run:');
        console.log('   npm run cleanup-indexes -- --cleanup');
        console.log('\n   OR');
        console.log('   ts-node scripts/cleanup-indexes.ts --cleanup');
      }
    }

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

main();
