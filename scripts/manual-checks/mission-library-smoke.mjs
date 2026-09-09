// Run from this worktree with Vite on 8099 and VITE_SUPABASE_URL=https://pragma-library.test.
// Synthetic API only; all external requests are blocked. No production writes or AI calls.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:8099';
const output = '.tmp/mission-library-smoke';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [], writes = [], pages = [];
page.on('pageerror', error => errors.push(error.message));
let fixture, assignments = [], failNextPage = false;
await page.addInitScript(() => sessionStorage.setItem('dev-stub-session', JSON.stringify({
  user_id: '10000000-0000-4000-8000-000000000001', email: 'library@example.test', approval_status: 'approved', profile_completed: true,
})));
await page.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin === base) return route.continue();
  if (url.hostname !== 'pragma-library.test') return route.abort();
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
  const resource = url.pathname.split('/').pop(); let data = [];
  if (req.method() !== 'GET') writes.push({ resource, method: req.method(), body: req.postDataJSON() });
  if (resource === 'scenarios' && fixture) {
    const id = url.searchParams.get('scenario_id')?.replace(/^eq\./, '');
    if (id) data = fixture.rows.find(row => row.scenario_id === id) ?? null;
    else {
      const from = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1000);
      pages.push(from);
      if (failNextPage && from >= 500) return route.fulfill({status:500,headers,contentType:'application/json',body:JSON.stringify({message:'검증용 후속 페이지 실패'})});
      data = fixture.rows.slice(from, from + Math.min(limit, 1000));
    }
  }
  if (resource === 'curriculum_outlines' && fixture) {
    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    if (req.method() === 'PATCH') Object.assign(fixture.outlines.find(item => item.id === id), req.postDataJSON());
    data = id ? fixture.outlines.find(item => item.id === id) : fixture.outlines;
  }
  if (resource === 'curriculum_weeks' && fixture) {
    const id = url.searchParams.get('outline_id')?.replace(/^eq\./, '');
    data = fixture.weeks.filter(week => week.outline_id === id);
  }
  if (resource === 'curriculum_week_scenarios') {
    if (req.method() === 'POST') assignments = req.postDataJSON().map((item, i) => ({...item,id:`assignment-${i}`}));
    data = assignments;
  }
  return route.fulfill({ status:200, contentType:'application/json', headers, body:JSON.stringify(data) });
});

