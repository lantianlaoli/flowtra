import assert from "node:assert/strict";
import test from "node:test";

import { isRetryableImageCloneBulkKieError } from "@/lib/image-clone-bulk-kie";

test("detects retryable KIE bulk image failures", () => {
  assert.equal(isRetryableImageCloneBulkKieError("Internal Error, Please try again later."), true);
  assert.equal(isRetryableImageCloneBulkKieError(new Error("KIE task creation failed: 502 Bad Gateway")), true);
  assert.equal(isRetryableImageCloneBulkKieError("Request timed out"), true);
});

test("does not retry non-transient KIE bulk image failures", () => {
  assert.equal(isRetryableImageCloneBulkKieError("Content policy violation"), false);
  assert.equal(isRetryableImageCloneBulkKieError("Invalid aspect ratio"), false);
});
