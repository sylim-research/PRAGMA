# Landing CTA refinement and consistent demo labels

- Removed the white pill background, radius, and padding from the landing page's `로그인 없이` qualifier; retained the text at medium weight.
- Previewed #22364D globally, then restored the original colors after the user rejected its stronger blue appearance.
- Applied a subtler #15202B -> #192634 adjustment to existing brand-color literals and aligned foreground/primary tokens to 211 35% 15%. Changes affect 68 source files, including existing generated-document styles. Unrelated pre-existing mission-runner changes were preserved.
- Local browser at port 8107 confirms header and architecture CTA use rgb(25, 38, 52); the qualifier has transparent background and zero padding. No production deployment.
- Typecheck passed for the initial color/qualifier change; the subsequent revision changes color literals only.
- Research-trail not updated: visual styling only; no learning design, content, prompts, or contracts changed.
- The user approved publishing the final UI on 2026-10-06. The original navy is retained; all color experiments have been reverted.
- Follow-up: removed the landing-page architecture CTA and centered the remaining yellow mission-demo CTA. The architecture route itself remains available. Removed its unused icon import and button styling.
- User review restored the paired yellow demo/navy architecture CTAs. Added a 1px, 50%-opacity navy underline with a 3px offset to the plain `로그인 없이` qualifier; no pill background.
- Final user decision: restored the original #15202B navy and original global tokens across all 68 affected files. Only the landing-page qualifier styling and paired-CTA markup cleanup remain from this session. Browser verification confirms rgb(21, 32, 43), transparent qualifier background, 1px underline and 3px offset. Existing mission-runner edits remain untouched.
- Standardized user-visible links to the mission demo as `학습 미션 체험` across the architecture page, admin shell, and profile demo return link, matching the landing page. Internal explanatory comments and mission identifiers are unchanged.
- Added the architecture page's PlayCircle icon to the landing demo CTA. Main-card hover now preserves fill/text colors and adds a 1px outline shadow; existing arrow motion and keyboard focus remain.
- Final qualifier refinement: removed the underline and increased `로그인 없이` from 11.5px/500 to 12.5px/600, retaining plain navy text without a badge background.
- Increased both landing secondary CTA labels from 14px to 14.5px; the qualifier remains 12.5px.
- Final validation before release: TypeScript check passed; local DOM checks confirmed the two CTA links, original navy, PlayCircle icon, 14.5px CTA labels, and a transparent 12.5px/600 qualifier without an underline. Release CI validates the committed changes separately.
