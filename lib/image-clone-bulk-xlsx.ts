import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type {
  ImageCloneBulkAspectRatio,
  ImageCloneBulkImage,
  ImageCloneBulkResolution,
  ImageCloneBulkRow,
  ImageCloneBulkWorkbook,
} from "@/lib/image-clone-bulk-types";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: "",
  textNodeName: "#text",
});

type SheetColumns = {
  size: string;
  requirement: string;
  copyText: string;
  style?: string;
  imageColumns: string[];
  maxColumnIndex: number;
};

const HEADER_ALIASES = {
  size: ["尺寸", "size", "dimensions", "dimension"],
  requirement: ["需求", "requirement", "requirements", "brief", "instruction", "instructions"],
  copyText: ["文案", "copy", "copytext", "text", "caption"],
  style: ["风格", "style", "styleguide", "direction"],
} as const;

const PRODUCT_HEADER_ALIASES = {
  title: ["标题", "title", "产品标题", "producttitle", "productname", "name"],
  description: ["描述", "description", "产品描述", "productdescription", "desc"],
  image: ["图片", "image", "产品图片", "images", "productimage", "productimages", "photo", "photos"],
} as const;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(getText).join("");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record["#text"] != null) return getText(record["#text"]);
    return Object.values(record).map(getText).join("");
  }
  return "";
}

function getRichText(item: unknown): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  const si = item as Record<string, unknown>;
  if (si.t != null) return getText(si.t);
  return asArray(si.r)
    .map((run) => getText((run as Record<string, unknown>).t))
    .join("");
}

