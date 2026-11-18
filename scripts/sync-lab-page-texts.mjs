import fs from "node:fs";
import { JSDOM } from "jsdom";

const htmlPath = "index.html";
const changesPath = "page-changes-lab.json";
const html = fs.readFileSync(htmlPath, "utf8");
const payload = JSON.parse(fs.readFileSync(changesPath, "utf8"));

if (!payload || payload.success !== true || !Array.isArray(payload.changes)) {
  throw new Error("page-changes-lab.json has an invalid structure.");
}
if (payload.changes.length > 500) {
  throw new Error("Too many page text changes.");
}

// Parse only for locating nodes. Never serialize the DOM: serialization can
// normalize or relocate markup and must not rewrite the page structure.
function parseWithLocations(source) {
  // The source file starts with a UTF-8 BOM. JSDOM treats a leading BOM in
  // an already-decoded string as text before the doctype, which moves the
  // entire head into the body. Strip it only for parsing and shift every
  // reported source offset by one so edits still target the original source.
  const hasBom = source.charCodeAt(0) === 0xFEFF;
  const dom = new JSDOM(hasBom ? source.slice(1) : source, {
    includeNodeLocations: true
  });

  return {
    window: dom.window,
    nodeLocation(node) {
      const location = dom.nodeLocation(node);
      if (!location || !hasBom) return location;

      const shiftPart = part => part ? {
        ...part,
        startOffset: part.startOffset + 1,
        endOffset: part.endOffset + 1
      } : null;

      return {
        ...location,
        startOffset: location.startOffset + 1,
        endOffset: location.endOffset + 1,
        startTag: shiftPart(location.startTag),
        endTag: shiftPart(location.endTag)
      };
    }
  };
}

function assertDocumentStructure(document, stage) {
  if (!document.doctype || document.documentElement?.tagName !== "HTML" ||
      !document.head || !document.body ||
      !document.head.querySelector("title") ||
      !document.head.querySelector('meta[charset]') ||
      !document.head.querySelector('link[rel="stylesheet"]')) {
    throw new Error("HTML structure validation failed " + stage + ".");
  }
}

const initialDom = parseWithLocations(html);
const document = initialDom.window.document;
assertDocumentStructure(document, "before text synchronization");

const excludedRoots = [
  "#devControlBar", "#loginBtn", "#adminBadge", "#adminModal",
  "#scheduleModal", "#passwordRecoveryPanel", "#tabletTeacherUpload",
  "#tabletImageUploadControls", "#tabletImageManagement", "#tabletGallery",
  "#googleSignInStatus", "#scheduleOperationStatus", "#scheduleTeacherControl",
  "#scheduleBulkManagement", "#scheduleBulkSelectionStatus", "#schedulesGrid",
  "#alertsTeacherControl", "#photoAlbumsStatus", "#photoAlbumsManagement",
  "#albumsSelectionStatus", "#photoAlbumsGrid", "#photoAlbumViewer",
  "#photoAlbumImagesGrid", "#photoAlbumEditor", "#photoAlbumUploadProgress",
  "#photoAlbumUploadStatus", "#photoAlbumUploadProgressText",
  "#photoAlbumUploadResults", "#albumImagesManagement",
  "#albumImagesSelectionStatus", "#scheduleClassFiles", "#adminErrorMsg",
  "#recoveryMessage", "#schoolImageViewer", '[data-page-no-auto-edit="true"]'
].join(",");

function makeStableId(element, textNodeIndex) {
  const path = [];
  let current = element;
  while (current && current !== document.body) {
    let position = 1;
    let previous = current.previousElementSibling;
    while (previous) {
      if (previous.tagName === current.tagName) position++;
      previous = previous.previousElementSibling;
    }
    path.unshift(current.tagName.toLowerCase() + position);
    current = current.parentElement;
  }
  const value = path.join("/") +
    (textNodeIndex === undefined ? "" : "/text-" + textNodeIndex);
  let hashA = 2166136261;
  let hashB = 2246822519;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    hashA = Math.imul(hashA ^ code, 16777619);
    hashB = Math.imul(hashB ^ code, 3266489917);
  }
  const hex = number => (number >>> 0).toString(16).padStart(8, "0");
  return "auto-" + hex(hashA) + hex(hashB);
}

const usedIds = new Set(
  Array.from(document.querySelectorAll("[data-page-edit-id]"))
    .map(element => element.getAttribute("data-page-edit-id"))
    .filter(Boolean)
);
const sourceEdits = [];

function addSourceEdit(start, end, replacement) {
  if (!Number.isInteger(start) || !Number.isInteger(end) ||
      start < 0 || end < start || end > html.length) {
    throw new Error("Invalid HTML source location; refusing to modify index.html.");
  }
  sourceEdits.push({ start, end, replacement });
}

