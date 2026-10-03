# HSK 3.0 reference data

HSK 3.0 vocabulary and topic references with their provenance; used only as a non-blocking reference ceiling, not as a proficiency equivalence.

이 디렉터리는 PRAGMA가 사용하는 HSK 3.0 참고 데이터의 provenance 경계를 보존한다.
HSK 급수와 PRAGMA 학습자 수준을 숙달도 등가로 해석하지 않는다. HSK 값은 생성된 중국어의
누적 어휘 참고 상한과 비차단 사후감사에만 사용한다.

## 층위

```text
공식 PDF
  -> source/hsk3_vocab_extracted.csv
  -> source/hsk3_topics_extracted.csv
     -> derived/hsk3_topics_raw.csv             공식 전사
     -> derived/hsk3_topic_derivations.csv      결정론 파생
     -> derived/pragma_hsk_topic_mappings.csv   연구자 코딩의 legacy import
        -> supabase/seed/hsk3_reference_seed.sql
```

- **`source/`의 두 CSV와 `supabase/seed/hsk3_reference_seed.sql`도 Git에서 제외한다**
  (공식 대강의 축자 전사이므로 재배포하지 않는다). 로컬 파일은 유지되며, 무엇을
  근거로 썼는지는 `source-manifest.json`의 sha256·행 수·독립 감사 결과로 대조한다.
  이 때문에 새로 clone한 환경에서는 `npm run hsk3:build`·`hsk3:audit`가 동작하지 않는다.
- 공식 PDF 자체는 Git에 넣지 않는다. 공식 URL, SHA-256과 외부 증거 보관 위치는
  `source-manifest.json`에 기록한다.
- `source/`의 두 CSV는 기존 추출본을 해시 그대로 보존한 입력이다. 원 추출 실행 스크립트는
  남아 있지 않으므로 이 한계를 숨기지 않는다.
- `derived/`와 seed SQL은 `npm run hsk3:build`로 다시 만든다.
- `npm run hsk3:audit`는 source hash, 행 수, 등급 분포, 복합키, 주제 층위 분리를 검증한다.

## 연구자 코딩 상태

기존 `axis`, `scope`, `app_domain`, `state_framed` 값은 삭제하지 않고 별도 mapping 파일로
옮긴다. 다만 원 코더·코딩 시점·코딩 지침이 보존되지 않았으므로
`legacy_imported_unverified`로 표시한다. `selection_status`는 모두 `unreviewed`이며,
PRAGMA 장면 채택·제외 판단으로 자동 변환하지 않는다.

`open_ended`는 연구자 판단이 아니라 L3 문자열 끝의 `等` 표지 관찰이다. 파생 파일에서는
`has_explicit_open_marker`로 이름을 바꾸며 `false`를 폐쇄 목록으로 해석하지 않는다.

## DB 반영 경계

신규 migration은 스키마와 읽기 정책만 만든다. 11,000행 seed 적용, Edge 배포와 운영 검증은
별도 승인 뒤 수행한다. 기존 `public.hsk_vocab` 및 적용된 과거 migration은 수정하지 않는다.
