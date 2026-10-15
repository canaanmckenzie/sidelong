// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtTime, rows } from "../src/limits.js";

// A fixed "now": 2026-10-14 20:00 local time.
const NOW = new Date(2026, 9, 14, 20, 0).getTime();

test("fmtTime shows bare time within 24h, weekday beyond", () => {
  const tonight = new Date(2026, 9, 14, 21, 14).getTime() / 1000;
  assert.equal(fmtTime(tonight, NOW), "21:14");
  const saturday = new Date(2026, 9, 17, 18, 0).getTime() / 1000;
  assert.equal(fmtTime(saturday, NOW), "sat 18:00");
});

test("rows with no data says so", () => {
  assert.deepEqual(rows(null, NOW), [["usage", "no data yet"]]);
  assert.deepEqual(rows({ windows: {} }, NOW), [["usage", "no data yet"]]);
});

test("rows formats both windows, flags a hit limit, notes freshness", () => {
  const tonight = new Date(2026, 9, 14, 21, 14).getTime() / 1000;
  const friday = new Date(2026, 9, 16, 9, 0).getTime() / 1000;
  const r = rows(
    {
      status: "rejected",
      windows: {
        fiveHour: { utilization: 0.12, resetsAt: tonight },
        sevenDay: { utilization: 0.09, resetsAt: friday },
      },
      seenAt: NOW - 60_000,
    },
    NOW,
  );
  assert.deepEqual(r, [
    ["5-hour", "12% · resets 21:14"],
    ["7-day", "9% · resets fri 09:00"],
    ["status", "limit reached"],
    ["seen", "19:59"],
  ]);
});

test("rows omits the status line while allowed", () => {
  const r = rows(
    { status: "allowed", windows: { fiveHour: { utilization: 0.5, resetsAt: NOW / 1000 + 3600 } } },
    NOW,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0][0], "5-hour");
});
