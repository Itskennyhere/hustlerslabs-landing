import assert from "node:assert/strict";
import { test } from "node:test";
import { humanize, humanizeDeep } from "../lib/humanize";
import { fitPost, MAX_POST_LENGTH } from "../lib/xscan/analyze";
import { parseHandle } from "../lib/xscan/handle";
import { gradeFor, rate } from "../lib/xscan/rating";

const EM = "\u2014";
const EN = "\u2013";

test("humanize removes every kind of dash", () => {
  assert.equal(humanize(`shipping fast ${EM} that is the job`), "Shipping fast, that is the job");
  assert.equal(humanize(`I tried it${EM}It worked.`), "I tried it. It worked.");
  assert.equal(humanize(`one ${EN} two`), "One, two");
  assert.equal(humanize("this -- that"), "This, that");
  assert.equal(humanize("this - that"), "This, that");
  assert.equal(humanize(`pages 10${EN}20`), "Pages 10 to 20");
  assert.equal(humanize("a well-known fact."), "A well-known fact.");
  for (const out of [humanize(`x ${EM} y ${EN} z -- w - v`)]) {
    assert.ok(!/[\u2013\u2014]|--| - /.test(out), out);
  }
});

test("humanize swaps AI tells and capitalises", () => {
  assert.equal(
    humanize("it's important to note that we delve into data. leverage it for a seamless game-changer."),
    "We dig into data. Use it for a smooth big deal.",
  );
  assert.equal(humanize("In the ever-evolving world of crypto, things move."), "In crypto, things move.");
  assert.equal(humanize("Unlock the power of threads."), "Make the most of threads.");
  assert.equal(humanize("a rich tapestry of ideas"), "A mix of ideas");
  assert.equal(humanize("hello ,  world .ok"), "Hello, world.ok");
});

test("humanizeDeep walks objects and arrays", () => {
  assert.deepEqual(humanizeDeep({ a: [`x ${EM} y`], b: 3, c: { d: "leverage" } }), {
    a: ["X, y"],
    b: 3,
    c: { d: "Use" },
  });
});

test("parseHandle accepts handles and URLs", () => {
  assert.equal(parseHandle("@jack"), "jack");
  assert.equal(parseHandle("https://x.com/Sorsa_App?s=20"), "Sorsa_App");
  assert.equal(parseHandle("twitter.com/abc_123/status/1"), "abc_123");
  assert.equal(parseHandle("way_too_long_handle_here"), null);
  assert.equal(parseHandle("bad-handle"), null);
});

test("fitPost keeps posts under the limit", () => {
  const long = "Short one. ".repeat(40).trim();
  assert.ok(fitPost(long).length < MAX_POST_LENGTH);
  assert.ok(fitPost(long).endsWith("."));
});

test("grades and rating maths", () => {
  assert.equal(gradeFor(90), "S");
  assert.equal(gradeFor(80), "A");
  assert.equal(gradeFor(65), "B");
  assert.equal(gradeFor(50), "C");
  assert.equal(gradeFor(35), "D");
  assert.equal(gradeFor(34), "E");

  const now = new Date("2026-10-28T00:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const tweets = Array.from({ length: 14 }, (_, i) => ({
    created_at: new Date(now.getTime() - (i * 7 * day) / 14).toISOString(),
    likes_count: 40,
    view_count: 1000,
  }));
  const full = rate({ followers: 1000, sorsaScore: 2999, categoryCount: 1999, tweets, now });
  assert.equal(full.total, 100);

  const empty = rate({ followers: 0, sorsaScore: null, categoryCount: null, tweets: [], now });
  assert.equal(empty.total, 0);
  assert.equal(empty.grade, "E");
});
