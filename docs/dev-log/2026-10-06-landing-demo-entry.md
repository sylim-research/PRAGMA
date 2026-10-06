# Landing: demo entry emphasis · 2026-10-06

- Layout unchanged. While the demo is public (`IS_DEMO`), the representative mission link is the only filled yellow button, labelled `학습 미션 체험` with a `로그인 없이` tag; the arrow-only hover keeps its color.
- `전체 구조 보기` uses a navy fill; both secondary links share one width (240 px on sm+) so their gap sits on the cards' center line, with 14 px bold text and 1.5 px ink borders.
- Card buttons are outlined while the demo is public (`학습 시작하기` renamed `학습자 로그인`) and invert to ink on hover; without `IS_DEMO` they return to the previous filled styles.
- The main block is vertically centered between header and footer (the extra viewport-based top padding was removed). The footer shows only the copyright line.
- Validation: `npm run typecheck`; local browser checks at 1440×900, 1280×720 (no scroll), and 375 px.
