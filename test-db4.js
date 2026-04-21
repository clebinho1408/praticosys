import { db } from './db/index.js';
import { examRequests } from './db/schema.js';

async function main() {
  const reqs = await db.select().from(examRequests);
  const cfcLen = reqs.filter(r => r.source === 'SCHOOL').length;
  const cnhLen = reqs.filter(r => r.source === 'STUDENT_DIRECT').length;
  console.log('Total:', reqs.length);
  console.log('SCHOOL:', cfcLen);
  console.log('STUDENT_DIRECT:', cnhLen);
  process.exit(0);
}
main().catch(console.error);
