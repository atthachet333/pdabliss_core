// EP48.5 g0-test-manifest fixture (NOT a test file of the repository: it runs only when a manifest test passes it explicitly).
import { test } from "node:test";
test("beta 1", () => {});
test("beta skipped", { skip: "fixture" }, () => {});