const candidates = Array.from(document.body.querySelectorAll("*"));
for (const element of candidates) {
  if (element.hasAttribute("data-page-edit-id")) continue;
  if (element.parentElement &&
      element.parentElement.closest("[data-page-edit-id]")) continue;
  if (element.closest(excludedRoots)) continue;

  const tag = element.tagName;
  if ([
    "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "CANVAS",
    "INPUT", "TEXTAREA", "SELECT", "OPTION", "IFRAME"
  ].includes(tag)) continue;

  if (element.children.length === 0) {
    if (!element.textContent || !element.textContent.trim()) continue;
    const id = makeStableId(element);
    if (usedIds.has(id)) continue;

    const location = initialDom.nodeLocation(element);
    if (!location?.startTag) {
      throw new Error("Could not locate an HTML element while creating edit IDs.");
    }
    const tagEnd = location.startTag.endOffset;
    const insertionPoint = html[tagEnd - 2] === "/" ? tagEnd - 2 : tagEnd - 1;
    addSourceEdit(insertionPoint, insertionPoint, ' data-page-edit-id="' + id + '"');
    usedIds.add(id);
    continue;
  }

  Array.from(element.childNodes).forEach((node, index) => {
    if (node.nodeType !== initialDom.window.Node.TEXT_NODE ||
        !node.nodeValue.trim()) return;

    const id = makeStableId(element, index);
    if (usedIds.has(id)) return;
    const location = initialDom.nodeLocation(node);
    if (!location) {
      throw new Error("Could not locate a text node while creating edit IDs.");
    }
    const rawText = html.slice(location.startOffset, location.endOffset);
    addSourceEdit(
      location.startOffset,
      location.endOffset,
      '<span data-page-edit-id="' + id + '">' + rawText + "</span>"
    );
    usedIds.add(id);
  });
}

// Apply non-overlapping source edits from right to left so every original
// offset remains valid. The original doctype, head, body, comments and scripts
// remain byte-for-byte unchanged except for the intended edit markers.
sourceEdits.sort((a, b) => b.start - a.start || b.end - a.end);
let markedHtml = html;
let previousStart = html.length + 1;
for (const edit of sourceEdits) {
  if (edit.end > previousStart) {
    throw new Error("Overlapping HTML source edits detected; refusing to write.");
  }
  markedHtml =
    markedHtml.slice(0, edit.start) +
    edit.replacement +
    markedHtml.slice(edit.end);
  previousStart = edit.start;
}

const markedDom = parseWithLocations(markedHtml);
const markedDocument = markedDom.window.document;
assertDocumentStructure(markedDocument, "after adding edit markers");

const seen = new Set();
const targets = new Map();
for (const element of markedDocument.querySelectorAll("[data-page-edit-id]")) {
  const id = element.getAttribute("data-page-edit-id");
  if (id) {
    if (targets.has(id)) throw new Error("Duplicate HTML edit id: " + id);
    targets.set(id, element);
  }
}

const missing = [];
const textEdits = [];
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

for (const item of payload.changes) {
  if (!item || typeof item.id !== "string" || typeof item.text !== "string" ||
      item.id.length > 200 || item.text.length > 10000) {
    throw new Error("A change item has invalid id/text values.");
  }
  if (seen.has(item.id)) throw new Error("Duplicate edit id: " + item.id);
  seen.add(item.id);

  const target = targets.get(item.id);
  if (!target) {
    missing.push(item.id);
    continue;
  }
  const location = markedDom.nodeLocation(target);
  if (!location?.startTag || !location?.endTag ||
      location.endTag.startOffset < location.startTag.endOffset) {
    throw new Error("Could not safely locate the content for edit id: " + item.id);
  }
  textEdits.push({
    start: location.startTag.endOffset,
    end: location.endTag.startOffset,
    replacement: escapeHtml(item.text)
  });
}

if (missing.length) {
  throw new Error(
    "Refusing to write index.html because these saved edit IDs were not found: " +
    missing.join(", ")
  );
}

textEdits.sort((a, b) => b.start - a.start);
let output = markedHtml;
let previousTextStart = markedHtml.length + 1;
for (const edit of textEdits) {
  if (edit.end > previousTextStart) {
    throw new Error("Overlapping text replacements detected; refusing to write.");
  }
  output =
    output.slice(0, edit.start) +
    edit.replacement +
    output.slice(edit.end);
  previousTextStart = edit.start;
}

const finalDom = parseWithLocations(output);
assertDocumentStructure(finalDom.window.document, "after text synchronization");
if (finalDom.window.document.head.querySelectorAll("meta").length < 5) {
  throw new Error("The document head appears incomplete; refusing to write index.html.");
}
if (finalDom.window.document.body.querySelectorAll("script").length < 1) {
  throw new Error("The document body appears incomplete; refusing to write index.html.");
}

fs.writeFileSync(htmlPath, output, "utf8");
console.log("Updated " + payload.changes.length + " text nodes in index.html.");
console.log("Preserved the original HTML source structure without DOM serialization.");
