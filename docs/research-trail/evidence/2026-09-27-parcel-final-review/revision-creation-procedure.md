# 최종 후보의 새 revision 생성 절차 — 아직 실행하지 않음

> **후속 최종 상태 (2026-09-27 KST):** 아래는 준비 당시 절차다. pending v4 등록 후 연구자가 정상 최종화 metadata에 따른 새 hash를 허용했다. 별도 scenario `051532cc-c3a2-4440-9a5e-efc54e9ac481`의 최종 승인·지정 편성 교체까지 완료했다. [실행 기록](revision-registration.md), [승인·편성·읽기 결과](revision-release-result.json)를 따른다. 아래 INSERT를 다시 실행하지 않는다.

## 입력과 경계

- 파일: 같은 폴더의 `local-revision-candidate.json` 및 `revision-manifest.json`.
- 최종 후보 hash: `6254e9f9b2c5841e5d1304fb52628f1bbaadc7702adb22b1e25799e716cb34af`.
- 기준: scenario `3da0c62d-e91f-4f68-9b74-28cd9d42f044`, v3 `980571d6-8852-48c4-9cde-233713360b5f`, 승인 hash `bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095`.
- 목적: 기존 `mission_lineage_versions`에 교수자 재승인을 기다리는 **generated snapshot 한 건**을 추가한다. `scenarios`의 현재 승인 콘텐츠와 `curriculum_week_scenarios`는 건드리지 않는다.
- 이 문서는 실행 절차다. 이번 작업에서는 DB revision을 생성하지 않았다. DB version 번호/ID는 아직 없으며 v4 생성 완료로 표현하지 않는다.

## 기존 RPC를 사용하지 않는 이유

`save_generated_mission_revision`은 `mission_status='generated'` 행만 대상으로 현재 `scenarios.mission_content`를 UPDATE한다. 지금의 reviewed v3를 generated로 되돌려 호출하지 않는다. `supersede_generated_mission_for_rework`도 원본을 반려/archived 상태로 바꾸므로 사용하지 않는다.

이번 준비 범위는 승인 미션의 현재본 교체가 아니라 append-only pending snapshot 생성이다. 저장소 migration `20260814205000_mission_lineage_versions.sql`의 관리자 INSERT 정책으로 이력 한 건만 추가할 수 있다. 생성된 pending snapshot은 자동으로 교수자 승인 화면의 현재본이나 learner 실행본이 되지 않는다. 이 단계와 이후 새 hash에 대한 교수자 승인·활성화 절차를 구별한다.

## 실제 생성이 승인된 다음 실행 순서

1. 현재의 관리자 Supabase 세션을 사용한다. 별도 learner 세션이나 토큰을 복사하지 않는다.
2. 파일의 schema/hash를 다시 바꾸지 않은 채 확인하고, 기존 reviewed v3와 지정 assignment가 그대로인지 읽는다. 최신 lineage가 여전히 v3인지 확인한다. 이미 같은 hash의 pending row가 있거나 최신 버전이 달라졌다면 INSERT하지 않고 그 상태를 먼저 확인한다.
3. 아래처럼 **이력 테이블에만 INSERT**한다. `.upsert`, 기존 v3 UPDATE, scenario 상태 변경, 편성 변경은 사용하지 않는다.
4. 반환된 id/version/hash/stage를 같은 관리자 세션으로 재조회한다. 새 행의 stage가 generated이고 `reviewed_by`, `reviewed_at`, `ai_quality_result`, `item_lineage` 열은 null인지 확인한다. 기존 v3·현재 scenario·assignment가 동일한지도 확인한다.
5. 여기서 정지한다. 새 해시에 대한 교수자 승인은 별도로 필요하다. 과거 품질 점검, finalized_at, approval_basis, review run을 자동 승계하지 않는다.

다음은 기존 관리자 세션의 `db` 클라이언트와 위 두 JSON 파일을 로드한 `candidate`, `manifest`를 입력으로 사용하는 정확한 다음 DB 작업이다. **현재 실행하지 않는다.**

