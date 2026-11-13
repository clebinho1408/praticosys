import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { localD1, seedD1, pagesHarness } from './d1-runtime.js';
import { observeSecurity, auditRoles } from './security-audit-cases.js';
// @ts-ignore Shared Pages schema.
import { users, systemSettings, drivingSchools, instructors, cfcRequests, cnhbrasilRequests } from '../../db/schema.js';

const runtime = await localD1();
try {
  await seedD1(runtime.db);
  const tokens = new Map<string,string>();
  for (const role of auditRoles) {
    const userId = `audit-${role}`;
    await runtime.db.insert(users).values({
      id:userId,login:userId,name:'Synthetic audit user',role,allowedModules:['cfc'],
      schoolId:role==='SCHOOL'?'d1-school':null,
      examinerId:role==='EXAMINER'?'d1-examiner':null,
      instructorId:role==='INSTRUCTOR'?'d1-instructor':null,
    });
    const token = randomUUID();
    tokens.set(role,token);
    await runtime.db.execute(sql`INSERT INTO sessoes (id,usuario_id,expira_em) VALUES (${token},${userId},${new Date(Date.now()+600_000).toISOString()})`);
  }
  await runtime.db.insert(users).values({id:'audit-null-password',login:'audit.no-password',name:'Synthetic null password',role:'SCHOOL',forcePasswordChange:false});
  await runtime.db.update(systemSettings).set({riskAreaKey:'synthetic-risk-key-only'}).where(eq(systemSettings.id,1));
  await runtime.db.insert(drivingSchools).values({id:'audit-school-other',name:'Synthetic other school'});
  await runtime.db.insert(instructors).values({id:'audit-foreign-instructor',name:'Synthetic other instructor',cpf:'00000000001'});
  await runtime.db.insert(cfcRequests).values({id:'audit-foreign-cfc',schoolId:'audit-school-other',studentName:'Synthetic other student',modulo:'CFC',status:'WAITING_SCHEDULING',examType:'COMMON',source:'SCHOOL'});
  await runtime.db.insert(cnhbrasilRequests).values({id:'audit-cnh',instructor:'audit-foreign-instructor',studentName:'Synthetic CNH student',modulo:'CNH_BRASIL',status:'WAITING_SCHEDULING',examType:'COMMON',source:'MANUAL'});
  const harness = await pagesHarness(runtime.env);
  try {
    const report = await observeSecurity(async (role,method,route,body) => {
      const token = role ? tokens.get(role) ?? 'invalid-synthetic-token' : undefined;
      const response = await harness.dispatch(new Request(`http://test.invalid/api/${route}`,{
        method,headers:{'Content-Type':'application/json','X-User-Role':'ADMIN','X-User-Id':'spoofed-admin',...(token?{Authorization:`Bearer ${token}`}:{})},
        ...(body?{body:JSON.stringify(body)}:{}),
      }));
      return {status:response.status,body:await response.json()};
    },'Pages/D1');
    await writeFile(new URL('../../security-audit/permissions-pages.json',import.meta.url),JSON.stringify(report,null,2));
    console.log(`Pages/D1: ${report.results.length} sanitized observations; critical reset, cross-user access and protected routes reproduced.`);
  } finally { await harness.drain(); }
} finally { await runtime.mf.dispose(); }
