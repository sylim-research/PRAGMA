import unittest

from content_coverage import MATRIX_SIZE, coverage, report, select


def mission(act="request", p="equal", d="close", r="low", status="reviewed", direction="ko_zh", mode="translation"):
    return {"speech_act": act, "p": p, "d": d, "r": r, "mission_status": status,
            "direction": direction, "mode": mode}


class CoverageTest(unittest.TestCase):
    def test_matrix_has_243_cells(self):
        self.assertEqual(MATRIX_SIZE, 243)

    def test_duplicate_missions_fill_one_cell(self):
        result = coverage([mission(), mission(), mission(r="high")])
        self.assertEqual(result["filled"], 2)
        self.assertEqual(result["per_act"]["request"], 2)
        self.assertEqual(result["per_act"]["refusal"], 0)

    def test_values_outside_the_matrix_are_counted_separately(self):
        result = coverage([mission(p=""), mission(act="greeting")])
        self.assertEqual(result["filled"], 0)
        self.assertEqual(result["outside_matrix"], 2)

    def test_status_filter(self):
        missions = [mission(), mission(status="generated")]
        self.assertEqual(len(select(missions, "reviewed")), 1)
        self.assertEqual(len(select(missions, "all")), 2)

    def test_report_states_filled_cells(self):
        text = report([mission(), mission(direction="zh_ko", mode="interpreting")], "reviewed", "sample.csv")
        self.assertIn("**1 / 243**", text)
        self.assertIn("| 중→한 | 0 | 1 | 1 |", text)


if __name__ == "__main__":
    unittest.main()
