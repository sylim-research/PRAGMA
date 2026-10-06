# Research analysis (Python)

Descriptive analyses of PRAGMA content data. Standard library only (Python 3.10+); no install step.
These scripts count and describe content; they do not evaluate learning outcomes.

## Mission coverage of the design matrix

`content_coverage.py` reports how learning missions are distributed over the design matrix
(9 speech acts × P3 × D3 × R3 = 243 cells), by direction (ko→zh, zh→ko) and task mode
(translation, interpreting), with P·D·R marginals and mission format versions.

```bash
python analysis/content_coverage.py analysis/data/missions_metadata_2026-10-07.csv
python analysis/content_coverage.py analysis/data/missions_metadata_2026-10-07.csv --status all --out analysis/reports/coverage_all_2026-10-07.md
python -m unittest discover -s analysis
```

`--status` selects `reviewed` (default), `generated`, or `all`.

### Data

`data/missions_metadata_2026-10-07.csv` is a read-only export of the `scenarios` table on 2026-10-07:
scenario ID, speech act, learner level, mission status, format version, direction, mode, and P·D·R of the
production task. Mission text is not included. Rows with no mission content are excluded.

### Reports (2026-10-07)

- `reports/coverage_reviewed_2026-10-07.md`: 165 reviewed missions, 46 of 243 cells filled.
- `reports/coverage_all_2026-10-07.md`: 540 missions with content, 95 of 243 cells filled.

`reviewed` includes earlier format versions (mission_v5) that remain in that status; the format table in
each report shows the breakdown.
