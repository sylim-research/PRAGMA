import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync} from 'node:fs';
process.loadEnvFile('../../.env');
const db=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const release=readFileSync('supabase/functions/_shared/contentRelease.ts','utf8').match(/id: "([^"]+)"/)[1];
assert.equal(new URL(process.env.VITE_SUPABASE_URL).hostname,'tlnjxagqwvefeqdagtkq.supabase.co');
const login=await db.auth.signInWithPassword({email:process.env.PRAGMA_BATCH_ADMIN_EMAIL,password:process.env.PRAGMA_BATCH_ADMIN_PASSWORD});
if(login.error)throw login.error;
try {
 assert.equal((await db.rpc('is_admin')).data,true);
 const rows=[];
 for(let offset=0;;offset+=200){
  const r=await db.from('scenarios').select('*')
   .eq('core_content->generation->>content_release_id',release).order('scenario_id').range(offset,offset+199);
  if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<200)break;
 }
 const requests=await Promise.all([
  db.from('curriculum_outlines').select('id,title,status,level,language_direction,course_mode,composition_theme_codes'),
  db.from('curriculum_weeks').select('id,outline_id,week_no,type,speech_act,scenario_slots'),
  db.from('curriculum_week_scenarios').select('id,outline_id,week_no,scenario_id,position'),
  db.from('content_review_runs').select('id,kind,target_id,content_hash,source_hash,approved_at,rules,openai_review,claude_review,adjudication'),
 ]);
 for(const r of requests)if(r.error)throw r.error;
 const report={checkedAt:new Date().toISOString(),release,rows,outlines:requests[0].data,weeks:requests[1].data,assignments:requests[2].data,reviews:requests[3].data};
 writeFileSync('.tmp/course-content-inventory.json',JSON.stringify(report));
 const group=rows.reduce((a,r)=>{const k=[r.learner_level,r.core_content.direction,r.mode,r.speech_act,r.mission_status??'core-only'].join('/');a[k]=(a[k]??0)+1;return a;},{});
 console.log(JSON.stringify({checkedAt:report.checkedAt,release,total:rows.length,native:rows.filter(r=>r.mission_content?.mpj_items?.length===5).length,
  approved:rows.filter(r=>r.mission_status==='reviewed').length,coverage:group,reviewCount:report.reviews.length}));
}finally{await db.auth.signOut({scope:'local'});}