```javascript
const { data: auth, error: authError } = await db.auth.getUser();
if (authError || !auth.user) throw new Error('관리자 인증 확인 실패');

const { data: current, error: currentError } = await db.from('scenarios')
  .select('scenario_id,mission_status,mission_content')
  .eq('scenario_id', manifest.scenario_id).single();
if (currentError || current.mission_status !== 'reviewed'
    || current.mission_content.provenance.mission_content_hash !== manifest.old_hash)
  throw new Error('기준 v3 변경: INSERT 중단');

const { data: parent, error: parentError } = await db.from('mission_lineage_versions')
  .select('id,version_no,stage,mission_content_hash,realization_pack_id,realization_pack_version,coverage_status,rule_scope_ids,risk_scope_ids,evidence_scope_ids')
  .eq('scenario_id', manifest.scenario_id)
  .order('version_no', { ascending: false }).limit(1).single();
if (parentError || parent.id !== manifest.parent_version_id
    || parent.version_no !== 3 || parent.stage !== 'reviewed'
    || parent.mission_content_hash !== manifest.old_hash)
  throw new Error('기준 lineage 변경 또는 기존 pending 존재: INSERT 중단');
if (candidate.provenance.mission_content_hash !== manifest.candidate_hash
    || manifest.candidate_hash !== '6254e9f9b2c5841e5d1304fb52628f1bbaadc7702adb22b1e25799e716cb34af'
    || candidate.quality_check || candidate.authoring || candidate.hsk_lexical_audit
    || candidate.provenance.finalized_at)
  throw new Error('최종 후보 또는 미승인 상태 불일치');

const pendingId = crypto.randomUUID();
const row = {
  id: pendingId,
  scenario_id: manifest.scenario_id,
  version_no: parent.version_no + 1,
  parent_version_id: parent.id,
  stage: 'generated',
  mission_content: candidate,
  mission_content_hash: manifest.candidate_hash,
  item_lineage: null,
  realization_pack_id: parent.realization_pack_id,
  realization_pack_version: parent.realization_pack_version,
  coverage_status: parent.coverage_status,
  rule_scope_ids: parent.rule_scope_ids,
  risk_scope_ids: parent.risk_scope_ids,
  evidence_scope_ids: parent.evidence_scope_ids,
  generation_provider: null,
  generation_model: null,
  prompt_version: null,
  prompt_snapshot_hash: null,
  prompt_instance_hash: null,
  generation_attempt: null,
  validation_result: {
    result: 'pass',
    scope: 'local_schema_hash_and_authorized_diff_only',
    allowed_field_count: 9,
    outside_allowed_semantic_diff: 0,
    professor_approval: 'pending',
    current_scenario_unchanged: true,
    source_version_id: parent.id,
    inherited_content_provenance_and_item_lineage: 'source_ancestry_only_not_new_review',
  },
  ai_quality_result: null,
  actor_id: auth.user.id,
  reviewed_by: null,
  reviewed_at: null,
};
const { data: created, error } = await db.from('mission_lineage_versions')
  .insert(row).select('id,version_no,parent_version_id,stage,mission_content_hash').single();
if (error) throw error; // unique 충돌/응답 유실 시 무조건 재삽입하지 않는다.
```

응답이 유실되면 동일 `pendingId`와 scenario/hash로 먼저 재조회한다. `(scenario_id, version_no)` unique 충돌은 동시 변경으로 보고 중단한다. 새로운 버전 번호를 임의로 올려 재시도하지 않는다. 실제 INSERT와 상태 확인은 해당 작업의 승인 후 수행한다.

candidate 내부의 기존 generation provenance와 item_lineage 자료는 원자료 출처로 남아 있다. 새 검토 통과나 새 item attribution 완료를 뜻하지 않으며, 새 행의 품질·승인·item_lineage 열에는 승계하지 않는다. 이후 finalized payload 준비로 hash가 달라지면 이 후보 hash에 대한 승인으로 대체하지 않고 최종 hash를 다시 명시해야 한다.

## 이후 운영 검증 경계

과거 저장 실패는 추가 조사하지 않는다. 새 release가 승인·배포된 뒤 대표 미션의 저장 성공과 재조회로 해당 버전을 검증한다. 다시 실패할 때에만 앞서 정리한 Network Preserve Log/실제 payload/DB 응답 증거 절차를 적용한다.
