"""Coverage of PRAGMA learning missions over the design matrix.

The design matrix crosses 9 speech acts with power (P), distance (D), and
imposition (R), three levels each: 9 x 3 x 3 x 3 = 243 cells. This script reads
mission metadata exported from the scenarios table and reports how the missions
are distributed over that matrix, by direction and task mode.

Descriptive only: it counts content, it does not evaluate learning outcomes.

Usage:
    python analysis/content_coverage.py analysis/data/missions_metadata_2026-10-07.csv
    python analysis/content_coverage.py <csv> --status all --out report.md
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from itertools import product
from pathlib import Path

SPEECH_ACTS = {
    "request": "요청", "refusal": "거절", "apology": "사과", "thanks": "감사",
    "compliment": "칭찬", "complaint": "불평", "proposal": "제안",
    "agreement": "동의", "opposition": "반대",
}
POWER = {"speaker_lower": "화자 낮음", "equal": "대등", "speaker_higher": "화자 높음"}
DISTANCE = {"close": "가까움", "acquaintance": "아는 사이", "distant": "먼 사이"}
IMPOSITION = {"low": "낮음", "mid": "중간", "high": "높음"}
DIRECTIONS = {"ko_zh": "한→중", "zh_ko": "중→한"}
MODES = {"translation": "번역", "interpreting": "통역"}
STATUS_LABEL = {"reviewed": "승인 상태(reviewed)", "generated": "생성(승인 전)"}

MATRIX_SIZE = len(SPEECH_ACTS) * len(POWER) * len(DISTANCE) * len(IMPOSITION)


def load_missions(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def select(missions: list[dict[str, str]], status: str) -> list[dict[str, str]]:
    return missions if status == "all" else [m for m in missions if m["mission_status"] == status]


def cell(mission: dict[str, str]) -> tuple[str, str, str, str]:
    return mission["speech_act"], mission["p"], mission["d"], mission["r"]


def is_in_matrix(mission: dict[str, str]) -> bool:
    act, p, d, r = cell(mission)
    return act in SPEECH_ACTS and p in POWER and d in DISTANCE and r in IMPOSITION


def coverage(missions: list[dict[str, str]]) -> dict[str, object]:
    """Filled cells overall and per speech act (each act has 27 cells)."""
    filled = {cell(m) for m in missions if is_in_matrix(m)}
    per_act = {
        act: sum(1 for p, d, r in product(POWER, DISTANCE, IMPOSITION) if (act, p, d, r) in filled)
        for act in SPEECH_ACTS
    }
    return {"filled": len(filled), "total": MATRIX_SIZE, "per_act": per_act,
            "outside_matrix": sum(1 for m in missions if not is_in_matrix(m))}


def table(header: list[str], rows: list[list[object]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(str(value) for value in row) + " |" for row in rows]
    return "\n".join(lines)


def report(missions: list[dict[str, str]], status: str, source: str) -> str:
    scope = "전체" if status == "all" else STATUS_LABEL.get(status, status)
    cov = coverage(missions)
    by_route = Counter((m["direction"], m["mode"]) for m in missions)
    by_act = Counter(m["speech_act"] for m in missions)
    acts_per_route = {route: Counter(m["speech_act"] for m in missions if (m["direction"], m["mode"]) == route)
                      for route in product(DIRECTIONS, MODES)}

    parts = [
        f"# PRAGMA 학습 미션 설계 매트릭스 분포 ({scope})",
        f"- 원자료: `{source}`\n- 미션 수: {len(missions)}",
        f"- 설계 셀(9화행 × P3 × D3 × R3) 중 채워진 셀: **{cov['filled']} / {cov['total']}** "
        f"({cov['filled'] / cov['total']:.1%})",
    ]
    if cov["outside_matrix"]:
        parts.append(f"- 매트릭스 값이 비었거나 다른 값인 미션: {cov['outside_matrix']}")

    parts.append("\n## 방향 × 수행 방식\n" + table(
        ["방향", "번역", "통역", "계"],
        [[DIRECTIONS[d], by_route[(d, "translation")], by_route[(d, "interpreting")],
          by_route[(d, "translation")] + by_route[(d, "interpreting")]] for d in DIRECTIONS]))

    by_schema = Counter(m.get("schema_version", "") for m in missions)
    parts.append("\n## 미션 형식 버전\n" + table(
        ["형식", "미션 수"], [[version or "(없음)", n] for version, n in sorted(by_schema.items())]))

    route_cols = list(product(DIRECTIONS, MODES))
    parts.append("\n## 화행별 미션 수와 셀 채움(화행당 27셀)\n" + table(
        ["화행", "미션 수", *[f"{DIRECTIONS[d]} {MODES[m]}" for d, m in route_cols], "채워진 셀"],
        [[SPEECH_ACTS[act], by_act[act], *[acts_per_route[route][act] for route in route_cols],
          f"{cov['per_act'][act]} / 27"] for act in SPEECH_ACTS]))

    for title, key, labels in (("P(힘)", "p", POWER), ("D(거리)", "d", DISTANCE), ("R(부담)", "r", IMPOSITION)):
        counts = Counter(m[key] for m in missions)
        parts.append(f"\n## {title} 분포\n" + table(
            ["값", "미션 수", "비율"],
            [[labels[v], counts[v], f"{counts[v] / max(len(missions), 1):.1%}"] for v in labels]))
    return "\n".join(parts) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--status", default="reviewed", choices=["reviewed", "generated", "all"])
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)

    text = report(select(load_missions(args.csv), args.status), args.status, args.csv.as_posix())
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
