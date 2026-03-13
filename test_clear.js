import { pb } from './services/pocketbase.js';

async function testClear() {
  try {
    console.log('Fetching print queue...');
    const records = await pb.collection('print_queue').getFullList();
    console.log(`Found ${records.length} records to delete.`);
    
    for (const r of records) {
      console.log(`Deleting ${r.id}...`);
      await pb.collection('print_queue').delete(r.id);
    }
    console.log('Done.');

  } catch (e) {
    console.error('Error:', e);
  }
}

testClear();
