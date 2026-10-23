// Requires local PostgreSQL binaries. Runs on a private Unix socket, never the
// linked project. Reintroducing a child-only profile lock must fail this test.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../..',import.meta.url));
const migrations=join(root,'supabase/migrations');
const files=process.argv[2]?[process.argv[2]]:readdirSync(migrations).sort().map(file=>join(migrations,file));
let profile;
for(const file of files){
  const matches=[...readFileSync(file,'utf8').matchAll(/create or replace function public\.mb_profile\([\s\S]*?end \$\$;/gi)];
  if(matches.length)profile=matches.at(-1)[0];
}
assert.ok(profile,'No mb_profile migration found');
const bin=process.env.PG_BIN||execFileSync('pg_config',['--bindir'],{encoding:'utf8'}).trim();
const directory=mkdtempSync(join(tmpdir(),'mb-profile-race-'));
const data=join(directory,'data');
const env={...process.env,PGHOST:directory,PGPORT:'5432',PGUSER:'postgres',PGDATABASE:'postgres'};
const psqlArgs=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
const sql=query=>execFileSync(join(bin,'psql'),[...psqlArgs,'-c',query],{env,encoding:'utf8'}).trim();
const sessions=[];
const start=query=>{
  const child=spawn(join(bin,'psql'),[...psqlArgs,'-c',query],{env,stdio:['ignore','pipe','pipe']});
  let output='',errors='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>errors+=data);
  const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve({code,output,errors}));});
  sessions.push({child,done});return done;
};
const waitUntil=async(query,predicate)=>{
  for(let attempt=0;attempt<100;attempt++){
    const value=sql(query);if(predicate(value))return value;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw new Error('A controlled PostgreSQL session did not reach its test boundary');
};
let running=false;
try{
  execFileSync(join(bin,'initdb'),['-D',data,'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
  execFileSync(join(bin,'pg_ctl'),['-D',data,'-l',join(directory,'server.log'),'-o',`-k ${directory} -h '' -p 5432 -F`,'-w','start'],{stdio:'pipe'});running=true;
  // Match the real parent/child constraints, including authored asset ownership.
  sql(`create schema auth;create schema extensions;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,
      name text not null,is_operator boolean not null default false,suspended boolean not null default false,created_at timestamptz default now());
    create table public.assets(id uuid primary key,owner_id uuid references auth.users(id) on delete set null);
    ${profile}
    insert into auth.users values('00000000-0000-4000-8000-000000000001');
    select public.mb_profile('00000000-0000-4000-8000-000000000001');`);
  const gate=start("set application_name='mb_race_gate';select pg_advisory_lock(72401);select pg_sleep(20);");
  await waitUntil("select count(*) from pg_stat_activity where application_name='mb_race_gate' and wait_event='PgSleep'",value=>value==='1');
  const writer=start(`set application_name='mb_race_writer';begin;set local statement_timeout='6s';
    select public.mb_profile('00000000-0000-4000-8000-000000000001');
    select pg_advisory_xact_lock(72401);
    insert into public.assets values('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001');commit;`);
  await waitUntil("select count(*) from pg_stat_activity where application_name='mb_race_writer' and wait_event_type='Lock'",value=>value==='1');
  const deletion=start("set application_name='mb_race_delete';set statement_timeout='6s';delete from auth.users where id='00000000-0000-4000-8000-000000000001';");
  // Either the deletion has committed, or it is blocked by the bad child lock.
  await waitUntil("select (not exists(select 1 from auth.users)) or exists(select 1 from pg_stat_activity where application_name='mb_race_delete' and wait_event_type='Lock')",value=>value==='t');
  sql("select pg_cancel_backend(pid) from pg_stat_activity where application_name='mb_race_gate'");await gate;
  const [writeResult,deleteResult]=await Promise.all([writer,deletion]);
  assert.doesNotMatch(writeResult.errors+deleteResult.errors,/40P01|deadlock detected/,'Profile resolution must not deadlock a dependent insert against Auth deletion');
  assert.equal(deleteResult.code,0,'Account deletion must complete');
  assert.equal(writeResult.code,1,'A deleted actor cannot create an asset');
  assert.match(writeResult.errors,/23503/,'The real ownership foreign key must reject a deleted parent');
  assert.equal(sql('select count(*) from auth.users'),'0');
  assert.equal(sql('select count(*) from public.assets'),'0');
  sql(`do $$begin
    perform public.mb_profile('00000000-0000-4000-8000-000000000001');
    raise exception 'Deleted actor unexpectedly resolved';
    exception when sqlstate 'PT401' then if sqlerrm<>'AUTH_REQUIRED' then raise;end if;
  end $$;`);
  console.log('PASS: profile resolution, concurrent Auth deletion and a real dependent insert do not deadlock; deleted actors are rejected.');
}finally{
  for(const {child} of sessions)if(child.exitCode===null)child.kill('SIGTERM');
  await Promise.allSettled(sessions.map(({done})=>done));
  if(running)execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});
  rmSync(directory,{recursive:true,force:true});
}
