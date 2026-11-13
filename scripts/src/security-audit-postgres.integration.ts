import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { isTable } from 'drizzle-orm';
import { observeSecurity, auditRoles } from './security-audit-cases.js';
// @ts-ignore Shared schema only, no workspace connection imported here.
import * as schema from '../../db/schema.js';

const socket=process.env.CPF_TEST_SOCKET;
assert.ok(socket && socket===tmpdir() && path.basename(socket).startsWith('cpf-pg-'));
assert.equal(process.env.DATA_BASE_NEON,undefined);
assert.equal(process.env.DATABASE_URL,`postgresql://postgres@localhost/cpf_test?host=${encodeURIComponent(socket)}`);
const {pool}=await import('@workspace/db');
let server:import('node:http').Server|undefined;
try {
  const created=new Set<string>();
  for(const table of Object.values(schema)){
    if(!isTable(table))continue;
    const config=getTableConfig(table as any);
    if(created.has(config.name))continue;
    created.add(config.name);
    const cols=config.columns.map(c=>`"${c.name}" ${c.getSQLType()}${c.primary?' PRIMARY KEY':''}`);
    await pool.query(`CREATE TABLE "${config.name}" (${cols.join(',')})`);
  }
  await pool.query('CREATE TABLE sessoes(id text PRIMARY KEY,usuario_id text,expira_em timestamp,criado_em timestamp DEFAULT now())');
  await pool.query("CREATE TABLE backups(id text PRIMARY KEY,tipo_gatilho text,dados jsonb,tamanho_bytes integer,criado_em timestamp DEFAULT now())");
  const tokens=new Map<string,string>();
  for(const role of auditRoles){
    const id=`audit-${role}`;
    await pool.query(`INSERT INTO usuarios(id,nome,login,perfil,autoescola_id,examinador_id,instrutor_id,modulos_permitidos) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id,'Synthetic user',id,role,role==='SCHOOL'?'audit-own-school':null,role==='EXAMINER'?'audit-own-examiner':null,role==='INSTRUCTOR'?'audit-own-instructor':null,'["cfc"]']);
    const token=randomUUID(); tokens.set(role,token);
    await pool.query("INSERT INTO sessoes(id,usuario_id,expira_em) VALUES($1,$2,NOW()+interval '10 minutes')",[token,id]);
  }
  await pool.query("INSERT INTO usuarios(id,nome,login,perfil,forcar_troca_senha) VALUES('audit-null-password','Synthetic null password','audit.no-password','SCHOOL',false)");
  await pool.query("INSERT INTO configuracoes(id,nome_orgao,chave_area_risco) VALUES(1,'Synthetic agency','synthetic-risk-key-only')");
  await pool.query("INSERT INTO autoescolas(id,nome) VALUES('audit-school-other','Synthetic other school')");
  await pool.query("INSERT INTO instrutores(id,nome) VALUES('audit-foreign-instructor','Synthetic other instructor')");
  await pool.query("INSERT INTO solicitacoes_cfc(id,autoescola_id,nome_candidato,modulo,status,tipo_exame,origem) VALUES('audit-foreign-cfc','audit-school-other','Synthetic student','CFC','WAITING_SCHEDULING','COMMON','SCHOOL')");
  await pool.query("INSERT INTO solicitacoes_cnhbrasil(id,nome_candidato,modulo,status,tipo_exame,origem) VALUES('audit-cnh','Synthetic CNH student','CNH_BRASIL','WAITING_SCHEDULING','COMMON','MANUAL')");
  const {default:router}=await import('../../artifacts/api-server/src/routes/praticosys.js');
  const {sessionAuth}=await import('../../artifacts/api-server/src/middleware/session.js');
  const express=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('express');
  const app=express(); app.use(express.json()); app.use('/api',sessionAuth,router);
  server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server!.once('listening',resolve));
  const {port}=server!.address() as {port:number};
  const report=await observeSecurity(async(role,method,route,body)=>{
    const token=role?tokens.get(role)??'invalid-synthetic-token':undefined;
    const response=await fetch(`http://127.0.0.1:${port}/api/${route}`,{
      method,headers:{'Content-Type':'application/json','X-User-Role':'ADMIN','X-User-Id':'spoofed-admin',...(token?{Authorization:`Bearer ${token}`}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),
    });
    return{status:response.status,body:await response.json()};
  },'Express/PostgreSQL');
  await writeFile(new URL('../../security-audit/permissions-express.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(`Express/PostgreSQL: ${report.results.length} sanitized observations; real session middleware and foreign-record tests completed.`);
} finally{
  if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
  await pool.end();
}
