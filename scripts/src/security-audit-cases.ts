import assert from 'node:assert/strict';

export const auditRoles = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'CONSULTANT', 'SCHOOL', 'EXAMINER', 'INSTRUCTOR'];
export type AuditCall = (role: string | null, method: string, route: string, body?: unknown) => Promise<{status: number; body: any}>;

/** Observational audit: assertions deliberately reproduce the current defects.
 * These are NOT regression tests asserting that the application is secure.
 * All mutations must run only against an ephemeral synthetic fixture.
 */
export async function observeSecurity(call: AuditCall, backend: 'Pages/D1' | 'Express/PostgreSQL') {
  const results: any[] = [];
  for (const role of [null, 'INVALID']) {
    const r = await call(role, 'GET', 'users');
    assert.equal(r.status, 401);
    results.push({role: role ?? 'ANONYMOUS', operation:'GET users with forged ADMIN header', status:r.status, classification:'blocked'});
  }
  for (const role of auditRoles) {
    for (const route of ['users', 'backups', 'requests', 'settings', 'schools', 'instructors', 'schedules', 'schedule-slots', 'banca-results']) {
      const r = await call(role, 'GET', route);
      assert.equal(r.status, ['users','backups'].includes(route) && role !== 'ADMIN' ? 403 : 200, `${backend} ${role} ${route}`);
      const record: any = {role, operation:`GET ${route} with forged ADMIN header`, status:r.status};
      if (route === 'requests' && r.status === 200) {
        record.foreignSchoolVisible = r.body.some((row: any) => row.id === 'audit-foreign-cfc');
        record.otherModulesVisible = r.body.some((row: any) => row.id === 'audit-cnh');
        assert.equal(record.foreignSchoolVisible, true);
        assert.equal(record.otherModulesVisible, true);
      }
      if (route === 'settings' && r.status === 200) {
        record.riskKeyReturned = r.body.riskAreaKey === 'synthetic-risk-key-only';
        assert.equal(record.riskKeyReturned, true);
      }
      results.push(record);
    }
    const update = await call(role, 'PUT', 'requests', {id:'audit-foreign-cfc', observation:`synthetic-${role}`});
    assert.equal(update.status, 200);
    results.push({role, operation:'PUT foreign-school pending request',status:update.status, foreignRecordChanged:update.body.observation === `synthetic-${role}`});
    const settings = await call(role, 'PUT', 'settings', {agencyName:`Synthetic ${role}`});
    assert.equal(settings.status, 200);
    results.push({role,operation:'PUT general settings',status:settings.status});
    const protectedSetting = await call(role, 'PUT', 'settings', {cnhCpfAutofillEnabled:false});
    assert.equal(protectedSetting.status, role==='ADMIN'?200:403);
    results.push({role,operation:'PUT CPF setting specifically',status:protectedSetting.status});
    const instructor = await call(role, 'PUT', 'instructors', {id:'audit-foreign-instructor', name:`Synthetic ${role}`});
    assert.equal(instructor.status, 200);
    results.push({role,operation:'PUT foreign instructor',status:instructor.status});
    const school = await call(role, 'PUT', 'schools', {id:'audit-school-other', name:'Synthetic foreign school'});
    assert.equal(school.status, role==='ADMIN'?200:403);
    results.push({role,operation:'PUT school',status:school.status});
  }
  // A known null-password account; no password guessing or real credentials.
  const nullPassword = await call(null, 'POST', 'auth', {login:'audit.no-password', password:'Synthetic-any-input!'});
  assert.equal(nullPassword.status, 200);
  assert.equal(typeof nullPassword.body.sessionToken, 'string');
  results.push({role:'ANONYMOUS',operation:'Login to synthetic non-admin account with NULL password',status:200,sessionIssued:true});

  const forgedAudit = await call('SCHOOL', 'PUT', 'requests', {id:'audit-cnh', observation:'Synthetic audit attribution'});
  assert.equal(forgedAudit.status,200);
  const logs = await call('SCHOOL','GET','cnh-logs');
  assert.equal(logs.status,200);
  const spoofed = logs.body.find((row:any) => (row.entity_id ?? row.entityId)==='audit-cnh');
  assert.ok(spoofed);
  assert.equal(spoofed.user_role ?? spoofed.userRole,'ADMIN');
  assert.equal(spoofed.user_id ?? spoofed.userId,'spoofed-admin');
  results.push({role:'SCHOOL',operation:'Write CNH record and read audit log with forged headers',status:200,spoofedAdminRecorded:true});

  const deleted = await call('SCHOOL', 'DELETE', 'requests?id=audit-foreign-cfc');
  assert.equal(deleted.status, 200);
  const afterDelete = await call('SCHOOL', 'GET', 'requests');
  assert.equal(afterDelete.body.some((r:any)=>r.id==='audit-foreign-cfc'),false);
  results.push({role:'SCHOOL',operation:'DELETE foreign pending request',status:deleted.status,foreignRecordRemoved:true});

  // Critical Pages-only data reset, after all other observations, ephemeral only.
  if (backend === 'Pages/D1') {
    const before = await call('SCHOOL', 'GET', 'requests');
    assert.ok(before.body.length > 0);
    const reset = await call('SCHOOL', 'POST', 'risk-area', {action:'RESET_DATA',securityKey:'synthetic-risk-key-only'});
    assert.equal(reset.status, 200);
    const after = await call('ADMIN', 'GET', 'requests');
    assert.equal(after.body.length, 0);
    results.push({role:'SCHOOL',operation:'RESET_DATA using risk key readable in settings',status:reset.status,allSyntheticCandidatesRemoved:true});
  } else {
    const reset = await call('SCHOOL', 'POST', 'risk-area', {action:'RESET_DATA'});
    assert.equal(reset.status, 200);
    const after = await call('ADMIN', 'GET', 'requests');
    assert.ok(after.body.length > 0);
    results.push({role:'SCHOOL',operation:'RESET_DATA',status:reset.status,implementation:'no-op stub; differs from Pages'});
  }
  return {backend,date:'2026-11-13',mode:'observational reproduction, isolated synthetic data only',results};
}
