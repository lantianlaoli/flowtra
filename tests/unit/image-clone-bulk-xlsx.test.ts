import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { __test__, parseImageCloneBulkWorkbook } from '@/lib/image-clone-bulk-xlsx';

test('resolves current Sheet1 headers without sequence', () => {
  const columns = __test__.getSheetColumns(new Map([
    ['A1', 'size'],
    ['B1', 'requirement'],
    ['C1', 'reference image'],
    ['D1', 'copy'],
  ]));

  assert.equal(columns.size, 'A');
  assert.equal(columns.requirement, 'B');
  assert.deepEqual(columns.imageColumns, ['C']);
  assert.equal(columns.copyText, 'D');
  assert.equal(columns.style, undefined);
});

test('resolves current Sheet1 headers with optional style', () => {
  const columns = __test__.getSheetColumns(new Map([
    ['A1', '尺寸'],
    ['B1', '需求'],
    ['C1', '竞品图'],
    ['D1', '文案'],
    ['E1', '风格'],
  ]));

  assert.equal(columns.size, 'A');
  assert.equal(columns.requirement, 'B');
  assert.deepEqual(columns.imageColumns, ['C']);
  assert.equal(columns.copyText, 'D');
  assert.equal(columns.style, 'E');
});

test.skip('parses current Flowtra example workbook with Sheet2 product images', async () => {
  const buffer = await readFile('docs/bulk_clone_images/examples.xlsx');
  const workbook = await parseImageCloneBulkWorkbook(buffer);

  assert.equal(workbook.product.title.includes('Desk Fan'), true);
  assert.equal(workbook.product.description.includes('Compact and Powerful Design'), true);
  assert.equal(workbook.product.images.length, 1);
  assert.equal(workbook.rows.length, 3);
  assert.equal(workbook.rows[0].requirement, '');
  assert.deepEqual(
    workbook.rows.map((row) => ({
      rowNumber: row.rowNumber,
      sequence: row.sequence,
      aspectRatio: row.aspectRatio,
      resolution: row.resolution,
      refs: row.referenceImages.length,
    })),
    [
      { rowNumber: 2, sequence: '1', aspectRatio: '1:1', resolution: '2K', refs: 1 },
      { rowNumber: 3, sequence: '2', aspectRatio: '1:1', resolution: '2K', refs: 1 },
      { rowNumber: 4, sequence: '3', aspectRatio: '1:1', resolution: '2K', refs: 1 },
    ]
  );
  assert.equal(workbook.warnings.length, 0);
});

test('missing Sheet1 required headers report bilingual header names', () => {
  assert.throws(
    () => __test__.getSheetColumns(new Map([
      ['A1', 'size'],
      ['B1', 'requirement'],
      ['C1', 'reference image'],
    ])),
    /Sheet1 is missing required header: 文案 \/ copy/
  );
});

test('missing Sheet2 required headers report Sheet2 header names', () => {
  assert.throws(
    () => {
      __test__.getProductContextFromSheet2(new Map([
        ['A1', 'title'],
        ['B1', 'description'],
        ['A2', 'Example product'],
        ['B2', 'Example description'],
      ]), new Map());
    },
    /Sheet2 is missing required header: 图片 \/ image/
  );
});
