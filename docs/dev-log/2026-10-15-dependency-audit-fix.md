# Dependency audit fix — 2026-10-15

Source: a fresh clone of `main` (`a011a7b4`) reported 37 `npm audit` advisories (2 critical, 29 high, 6 moderate). The two critical entries were `tinypool` (RCE via prototype pollution) reached only through `vitest` 3, a test-time dependency. Most high entries were transitive development tooling (eslint, vite, tailwind, rollup).

Changes (branch `claude/npm-audit-fix-20261015`)
- `npm audit fix` without `--force`: 37 → 16, lockfile only.
- Toolchain majors: vite 5 → 8, vitest 3 → 5, `@vitejs/plugin-react-swc` 3 → 4, `@testing-library/jest-dom` 6 → 7. `esbuild` and `vite-node` become explicit devDependencies because vite 8 no longer ships esbuild and vitest 5 no longer ships vite-node (both are used by `scripts/`).
- `overrides`: `compression` ^1.8.2 (pulled by `serve`), `postcss-selector-parser` ^7.1.6 (pulled by tailwindcss 3).
- `tsconfig.app.json` adds `"node"` to `types`: vitest 5 stops referencing `@types/node`, which had been supplying `node:fs`, `process` and `Array.prototype.at` to 93 test-file sites.
- `src/test/setup.ts` imports `@testing-library/jest-dom/vitest` so matcher types attach to vitest 5's `Assertion<T, E>`.
- `tailwind.config.ts` blocklists the token `[-:T]`: Tailwind reads the regex `/[-:T]/` in `src/lib/mission/missionEventExport.ts` as an arbitrary-property class and emits `-: T;`. esbuild's CSS minifier tolerated it; lightningcss (vite 8 default) fails the build on it.
- `supabase/functions/content-review/domain.generated.mjs` regenerated with esbuild 0.28 so `prebuild --check` passes (one minified line differs).
- `react-router-dom` 6 → 7 (second commit). The app uses only the declarative API (BrowserRouter, Routes, Route, Link, NavLink, Navigate, useNavigate, useLocation, useParams, useSearchParams; MemoryRouter in tests), none of the data-router APIs. The only source change: two tests dropped the `future={{ v7_startTransition, v7_relativeSplatPath }}` prop, which v7 removed because those behaviours are now the default.
- README: a short "로컬에서 실행하기" block under 시스템 아키텍처 — Node 22, `.env` from `.env.example`, the Supabase requirement, and the three verification commands.

Remaining: 5 advisories, 0 critical, all build-time: `braces` (no patched release) and its dependents `micromatch`, `chokidar`, `fast-glob`, reached only through tailwindcss 3. They leave only with tailwindcss 4, which changes default border colour, ring width and shadow scale across the UI; that migration is deferred until after the second defense so the live screens keep matching the figures captured for the thesis.

Validation: `npm run typecheck` 0 errors; `npm test` 165 files, 1129 passed / 9 skipped; `release:policy-test` 5/5; `review:db-test` 32/32; `npm run build` OK (dist 5.0 MB). Tests and build ran with the CI placeholder values for `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`.