export function cleanBulkCellText(text: string): string {
  const cleaned = text
    .replace(/&#10;/g, "\n")
    .replace(/&#9;/g, "\t")
    .replace(/&amp;#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return /^(null|undefined)$/i.test(cleaned) ? "" : cleaned;
}

function normalizeCellRef(ref: string) {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!match) return null;
  return { col: match[1].toUpperCase(), row: Number(match[2]) };
}

function columnToIndex(col: string) {
  return col.split("").reduce((index, char) => index * 26 + char.charCodeAt(0) - 64, 0);
}

function indexToColumn(index: number) {
  let col = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    current = Math.floor((current - 1) / 26);
  }
  return col;
}

function mimeForFile(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

function targetToMediaPath(target: string) {
  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\.\//, "")}`;
}

function extractDispimgId(value: string) {
  return /DISPIMG\("([^"]+)"/i.exec(value)?.[1] ?? null;
}

function normalizeHeader(value: string) {
  return cleanBulkCellText(value).replace(/\s+/g, "").toLowerCase();
}

function findOptionalHeaderColumn(headers: Map<string, string>, names: string[]) {
  const normalizedNames = names.map(normalizeHeader);
  for (const [col, value] of headers) {
    if (normalizedNames.includes(value)) return col;
  }
  return undefined;
}

function findRequiredHeaderColumn(headers: Map<string, string>, names: string[], sheetName = "Sheet1") {
  const col = findOptionalHeaderColumn(headers, names);
  if (!col) throw new Error(`${sheetName} is missing required header: ${names[0]} / ${names[1]}`);
  return col;
}

function getSheetColumns(cells: Map<string, string>): SheetColumns {
  const headers = new Map<string, string>();
  let maxColumnIndex = 1;

  for (const [ref, value] of cells) {
    const cellRef = normalizeCellRef(ref);
    if (!cellRef) continue;
    maxColumnIndex = Math.max(maxColumnIndex, columnToIndex(cellRef.col));
    if (cellRef.row === 1) headers.set(cellRef.col, normalizeHeader(value));
  }

  const size = findRequiredHeaderColumn(headers, [...HEADER_ALIASES.size]);
  const requirement = findRequiredHeaderColumn(headers, [...HEADER_ALIASES.requirement]);
  const copyText = findRequiredHeaderColumn(headers, [...HEADER_ALIASES.copyText]);
  const style = findOptionalHeaderColumn(headers, [...HEADER_ALIASES.style]);
  const requirementIndex = columnToIndex(requirement);
  const copyTextIndex = columnToIndex(copyText);

  if (requirementIndex >= copyTextIndex) {
    throw new Error("Sheet1 header 文案 / copy must appear after 需求 / requirement.");
  }

  const imageColumns = Array.from(
    { length: copyTextIndex - requirementIndex - 1 },
    (_, index) => indexToColumn(requirementIndex + index + 1)
  );

  return {
    size,
    requirement,
    copyText,
    style,
    imageColumns,
    maxColumnIndex: Math.max(maxColumnIndex, style ? columnToIndex(style) : copyTextIndex),
  };
}

export const __test__ = {
  getSheetColumns,
  normalizeHeader,
  getProductContextFromSheet2,
};

export function bulkAspectRatioFromSize(size: string): ImageCloneBulkAspectRatio {
  const match = /(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/.exec(size);
  if (!match) return "auto";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return "auto";
  const ratio = width / height;
  const candidates: Array<[ImageCloneBulkAspectRatio, number]> = [
    ["1:1", 1],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
  ];
  const [best] = candidates.reduce((current, candidate) =>
    Math.abs(candidate[1] - ratio) < Math.abs(current[1] - ratio) ? candidate : current
  );
  return best;
}

export function bulkResolutionFromSize(
  size: string,
  aspectRatio = bulkAspectRatioFromSize(size)
): ImageCloneBulkResolution {
  const match = /(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/.exec(size);
  if (!match || aspectRatio === "auto") return "1K";
  const longestSide = Math.max(Number(match[1]), Number(match[2]));
  if (longestSide <= 1024) return "1K";
  if (aspectRatio === "1:1") return "2K";
  return longestSide <= 2048 ? "2K" : "4K";
}

async function parseSharedStrings(zip: JSZip) {
  const file = zip.file("xl/sharedStrings.xml");
  if (!file) return [];
  const doc = parser.parse(await file.async("string"));
  return asArray(doc?.sst?.si).map((item) => getRichText(item));
}

async function parseSheet(zip: JSZip, sheetPath: string, sharedStrings: string[]) {
  const file = zip.file(sheetPath);
  if (!file) return new Map<string, string>();
  const doc = parser.parse(await file.async("string"));
  const cells = new Map<string, string>();
  for (const row of asArray(doc?.worksheet?.sheetData?.row)) {
    for (const cell of asArray(row?.c)) {
      const ref = cell?.r;
      if (!ref) continue;
      const formula = getText(cell.f);
      if (formula) {
        cells.set(ref, `=${formula}`);
        continue;
      }
      const raw = getText(cell.v);
      if (cell.t === "s" && raw !== "") {
        cells.set(ref, sharedStrings[Number(raw)] ?? "");
      } else if (cell.t === "inlineStr") {
        cells.set(ref, getText(cell.is));
      } else {
        cells.set(ref, raw);
      }
    }
  }
  return cells;
}

async function parseCellImages(zip: JSZip): Promise<Map<string, ImageCloneBulkImage>> {
  const relsFile = zip.file("xl/_rels/cellimages.xml.rels");
  const imagesFile = zip.file("xl/cellimages.xml");
  if (!relsFile || !imagesFile) return new Map();

  const relsDoc = parser.parse(await relsFile.async("string"));
  const rels = new Map<string, string>();
  for (const rel of asArray(relsDoc?.Relationships?.Relationship)) {
    if (rel?.Id && rel?.Target) rels.set(rel.Id, targetToMediaPath(rel.Target));
  }

  const imageDoc = parser.parse(await imagesFile.async("string"));
  const result = new Map<string, ImageCloneBulkImage>();
  for (const cellImage of asArray(imageDoc?.cellImages?.cellImage)) {
    const pic = cellImage?.pic;
    const name = pic?.nvPicPr?.cNvPr?.name;
    const relId = pic?.blipFill?.blip?.["r:embed"] ?? pic?.blipFill?.blip?.embed;
    const mediaPath = relId ? rels.get(relId) : undefined;
    const file = mediaPath ? zip.file(mediaPath) : null;
    if (!name || !mediaPath || !file) continue;
    const bytes = await file.async("base64");
    const fileName = mediaPath.split("/").pop() ?? `${name}.png`;
    const mimeType = mimeForFile(fileName);
    result.set(name, {
      id: name,
      fileName,
      mimeType,
      dataUrl: `data:${mimeType};base64,${bytes}`,
    });
  }
  return result;
}

function rowObject(cells: Map<string, string>, rowNumber: number, maxColumnIndex: number) {
  const values: Record<string, string> = {};
  for (let index = 1; index <= maxColumnIndex; index += 1) {
    const col = indexToColumn(index);
    values[col] = cleanBulkCellText(cells.get(`${col}${rowNumber}`) ?? "");
  }
  return values;
}

function imagesForRow(
  values: Record<string, string>,
  imageColumns: string[],
  imageMap: Map<string, ImageCloneBulkImage>
) {
  return imageColumns
    .map((col) => extractDispimgId(values[col] ?? ""))
    .filter((id): id is string => Boolean(id))
    .map((id) => imageMap.get(id))
    .filter((image): image is ImageCloneBulkImage => Boolean(image));
}

function buildParsedRow(
  cells: Map<string, string>,
  imageMap: Map<string, ImageCloneBulkImage>,
  columns: SheetColumns,
  rowNumber: number
): ImageCloneBulkRow {
  const values = rowObject(cells, rowNumber, columns.maxColumnIndex);
  const size = values[columns.size];
  const aspectRatio = bulkAspectRatioFromSize(size);
  return {
    id: `row-${rowNumber}`,
    rowNumber,
    sequence: String(rowNumber - 1),
    size,
    requirement: values[columns.requirement],
    copyText: values[columns.copyText],
    style: columns.style ? values[columns.style] : "",
    aspectRatio,
    resolution: bulkResolutionFromSize(size, aspectRatio),
    referenceImages: imagesForRow(values, columns.imageColumns, imageMap),
    source: { cells: values },
  };
}

function getHeaderMap(cells: Map<string, string>) {
  const headers = new Map<string, string>();
  for (const [ref, value] of cells) {
    const cellRef = normalizeCellRef(ref);
    if (cellRef?.row === 1) headers.set(cellRef.col, normalizeHeader(value));
  }
  return headers;
}

function getSheetMaxColumnIndex(cells: Map<string, string>) {
  let maxColumnIndex = 1;
  for (const ref of cells.keys()) {
    const cellRef = normalizeCellRef(ref);
    if (cellRef) maxColumnIndex = Math.max(maxColumnIndex, columnToIndex(cellRef.col));
  }
  return maxColumnIndex;
}

function getProductContextFromSheet2(
  sheet2: Map<string, string>,
  imageMap: Map<string, ImageCloneBulkImage>
) {
  const headers = getHeaderMap(sheet2);
  const titleColumn = findRequiredHeaderColumn(headers, [...PRODUCT_HEADER_ALIASES.title], "Sheet2");
  const descriptionColumn = findRequiredHeaderColumn(headers, [...PRODUCT_HEADER_ALIASES.description], "Sheet2");
  const firstImageColumn = findRequiredHeaderColumn(headers, [...PRODUCT_HEADER_ALIASES.image], "Sheet2");

  const maxColumnIndex = getSheetMaxColumnIndex(sheet2);
  const imageColumns = Array.from(
    { length: maxColumnIndex - columnToIndex(firstImageColumn) + 1 },
    (_, index) => indexToColumn(columnToIndex(firstImageColumn) + index)
  );
  const row2 = rowObject(sheet2, 2, maxColumnIndex);

  return {
    title: row2[titleColumn],
    description: row2[descriptionColumn],
    images: imagesForRow(row2, imageColumns, imageMap),
    imageColumns,
  };
}

export async function parseImageCloneBulkWorkbook(buffer: ArrayBuffer | Buffer): Promise<ImageCloneBulkWorkbook> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await parseSharedStrings(zip);
  const [sheet1, sheet2, imageMap] = await Promise.all([
    parseSheet(zip, "xl/worksheets/sheet1.xml", sharedStrings),
    parseSheet(zip, "xl/worksheets/sheet2.xml", sharedStrings),
    parseCellImages(zip),
  ]);
  const columns = getSheetColumns(sheet1);

  const rowNumbers = [...sheet1.keys()]
    .map((ref) => normalizeCellRef(ref))
    .filter((ref): ref is { col: string; row: number } => Boolean(ref))
    .map((ref) => ref.row)
    .filter((row) => row >= 2);
  const maxRow = Math.max(...rowNumbers, 1);
  const allRows = Array.from({ length: Math.max(0, maxRow - 1) }, (_, index) =>
    buildParsedRow(sheet1, imageMap, columns, index + 2)
  ).filter((row) => row.requirement || row.copyText || row.referenceImages.length > 0);

  const productContext = getProductContextFromSheet2(sheet2, imageMap);
  const rows = allRows;
  const warnings: string[] = [];
  if (!productContext.imageColumns.length) {
    warnings.push("Sheet2 is missing required header: 图片 / image");
  } else if (!productContext.images.length) {
    warnings.push(`No product reference images found in Sheet2 row 2 columns ${productContext.imageColumns.join(":")}.`);
  }
  for (const row of allRows) {
    for (const col of columns.imageColumns) {
      const value = row.source.cells[col];
      const id = extractDispimgId(value);
      if (id && !imageMap.has(id)) warnings.push(`Row ${row.rowNumber} column ${col} image ${id} was not found.`);
    }
  }

  return {
    product: {
      title: productContext.title,
      description: productContext.description,
      images: productContext.images,
    },
    rows,
    warnings,
    imageCount: imageMap.size,
  };
}
