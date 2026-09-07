# PRAGMA 모델 배분 점검 · 2026-09-07

## 범위와 확인 근거

- 사용자 요청: 앱의 모든 모델 버전을 점검하고, 비용 증가를 감수할 때 콘텐츠 품질을 높일 업그레이드 후보를 판단한다. 이번 작업은 조사·권고이며 운영 모델 전환은 실행하지 않았다.
- [단독 진행 적합] 코드·기존 운영 기록의 읽기 전용 조사. 다른 모델에 신규 유료 검토를 요청하지 않았다.
- GitHub API로 확인한 main: `044dc6ba7b49c0ce23cef3fd44b6af1f06a84177` (PR #98). 조사 worktree의 `src/`·`supabase/` 트리는 이 main과 동일하다.
- 운영 조회: 2026-09-07 08:47 UTC부터. 기존 관리자 인증으로 `content-review`의 `inspect`만 호출하고 `llm_invocation_events`·`content_review_runs`의 기존 기록을 읽었다. 콘텐츠·검수·승인·편성 데이터를 쓰거나 API 공급자 키를 읽지 않았다.
- `inspect` HTTP 200의 현재 설정: OpenAI `gpt-4.1`, Claude `claude-opus-5`. 앞선 문답의 Claude 운영값 미확인 상태를 이번 조회로 해소했다.
- 전체 호출 장부 3,407행 중 최근 500행을 점검했다. 기간은 2026-09-04 15:28:45 UTC~09-07 05:36:11 UTC. 이는 호출 500회이지 미션 500개가 아니며, 전수 품질 평가도 아니다.
- 최근 50개 검수 행과 피드백·원자료 분석·구형 개요·코어 검수의 최신 기록을 별도로 읽었다. 원자료 분석·구형 개별 생성의 해당 장부 행은 0개였다. 이를 역사적으로 실행된 적이 없다는 증거로 일반화하지 않는다.
- 로컬 상세 메타데이터는 조사 worktree의 `tmp/model-audit/runtime-metadata.json`, `extra-metadata.json`에만 보관한다. 개인정보·학습자 응답·인증정보를 감사 문서에 포함하지 않았다.

## 현행 모델과 역할

| 역할 | 코드 요청 모델 | 운영 근거·확인 범위 |
| --- | --- | --- |
| 코어 상황·관계·원문 생성 | `gpt-4.1-mini` | 최근 500회 중 42회, 반환 `gpt-4.1-mini-2025-04-14` |
| 미션의 MJT·DCT·후보·해설 생성 | `gpt-4o` | 생성 189회, 수리 24회, 반환 `gpt-4o-2024-08-06` |
| 코어 수리·코어/미션 품질검사·후보 의미 검수 | `gpt-4.1` | 미션 critic 166회, 코어 수리 15회; 별도 코어 critic 최신 기록도 `gpt-4.1-2025-04-14` |
| 교수자 화면 OpenAI 검토·Claude 지적 재검토 | `gpt-4.1` | 운영 inspect와 저장된 검수 응답 `gpt-4.1-2025-04-14` |
| 선택적 독립 Claude 검토 | `claude-opus-5` | 운영 inspect 및 최근 실제 검수, effort `medium` |
| 문항 근거 연결 보조 | `gpt-4.1-mini` | 최근 500회 중 64회, 반환 `gpt-4.1-mini-2025-04-14` |
| 원자료 텍스트·이미지 분석 | `gpt-4.1-mini` | 코드 경로 존재. 해당 호출 장부 0행이므로 실사용 확인과 구분 |
| 구형 개요·개별 시나리오 생성 | `gpt-4.1-mini` | 개요 최신 반환 `gpt-4.1-mini-2025-04-14`; 개별 생성 해당 장부 0행 |
| 학습자 DCT 참고 피드백 | `gpt-4.1-mini` | 기록 26행, 최신 08-28 반환 `gpt-4.1-mini-2025-04-14`; 400/404에만 `gpt-4o-mini` 대체 |
| 학습자 녹음 전사 | `gpt-4o-transcribe` | main 코드 기준. 이번에 새 음성 전사를 실행하지 않음 |
| 원문 음성 합성 | ElevenLabs `eleven_multilingual_v2` | main 코드·당일 배포/사용자 청취 이력 기준. 이번에 새 음성 합성을 실행하지 않음 |
| 합성 장애 시 대체 | `gpt-4o-mini-tts` → `tts-1-hd` | 코드 기준. 마지막 대체는 400/404 호환 오류에만 시도 |

직접 호출하는 현행 AI 제공자는 OpenAI·Anthropic·ElevenLabs 세 곳이다. STT는 OpenAI에 포함된다. 앱 내부의 별도 Gemini·임베딩·이미지 생성 모델 호출은 조사 범위에서 발견하지 않았다. 문헌/HSK 규칙 검사와 주차 수업자료 조합은 별도 생성 모델이 아니다.

`youtube-transcript` Edge 소스에는 Supadata 통합이 남아 있다. 그러나 `AuthenticImportPanel.tsx:226`에 배포 미연결로 YouTube 자막 탭을 제거한 기록이 있고 현재 `src/` 호출부도 없다. 따라서 이를 현행 학습 미션의 네 번째 운영 AI로 세지 않는다. 남은 Edge 경로를 다시 연결한다면 기본 `auto`가 기존 자막 실패 시 AI 전사를 사용할 수 있으며, 앱은 그 내부 모델 버전을 지정하지 않는다.

주요 소스:

- `supabase/functions/_shared/openaiRequestContract.ts:1` — 공통 모델 배분, 대체 정책, 요청 구성
- `supabase/functions/generate-scenario/index.ts:85`, `3997`, `4249`, `4624`, `4697`, `4769`, `4933`, `4971` — 역할별 호출
- `supabase/functions/_shared/contentReviewProvider.ts:15` — effort, 출력 한도, 제한시간
- `supabase/functions/content-review/index.ts:36` — 운영 검수 설정
- `supabase/functions/stt/index.ts:9`; `_shared/ttsProvider.ts:35`; `_shared/ttsVoicePolicy.ts:5`
- `src/lib/curriculum/weeklyMaterials.ts:37` — 저장된 미션·주차 계획·설명 조합

## 판단

현재 모델 배분은 GPT-4 계열의 경량 생성·비추론 검수를 중심으로 한다. 역할 분리와 호출 근거 저장은 구현되어 있으나, 2026-09-07의 최신 고성능 모델과 실제 콘텐츠를 비교해 최상 품질임을 확인한 상태는 아니다. Codex에서 사용하는 개발 모델과 앱이 API로 호출하는 모델은 별개다.

업그레이드 우선순위는 (1) 코어 상황·원문 (2) 완전한 미션·해설 (3) 의미 검수다. 코어의 부자연스러운 인물·사건·권한 관계가 뒤 문항과 DCT에 영향을 주므로, Claude만 바꾸어서는 생성 출발점이 그대로 남는다. 다만 과거 결함의 원인을 모두 모델 버전 탓으로 돌리지는 않는다. 범용 역할 쌍 강제와 같은 프롬프트·보정 코드의 문제도 이미 확인·수정되었다.

최근 검수 50행 중 Claude 결과가 있는 6건은 모두 fail, 그중 OpenAI가 pass인 건은 4건이었다. 이는 선택된 표본의 판정 불일치이며 Claude의 정확도·우월성 수치가 아니다. 최신 기록에는 유효 수정안과 해설에서 인용한 표현의 불일치처럼 확인할 가치가 있는 지적이 있고, 조건절을 과잉 우회로 보는 판단이나 직접형 표현을 비문에 가깝다고 보는 지적처럼 교수자 판단이 필요한 부분도 있다. 지적 수·엄격함을 품질로 대체하면 안 된다.

## 권고 후보 — 아직 채택·배포하지 않음

| 작업 | 권고 후보 | 이유·제약 |
| --- | --- | --- |
| 코어·미션 생성 및 수리 | `gpt-6-astra` | 사용자의 품질 우선 예산을 반영한 최우선 비교 후보. 인물·사건·원문·판정·해설의 동시 정합성을 대상으로 확인 |
| 의미 검수·교수자 OpenAI 검토·재검토 | `gpt-6-astra` | 현재 `gpt-4.1` 대비 누락·근거 없는 지적을 비교. 생성과 같은 모델의 자기검토가 완전 독립이라고 주장하지 않음 |
| 추가 독립 검토 | `claude-fable-5-1` | 기존 Opus 결과와 비교할 후보. 다른 제공자·이전 판정 비공개를 유지하고 자동 승인 권한을 주지 않음 |
| 학습자 즉시 피드백 | `gpt-5.6-sol` | 질 높은 진단과 수업 중 응답시간을 함께 측정. low effort를 시작 후보로 삼되 현재 1,200토큰 출력 상한을 그대로 복사하지 않음 |
| 원자료 분석·근거 연결 보조 | `gpt-5.6-sol` | 실제로 사용하는 경로에서 순차 적용할 후보. 경로마다 더 많은 모델을 추가할 필요는 없음 |
| 녹음 전사 | 현재 유지, 후속 `gpt-transcribe` 비교 | 새 모델은 다국어·혼합언어 단서를 지원. 학습자의 오류·반복을 임의 교정하지 않는 축자성으로 평가해야 함 |
| 원문 음성 | `eleven_multilingual_v2` 유지 | 사용자가 선택한 목소리·언어별 속도 우선. `eleven_v3`는 표현력 비교 후보이나 정확한 원문·절제된 억양이 중요한 과업이라 최신 번호만으로 교체하지 않음 |

GPT-6 Astra의 `medium`을 콘텐츠 생성·검수 비교 시작점으로 제안하며, 어려운 판단에서 `high`의 추가 이득과 지연을 확인한다. 최고 effort를 모든 호출에 일괄 적용하지 않는다. Fable effort도 명시하되 동일 이름의 effort가 다른 모델에서 같은 계산량이나 품질을 뜻한다고 해석하지 않는다.

최소 후속 비교는 기존 문제 사례·정상 사례·다른 화행을 포함한 3~5개 동일 입력으로 한다. 개연성, 중국어/한국어 자연성, 의미 보존, P/D/R 근거, 판정·해설 정합성, 근거 없는 지적, 스키마 완결, 시간·비용을 함께 본다. 방향·모드·수준·화행 전체를 검증했다는 주장은 하지 않는다. 이번 조사에서는 이 신규 유료 비교를 실행하지 않았다.

## 비용과 호환성

2026-09-07 공식 일반 단가(100만 토큰당 입력/출력, 캐시·배치·세금 제외):

| 모델 | 입력 | 출력 |
| --- | ---: | ---: |
| GPT-4.1 mini | $0.40 | $1.60 |
| GPT-4o | $2.50 | $10 |
| GPT-4.1 | $2 | $8 |
| GPT-5.6 Sol | $4 | $20 |
| GPT-6 Astra | $10 | $50 |
| Claude Opus 5 | $5 | $25 |
| Claude Fable 5.1 | $10 | $50 |

최근 500회 장부의 입력은 1,892,456토큰, 출력은 223,491토큰이다. 동일한 토큰량을 가정하고 캐시 할인을 제외해 재산정하면 현행 혼합 모델 약 $5.70, 전부 Sol 약 $12.04, 전부 Astra 약 $30.10이다. 이는 단가 차이를 보여주는 계산이며 실제 청구액·월 예산·새 모델 작업비 예측이 아니다. 새 모델의 토큰화·추론량·재시도·생성 품질 및 수리 횟수 변화는 포함하지 않는다. Claude·음성 비용도 이 500회 표본에 포함되지 않는다.

예를 들어 모델 자체 기준 입력 20,000·출력 3,000토큰의 한 호출은 Sol $0.14, Astra/Fable 각각 $0.35다. 한 미션은 여러 번 호출될 수 있으며, 추론 토큰도 과금·출력 한도에 영향을 준다. 현재 OpenAI 자동 충전 월 $80과 Claude 월 사용 상한 $50을 전체 학기 비용 보장으로 해석하지 않는다.

모델명 치환만으로 끝낼 수 없는 확인 사항:

- Astra는 현재 코드가 항상 보내는 `temperature`를 지원하지 않는다. 지원되는 reasoning 설정과 출력 한도를 적용해야 한다. Chat Completions 자체는 사용 가능하므로 전체 API 구조 이전을 무조건 요구하지 않는다.
- 검수 OpenAI 경로는 `max_tokens:7000`·90초, Claude는 7,000·130초이다. 신규 추론 모델에 맞는 토큰 필드와 추론 포함 출력 예산·제한시간을 확인해야 한다. Fable은 기본 high·항상 활성 추론이다.
- 피드백의 `max_completion_tokens:1200`도 추론형 모델로 그대로 옮기면 사용자용 결과 예산이 부족할 수 있다.
- 현재 코어·미션의 일부 호출에는 명시적인 max completion 상한과 fetch timeout이 없다. 비싼 모델 전환 시 호출 단위의 합리적인 예산을 함께 정한다. 무제한 자동 재시도를 도입하지 않는다.
- 실제 계정의 신규 모델 접근 권한은 이번에 확인하지 않았다. 제공자 공식 모델 안내와 운영 계정 접근 가능성을 구분한다.
- 모델을 바꾸어도 기존 저장 미션·주차 자료·승인 기록은 바뀌지 않는다. 문제가 있는 콘텐츠는 새 버전 생성·검수·교수자 확정으로 교체해야 한다.
- 현행 생성계약 §5.1 등에 모델명이 명시되어 있으므로 실제 전환 시 코드·계약·프롬프트 스냅숏·연구 기록을 함께 갱신한다. 이번에는 기존 결정을 수정하지 않았다.

## 공식 출처

- [OpenAI 현행 모델 목록](https://developers.openai.com/api/docs/models)
- [GPT-6 Astra 사양·가격](https://developers.openai.com/api/docs/models/gpt-6-astra), [이전 시 호환성](https://developers.openai.com/api/docs/guides/latest-model)
- [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [GPT-4o](https://developers.openai.com/api/docs/models/gpt-4o), [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1)
- [GPT-Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe), [현행 GPT-4o Transcribe](https://developers.openai.com/api/docs/models/gpt-4o-transcribe)
- [Claude Fable 5.1 비교·가격](https://platform.claude.com/docs/en/models/fable-5-1/overview), [effort](https://platform.claude.com/docs/en/build-with-claude/effort)
- [ElevenLabs 모델 비교](https://elevenlabs.io/docs/overview/models)
- [Supadata transcript 모드](https://docs.supadata.ai/api-reference/endpoint/transcript/transcript)

## 종료 기록

- 앱 코드·모델 설정·데이터·배포 변경 없음. 신규 유료 생성·음성 호출 없음.
- 검증은 소스 대조, GitHub main 조회, 운영 inspect 및 기존 호출·검수 기록 조회, 공식 문서 확인에 한정했다. 코드 변경이 없어 테스트·build를 반복하지 않았다.
- dev-log: 이 문서. research-trail은 모델 정책의 채택·구현이 아직 없어 갱신하지 않았다. 채택 시 비교 결과와 함께 결정 근거를 남긴다.
- 논문 영향: 수치·운영 모델 버전 변경 없음 / 화면 변경 없음 / 프롬프트·계약 변경 및 동결본 재발행 없음.
