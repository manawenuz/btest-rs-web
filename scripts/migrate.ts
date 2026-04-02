import { migrate } from '../lib/db';

async function main() {
  console.log('Running database migration...');
  try {
    await migrate();
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
