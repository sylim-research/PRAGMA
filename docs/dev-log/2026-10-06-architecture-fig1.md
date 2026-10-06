# Architecture page aligned with README Fig. 1 · 2026-10-06

- `/architecture` now shows only the workflow figure from README Fig. 1: content production, class operation, and translation/interpreting learning lanes, the two connectors (approval → scheduling, release to learners), and the trace-record line. Step names match the README figure.
- Steps are numbered circles joined by one vertical line; every step in a lane has the same style (no dashed/filled distinctions). Lane headers use a light tint with a colored top band (navy, slate, yellow); connectors are drawn heavier than in-lane lines.
- Each step has a one-line description. The class-operation lane has five steps (learner management added from the previous page); the review step is labelled `AI 교차 검토`; the last learning step is `학습자 최종 결정`.
- The two workflow lanes (content production, learning) have a slightly deeper header tint, thicker top band, and larger title than the class-operation lane.
- The header uses the shared PRAGMA brand; the page title is the Fig. 1 heading.
- Validation: `npm run typecheck`; local checks at 1440×900 and 1280×720 (no scroll, equal lane heights).
