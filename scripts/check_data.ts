import { db } from '../db/index.js';
import { examRequests, examSchedules, instructors } from '../db/schema.js';

async function check() {
  try {
    const reqs = await db.select().from(examRequests);
    const schs = await db.select().from(examSchedules);
    const insts = await db.select().from(instructors);

    console.log("Requests count:", reqs.length);
    console.log("Schedules count:", schs.length);
    console.log("Instructors count:", insts.length);

    if (reqs.length > 0) console.log("First request:", reqs[0]);
    if (schs.length > 0) console.log("First schedule:", schs[0]);

    process.exit(0);
  } catch (e) {
    console.error("Error checking data:", e);
    process.exit(1);
  }
}

check();