try {
  await page.goto(base);
  fixture = await page.evaluate(async () => {
    const { SAMPLE_MISSION_V5_NATIVE } = await import('/src/lib/mission/missionV4Sample.ts');
    const { CURRENT_CONTENT_RELEASE_ID } = await import('/supabase/functions/_shared/contentRelease.ts');
    const { createStandard15WeekTemplate } = await import('/src/lib/curriculum/template.ts');
    const { createEmptyOutlineDraft, outlineDraftToInsert, weekDraftToInsert } = await import('/src/lib/curriculum/mappers.ts');
    const make = (id, status, situation, mode = 'translation') => ({
      scenario_id:id,content_format:'scenario_core_v1',speech_act:'request',learner_level:'intermediate',domain:'daily',mode,
      review_status:'approved',mission_status:status,mission_schema_version:status?'mission_v5':null,
      mission_mpj_items:status?SAMPLE_MISSION_V5_NATIVE.mpj_items:null,mission_content:status?SAMPLE_MISSION_V5_NATIVE:null,
      core_content:{situation_ko:situation,direction:'ko_zh',source_text:'검증용 원문',generation:{content_release_id:CURRENT_CONTENT_RELEASE_ID}},
    });
    const outlines = ['course-ok','course-mismatch'].map((id,i) => ({...outlineDraftToInsert(createEmptyOutlineDraft()),id,
      title:i?'검증용 고급 수업':'검증용 중급 수업',level:i?'advanced':'intermediate',language_direction:'ko_zh',course_mode:'mixed',
      composition_theme_codes:[],target_interpreting_week_count:0,status:'draft',scenarios_per_week:2}));
    const rows = Array.from({length:1001},(_,i)=>make(`material-${i}`,null,`검증용 시나리오 재료 ${i}`));
    rows.push(make('ready-translation','reviewed','동료에게 회의 자료를 부탁합니다. 전달 기한과 상대방의 선택권을 함께 고려합니다.'),
      make('ready-interpreting','released','행사 안내 데스크에서 일정 변경을 요청합니다. 담당자에게 변경 사유를 간결하게 전합니다.','stt_interpreting'),
      make('pending','generated','교수자 승인을 기다리는 검증용 미션입니다.'),
      {...make('old','reviewed','과거 사용 범위의 검증용 미션입니다.'),core_content:{situation_ko:'과거 사용 범위의 검증용 미션입니다.',direction:'ko_zh'}});
    return { rows,outlines,weeks:outlines.flatMap(outline=>createStandard15WeekTemplate().map(w=>({
      ...weekDraftToInsert(w,outline.id),id:`${outline.id}-${w.week_no}`,
    }))) };
  });
  await page.goto(`${base}/admin/library`);
  await expect(page.getByRole('button',{name:'편성 가능 미션 2',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(pages).toContain(1000);
  await expect(page.getByRole('link',{name:'학습 미션 라이브러리',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'시나리오 재료 1001',exact:true})).toBeVisible();
  await page.screenshot({path:`${output}/desktop.png`,fullPage:true});
  const card = page.locator('li').filter({hasText:'동료에게 회의 자료를 부탁합니다.'});
  await card.getByRole('link',{name:'수업에 편성 →',exact:true}).click();
  await expect(page).toHaveURL(/composer\?scenarioId=ready-translation$/);
  await page.getByRole('combobox',{name:'교과목 선택'}).selectOption('course-mismatch');
  await expect(page.getByRole('region',{name:'라이브러리에서 선택한 미션'})).toContainText('현재 교과목 조건과 남은 자리에 맞는 주차가 없습니다');
  await page.getByRole('combobox',{name:'교과목 선택'}).selectOption('course-ok');
  await expect(page).toHaveURL(/scenarioId=ready-translation&outline=course-ok/);
  await page.reload();
  await expect(page.getByRole('button',{name:'2주차에 추가',exact:true})).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole('button',{name:'2주차에 추가',exact:true}).click();
  await expect(page.getByRole('region',{name:'라이브러리에서 선택한 미션'})).toContainText('현재 교과목 편성에 포함');
  expect(writes).toEqual([]);
  await page.screenshot({path:`${output}/composer.png`,fullPage:true});
  await page.getByRole('button',{name:'편성 저장',exact:true}).click();
  await expect.poll(()=>assignments.length).toBe(1);
  expect(assignments[0]).toMatchObject({outline_id:'course-ok',week_no:2,scenario_id:'ready-translation'});
  await page.reload();
  await expect(page.getByRole('region',{name:'라이브러리에서 선택한 미션'})).toContainText('현재 교과목 편성에 포함');
  await page.goto(`${base}/admin/library`);
  await expect(page.getByText('1곳에 편성됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'승인 전 미션 1',exact:true}).click();
  await expect(page.getByRole('link',{name:'감수·승인 확인 →'})).toHaveAttribute('href','/admin/review?scenarioId=pending');
  await page.getByRole('button',{name:'시나리오 재료 1001',exact:true}).click();
  await expect(page.getByRole('link',{name:'이 재료로 조립 →'}).first()).toHaveAttribute('href','/admin/assembly?scenarioId=material-0');
  await page.getByRole('button',{name:'편성 가능 미션 2',exact:true}).click();
  const previewCard = page.locator('li').filter({hasText:'행사 안내 데스크에서 일정 변경을 요청합니다.'});
  await previewCard.getByRole('button',{name:'미션 보기 ▾',exact:true}).click();
  await expect(previewCard.getByRole('button',{name:'미션 접기 ▴',exact:true})).toBeVisible();
  await expect(previewCard).toContainText('첫인상 판단');
  await expect(previewCard).toContainText('산출 과제');
  await previewCard.getByRole('button',{name:'미션 접기 ▴',exact:true}).click();
  for(const width of [390,768,1280]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`overflow at ${width}`).toBe(true);
    if(width===390) await page.screenshot({path:`${output}/mobile.png`,fullPage:true});
  }
  failNextPage = true;
  await page.reload();
  await expect(page.getByText(/검증용 후속 페이지 실패/)).toBeVisible();
  await expect(page.getByRole('button',{name:'편성 가능 미션 —',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
  const result = {status:'PASS',data:'Synthetic API; real local browser',checks:['pagination beyond 1000','default release and MJT5 eligibility',
    'mission-ID handoff','course mismatch excluded','ID retained after course choice and reload','explicit add then explicit save','save and reload round trip',
    'assignment count','pending/material routing','released mission preview','390/768/1280 overflow','later-page failure hides counts'],writes};
  await writeFile(`${output}/result.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} catch(error) {
  await page.screenshot({path:`${output}/failure.png`,fullPage:true});
  console.log((await page.locator('body').innerText()).slice(-2500)); throw error;
} finally { await browser.close(); }
