# Brand colours: navy, yellow, cream only — 2026-10-07

Decision (researcher): keep the PRAGMA brand language (navy #15202B, yellow #FAD338, cream background) and remove the cobalt blue introduced for demo entry and selection. Static side-by-side mockups of the landing and mission briefing were reviewed before implementation.

Colour rule applied: navy fill = the one forward action on a screen; navy outline or text link = secondary navigation; yellow fill = learner decisions; selected state = navy fill with white text (as the existing step numbers already do).

Changes
- Landing (public demo mode only): "전체 구조 보기" moved to the right side of the header as a text link. "학습 미션 체험" stays below the role cards as the single navy-filled action. Role-card entries ("학습자 로그인", "제작·승인하기") become arrow text links. Non-demo mode keeps its filled card buttons.
- Demo mission selector: four separate boxes → one segmented control; the selected mission is navy-filled.
- Mission briefing card: header band and row dividers removed; the two activity lists are separated by a single vertical rule on desktop (down arrow kept on narrow screens); start button navy.
- Step bar: "DCT" pill outline, focus ring and hover moved from blue to navy; demo record step labels moved from blue to neutral beige.
- Unchanged: the messenger-style blue (#326BD6) for "다른 맥락에서는?" bubbles and word hints (separate 2026-10-01 decision).

Validation: `npm run typecheck` passed; 12 test files / 71 tests passed (mission runner, mission components, landing). Checked at 1366×800 and 390×760.
