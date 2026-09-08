// Vite on 8102: VITE_SUPABASE_URL=https://pragma-week13.test with a dummy key.
// Real browser PDF extraction; in-memory API responses, never production writes.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:8102';
const output = '.tmp/source-teaching-smoke';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
let fixture, draft = null; const requests = [];
await page.addInitScript(() => sessionStorage.setItem('dev-stub-session', JSON.stringify({
  user_id: '10000000-0000-4000-8000-000000000001', email: 'source-studio@example.test', approval_status: 'approved', profile_completed: true,
})));
await page.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin === base) return route.continue();
  if (url.hostname !== 'pragma-week13.test') return route.abort();
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
  const resource = url.pathname.split('/').pop(); let data = [];
  if (resource === 'curriculum_outlines') data = req.headers().accept?.includes('vnd.pgrst.object') ? fixture.outline : [fixture.outline];
  if (resource === 'curriculum_weeks') data = fixture.weeks;
  if (resource === 'get_teaching_material_state') data = { current: true, draft };
  if (resource === 'teaching-materials') {
    const body = req.postDataJSON(); requests.push(body);
    const sources = body.config.sources.map(s => ({ id:s.id, label:`${s.label} · ${s.ref}`, text:s.text }));
    if (body.action === 'preview') data = { system:'Fixture prompt', user:JSON.stringify({sources}), model:'fixture', promptVersion:'source_teaching_v2',
      inputHash:'fixture-input', sourceHash:'fixture-source', characters:sources.reduce((sum,s)=>sum+s.text.length,0), sources:sources.map(s=>({...s,characters:s.text.length})) };
    else {
      const source = sources[0];
      const content = body.content ?? { sections:['concept','comparison','practice','faq'].map((key,index) => ({key,title:['요청의 선택권','표현 비교','짝 활동','예상 질문'][index],
        paragraphs:['브라우저 검증용 예시 자료입니다. 실제 AI 생성 결과가 아닙니다.'],items:['상대방이 거절할 수 있는 선택권을 비교해 보세요.'],source_ids:[source.id],evidence:[{source_id:source.id,quote:source.text.slice(0,100)}]})),
        instructor_notes:[{title:'교수자 진행',body:'검증용 교수자 메모',source_ids:[source.id]}] };
      draft = {id:'20000000-0000-4000-8000-000000000001',outline_id:fixture.outline.id,week_no:body.weekNo,revision:(draft?.revision??0)+1,
        kind:'lesson',source_config:body.config,sources,source_hash:'fixture-source',content,provenance:{model:'fixture',prompt_version:'source_teaching_v2'}};
      data = {current:true,draft};
    }
  }
  return route.fulfill({ status:200,contentType:'application/json',headers,body:JSON.stringify(data) });
});
try {
  await page.goto(base);
  fixture = await page.evaluate(async () => {
    const { createStandard15WeekTemplate } = await import('/src/lib/curriculum/template.ts');
    const { createEmptyOutlineDraft, outlineDraftToInsert, weekDraftToInsert } = await import('/src/lib/curriculum/mappers.ts');
    const outline = {...outlineDraftToInsert(createEmptyOutlineDraft()),id:'10000000-0000-4000-8000-000000000002',title:'검증용 한중 화용 수업',
      level:'intermediate',language_direction:'ko_zh',course_mode:'mixed',status:'draft'};
    return {outline,weeks:createStandard15WeekTemplate().map(w=>({...weekDraftToInsert(w,outline.id),id:`week-${w.week_no}`}))};
  });
  const pdfPage = await browser.newPage();
  await pdfPage.setContent('<html><meta charset="utf-8"><h1>검증용 요청 자료</h1><p>요청은 상대방의 선택권을 남길 수 있습니다.</p><p>“가능하시면 자료를 보내 주시겠어요?”와 “자료를 보내 주세요.”의 관계와 부담을 비교합니다.</p></html>');
  const pdf = await pdfPage.pdf(); await pdfPage.close();
  await page.goto(`${base}/admin/teaching-generator?courseId=${fixture.outline.id}&weekNo=2`);
  const previewButton = page.getByRole('button',{name:'생성 내용 확인',exact:true});
  await expect(previewButton).toBeDisabled();
  await page.getByLabel('pdf 파일').setInputFiles({name:'검증용-요청자료.pdf',mimeType:'application/pdf',buffer:pdf});
  const sourceText = page.getByLabel('생성에 사용할 원문');
  await expect(sourceText).toHaveValue(/상대방의 선택권/);
  expect(await sourceText.inputValue()).toContain('[PDF 1쪽]');
  await expect(previewButton).toBeDisabled();
  await page.getByRole('button',{name:'원문·출처 확인 완료'}).click();
  await expect(previewButton).toBeEnabled();
  await previewButton.click();
  await expect(page.getByRole('button',{name:'초안 생성',exact:true})).toBeEnabled();
  await page.getByLabel('강조할 내용 · 선택').fill('선택권과 부담을 비교');
  await expect(page.getByRole('button',{name:'초안 생성',exact:true})).toHaveCount(0);
  await previewButton.click();
  await page.getByRole('button',{name:'초안 생성',exact:true}).click();
  await expect(page.getByRole('heading',{name:'요청의 선택권',exact:true})).toBeVisible();
  expect(requests.at(-1).config.missionIds).toEqual([]);
  await page.getByRole('button',{name:'초안 편집',exact:true}).click();
  await page.getByLabel('설명 · 한 줄에 한 문단').first().fill('교수자가 원문을 대조하고 수정한 설명입니다.');
  await page.getByRole('button',{name:'수정본 저장',exact:true}).click();
  await page.reload();
  await expect(page.getByText('교수자가 원문을 대조하고 수정한 설명입니다.',{exact:true})).toBeVisible();
  await expect(page.getByText('원문 확인됨',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:/주차에서 검토·활용/})).toHaveAttribute('href',new RegExp('/admin/package\\?courseId=.*weekNo=2'));
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`${output}/desktop.png`,fullPage:true});
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`).toBe(true);
    if (width === 390) await page.screenshot({path:`${output}/mobile.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'텍스트·전사문',exact:true}).click();
  await page.getByRole('button',{name:'텍스트 소스 추가'}).click();
  await expect(previewButton).toBeDisabled();
  await page.getByLabel('출처 · 저자·연도·쪽수 또는 주소').fill('영상 전사문 검증 출처');
  await sourceText.fill('확인한 자막을 직접 입력한 검증 자료입니다.');
  await page.getByRole('button',{name:'원문·출처 확인 완료'}).click();
  await expect(previewButton).toBeEnabled();
  expect(errors).toEqual([]);
  const result={status:'PASS',data:'Synthetic sources and in-memory API; real PDF text extraction',checks:['source confirmation gate','actual PDF extraction','no mission required','preview invalidation','generate/edit/reload','saved source restoration','package link','390/768/1280 responsive widths','text transcript with attribution'],requests:requests.map(r=>r.action)};
  await writeFile(`${output}/result.json`,JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} catch(error) {
  await page.screenshot({path:`${output}/failure.png`,fullPage:true});
  console.log((await page.locator('body').innerText()).slice(-5000)); throw error;
} finally { await browser.close(); }
