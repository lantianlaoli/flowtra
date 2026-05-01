import assert from "node:assert/strict";
import test from "node:test";
import {
  createImageCloneBulkReplacementJob,
  validateImageCloneBulkRegenerationLocalImages,
  validateImageCloneBulkRegenerationOutputSize,
} from "@/lib/image-clone-bulk-regenerate";
import type { ImageCloneBulkJob } from "@/lib/image-clone-bulk-types";

const baseJob: ImageCloneBulkJob = {
  rowId: "row-1",
  rowNumber: 3,
  sequence: "A-1",
  taskId: "old-task",
  status: "success",
  resultUrl: "https://example.com/result.png",
  error: "old error",
  prompt: "Original prompt",
  aspectRatio: "16:9",
  resolution: "2K",
  sourceRow: {
    cells: {
      requirement: "Make it clean",
    },
  },
};

test("bulk regeneration output size rules match KIE constraints", () => {
  assert.equal(validateImageCloneBulkRegenerationOutputSize("auto", "1K"), null);
  assert.equal(validateImageCloneBulkRegenerationOutputSize("16:9", "4K"), null);
  assert.match(validateImageCloneBulkRegenerationOutputSize("auto", "2K") ?? "", /Auto aspect ratio/);
  assert.match(validateImageCloneBulkRegenerationOutputSize("1:1", "4K") ?? "", /does not support 4K/);
});

test("bulk regeneration local image validation enforces type, count, and size", () => {
  const validDataUrl = `data:image/png;base64,${Buffer.from("small").toString("base64")}`;
  assert.equal(validateImageCloneBulkRegenerationLocalImages([{ fileName: "ref.png", dataUrl: validDataUrl }]), null);
  assert.match(
    validateImageCloneBulkRegenerationLocalImages(new Array(5).fill({ fileName: "ref.png", dataUrl: validDataUrl })) ?? "",
    /Upload up to 4/
  );
  assert.match(
    validateImageCloneBulkRegenerationLocalImages([{ fileName: "ref.gif", dataUrl: "data:image/gif;base64,abcd" }]) ?? "",
    /PNG, JPG, JPEG, or WebP/
  );

  const oversizedDataUrl = `data:image/jpeg;base64,${"a".repeat(14 * 1024 * 1024)}`;
  assert.match(
    validateImageCloneBulkRegenerationLocalImages([{ fileName: "large.jpg", dataUrl: oversizedDataUrl }]) ?? "",
    /10 MB or smaller/
  );
});

test("bulk regeneration replacement job clears old result and preserves row metadata", () => {
  const replacement = createImageCloneBulkReplacementJob({
    job: baseJob,
    taskId: "new-task",
    prompt: "New prompt",
    aspectRatio: "4:3",
    resolution: "1K",
  });

  assert.equal(replacement.rowId, baseJob.rowId);
  assert.equal(replacement.rowNumber, baseJob.rowNumber);
  assert.equal(replacement.sequence, baseJob.sequence);
  assert.deepEqual(replacement.sourceRow, baseJob.sourceRow);
  assert.equal(replacement.taskId, "new-task");
  assert.equal(replacement.status, "waiting");
  assert.equal(replacement.resultUrl, undefined);
  assert.equal(replacement.error, undefined);
  assert.equal(replacement.prompt, "New prompt");
  assert.equal(replacement.aspectRatio, "4:3");
  assert.equal(replacement.resolution, "1K");
});
