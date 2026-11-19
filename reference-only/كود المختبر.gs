// LAB SANDBOX BACKEND TEMPLATE: isolated from production. Replace the three identity placeholders before deployment.

const CLIENT_ID = "";
const ALLOWED_EMAIL = "";

const FOLDER_NAME = "مختبر - صور مدرسة عمر بن الخطاب ث بنين";
const SCHEDULE_FOLDER_NAME = "مختبر - قوائم فصول مدرسة عمر بن الخطاب ث بنين";
const PHOTO_ALBUMS_FOLDER_NAME = "مختبر - ألبومات معرض مدرسة عمر بن الخطاب ث بنين";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_CLASSES = ["1/1", "1/2", "1/3", "1/4", "1/5", "1/6", "1/7", "1/8"];
const RECOVERY_EMAIL = "";
const ALLOWED_PAGE_ORIGINS = [
  "https://dodydiaa2013-stack.github.io"
];
/* =========================
   المجلدات
========================= */

function getFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(FOLDER_NAME);
}

function getScheduleFolder() {
  const folders = DriveApp.getFoldersByName(SCHEDULE_FOLDER_NAME);
  return folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(SCHEDULE_FOLDER_NAME);
}
/* =========================
   مجلدات معرض الألبومات
========================= */


function getPhotoAlbums() {
  const rootFolder = getPhotoAlbumsFolder();
  const folders = rootFolder.getFolders();
  const albums = [];

  while (folders.hasNext()) {
    const folder = folders.next();
    const metadata = getPhotoAlbumMetadata(folder);

    const files = folder.getFiles();
    let images = [];
    let coverUrl = "";

    while (files.hasNext()) {
      const file = files.next();

      if (!isImageMimeType(file.getMimeType())) {
        continue;
      }

      const fileId = file.getId();

      if (fileId === metadata.coverFileId) {
        coverUrl = getImageUrl(fileId);
        continue;
      }

      images.push({
        id: fileId,
        name: file.getName(),
        url: getImageUrl(fileId)
      });
    }

    images = applySavedPhotoContentOrder_(
      images,
      "albumImages",
      folder.getId()
    );

    albums.push({
      id: folder.getId(),
      title: metadata.title,
      description: metadata.description,
      coverFileId: metadata.coverFileId,
      coverUrl: coverUrl,
      imageCount: images.length,
      images: images,
      updatedAt: metadata.updatedAt
    });
  }

  return applySavedPhotoContentOrder_(
    albums,
    "albums",
    ""
  );
}

function isFolderInsideFolder(folder, parentFolderId) {
  const parents = folder.getParents();

  while (parents.hasNext()) {
    if (parents.next().getId() === parentFolderId) {
      return true;
    }
  }

  return false;
}
/* =========================
   بيانات الألبومات
========================= */

function getPhotoAlbumMetadata(folder) {
  const description = folder.getDescription();

  if (!description) {
    return {
      title: folder.getName(),
      description: "",
      coverFileId: "",
      updatedAt: ""
    };
  }

  try {
    const data = JSON.parse(description);

    return {
      title: data.title || folder.getName(),
      description: data.description || "",
      coverFileId: data.coverFileId || "",
      updatedAt: data.updatedAt || ""
    };
  } catch (error) {
    return {
      title: folder.getName(),
      description: "",
      coverFileId: "",
      updatedAt: ""
    };
  }
}

function savePhotoAlbumMetadata(folder, data) {
  const oldData = getPhotoAlbumMetadata(folder);

  const metadata = {
    title: data.title || oldData.title,
    description: data.description !== undefined
      ? data.description
      : oldData.description,
    coverFileId: data.coverFileId !== undefined
      ? data.coverFileId
      : oldData.coverFileId,
    updatedAt: new Date().toISOString()
  };

  folder.setDescription(JSON.stringify(metadata));

  return metadata;
}
/* =========================
   قراءة ألبومات معرض الصور
========================= */
function savePhotoAlbumCover(folder, p) {
  if (!p.coverData) {
    return getPhotoAlbumMetadata(folder);
  }

  const mimeType = String(p.coverMimeType || "").trim();
  const fileName = getSafeFileName(p.coverName || "album-cover");

  if (!isImageMimeType(mimeType)) {
    throw new Error("ملف الغلاف يجب أن يكون صورة");
  }

  const bytes = decodeImageData(p.coverData, mimeType);

  if (!bytes || bytes.length === 0) {
    throw new Error("بيانات صورة الغلاف غير صالحة");
  }

  if (bytes.length > MAX_FILE_SIZE) {
    throw new Error("حجم صورة الغلاف يجب ألا يتجاوز 4 ميجابايت");
  }

  const blob = Utilities.newBlob(
    bytes,
    mimeType,
    fileName
  );

  const file = folder.createFile(blob);

  setPublicImage(file);

  return savePhotoAlbumMetadata(folder, {
    coverFileId: file.getId()
  });
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function scheduleUploadPostMessage(p, result) {
  p = p || {};

  const requestedOrigin = String(p.origin || "");
  const allowedOrigin = ALLOWED_PAGE_ORIGINS.includes(requestedOrigin)
    ? requestedOrigin
    : "";

  if (!allowedOrigin) {
    return jsonOutput({
      success: false,
      message: "مصدر الطلب غير مسموح"
    });
  }

  const payload = JSON.stringify({
    type: "scheduleUploadResult",
    nonce: String(p.nonce || ""),
    result: result || {}
  }).replace(/</g, "\\u003c");

  const html =
    "<!DOCTYPE html><html><body><script>" +
    "window.top.postMessage(" + payload + ", " +
    JSON.stringify(allowedOrigin) + ");" +
    "</script></body></html>";

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function galleryUploadPostMessage(p, result) {
  p = p || {};

  const requestedOrigin = String(p.origin || "");
  const allowedOrigin = ALLOWED_PAGE_ORIGINS.includes(requestedOrigin)
    ? requestedOrigin
    : "";

  if (!allowedOrigin) {
    return jsonOutput({
      success: false,
      message: "مصدر الطلب غير مسموح"
    });
  }

  const payload = JSON.stringify({
    type: "galleryUploadResult",
    nonce: String(p.nonce || ""),
    result: result || {}
  }).replace(/</g, "\\u003c");

  const html =
    "<!DOCTYPE html><html><body><script>" +
    "window.top.postMessage(" + payload + ", " +
    JSON.stringify(allowedOrigin) + ");" +
    "</script></body></html>";

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function pageChangesPostMessage(p, result) {
  const nonce = String(p && p.nonce || "");
  const requestedOrigin = String(p && p.origin || "");

  const allowedOrigin = ALLOWED_PAGE_ORIGINS.includes(requestedOrigin)
    ? requestedOrigin
    : "";

  if (!allowedOrigin) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: "مصدر الطلب غير مسموح"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const payload = JSON.stringify({
    type: "savePageChangesResult",
    nonce: nonce,
    result: Object.assign({ environment: "LAB" }, result || {})
  }).replace(/</g, "\\u003c");

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <script>
          window.top.postMessage(
            ${payload},
            ${JSON.stringify(allowedOrigin)}
          );
        </script>
      </body>
    </html>
  `;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function photoAlbumPostMessage(p, result) {
  p = p || {};

  const requestedOrigin = String(p.origin || "");
  const allowedOrigin = ALLOWED_PAGE_ORIGINS.includes(requestedOrigin)
    ? requestedOrigin
    : "";

  if (!allowedOrigin) {
    return jsonOutput({
      success: false,
      message: "مصدر الطلب غير مسموح"
    });
  }

  const payload = JSON.stringify({
    type: "photoAlbumResult",
    nonce: String(p.nonce || ""),
    result: result || {}
  }).replace(/</g, "\\u003c");

  const html =
    "<!DOCTYPE html><html><body><script>" +
    "window.top.postMessage(" + payload + ", " +
    JSON.stringify(allowedOrigin) + ");" +
    "</script></body></html>";

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function isPhotoAlbumAdminAuthorized(p) {
  if (!p || !p.token || !p.adminSessionToken) {
    return false;
  }

  return verifyAdminToken(p.token) &&
         verifyAdminSession(p.adminSessionToken);
}


/* =========================================
   ترتيب الصور والألبومات والحذف الجماعي
========================================= */


function getPhotoContentOrderKey_(scope, albumId) {
  const prefix = "PHOTO_CONTENT_ORDER_V1_";

  if (scope === "albumImages") {
    return prefix + "albumImages_" + encodeURIComponent(String(albumId));
  }

  return prefix + scope;
}


/* قراءة العناصر وفق الترتيب المحفوظ */
function applySavedPhotoContentOrder_(items, scope, albumId) {
  const key = getPhotoContentOrderKey_(scope, albumId);
  const savedValue = PropertiesService
    .getScriptProperties()
    .getProperty(key);

  if (!savedValue) return items;

  try {
    const savedIds = JSON.parse(savedValue);

    if (!Array.isArray(savedIds)) return items;

    const byId = new Map();

    items.forEach(function(item) {
      byId.set(String(item.id), item);
    });

    const ordered = [];
    const used = new Set();

    savedIds.forEach(function(id) {
      const normalizedId = String(id);

      if (byId.has(normalizedId) && !used.has(normalizedId)) {
        ordered.push(byId.get(normalizedId));
        used.add(normalizedId);
      }
    });

    // إضافة العناصر الجديدة التي لم تكن موجودة وقت حفظ الترتيب.
    items.forEach(function(item) {
      const id = String(item.id);

      if (!used.has(id)) {
        ordered.push(item);
        used.add(id);
      }
    });

    return ordered;

  } catch (error) {
    console.error("تعذر قراءة ترتيب المحتوى: " + error.message);
    return items;
  }
}


/* الحصول على العناصر الحالية حسب النطاق */
function getPhotoContentItemsForOrder_(scope, albumId) {
  const items = [];

  if (scope === "gallery") {
    const files = getFolder().getFiles();

    while (files.hasNext()) {
      const file = files.next();

      if (file.getMimeType().startsWith("image/")) {
        items.push({
          id: file.getId()
        });
      }
    }

    return items;
  }

  if (scope === "albums") {
    const folders = getPhotoAlbumsFolder().getFolders();

    while (folders.hasNext()) {
      const folder = folders.next();

      items.push({
        id: folder.getId()
      });
    }

    return items;
  }

  if (scope === "albumImages") {
    if (!albumId) {
      throw new Error("معرّف الألبوم غير موجود");
    }

    const folder = getPhotoAlbumFolder(albumId);
    const metadata = getPhotoAlbumMetadata(folder);
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();

      if (!isImageMimeType(file.getMimeType())) continue;

      // لا يدخل غلاف الألبوم ضمن ترتيب الصور أو الحذف الجماعي.
      if (file.getId() === metadata.coverFileId) continue;

      items.push({
        id: file.getId()
      });
    }

    return items;
  }

  throw new Error("نطاق المحتوى غير مسموح");
}


/* حفظ ترتيب المحتوى */

function savePhotoContentOrder(p) {
  p = p || {};

  try {
    if (!isPhotoAlbumAdminAuthorized(p)) {
      throw new Error("غير مصرح لك بتغيير ترتيب المحتوى");
    }

    const scope = String(p.scope || "").trim();
    const albumId = String(p.albumId || "").trim();

    if (!["gallery", "albums", "albumImages"].includes(scope)) {
      throw new Error("نطاق الترتيب غير صحيح");
    }

    if (scope === "albumImages" && !albumId) {
      throw new Error("معرّف الألبوم غير موجود");
    }

    let ids;

    try {
      ids = JSON.parse(String(p.ids || ""));
    } catch (error) {
      throw new Error("قائمة الترتيب غير صالحة");
    }

    if (!Array.isArray(ids) || ids.length > 5000 || !ids.length) {
      throw new Error("قائمة الترتيب فارغة أو أكبر من الحد المسموح");
    }

    ids = ids.map(function(id) {
      return String(id || "").trim();
    });

    if (ids.some(function(id) { return !id; })) {
      throw new Error("توجد معرّفات غير صالحة ضمن الترتيب");
    }

    if (new Set(ids).size !== ids.length) {
      throw new Error("توجد معرّفات مكررة ضمن الترتيب");
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
      const currentItems = getPhotoContentItemsForOrder_(scope, albumId);
      const currentIds = new Set(
        currentItems.map(function(item) {
          return String(item.id);
        })
      );

      // يجب أن تكون القائمة المرسلة ترتيبًا كاملًا للعناصر الموجودة.
      if (
        ids.length !== currentIds.size ||
        ids.some(function(id) {
          return !currentIds.has(id);
        })
      ) {
        throw new Error(
          "تغيرت قائمة المحتوى. حدّث القائمة ثم حاول حفظ الترتيب مرة أخرى."
        );
      }

      const key = getPhotoContentOrderKey_(scope, albumId);

      PropertiesService.getScriptProperties().setProperty(
        key,
        JSON.stringify(ids)
      );

    } finally {
      lock.releaseLock();
    }

    return photoAlbumPostMessage(p, {
      success: true,
      message: "تم حفظ ترتيب المحتوى بنجاح",
      scope: scope,
      count: ids.length
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message || "تعذر حفظ الترتيب"
    });
  }
}


/* الحذف الجماعي الآمن */
/* الحذف الجماعي الآمن */
function bulkDeletePhotoContent(p) {
  p = p || {};

  try {
    if (!isPhotoAlbumAdminAuthorized(p)) {
      throw new Error("غير مصرح لك بحذف المحتوى");
    }

    const scope = String(p.scope || "").trim();
    const albumId = String(p.albumId || "").trim();

    if (!["gallery", "albums", "albumImages"].includes(scope)) {
      throw new Error("نطاق الحذف غير صحيح");
    }

    if (scope === "albumImages" && !albumId) {
      throw new Error("معرّف الألبوم غير موجود");
    }

    let ids;

    try {
      ids = JSON.parse(String(p.ids || ""));
    } catch (error) {
      throw new Error("قائمة الحذف غير صالحة");
    }

    if (!Array.isArray(ids) || !ids.length || ids.length > 5000) {
      throw new Error(
        "قائمة الحذف فارغة أو أكبر من الحد المسموح"
      );
    }

    ids = ids.map(function(id) {
      return String(id || "").trim();
    });

    if (ids.some(function(id) { return !id; })) {
      throw new Error("توجد معرّفات غير صالحة");
    }

    if (new Set(ids).size !== ids.length) {
      throw new Error(
        "توجد معرّفات مكررة في قائمة الحذف"
      );
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
      const currentItems = getPhotoContentItemsForOrder_(
        scope,
        albumId
      );

      const currentIds = new Set(
        currentItems.map(function(item) {
          return String(item.id);
        })
      );

      // التحقق من جميع العناصر قبل حذف أي عنصر.
      if (ids.some(function(id) {
        return !currentIds.has(id);
      })) {
        throw new Error(
          "بعض العناصر المحددة غير موجودة أو لا تنتمي إلى هذا القسم"
        );
      }

      const targets = [];

      if (scope === "albums") {
        const rootFolder = getPhotoAlbumsFolder();

        ids.forEach(function(id) {
          const folder = DriveApp.getFolderById(id);

          if (!isFolderInsideFolder(folder, rootFolder.getId())) {
            throw new Error(
              "أحد الألبومات المحددة خارج مجلد المعرض"
            );
          }

          targets.push({
            id: id,
            item: folder
          });
        });

      } else {
        const parentFolder = scope === "gallery"
          ? getFolder()
          : getPhotoAlbumFolder(albumId);

        const metadata = scope === "albumImages"
          ? getPhotoAlbumMetadata(parentFolder)
          : null;

        ids.forEach(function(id) {
          const file = DriveApp.getFileById(id);

          if (!isFileInsideFolder(file, parentFolder.getId())) {
            throw new Error(
              "إحدى الصور المحددة خارج المجلد المطلوب"
            );
          }

          if (
            scope === "gallery" &&
            !file.getMimeType().startsWith("image/")
          ) {
            throw new Error(
              "أحد الملفات المحددة ليس صورة"
            );
          }

          if (
            scope === "albumImages" &&
            !isImageMimeType(file.getMimeType())
          ) {
            throw new Error(
              "أحد الملفات المحددة ليس صورة صالحة"
            );
          }

          if (
            scope === "albumImages" &&
            metadata.coverFileId === id
          ) {
            throw new Error(
              "لا يمكن حذف غلاف الألبوم ضمن الحذف الجماعي. غيّر الغلاف أولًا."
            );
          }

          targets.push({
            id: id,
            item: file
          });
        });
      }

      // بعد نجاح جميع عمليات التحقق تبدأ عمليات الحذف.
      targets.forEach(function(target) {
        target.item.setTrashed(true);
      });

      const props = PropertiesService.getScriptProperties();
      const orderKey = getPhotoContentOrderKey_(scope, albumId);

      const remainingIds = currentItems
        .map(function(item) {
          return String(item.id);
        })
        .filter(function(id) {
          return ids.indexOf(id) === -1;
        });

      props.setProperty(
        orderKey,
        JSON.stringify(remainingIds)
      );

      /*
       * لا نحذف ترتيب الصور الداخلية للألبومات المحذوفة.
       * نحتاج هذا الترتيب عند استعادة الألبوم.
       */

    } finally {
      lock.releaseLock();
    }

    return photoAlbumPostMessage(p, {
      success: true,
      message:
        "تم حذف العناصر المحددة بنجاح ونقلها إلى سلة مهملات Google Drive",
      scope: scope,
      deletedCount: ids.length
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message || "تعذر تنفيذ الحذف الجماعي"
    });
  }
}

function createPhotoAlbum(p) {
  try {
    const isAuthorized = isPhotoAlbumAdminAuthorized(p);
    if (!isAuthorized) {
      throw new Error("غير مصرح لك بإنشاء ألبوم");
    }

    const title = String(p.title || "").trim();
    const description = String(p.description || "").trim();

    if (!title) {
      throw new Error("اكتب اسم الألبوم");
    }

    if (title.length > 80) {
      throw new Error("اسم الألبوم طويل جدًا");
    }

    if (description.length > 500) {
      throw new Error("وصف الألبوم طويل جدًا");
    }

    const rootFolder = getPhotoAlbumsFolder();
    const albumFolder = rootFolder.createFolder(title);

    let metadata = savePhotoAlbumMetadata(
  albumFolder,
  {
    title: title,
    description: description,
    coverFileId: ""
  }
);

if (p.coverData) {
  metadata = savePhotoAlbumCover(albumFolder, p);
}
const albumImages = [];
const albumFiles = albumFolder.getFiles();

while (albumFiles.hasNext()) {
  const file = albumFiles.next();

  if (!isImageMimeType(file.getMimeType())) {
    continue;
  }

  albumImages.push({
    id: file.getId(),
    name: file.getName(),
    url: getImageUrl(file.getId())
  });
}
    return photoAlbumPostMessage(p, {
      success: true,
      message: "تم إنشاء الألبوم بنجاح",
      album: {
        id: albumFolder.getId(),
        title: metadata.title,
        description: metadata.description,
        coverFileId: metadata.coverFileId || "",
coverUrl: metadata.coverFileId
  ? getImageUrl(metadata.coverFileId)
  : "",
        imageCount: albumImages.length,
images: albumImages,
updatedAt: metadata.updatedAt
      }
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message
    });
  }
}
/* =========================
   تعديل بيانات الألبوم
========================= */

function updatePhotoAlbum(p) {
  try {
    const isAuthorized = isPhotoAlbumAdminAuthorized(p);

    if (!isAuthorized) {
      throw new Error("غير مصرح لك بتعديل الألبوم");
    }

    const albumId = String(p.albumId || "").trim();

    if (!albumId) {
      throw new Error("معرّف الألبوم غير موجود");
    }

    const albumFolder = getPhotoAlbumFolder(albumId);

    const title = String(p.title || "").trim();
    const description = String(p.description || "").trim();

    if (!title) {
      throw new Error("اكتب اسم الألبوم");
    }

    if (title.length > 80) {
      throw new Error("اسم الألبوم طويل جدًا");
    }

    if (description.length > 500) {
      throw new Error("وصف الألبوم طويل جدًا");
    }

    albumFolder.setName(title);

    let metadata = savePhotoAlbumMetadata(
  albumFolder,
  {
    title: title,
    description: description
  }
);

if (p.coverData) {
  metadata = savePhotoAlbumCover(albumFolder, p);
}

    return photoAlbumPostMessage(p, {
      success: true,
      message: "تم تعديل بيانات الألبوم بنجاح",
      album: {
        id: albumFolder.getId(),
        title: metadata.title,
        description: metadata.description,
        coverFileId: metadata.coverFileId,
        coverUrl: metadata.coverFileId
          ? getImageUrl(metadata.coverFileId)
          : "",
        updatedAt: metadata.updatedAt
      }
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message
    });
  }
}
/* =========================
   رفع صورة داخل ألبوم
========================= */

function uploadPhotoAlbumImage(p) {
  try {
    const isAuthorized = isPhotoAlbumAdminAuthorized(p);

    if (!isAuthorized) {
      throw new Error("غير مصرح لك برفع الصور");
    }

    const albumId = String(p.albumId || "").trim();

    if (!albumId) {
      throw new Error("معرّف الألبوم غير موجود");
    }

    const albumFolder = getPhotoAlbumFolder(albumId);

    const fileName = getSafeFileName(p.fileName);
    const mimeType = p.mimeType || "";
    const data = p.data || "";

    if (!data) {
      throw new Error("بيانات الصورة غير موجودة");
    }

    const bytes = decodeImageData(data, mimeType);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);

    const file = albumFolder.createFile(blob);

    // مشاركة الصورة نفسها فقط، وليس مجلد الألبوم.
    setPublicImage(file);

    const metadata = getPhotoAlbumMetadata(albumFolder);

    // جعل أول صورة مرفوعة غلافًا تلقائيًا.
    if (!metadata.coverFileId) {
      savePhotoAlbumMetadata(albumFolder, {
        coverFileId: file.getId()
      });
    }

    return photoAlbumPostMessage(p, {
      success: true,
      message: "تم رفع الصورة بنجاح",
      image: {
        id: file.getId(),
        name: file.getName(),
        url: getImageUrl(file.getId())
      }
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message
    });
  }
}
/* =========================
   تغيير غلاف الألبوم
========================= */

function updatePhotoAlbumCover(p) {
  try {
    const isAuthorized = isPhotoAlbumAdminAuthorized(p);

    if (!isAuthorized) {
      throw new Error("غير مصرح لك بتغيير الغلاف");
    }

    const albumId = String(p.albumId || "").trim();
    const fileId = String(p.fileId || "").trim();

    if (!albumId || !fileId) {
      throw new Error("بيانات الألبوم أو الصورة غير مكتملة");
    }

    const albumFolder = getPhotoAlbumFolder(albumId);
    const file = DriveApp.getFileById(fileId);

    if (!isFileInsideFolder(file, albumFolder.getId())) {
      throw new Error("الصورة ليست داخل هذا الألبوم");
    }

    if (!isImageMimeType(file.getMimeType())) {
      throw new Error("الملف المحدد ليس صورة");
    }

    const metadata = savePhotoAlbumMetadata(
      albumFolder,
      {
        coverFileId: fileId
      }
    );

    return photoAlbumPostMessage(p, {
      success: true,
      message: "تم تغيير غلاف الألبوم بنجاح",
      coverFileId: metadata.coverFileId,
      coverUrl: getImageUrl(fileId)
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message
    });
  }
}
/* =========================
   استبدال صورة داخل ألبوم
========================= */

function replacePhotoAlbumImage(p) {
  try {
    const isAuthorized = isPhotoAlbumAdminAuthorized(p);

    if (!isAuthorized) {
      throw new Error("غير مصرح لك باستبدال الصور");
    }

    const albumId = String(p.albumId || "").trim();
    const oldFileId = String(p.imageId || p.fileId || "").trim();

    if (!albumId || !oldFileId) {
      throw new Error(
        "بيانات الألبوم أو الصورة غير مكتملة"
      );
    }

    const albumFolder = getPhotoAlbumFolder(albumId);
    const oldFile = DriveApp.getFileById(oldFileId);

    if (!isFileInsideFolder(oldFile, albumFolder.getId())) {
      throw new Error(
        "الصورة القديمة ليست داخل هذا الألبوم"
      );
    }

    if (!isImageMimeType(oldFile.getMimeType())) {
      throw new Error("الملف القديم ليس صورة");
    }

    const fileName = getSafeFileName(p.fileName);
    const mimeType = p.mimeType || "";
    const data = p.data || "";

    if (!data) {
      throw new Error("بيانات الصورة الجديدة غير موجودة");
    }

    const bytes = decodeImageData(data, mimeType);
    const blob = Utilities.newBlob(
      bytes,
      mimeType,
      fileName
    );

    // إنشاء الصورة الجديدة أولًا.
    const newFile = albumFolder.createFile(blob);

    setPublicImage(newFile);

    const metadata = getPhotoAlbumMetadata(albumFolder);

    // إذا كانت الصورة القديمة هي الغلاف، نحدّث الغلاف.
    if (metadata.coverFileId === oldFileId) {
      savePhotoAlbumMetadata(albumFolder, {
        coverFileId: newFile.getId()
      });
    }

    // حذف الصورة القديمة بعد نجاح إنشاء الجديدة.
    oldFile.setTrashed(true);

    return photoAlbumPostMessage(p, {
      success: true,
      message: "تم استبدال الصورة بنجاح",
      oldFileId: oldFileId,
      image: {
        id: newFile.getId(),
        name: newFile.getName(),
        url: getImageUrl(newFile.getId())
      },
      coverFileId: metadata.coverFileId === oldFileId
        ? newFile.getId()
        : metadata.coverFileId
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message
    });
  }
}
/* =========================
   حذف صورة من ألبوم
========================= */

function deletePhotoAlbumImage(p) {
  try {
    const isAuthorized = isPhotoAlbumAdminAuthorized(p);

    if (!isAuthorized) {
      throw new Error("غير مصرح لك بحذف الصور");
    }

    const albumId = String(p.albumId || "").trim();
    const fileId = String(p.imageId || p.fileId || "").trim();

    if (!albumId || !fileId) {
      throw new Error(
        "بيانات الألبوم أو الصورة غير مكتملة"
      );
    }

    const albumFolder = getPhotoAlbumFolder(albumId);
    const file = DriveApp.getFileById(fileId);

    if (!isFileInsideFolder(file, albumFolder.getId())) {
      throw new Error("الصورة ليست داخل هذا الألبوم");
    }

    if (!isImageMimeType(file.getMimeType())) {
      throw new Error("الملف المحدد ليس صورة");
    }

    const metadata = getPhotoAlbumMetadata(albumFolder);

    if (metadata.coverFileId === fileId) {
      throw new Error(
        "لا يمكن حذف غلاف الألبوم. غيّر الغلاف أولًا"
      );
    }

    file.setTrashed(true);

    return photoAlbumPostMessage(p, {
      success: true,
      message: "تم حذف الصورة بنجاح",
      fileId: fileId
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message
    });
  }
}
/* =========================
   حذف ألبوم بالكامل
========================= */

function deletePhotoAlbum(p) {
  try {
    const isAuthorized = isPhotoAlbumAdminAuthorized(p);

    if (!isAuthorized) {
      throw new Error("غير مصرح لك بحذف الألبوم");
    }

    const albumId = String(p.albumId || "").trim();

    if (!albumId) {
      throw new Error("معرّف الألبوم غير موجود");
    }

    const rootFolder = getPhotoAlbumsFolder();
    const albumFolder = DriveApp.getFolderById(albumId);

    if (!isFolderInsideFolder(albumFolder, rootFolder.getId())) {
      throw new Error(
        "الألبوم غير موجود داخل مجلد معرض الصور"
      );
    }

    // نقل الألبوم ومحتوياته إلى سلة المهملات.
    albumFolder.setTrashed(true);

    return photoAlbumPostMessage(p, {
      success: true,
      message: "تم حذف الألبوم بنجاح"
    });

  } catch (error) {
    return photoAlbumPostMessage(p, {
      success: false,
      message: error.message
    });
  }
}
function isAllowedClass(className) {
  return ALLOWED_CLASSES.indexOf(className) !== -1;
}

function getImageUrl(fileId) {
  return "https://drive.google.com/thumbnail?id=" +
    fileId + "&sz=w1200";
}

function isImageMimeType(mimeType) {
  return /^image\/(jpeg|png|webp|gif)$/.test(mimeType);
}

function getSafeFileName(fileName) {
  return String(fileName || "school-image")
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 100);
}


function decodeImageData(data, mimeType) {
  if (!data || !isImageMimeType(mimeType)) {
    throw new Error("بيانات الصورة أو نوعها غير صحيح");
  }

  if (data.length > Math.ceil(MAX_FILE_SIZE * 4 / 3) + 8) {
    throw new Error("حجم الصورة أكبر من 4 ميجابايت");
  }

  const bytes = Utilities.base64Decode(data);

  if (bytes.length > MAX_FILE_SIZE) {
    throw new Error("حجم الصورة أكبر من 4 ميجابايت");
  }

  // تنظيف بيانات EXIF قبل حفظ الصورة
  return stripImageExif_(bytes, mimeType);
}

function setPublicImage(file) {
  file.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );
}


/* =========================
   عرض معرض الصور
========================= */


function getGalleryImages() {
  const files = getFolder().getFiles();
  const images = [];

  while (files.hasNext()) {
    const file = files.next();

    if (file.getMimeType().startsWith("image/")) {
      images.push({
        id: file.getId(),
        name: file.getName(),
        url: getImageUrl(file.getId())
      });
    }
  }

  return applySavedPhotoContentOrder_(
    images,
    "gallery",
    ""
  );
}


function getSchedules() {
  const folder = getScheduleFolder();
  const files = folder.getFiles();
  const schedules = {};

  ALLOWED_CLASSES.forEach(function(className) {
    schedules[className] = null;
  });

  while (files.hasNext()) {
    const file = files.next();

    if (!file.getMimeType().startsWith("image/")) {
      continue;
    }

    const description = file.getDescription() || "";
    const match = description.match(/^CLASS:(1\/[1-8])$/);

    if (!match) {
      continue;
    }

    const className = match[1];

    if (!isAllowedClass(className)) {
      continue;
    }

    schedules[className] = {
      className: className,
      id: file.getId(),
      name: file.getName(),
      url: getImageUrl(file.getId())
    };
  }

  return schedules;
}


/* =========================
   GET
========================= */

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const action = p.action || "";
  if (action === "galleryUploadStatus") {
  return getGalleryUploadStatus(p);
}

  if (action === "gallery") {
    const images = getGalleryImages();

    return outputWithCallback(
      { success: true, images: images },
      p.callback
    );
  }
if (action === "photoAlbums") {
  const albums = getPhotoAlbums();

  return outputWithCallback(
    {
      success: true,
      albums: albums
    },
    p.callback
  );
}
  if (action === "schedules") {
    const schedules = getSchedules();

    return outputWithCallback(
      { success: true, schedules: schedules },
      p.callback
    );
  }
  if (action === "pageChanges") {
    if (String(p.environment || "") !== "LAB") {
      return outputWithCallback({
        success: false,
        environment: "LAB",
        message: "طلب قراءة النصوص لا يحمل علامة المختبر الصحيحة."
      }, p.callback);
    }
    return outputWithCallback(
      getPageChangesForClient_(),
      p.callback
    );
  }
  return ContentService.createTextOutput(
    "خدمة صور مدرسة عمر بن الخطاب تعمل"
  );
}

function outputWithCallback(data, callback) {
  const result = JSON.stringify(data);

  if (callback && /^[a-zA-Z_$][\w.$]*$/.test(callback)) {
    return ContentService.createTextOutput(
      callback + "(" + result + ");"
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonOutput(data);
}


/* =========================
   POST
========================= */



function doPost(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const action = p.action || "";

  try {
        if (action === "adminLogin") {
      return adminLogin(p);
    }

    if (action === "adminLogout") {
      return adminLogout(p);
    }

    if (action === "requestPasswordRecovery") {
      return requestPasswordRecovery(p);
    }

    if (action === "verifyPasswordRecoveryCode") {
      return verifyPasswordRecoveryCode(p);
    }

    if (action === "resetAdminPassword") {
      return resetAdminPassword(p);
    }

    if (action === "verifyDeveloperGoogle") {
      return verifyDeveloperGoogle(p);
    }

    if (action === "savePageChanges") {
      return savePageChanges(p);
    }

    if (action === "uploadGalleryImage") {
      return uploadGalleryImage(p);
    }

    if (action === "replaceGalleryImage") {
      return replaceGalleryImage(p);
    }

    if (action === "delete") {
      return deleteGalleryImage(p);
    }

    if (action === "uploadSchedule") {
      return uploadScheduleImage(p);
    }

    if (action === "deleteSchedule") {
      return deleteScheduleImage(p);
    }

    if (action === "bulkDeleteSchedules") {
      return bulkDeleteSchedules(p);
    }

    if (action === "createPhotoAlbum") {
      return createPhotoAlbum(p);
    }

    if (action === "updatePhotoAlbum") {
      return updatePhotoAlbum(p);
    }

    if (action === "uploadPhotoAlbumImage") {
      return uploadPhotoAlbumImage(p);
    }

    if (action === "updatePhotoAlbumCover") {
      return updatePhotoAlbumCover(p);
    }

    if (action === "replacePhotoAlbumImage") {
      return replacePhotoAlbumImage(p);
    }

    if (action === "savePhotoContentOrder") {
      return savePhotoContentOrder(p);
    }

    if (action === "bulkDeletePhotoContent") {
      return bulkDeletePhotoContent(p);
    }

    if (action === "deletePhotoAlbumImage") {
      return deletePhotoAlbumImage(p);
    }

    if (action === "deletePhotoAlbum") {
      return deletePhotoAlbum(p);
    }

    return jsonOutput({
      success: false,
      message: "العملية المطلوبة غير معروفة أو غير مدعومة."
    });

  } catch (error) {
    const message = error.message || "تعذر تنفيذ العملية";

    if (action === "adminLogout") {
      return adminLogoutPostMessage(p, {
        success: false,
        message: message
      });
    }

    if (action === "verifyDeveloperGoogle") {
      return developerGooglePostMessage(p, {
        success: false,
        message: message
      });
    }

    if (action === "savePageChanges") {
      return pageChangesPostMessage(p, {
        success: false,
        message: message
      });
    }

    if (action === "uploadSchedule") {
      return scheduleUploadPostMessage(p, {
        success: false,
        message: message
      });
    }

    if (action === "uploadGalleryImage") {
      return galleryUploadPostMessage(p, {
        success: false,
        message: message
      });
    }

    if ([
      "createPhotoAlbum",
      "updatePhotoAlbum",
      "uploadPhotoAlbumImage",
      "updatePhotoAlbumCover",
      "replacePhotoAlbumImage",
      "deletePhotoAlbumImage",
      "deletePhotoAlbum",
      "savePhotoContentOrder",
      "bulkDeletePhotoContent"
    ].includes(action)) {
      return photoAlbumPostMessage(p, {
        success: false,
        message: message
      });
    }

    return jsonOutput({
      success: false,
      message: message
    });
  }
}


function uploadGalleryImage(p) {
  p = p || {};

  const nonce = String(p.nonce || "");
  const validNonce = /^[A-Za-z0-9_-]{10,120}$/.test(nonce);
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    if (!validNonce) {
      throw new Error("رقم طلب الرفع غير صالح.");
    }

    const token = p.token || "";
    const fileName = getSafeFileName(p.fileName);
    const mimeType = p.mimeType || "";
    const data = p.data || "";

    if (!token || !data) {
      throw new Error("بيانات الرفع غير مكتملة");
    }

    verifyAdminToken(token);
    verifyAdminSession(p.adminSessionToken || "");

    // منع إنشاء ملف مكرر لنفس الطلب.
    lock.waitLock(25000);
    lockAcquired = true;
    cleanupOldGalleryUploadResults_();
    const props = PropertiesService.getScriptProperties();
    const resultKey = "GALLERY_UPLOAD_RESULT_" + nonce;
    const previous = props.getProperty(resultKey);

    if (previous) {
      const saved = JSON.parse(previous);

      if (
        saved.savedAt &&
        Date.now() - saved.savedAt < 10 * 60 * 1000
      ) {
        return galleryUploadPostMessage(p, saved.result);
      }

      props.deleteProperty(resultKey);
    }

    const bytes = decodeImageData(data, mimeType);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = getFolder().createFile(blob);

    setPublicImage(file);

    const result = {
      success: true,
      message: "تم رفع الصورة وحفظها بنجاح",
      fileName: file.getName(),
      fileId: file.getId(),
      image: {
        id: file.getId(),
        name: file.getName(),
        url: getImageUrl(file.getId())
      },
      time: new Date().toISOString()
    };

    // حفظ نتيجة الطلب قبل إرسال تأكيد المتصفح.
    props.setProperty(
      resultKey,
      JSON.stringify({
        savedAt: Date.now(),
        result: result
      })
    );

    
    return galleryUploadPostMessage(p, result);

  } catch (error) {
    const result = {
      success: false,
      message: error.message || "تعذر رفع الصورة"
    };

    // حفظ نتيجة الفشل أيضًا لمنع إعادة تنفيذ الطلب نفسه.
    if (lockAcquired && validNonce) {
      try {
        PropertiesService.getScriptProperties().setProperty(
          "GALLERY_UPLOAD_RESULT_" + nonce,
          JSON.stringify({
            savedAt: Date.now(),
            result: result
          })
        );
      } catch (saveError) {
        console.error("تعذر حفظ نتيجة الرفع: " + saveError.message);
      }
    }

    return galleryUploadPostMessage(p, result);

  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function replaceGalleryImage(p) {
  p = p || {};

  const nonce = String(p.nonce || "");
  const validNonce = /^[A-Za-z0-9_-]{10,120}$/.test(nonce);
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  let newFile = null;
  let replacementCompleted = false;

  try {
    if (!validNonce) {
      throw new Error("رقم طلب الاستبدال غير صالح.");
    }

    verifyAdminToken(p.token || "");
    verifyAdminSession(p.adminSessionToken || "");

    lock.waitLock(25000);
    lockAcquired = true;

    cleanupOldGalleryUploadResults_();
    const props = PropertiesService.getScriptProperties();
    const resultKey = "GALLERY_UPLOAD_RESULT_" + nonce;
    const previous = props.getProperty(resultKey);

    // منع تنفيذ الاستبدال مرتين إذا أعاد المتصفح إرسال الطلب نفسه.
    if (previous) {
      const saved = JSON.parse(previous);
      if (saved.savedAt && Date.now() - saved.savedAt < 10 * 60 * 1000) {
        return galleryUploadPostMessage(p, saved.result || {
          success: false,
          message: "تعذر قراءة نتيجة الاستبدال السابق."
        });
      }
      props.deleteProperty(resultKey);
    }

    const oldFileId = String(p.oldFileId || "").trim();
    const fileName = getSafeFileName(p.fileName);
    const mimeType = String(p.mimeType || "").trim();
    const data = p.data || "";

    if (!oldFileId || !data) {
      throw new Error("بيانات استبدال الصورة غير مكتملة.");
    }

    if (!isImageMimeType(mimeType)) {
      throw new Error("نوع الصورة غير مسموح. استخدم JPG أو PNG أو WEBP أو GIF.");
    }

    const folder = getFolder();
    const oldFile = DriveApp.getFileById(oldFileId);

    if (
      oldFile.isTrashed() ||
      !isFileInsideFolder(oldFile, folder.getId()) ||
      !isImageMimeType(oldFile.getMimeType())
    ) {
      throw new Error("الصورة الأصلية غير موجودة في معرض المدرسة أو لم تعد متاحة.");
    }

    const bytes = decodeImageData(data, mimeType);
    newFile = folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));
    setPublicImage(newFile);

    // لا ننقل الصورة القديمة إلى المهملات إلا بعد إنشاء الجديدة وضبط صلاحياتها.
    oldFile.setTrashed(true);
    replacementCompleted = true;

    // الحفاظ على موضع الصورة القديمة في الترتيب المحفوظ.
    const orderKey = getPhotoContentOrderKey_("gallery", "");
    const savedOrder = props.getProperty(orderKey);
    if (savedOrder) {
      try {
        const ids = JSON.parse(savedOrder);
        if (Array.isArray(ids)) {
          props.setProperty(orderKey, JSON.stringify(ids.map(function(id) {
            return String(id) === oldFileId ? newFile.getId() : id;
          })));
        }
      } catch (orderError) {
        console.error("تعذر تحديث ترتيب المعرض أثناء الاستبدال: " + orderError.message);
      }
    }

    const result = {
      success: true,
      message: "تم استبدال الصورة بنجاح والحفاظ على ترتيبها.",
      fileName: newFile.getName(),
      fileId: newFile.getId(),
      image: {
        id: newFile.getId(),
        name: newFile.getName(),
        url: getImageUrl(newFile.getId())
      },
      replacedFileId: oldFileId,
      time: new Date().toISOString()
    };

    // حفظ التأكيد حتى يستطيع المتصفح استرجاعه إذا تعذر وصول postMessage.
    props.setProperty(resultKey, JSON.stringify({
      savedAt: Date.now(),
      result: result
    }));
   
    return galleryUploadPostMessage(p, result);

  } catch (error) {
    // إذا فشل الاستبدال قبل نقل الأصل إلى المهملات، نظّف الملف الجديد فقط.
    if (newFile && !replacementCompleted) {
      try {
        newFile.setTrashed(true);
      } catch (cleanupError) {
        console.error("تعذر تنظيف ملف الاستبدال غير المكتمل: " + cleanupError.message);
      }
    }

    const result = {
      success: false,
      message: error.message || "تعذر استبدال الصورة."
    };

    if (lockAcquired && validNonce) {
      try {
        PropertiesService.getScriptProperties().setProperty(
          "GALLERY_UPLOAD_RESULT_" + nonce,
          JSON.stringify({ savedAt: Date.now(), result: result })
        );
      } catch (saveError) {
        console.error("تعذر حفظ نتيجة فشل الاستبدال: " + saveError.message);
      }
    }

    return galleryUploadPostMessage(p, result);

  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}


function deleteGalleryImage(p) {
  verifyAdminToken(p.token || "");
  verifyAdminSession(p.adminSessionToken || "");

  const fileId = p.fileId || "";

  if (!fileId) {
    throw new Error("معرّف الصورة غير موجود");
  }

  const folder = getFolder();
  const file = DriveApp.getFileById(fileId);

  if (
    !isFileInsideFolder(file, folder.getId()) ||
    !file.getMimeType().startsWith("image/")
  ) {
    throw new Error(
      "الصورة غير موجودة في مجلد صور المدرسة"
    );
  }

  file.setTrashed(true);

  return jsonOutput({
    success: true,
    message: "تم حذف الصورة بنجاح"
  });
}

/* =========================
   رفع أو استبدال صورة فصل
========================= */

function uploadScheduleImage(p) {
  const startedAt = Date.now();
  const timings = {};
  const mark = (name, start) => {
    timings[name] = Date.now() - start;
  };

  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  let newFile = null;
  let uploadCompleted = false;

  try {
    let t = Date.now();
    verifyAdminToken(p.token || "");
    verifyAdminSession(p.adminSessionToken || "");
    mark("التحقق من الصلاحيات", t);

    const className = p.className || "";
    const fileName = getSafeFileName(p.fileName);
    const mimeType = p.mimeType || "";
    const data = p.data || "";

    if (!isAllowedClass(className)) {
      throw new Error("الفصل المحدد غير مسموح به");
    }
    if (!data) throw new Error("لم يتم إرسال صورة");

    t = Date.now();
    const bytes = decodeImageData(data, mimeType);
    mark("فك بيانات الصورة", t);

    t = Date.now();
    lock.waitLock(20000);
    lockAcquired = true;
    mark("انتظار القفل", t);

    t = Date.now();
    const folder = getScheduleFolder();
    const blob = Utilities.newBlob(bytes, mimeType, fileName);

    newFile = folder.createFile(blob);
    mark("إنشاء الملف في Drive", t);

    t = Date.now();
    newFile.setDescription("CLASS:" + className);
    mark("تسجيل بيانات الفصل", t);

    t = Date.now();
    setPublicImage(newFile);
    mark("ضبط صلاحيات الصورة", t);

    uploadCompleted = true;

    t = Date.now();
    const files = folder.getFiles();
    let scanned = 0;
    let deleted = 0;
    let deleteErrors = 0;

    while (files.hasNext()) {
      const oldFile = files.next();
      scanned++;

      if (
        oldFile.getId() !== newFile.getId() &&
        (oldFile.getDescription() || "") === "CLASS:" + className
      ) {
        try {
          oldFile.setTrashed(true);
          deleted++;
        } catch (deleteError) {
          deleteErrors++;
          console.error("تعذر حذف القائمة القديمة: " + deleteError.message);
        }
      }
    }

    mark("البحث عن الصور القديمة وحذفها", t);

    timings["عدد الملفات التي تم فحصها"] = scanned;
    timings["عدد الملفات القديمة المحذوفة"] = deleted;
    timings["عدد أخطاء الحذف"] = deleteErrors;

    console.log(
      "تشخيص رفع الفصل " + className + ": " +
      JSON.stringify(timings)
    );
    console.log("إجمالي زمن العملية: " + (Date.now() - startedAt) + " ms");

    return scheduleUploadPostMessage(p, {
      success: true,
      message: deleteErrors
        ? "تم رفع الصورة الجديدة، وتعذر حذف إحدى الصور القديمة."
        : "تم رفع قائمة الفصل بنجاح",
      className: className,
      fileId: newFile.getId(),
      fileName: newFile.getName(),
      url: getImageUrl(newFile.getId())
    });

  } catch (error) {
    if (newFile && !uploadCompleted) {
      try {
        newFile.setTrashed(true);
      } catch (cleanupError) {
        console.error(cleanupError);
      }
    }

    console.error("خطأ رفع الفصل: " + error.message);
    console.error("الأزمنة: " + JSON.stringify(timings));
    console.error("إجمالي الزمن: " + (Date.now() - startedAt) + " ms");

    return scheduleUploadPostMessage(p, {
      success: false,
      message: error.message || "تعذر رفع قائمة الفصل"
    });

  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function deleteScheduleImage(p) {
  verifyAdminToken(p.token || "");
verifyAdminSession(p.adminSessionToken || "");
  const fileId = p.fileId || "";
  const className = p.className || "";

  if (!fileId || !isAllowedClass(className)) {
    throw new Error("بيانات حذف القائمة غير صحيحة");
  }

  const folder = getScheduleFolder();
  const file = DriveApp.getFileById(fileId);

  if (!isFileInsideFolder(file, folder.getId())) {
    throw new Error("الصورة ليست داخل مجلد قوائم الفصول");
  }

  if (!file.getMimeType().startsWith("image/")) {
    throw new Error("الملف المحدد ليس صورة");
  }

  if (file.getDescription() !== "CLASS:" + className) {
    throw new Error("الصورة لا تخص الفصل المحدد");
  }

  file.setTrashed(true);

  return jsonOutput({
    success: true,
    message: "تم حذف قائمة الفصل بنجاح",
    className: className
  });
}


/* =========================
   التحقق من وجود الملف داخل مجلد محدد
========================= */
/* =========================================
   الحذف الجماعي الآمن لقوائم الفصول
========================================= */

function bulkDeleteSchedules(p) {
  p = p || {};

  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    // التحقق من حساب المسؤول وجلسة المسؤول.
    verifyAdminToken(p.token || "");
    verifyAdminSession(p.adminSessionToken || "");

    // قراءة العناصر المحددة.
    let selections;

    try {
      selections = JSON.parse(String(p.selections || ""));
    } catch (error) {
      throw new Error("قائمة الفصول المحددة غير صالحة");
    }

    if (
      !Array.isArray(selections) ||
      selections.length === 0 ||
      selections.length > ALLOWED_CLASSES.length
    ) {
      throw new Error("عدد قوائم الفصول المحددة غير صالح");
    }

    // التحقق من البيانات ومنع التكرار.
    const seenFileIds = new Set();
    const seenClasses = new Set();

    const normalizedSelections = selections.map(function(item) {
      if (!item || typeof item !== "object") {
        throw new Error("توجد بيانات غير صالحة ضمن القوائم المحددة");
      }

      const className = String(item.className || "").trim();
      const fileId = String(item.fileId || "").trim();

      if (!isAllowedClass(className) || !fileId || fileId.length > 200) {
        throw new Error("بيانات إحدى قوائم الفصول غير صحيحة");
      }

      if (seenFileIds.has(fileId)) {
        throw new Error("توجد صورة مكررة ضمن قائمة الحذف");
      }

      if (seenClasses.has(className)) {
        throw new Error("تم تحديد أكثر من قائمة للفصل نفسه");
      }

      seenFileIds.add(fileId);
      seenClasses.add(className);

      return {
        className: className,
        fileId: fileId
      };
    });

    // منع تعارض الحذف مع عمليات أخرى.
    lock.waitLock(20000);
    lockAcquired = true;

    const folder = getScheduleFolder();

    // التحقق من جميع الملفات قبل حذف أي ملف.
    const targets = normalizedSelections.map(function(selection) {
      const file = DriveApp.getFileById(selection.fileId);

      if (!isFileInsideFolder(file, folder.getId())) {
        throw new Error(
          "إحدى الصور المحددة ليست داخل مجلد قوائم الفصول"
        );
      }

      if (!file.getMimeType().startsWith("image/")) {
        throw new Error("أحد الملفات المحددة ليس صورة");
      }

      if (
        file.getDescription() !==
        "CLASS:" + selection.className
      ) {
        throw new Error(
          "إحدى الصور لا تخص الفصل المحدد لها"
        );
      }

      return {
        className: selection.className,
        fileId: selection.fileId,
        file: file
      };
    });

    // تنفيذ الحذف والتحقق من نتيجة كل ملف.
    const results = [];

    targets.forEach(function(target) {
      try {
        target.file.setTrashed(true);

        if (!target.file.isTrashed()) {
          throw new Error("لم يتم تأكيد نقل الصورة إلى سلة المهملات");
        }

        results.push({
          className: target.className,
          fileId: target.fileId,
          deleted: true
        });

      } catch (error) {
        results.push({
          className: target.className,
          fileId: target.fileId,
          deleted: false,
          message: error.message || "تعذر حذف القائمة"
        });
      }
    });

    const deletedCount = results.filter(function(item) {
      return item.deleted;
    }).length;

    const failedCount = results.length - deletedCount;

    return jsonOutput({
      success: failedCount === 0,
      message: failedCount === 0
        ? "تم حذف قوائم الفصول المحددة بنجاح"
        : "تم حذف بعض القوائم وتعذر حذف قوائم أخرى",
      deletedCount: deletedCount,
      failedCount: failedCount,
      results: results
    });

  } catch (error) {
    return jsonOutput({
      success: false,
      message: error.message || "تعذر تنفيذ الحذف الجماعي"
    });

  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}
function isFileInsideFolder(file, folderId) {
  const parents = file.getParents();

  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) {
      return true;
    }
  }

  return false;
}

/* =========================
   التحقق من حساب المسؤول
========================= */

function verifyAdminToken(token) {
  if (!token) {
    throw new Error("يجب تسجيل الدخول بحساب المسؤول");
  }

  const response = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" +
    encodeURIComponent(token),
    { muteHttpExceptions: true }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error("تعذر التحقق من حساب المسؤول");
  }

  const info = JSON.parse(response.getContentText());

  if (
    info.aud !== CLIENT_ID ||
    info.email !== ALLOWED_EMAIL ||
    String(info.email_verified) !== "true" ||
    Number(info.exp) * 1000 <= Date.now()
  ) {
    throw new Error("غير مصرح لك بتنفيذ هذا الإجراء");
  }

  return info.email;
}


/* =========================
   اختبار تشخيصي
========================= */


function initializeAdminPassword() {
  const properties = PropertiesService.getScriptProperties();

  const password = properties.getProperty("ADMIN_PASSWORD_TEMP");

  if (!password || password.length < 10) {
    throw new Error("كلمة المرور غير موجودة أو أقل من 10 أحرف");
  }

  const salt = Utilities.getUuid();

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + password,
    Utilities.Charset.UTF_8
  );

  const hash = Utilities.base64Encode(digest);

  properties.setProperties({
    ADMIN_PASSWORD_SALT: salt,
    ADMIN_PASSWORD_HASH: hash
  });

  properties.deleteProperty("ADMIN_PASSWORD_TEMP");

  return "تم إعداد بصمة كلمة مرور المسؤول بنجاح";
}
function verifyAdminPasswordOnServer(password) {
  if (!password) {
    return { success: false, message: "أدخل كلمة المرور" };
  }

  const properties = PropertiesService.getScriptProperties();
  const salt = properties.getProperty("ADMIN_PASSWORD_SALT");
  const savedHash = properties.getProperty("ADMIN_PASSWORD_HASH");

  if (!salt || !savedHash) {
    return { success: false, message: "إعداد كلمة المرور غير مكتمل" };
  }

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + password,
    Utilities.Charset.UTF_8
  );

  const enteredHash = Utilities.base64Encode(digest);

  if (enteredHash !== savedHash) {
    return { success: false, message: "كلمة المرور غير صحيحة" };
  }

  const token = Utilities.getUuid() + Utilities.getUuid();

  const authVersion = PropertiesService
  .getScriptProperties()
  .getProperty("ADMIN_AUTH_VERSION") || "1";

CacheService.getScriptCache().put(
  "ADMIN_SESSION_" + token,
  "authorized:" + authVersion,
  1800
);

  return {
    success: true,
    token: token,
    expiresIn: 1800
  };
}


function adminLogin(p) {
  p = p || {};

  const targetOrigin = String(p.origin || "");
  const originAllowed = ALLOWED_PAGE_ORIGINS.includes(targetOrigin);

  if (!originAllowed) {
    throw new Error("عنوان الموقع غير معتمد لتسجيل الدخول.");
  }

  try {
    const result = verifyAdminPasswordOnServer(p.password);

    const payload = JSON.stringify({
      type: "adminLoginResult",
      nonce: p.nonce || "",
      result: result
    }).replace(/</g, "\\u003c");

    return HtmlService.createHtmlOutput(
      "<!DOCTYPE html><html><body><script>" +
      "top.postMessage(" + payload + ", " +
      JSON.stringify(targetOrigin) + ");" +
      "</script></body></html>"
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (error) {
    const payload = JSON.stringify({
      type: "adminLoginResult",
      nonce: p.nonce || "",
      result: {
        success: false,
        message: error.message || "تعذر تسجيل الدخول"
      }
    }).replace(/</g, "\\u003c");

    return HtmlService.createHtmlOutput(
      "<!DOCTYPE html><html><body><script>" +
      "top.postMessage(" + payload + ", " +
      JSON.stringify(targetOrigin) + ");" +
      "</script></body></html>"
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function adminLogout(p) {
  p = p || {};

  const targetOrigin = String(p.origin || "");
  if (!ALLOWED_PAGE_ORIGINS.includes(targetOrigin)) {
    throw new Error("عنوان الموقع غير معتمد لتسجيل الخروج.");
  }

  const token = String(p.token || "").trim();
  const nonce = String(p.nonce || "");

  if (!token || token.length > 256) {
    throw new Error("جلسة المسؤول غير صالحة أو انتهت بالفعل.");
  }

  if (!/^[A-Za-z0-9_-]{10,120}$/.test(nonce)) {
    throw new Error("رقم طلب تسجيل الخروج غير صالح.");
  }

  // إلغاء جلسة المسؤول على الخادم فورًا، وليس الاكتفاء بإخفاء أدوات الإدارة.
  CacheService.getScriptCache().remove("ADMIN_SESSION_" + token);

  return adminLogoutPostMessage(p, {
    success: true,
    message: "تم تسجيل الخروج من الموقع بنجاح."
  });
}

function adminLogoutPostMessage(p, result) {
  p = p || {};

  const targetOrigin = String(p.origin || "");
  if (!ALLOWED_PAGE_ORIGINS.includes(targetOrigin)) {
    return jsonOutput({
      success: false,
      message: "عنوان الموقع غير معتمد لإتمام تسجيل الخروج."
    });
  }

  const payload = JSON.stringify({
    type: "adminLogoutResult",
    nonce: String(p.nonce || ""),
    result: result || { success: false, message: "تعذر تسجيل الخروج." }
  }).replace(/</g, "\\u003c");

  return HtmlService.createHtmlOutput(
    "<!DOCTYPE html><html><body><script>" +
    "top.postMessage(" + payload + ", " +
    JSON.stringify(targetOrigin) + ");" +
    "</script></body></html>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function verifyAdminSession(token) {
  if (!token) {
    throw new Error("يجب تسجيل الدخول بحساب المسؤول أولاً");
  }

  const properties = PropertiesService.getScriptProperties();
  const currentVersion =
    properties.getProperty("ADMIN_AUTH_VERSION") || "1";

  const session = CacheService.getScriptCache().get(
    "ADMIN_SESSION_" + token
  );

  if (session !== "authorized:" + currentVersion) {
    throw new Error("انتهت جلسة المسؤول. سجّل الدخول مرة أخرى.");
  }

  return true;
}

/**
 * GitHub هو مصدر الحقيقة الوحيد لتعديلات النصوص في المختبر.
 * لا تستخدم هذه الدوال Google Drive لتخزين نصوص الموقع.
 */
function getLabPageChangesGitHubSettings_() {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty("GITHUB_LAB_PAGE_SYNC_TOKEN");
  const branch = properties.getProperty("GITHUB_LAB_PAGE_SYNC_BRANCH");

  if (!token || !branch) {
    throw new Error("إعدادات GitHub الخاصة بالمختبر غير مكتملة.");
  }

  if (branch !== "automation/lab-page-text-sync-input") {
    throw new Error("فرع استقبال تعديلات النصوص لا يطابق فرع المختبر المعتمد.");
  }

  return {
    token: token,
    branch: branch,
    repository: "dodydiaa2013-stack/omar-bin-elkhatab-school-lab",
    path: "page-changes-lab.json"
  };
}

function getLabPageChangesApiUrl_(settings) {
  return "https://api.github.com/repos/" +
    settings.repository + "/contents/" + settings.path;
}

function validateLabPageChangesPayload_(payload) {
  if (
    !payload ||
    payload.success !== true ||
    !Array.isArray(payload.changes) ||
    payload.changes.length > 500
  ) {
    throw new Error("بنية ملف تعديلات النصوص في GitHub غير صحيحة.");
  }

  const seenIds = new Set();

  payload.changes.forEach(function(item) {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.text !== "string" ||
      !item.id ||
      item.id.length > 200 ||
      item.text.length > 10000 ||
      seenIds.has(item.id)
    ) {
      throw new Error("توجد بيانات غير صالحة أو معرّفات مكررة في ملف تعديلات GitHub.");
    }
    seenIds.add(item.id);
  });

  return {
    success: true,
    changes: payload.changes.map(function(item) {
      return { id: item.id, text: item.text };
    }),
    updatedAt: payload.updatedAt || null
  };
}

/**
 * يقرأ ملف النصوص من فرع المختبر مباشرة.
 * لا يوجد fallback إلى Drive ولا يحوّل أخطاء GitHub إلى قائمة فارغة.
 */
function readLabPageChangesFromGitHub_() {
  const settings = getLabPageChangesGitHubSettings_();
  const apiUrl = getLabPageChangesApiUrl_(settings);
  const headers = {
    Authorization: "Bearer " + settings.token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const response = UrlFetchApp.fetch(
    apiUrl + "?ref=" + encodeURIComponent(settings.branch),
    {
      method: "get",
      headers: headers,
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();

  if (status === 404) {
    return {
      exists: false,
      sha: "",
      payload: { success: true, changes: [], updatedAt: null },
      settings: settings,
      headers: headers,
      apiUrl: apiUrl
    };
  }

  if (status !== 200) {
    throw new Error("تعذرت قراءة ملف النصوص من GitHub. رمز الاستجابة: " + status);
  }

  const file = JSON.parse(response.getContentText() || "{}");
  if (file.encoding !== "base64" || !file.content || !file.sha) {
    throw new Error("استجابة ملف النصوص من GitHub غير مكتملة.");
  }

  const raw = Utilities.newBlob(
    Utilities.base64Decode(file.content.replace(/\\s/g, ""))
  ).getDataAsString("UTF-8");

  const payload = validateLabPageChangesPayload_(JSON.parse(raw));

  return {
    exists: true,
    sha: file.sha,
    payload: payload,
    settings: settings,
    headers: headers,
    apiUrl: apiUrl
  };
}

/** بصمة ثابتة لمحتوى النصوص لتأكيد الحفظ بعد الكتابة. */
function getPageChangesSyncHash_(payload) {
  const valid = validateLabPageChangesPayload_(payload);
  const normalized = valid.changes.slice().sort(function(a, b) {
    return a.id.localeCompare(b.id);
  });

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(normalized),
    Utilities.Charset.UTF_8
  );

  return Utilities.base64EncodeWebSafe(digest);
}

/** قراءة النصوص للموقع من GitHub فقط. */
function getSavedPageChanges() {
  try {
    const payload = readLabPageChangesFromGitHub_().payload;
    return Object.assign({}, payload, { environment: "LAB" });
  } catch (error) {
    console.error("تعذر قراءة تعديلات النصوص من GitHub: " + error.message);
    return {
      success: false,
      environment: "LAB",
      message: "تعذر قراءة تعديلات النصوص من مستودع المختبر. لم يتم اعتبارها قائمة فارغة."
    };
  }
}

/** نقطة دخول تحميل النصوص؛ لا توجد مزامنة عكسية أو نسخة Drive. */
function getPageChangesForClient_() {
  return getSavedPageChanges();
}

/** اسم توافق داخلي؛ المصدر الوحيد الآن GitHub وليس Drive. */
function syncPageChangesFromGitHub_() {
  const result = readLabPageChangesFromGitHub_();
  return {
    success: true,
    direction: "github-read",
    changes: result.payload.changes,
    updatedAt: result.payload.updatedAt
  };
}


/**
 * يطلب تشغيل مزامنة النصوص فور نجاح الحفظ والتحقق من GitHub.
 * يتطلب GitHub token بصلاحية Contents: write على مستودع المختبر.
 */
function triggerLabPageTextSyncWorkflow_(settings) {
  const dispatchUrl =
    "https://api.github.com/repos/" +
    settings.repository +
    "/dispatches";

  const response = UrlFetchApp.fetch(dispatchUrl, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + settings.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    payload: JSON.stringify({
      event_type: "lab-page-text-saved",
      client_payload: {
        branch: settings.branch,
        path: settings.path
      }
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status !== 204) {
    let detail = "";
    try {
      const body = JSON.parse(response.getContentText() || "{}");
      detail = String(body.message || "").slice(0, 160);
    } catch (ignored) {}

    throw new Error(
      "تعذر بدء النشر التلقائي من GitHub. رمز الاستجابة: " +
      status + (detail ? " - " + detail : "")
    );
  }

  return true;
}


/**
 * ينتظر نتيجة Workflow الفعلية ويتحقق من وجود PR يحتوي آخر نسخة محفوظة.
 * قبول repository_dispatch وحده لا يعني أن طلب المراجعة أُنشئ.
 */
function waitForLabPageReviewPR_(settings, expectedPayload, dispatchStartedAt) {
  const workflowRunsUrl = "https://api.github.com/repos/" + settings.repository +
    "/actions/workflows/sync-lab-page-texts.yml/runs?event=repository_dispatch&per_page=10";
  const pullsUrl = "https://api.github.com/repos/" + settings.repository +
    "/pulls?state=open&head=dodydiaa2013-stack:automation/lab-page-text-sync&base=main";
  const reviewBranch = "automation/lab-page-text-sync";
  const startedMs = new Date(dispatchStartedAt).getTime();
  let lastRun = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    const runsResponse = UrlFetchApp.fetch(workflowRunsUrl, {
      method: "get", headers: settings.headers, muteHttpExceptions: true
    });
    if (runsResponse.getResponseCode() !== 200) {
      return { status: "unverified", created: false,
        message: "تم إطلاق Workflow، لكن تعذرت قراءة حالة تشغيله من GitHub." };
    }
    const runsData = JSON.parse(runsResponse.getContentText() || "{}");
    const matchingRuns = (runsData.workflow_runs || []).filter(function(run) {
      return run.event === "repository_dispatch" &&
        run.path === ".github/workflows/sync-lab-page-texts.yml" &&
        new Date(run.created_at).getTime() >= startedMs - 5000;
    });
    matchingRuns.sort(function(a, b) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    lastRun = matchingRuns[0] || lastRun;

    if (lastRun && lastRun.status === "completed") {
      if (lastRun.conclusion !== "success") {
        return { status: "failed", created: false,
          runUrl: lastRun.html_url || "",
          message: "انتهى Workflow دون نجاح (" + (lastRun.conclusion || "unknown") + ")." };
      }
      const pullsResponse = UrlFetchApp.fetch(pullsUrl, {
        method: "get", headers: settings.headers, muteHttpExceptions: true
      });
      if (pullsResponse.getResponseCode() === 200) {
        const pulls = JSON.parse(pullsResponse.getContentText() || "[]");
        const reviewPR = pulls.find(function(pr) {
          return pr && pr.state === "open" && pr.head &&
            pr.head.ref === reviewBranch && pr.base && pr.base.ref === "main";
        });
        if (reviewPR) {
          const fileUrl = "https://api.github.com/repos/" + settings.repository +
            "/contents/" + settings.path + "?ref=" + encodeURIComponent(reviewBranch);
          const fileResponse = UrlFetchApp.fetch(fileUrl, {
            method: "get", headers: settings.headers, muteHttpExceptions: true
          });
          if (fileResponse.getResponseCode() === 200) {
            const file = JSON.parse(fileResponse.getContentText() || "{}");
            if (file.encoding === "base64" && file.content) {
              const raw = Utilities.newBlob(Utilities.base64Decode(file.content.replace(/\\s/g, "")))
                .getDataAsString("UTF-8");
              const prPayload = validateLabPageChangesPayload_(JSON.parse(raw));
              if (getPageChangesSyncHash_(prPayload) === getPageChangesSyncHash_(expectedPayload)) {
                return { status: "confirmed", created: true,
                  number: reviewPR.number, url: reviewPR.html_url || "",
                  runUrl: lastRun.html_url || "" };
              }
            }
          }
        }
      }
    }
    if (attempt < 11) Utilities.sleep(1500);
  }
  return { status: "pending", created: false,
    runUrl: lastRun && lastRun.html_url ? lastRun.html_url : "",
    message: "تم إطلاق Workflow، لكن لم يكتمل بعد تأكيد طلب المراجعة واحتوائه على أحدث النصوص." };
}

function savePageChanges(p) {
  p = p || {};

  if (String(p.environment || "") !== "LAB") {
    throw new Error("تم رفض الحفظ لأن الطلب لا يحدد بيئة المختبر.");
  }

  verifyAdminToken(p.googleUploadToken || p.token || "");
  verifyAdminSession(p.adminSessionToken || "");

  const rawChanges = p.changes || "";

  if (!rawChanges || rawChanges.length > 100000) {
    throw new Error("بيانات التعديلات فارغة أو أكبر من الحجم المسموح");
  }

  let data;

  try {
    data = JSON.parse(rawChanges);
  } catch (error) {
    throw new Error("صيغة بيانات التعديلات غير صحيحة");
  }

  // دعم الصيغة الأساسية { changes: [...] } وكذلك المصفوفة المباشرة
  // والتوافق مع العملاء الذين يرسلون changes كسلسلة JSON.
  let incomingChanges = null;

  if (Array.isArray(data)) {
    incomingChanges = data;
  } else if (data && Array.isArray(data.changes)) {
    incomingChanges = data.changes;
  } else if (data && typeof data.changes === "string") {
    try {
      const nestedChanges = JSON.parse(data.changes);
      incomingChanges = Array.isArray(nestedChanges)
        ? nestedChanges
        : nestedChanges && Array.isArray(nestedChanges.changes)
          ? nestedChanges.changes
          : null;
    } catch (error) {
      incomingChanges = null;
    }
  }

  if (!Array.isArray(incomingChanges) || incomingChanges.length > 500) {
    throw new Error("قائمة التعديلات غير صحيحة");
  }

  const allowedIds = [
    "school-title", "school-administration", "home-title",
    "home-vision-text", "home-mission-text",
    "results-card-title", "results-card-description",
    "support-card-title", "support-card-description",
    "schedules-card-title", "schedules-card-description",
    "tablet-title", "tablet-description", "server-title",
    "tablet-support-title", "schedules-title",
    "schedules-description", "alerts-title", "alerts-description",
    "republic-header", "academic-year", "header-manager",
    "lab-activities-news-title",
    "home-intro", "footer-leadership", "footer-school-name",
    "quick-links-title", "quick-results-link", "quick-tablet-link",
    "quick-schedules-link", "quick-gallery-link",
    "quick-student-queries-link", "quick-leaders-link",
    "support-section-title", "footer-manager",
    "support-responsibles-title", "support-diaa-name",
    "support-mona-name", "motto-tablet-title",
    "motto-tablet-description", "motto-dev-title",
    "motto-dev-description", "student-queries-title",
    "student-queries-description", "student-query-one-title",
    "student-query-two-title", "server-tip-1", "server-tip-2",
    "server-tip-3", "server-tip-4", "tablet-support-tip-1",
    "tablet-support-tip-2", "tablet-support-tip-3",
    "tablet-support-tip-4", "ticker-message-1",
    "footer-copyright",
    "ticker-message-2", "ticker-message-3", "ticker-message-4"
  ];

  const cleanChanges = [];
  const seenIds = new Set();

  incomingChanges.forEach(function(item) {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.text !== "string" ||
      item.id.length > 200 ||
      item.text.length > 10000
    ) {
      throw new Error("يوجد عنصر غير صالح ضمن التعديلات");
    }

    const isAutoId = /^auto-[0-9a-f]{16}$/.test(item.id);
    const isAllowedManualId = allowedIds.includes(item.id);

    if (!isAutoId && !isAllowedManualId) {
      throw new Error("يوجد معرّف عنصر غير مسموح بتعديله");
    }

    if (seenIds.has(item.id)) {
      throw new Error("يوجد معرّف مكرر ضمن التعديلات");
    }

    seenIds.add(item.id);

    cleanChanges.push({
      id: item.id,
      text: item.text
    });
  });

  if (!cleanChanges.length) {
    throw new Error("لا توجد تعديلات للحفظ");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    // نقرأ أحدث نسخة من GitHub بعد الحصول على القفل.
    // ويُستخدم SHA في طلب PUT لمنع الكتابة فوق تعديل خارجي متزامن.
    const current = readLabPageChangesFromGitHub_();
    const merged = new Map();

    // احتفظ بكل المعرّفات السابقة دائمًا؛ لا يسمح مسار المختبر باستبدال القائمة كاملة.
    current.payload.changes.forEach(function(item) {
      merged.set(item.id, item.text);
    });

    cleanChanges.forEach(function(item) {
      merged.set(item.id, item.text);
    });

    const finalChanges = Array.from(merged.entries()).map(function(entry) {
      return { id: entry[0], text: entry[1] };
    });

    if (!finalChanges.length) {
      throw new Error("لا توجد نصوص لحفظها.");
    }

    const payloadToSave = {
      success: true,
      changes: finalChanges,
      updatedAt: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(payloadToSave, null, 2) + "\n";
    const contentBase64 = Utilities.base64Encode(
      Utilities.newBlob(jsonContent, "application/json", current.settings.path).getBytes()
    );

    const requestBody = {
      message: "Save lab page text changes",
      content: contentBase64,
      branch: current.settings.branch
    };

    if (current.exists) {
      requestBody.sha = current.sha;
    }

    const putResponse = UrlFetchApp.fetch(current.apiUrl, {
      method: "put",
      contentType: "application/json",
      headers: current.headers,
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });

    const putStatus = putResponse.getResponseCode();

    if (putStatus !== 200 && putStatus !== 201) {
      let apiMessage = "";
      try {
        const body = JSON.parse(putResponse.getContentText() || "{}");
        apiMessage = String(body.message || "").slice(0, 180);
      } catch (ignored) {}

      if (putStatus === 409 || putStatus === 422) {
        throw new Error("حدث تعديل متزامن على ملف GitHub. لم نستبدل النسخة الأخرى؛ أعد تحميل النصوص ثم حاول الحفظ.");
      }

      throw new Error(
        "رفض GitHub حفظ التعديلات. رمز الاستجابة: " + putStatus +
        (apiMessage ? " - " + apiMessage : "")
      );
    }

    // إعادة القراءة من GitHub نفسه والتحقق من تطابق كل النصوص.
    const verified = readLabPageChangesFromGitHub_();
    if (
      getPageChangesSyncHash_(verified.payload) !==
      getPageChangesSyncHash_(payloadToSave)
    ) {
      throw new Error("لم تتطابق النصوص بعد إعادة قراءتها من GitHub؛ لم يتم تأكيد الحفظ.");
    }

    // ابدأ Workflow فور تأكيد أن GitHub حفظ النصوص كما هي.
    // فشل إطلاق الحدث لا يلغي نجاح الحفظ؛ يوجد تشغيل مجدول احتياطيًا.
    let workflowTriggered = false;
    let workflowTriggerError = "";
    let reviewStatus = { status: "not_started", created: false };
    try {
      const dispatchStartedAt = new Date().toISOString();
      workflowTriggered = triggerLabPageTextSyncWorkflow_(verified.settings);
      if (workflowTriggered) {
        reviewStatus = waitForLabPageReviewPR_(verified.settings, payloadToSave, dispatchStartedAt);
      }
    } catch (dispatchError) {
      workflowTriggerError = dispatchError.message || String(dispatchError);
      reviewStatus = { status: "dispatch_failed", created: false };
      console.error("تعذر إطلاق أو تأكيد مزامنة نصوص المختبر: " + workflowTriggerError);
    }

    return pageChangesPostMessage(p, {
      success: true,
      environment: "LAB",
      githubSaved: true,
      githubVerified: true,
      workflowTriggered: workflowTriggered,
      workflowTriggerError: workflowTriggerError,
      workflowStatus: reviewStatus.status,
      reviewPrCreated: reviewStatus.created === true,
      reviewPrNumber: reviewStatus.number || null,
      reviewPrUrl: reviewStatus.url || "",
      workflowRunUrl: reviewStatus.runUrl || "",
      workflowStatusMessage: reviewStatus.message || "",
      htmlUpdatePending: true,
      message: reviewStatus.created
        ? "تم حفظ النصوص والتحقق منها، وتم التأكد من وجود طلب المراجعة الذي يحتوي أحدث النصوص."
        : "تم حفظ النصوص والتحقق منها في مستودع المختبر، لكن لم يتم تأكيد إنشاء طلب المراجعة بعد.",
      count: finalChanges.length
    });

  } finally {
    lock.releaseLock();
  }
}

function passwordRecoveryPostMessage(p, result) {
  p = p || {};

  const targetOrigin = String(p.origin || "");

  const allowedOrigins = [
    "https://dodydiaa2013-stack.github.io"
  ];

  if (!allowedOrigins.includes(targetOrigin)) {
    return HtmlService.createHtmlOutput(
      "Invalid recovery origin."
    ).setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
  }

  const payload = JSON.stringify({
    type: "passwordRecoveryResult",
    nonce: String(p.nonce || ""),
    result: result
  }).replace(/</g, "\\u003c");

  const html =
    "<!DOCTYPE html><html><body><script>" +
    "top.postMessage(" + payload + ", " +
    JSON.stringify(targetOrigin) + ");" +
    "</script></body></html>";

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}


function recoveryHash_(salt, code) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + code,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

function recoveryEqual_(a, b) {
  if (!a || !b || a.length !== b.length) return false;

  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}



function requestPasswordRecovery(p) {
  p = p || {};

  const requestOrigin = String(p.origin || "");

  if (requestOrigin !== "https://dodydiaa2013-stack.github.io") {
    return passwordRecoveryPostMessage(p, {
      success: false,
      message: "الموقع غير مصرح له بطلب استعادة كلمة المرور."
    });
  }

  // التحقق من البريد الذي أدخله المستخدم ومطابقته بالبريد البديل المحفوظ.
  // المقارنة لا تفرق بين الحروف الكبيرة والصغيرة.
  const enteredEmail = String(p.recoveryEmail || "").trim().toLowerCase();
  const savedRecoveryEmail = String(RECOVERY_EMAIL || "").trim().toLowerCase();

  if (
    !enteredEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail) ||
    enteredEmail !== savedRecoveryEmail
  ) {
    return passwordRecoveryPostMessage(p, {
      success: false,
      message: "البريد الإلكتروني غير صحيح."
    });
  }

  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();

  let code = "";
  let salt = "";

  try {
    if (MailApp.getRemainingDailyQuota() < 1) {
      throw new Error("تعذر إرسال البريد حاليًا. حاول لاحقًا.");
    }

    lock.waitLock(10000);

    try {
      const now = Date.now();
      const lastSend = Number(
        props.getProperty("ADMIN_RECOVERY_SEND_COOLDOWN") || "0"
      );

      if (lastSend && now - lastSend < 60000) {
        throw new Error("انتظر دقيقة قبل طلب رمز جديد.");
      }

      // الحد الأقصى 3 طلبات خلال 30 دقيقة.
      reserveRecoverySendSlotLocked_(props, now);

      const bytes = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        Utilities.getUuid() + now,
        Utilities.Charset.UTF_8
      );

      const number =
        (((bytes[0] & 255) * 16777216) +
         ((bytes[1] & 255) * 65536) +
         ((bytes[2] & 255) * 256) +
         (bytes[3] & 255)) % 1000000;

      code = String(number).padStart(6, "0");
      salt = Utilities.getUuid();

      props.setProperties({
        ADMIN_RECOVERY_CODE_HASH: recoveryHash_(salt, code),
        ADMIN_RECOVERY_CODE_SALT: salt,
        ADMIN_RECOVERY_ATTEMPTS: "0",
        ADMIN_RECOVERY_CODE_EXPIRES: String(now + 10 * 60 * 1000),
        ADMIN_RECOVERY_SEND_COOLDOWN: String(now)
      });

    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }

    try {
      // الإرسال دائمًا إلى البريد المحفوظ، وليس إلى قيمة يحددها المستخدم.
      MailApp.sendEmail({
        to: RECOVERY_EMAIL,
        subject: "رمز استعادة كلمة مرور مدرسة عمر بن الخطاب",
        body:
          "رمز استعادة كلمة المرور هو: " + code +
          "\n\nصلاحية الرمز 10 دقائق." +
          "\nيسمح بخمس محاولات للتحقق." +
          "\nإذا لم تطلب هذا الرمز فتجاهل الرسالة."
      });

    } catch (mailError) {
      lock.waitLock(10000);

      try {
        props.deleteProperty("ADMIN_RECOVERY_CODE_HASH");
        props.deleteProperty("ADMIN_RECOVERY_CODE_SALT");
        props.deleteProperty("ADMIN_RECOVERY_ATTEMPTS");
        props.deleteProperty("ADMIN_RECOVERY_CODE_EXPIRES");
        props.deleteProperty("ADMIN_RECOVERY_SEND_COOLDOWN");
      } finally {
        if (lock.hasLock()) lock.releaseLock();
      }

      throw new Error("تعذر إرسال رسالة التحقق. حاول لاحقًا.");
    }

    return passwordRecoveryPostMessage(p, {
      success: true,
      message: "تم إرسال رمز التحقق إلى البريد البديل المعتمد."
    });

  } catch (error) {
    return passwordRecoveryPostMessage(p, {
      success: false,
      message: error.message || "حدث خطأ أثناء طلب الاستعادة."
    });
  }
}



function verifyPasswordRecoveryCode(p) {
  p = p || {};

  const requestOrigin = String(p.origin || "");

  if (requestOrigin !== "https://dodydiaa2013-stack.github.io") {
    return passwordRecoveryPostMessage(p, {
      success: false,
      message: "الموقع غير مصرح له بالتحقق من رمز الاستعادة."
    });
  }

  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const savedHash = props.getProperty("ADMIN_RECOVERY_CODE_HASH");
    const salt = props.getProperty("ADMIN_RECOVERY_CODE_SALT");
    const expires = Number(
      props.getProperty("ADMIN_RECOVERY_CODE_EXPIRES") || "0"
    );

    if (!savedHash || !salt || !expires || Date.now() >= expires) {
      props.deleteProperty("ADMIN_RECOVERY_CODE_HASH");
      props.deleteProperty("ADMIN_RECOVERY_CODE_SALT");
      props.deleteProperty("ADMIN_RECOVERY_ATTEMPTS");
      props.deleteProperty("ADMIN_RECOVERY_CODE_EXPIRES");

      throw new Error("انتهت صلاحية الرمز. اطلب رمزًا جديدًا.");
    }

    let attempts = Number(
      props.getProperty("ADMIN_RECOVERY_ATTEMPTS") || "0"
    );

    if (attempts >= 5) {
      throw new Error("تم تجاوز عدد المحاولات المسموح. اطلب رمزًا جديدًا.");
    }

    const code = String(p.code || "").trim();

    if (!/^\d{6}$/.test(code)) {
      attempts++;
      props.setProperty("ADMIN_RECOVERY_ATTEMPTS", String(attempts));

      if (attempts >= 5) {
        props.deleteProperty("ADMIN_RECOVERY_CODE_HASH");
        props.deleteProperty("ADMIN_RECOVERY_CODE_SALT");
        props.deleteProperty("ADMIN_RECOVERY_ATTEMPTS");
        props.deleteProperty("ADMIN_RECOVERY_CODE_EXPIRES");
      }

      throw new Error("رمز التحقق غير صحيح.");
    }

    const enteredHash = recoveryHash_(salt, code);

    if (!recoveryEqual_(savedHash, enteredHash)) {
      attempts++;
      props.setProperty("ADMIN_RECOVERY_ATTEMPTS", String(attempts));

      if (attempts >= 5) {
        props.deleteProperty("ADMIN_RECOVERY_CODE_HASH");
        props.deleteProperty("ADMIN_RECOVERY_CODE_SALT");
        props.deleteProperty("ADMIN_RECOVERY_ATTEMPTS");
        props.deleteProperty("ADMIN_RECOVERY_CODE_EXPIRES");

        throw new Error(
          "تم تجاوز عدد المحاولات المسموح. اطلب رمزًا جديدًا."
        );
      }

      throw new Error("رمز التحقق غير صحيح.");
    }

    // حذف رمز البريد بعد نجاح التحقق
    props.deleteProperty("ADMIN_RECOVERY_CODE_HASH");
    props.deleteProperty("ADMIN_RECOVERY_CODE_SALT");
    props.deleteProperty("ADMIN_RECOVERY_ATTEMPTS");
    props.deleteProperty("ADMIN_RECOVERY_CODE_EXPIRES");

    const resetToken = Utilities.getUuid() + Utilities.getUuid();
    const resetSalt = Utilities.getUuid();

    props.setProperties({
      ADMIN_RECOVERY_RESET_HASH: recoveryHash_(resetSalt, resetToken),
      ADMIN_RECOVERY_RESET_SALT: resetSalt,
      ADMIN_RECOVERY_RESET_EXPIRES: String(Date.now() + 10 * 60 * 1000)
    });

    return passwordRecoveryPostMessage(p, {
      success: true,
      resetToken: resetToken
    });

  } catch (error) {
    return passwordRecoveryPostMessage(p, {
      success: false,
      message: error.message || "حدث خطأ أثناء التحقق."
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function resetAdminPassword(p) {
  p = p || {};

  const requestOrigin = String(p.origin || "");

  if (requestOrigin !== "https://dodydiaa2013-stack.github.io") {
    return passwordRecoveryPostMessage(p, {
      success: false,
      message: "الموقع غير مصرح له بتغيير كلمة المرور."
    });
  }

  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();

  try {
    const resetToken = String(p.resetToken || "");
    const newPassword = String(p.newPassword || "");

    if (newPassword.length < 12 || newPassword.length > 128) {
      throw new Error("كلمة المرور يجب أن تكون من 12 إلى 128 حرفًا.");
    }

    if (!resetToken) {
      throw new Error("انتهت صلاحية عملية الاستعادة. اطلب رمزًا جديدًا.");
    }

    lock.waitLock(10000);

    const savedHash = props.getProperty("ADMIN_RECOVERY_RESET_HASH");
    const resetSalt = props.getProperty("ADMIN_RECOVERY_RESET_SALT");
    const expires = Number(
      props.getProperty("ADMIN_RECOVERY_RESET_EXPIRES") || "0"
    );

    if (!savedHash || !resetSalt || !expires || Date.now() >= expires) {
      throw new Error("انتهت صلاحية عملية الاستعادة. اطلب رمزًا جديدًا.");
    }

    const enteredHash = recoveryHash_(resetSalt, resetToken);

    if (!recoveryEqual_(savedHash, enteredHash)) {
      throw new Error("رمز الاستعادة غير صالح أو تم استخدامه.");
    }

    const salt = Utilities.getUuid();

    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      salt + newPassword,
      Utilities.Charset.UTF_8
    );

    const hash = Utilities.base64Encode(digest);

    const oldVersion = Number(
      props.getProperty("ADMIN_AUTH_VERSION") || "1"
    );

    props.setProperties({
      ADMIN_PASSWORD_SALT: salt,
      ADMIN_PASSWORD_HASH: hash,
      ADMIN_AUTH_VERSION: String(oldVersion + 1)
    });

    // إبطال رمز تغيير كلمة المرور بعد استخدامه
    props.deleteProperty("ADMIN_RECOVERY_RESET_HASH");
    props.deleteProperty("ADMIN_RECOVERY_RESET_SALT");
    props.deleteProperty("ADMIN_RECOVERY_RESET_EXPIRES");
    props.deleteProperty("ADMIN_RECOVERY_SEND_COOLDOWN");

    return passwordRecoveryPostMessage(p, {
      success: true,
      message: "تم تغيير كلمة المرور بنجاح."
    });

  } catch (error) {
    return passwordRecoveryPostMessage(p, {
      success: false,
      message: error.message || "حدث خطأ أثناء تغيير كلمة المرور."
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function verifyDeveloperGoogle(p) {
  try {
    const token = String(
      p && (p.token || p.googleUploadToken) || ""
    ).trim();

    const allowedDeveloperEmail = ALLOWED_EMAIL;

    if (!token) {
      return developerGooglePostMessage(p, {
        success: false,
        message: "لم يتم استلام رمز حساب Google"
      });
    }

    // التحقق من صلاحية رمز Google واستخراج البريد الإلكتروني
    const email = verifyAdminToken(token);

    if (!email) {
      return developerGooglePostMessage(p, {
        success: false,
        message: "فشل التحقق من حساب Google"
      });
    }

    // التحقق من البريد المصرح له باستخدام وضع المطور
    const verifiedEmail = String(email).trim().toLowerCase();

    if (verifiedEmail !== allowedDeveloperEmail) {
      return developerGooglePostMessage(p, {
        success: false,
        message: "هذا الحساب غير مصرح له باستخدام وضع المطور"
      });
    }

    return developerGooglePostMessage(p, {
      success: true,
      email: verifiedEmail,
      message: "تم التحقق من حساب المطوّر بنجاح"
    });

  } catch (error) {
    return developerGooglePostMessage(p, {
      success: false,
      message: error.message || "حدث خطأ أثناء التحقق"
    });
  }
}

function developerGooglePostMessage(p, result) {
  const nonce = String(p && p.nonce || "");
  const requestedOrigin = String(p && p.origin || "");

  const allowedOrigin = ALLOWED_PAGE_ORIGINS.includes(requestedOrigin)
    ? requestedOrigin
    : "";

  if (!allowedOrigin) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: "مصدر الطلب غير مسموح"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const payload = JSON.stringify({
    type: "developerGoogleVerification",
    nonce: nonce,
    result: result || {}
  }).replace(/</g, "\\u003c");

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <script>
          window.top.postMessage(
            ${payload},
            ${JSON.stringify(allowedOrigin)}
          );
        </script>
      </body>
    </html>
  `;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function reserveRecoverySendSlotLocked_(props, now) {
  const key = "ADMIN_RECOVERY_SEND_HISTORY";
  const windowMs = 30 * 60 * 1000;
  const maxRequests = 3;

  let history = [];

  try {
    history = JSON.parse(props.getProperty(key) || "[]");

    if (!Array.isArray(history)) {
      history = [];
    }
  } catch (e) {
    history = [];
  }

  history = history.filter(timestamp =>
    Number.isFinite(timestamp) &&
    timestamp <= now &&
    now - timestamp < windowMs
  );

  if (history.length >= maxRequests) {
    const remainingMs = windowMs - (now - history[0]);
    const minutes = Math.ceil(remainingMs / 60000);

    throw new Error(
      "تم تجاوز الحد المسموح لطلبات الاستعادة. حاول مرة أخرى بعد " +
      minutes + " دقيقة."
    );
  }

  history.push(now);
  props.setProperty(key, JSON.stringify(history));
}


// الدالة الأصلية للاستخدام المستقل عند الحاجة

/* =====================================
   تنظيف بيانات EXIF من الصور قبل حفظها
===================================== */

function stripImageExif_(bytes, mimeType) {
  try {
    const type = String(mimeType || "").toLowerCase();

    if (type === "image/jpeg" || type === "image/jpg") {
      return stripJpegExif_(bytes);
    }

    if (type === "image/png") {
      return stripPngExif_(bytes);
    }

    if (type === "image/webp") {
      return stripWebpExif_(bytes);
    }

    // GIF يظل كما هو للحفاظ على الحركة
    return bytes;

  } catch (error) {
    console.error("تعذر تنظيف بيانات الصورة: " + error.message);
    return bytes;
  }
}


/* تنظيف JPEG دون إعادة ضغط الصورة */

function stripJpegExif_(bytes) {
  if (
    bytes.length < 4 ||
    (bytes[0] & 255) !== 255 ||
    (bytes[1] & 255) !== 216
  ) return bytes;

  let output = bytes.slice(0, 2);
  let pos = 2;

  while (pos < bytes.length) {
    const start = pos;

    if ((bytes[pos] & 255) !== 255) return bytes;

    while (pos < bytes.length && (bytes[pos] & 255) === 255) {
      pos++;
    }

    if (pos >= bytes.length) return bytes;

    const marker = bytes[pos] & 255;

    if (marker === 218 || marker === 217) {
      return output.concat(bytes.slice(start));
    }

    if (
      marker === 1 ||
      marker === 216 ||
      (marker >= 208 && marker <= 215)
    ) {
      output = output.concat(bytes.slice(start, pos + 1));
      pos++;
      continue;
    }

    if (pos + 2 >= bytes.length) return bytes;

    const length =
      ((bytes[pos + 1] & 255) << 8) |
      (bytes[pos + 2] & 255);

    if (length < 2) return bytes;

    const end = pos + 1 + length;

    if (end > bytes.length) return bytes;

    const isExif =
      marker === 225 &&
      length >= 8 &&
      (bytes[pos + 3] & 255) === 69 &&
      (bytes[pos + 4] & 255) === 120 &&
      (bytes[pos + 5] & 255) === 105 &&
      (bytes[pos + 6] & 255) === 102 &&
      (bytes[pos + 7] & 255) === 0 &&
      (bytes[pos + 8] & 255) === 0;

    if (!isExif) {
      output = output.concat(bytes.slice(start, end));
    }

    pos = end;
  }

    return bytes;
}


/* تنظيف PNG مع الحفاظ على الشفافية */

function stripPngExif_(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (bytes.length < 20) return bytes;

  for (let i = 0; i < 8; i++) {
    if ((bytes[i] & 255) !== signature[i]) return bytes;
  }

  let output = bytes.slice(0, 8);
  let pos = 8;
  let foundEnd = false;

  while (pos + 12 <= bytes.length) {
    const length =
      ((bytes[pos] & 255) << 24) |
      ((bytes[pos + 1] & 255) << 16) |
      ((bytes[pos + 2] & 255) << 8) |
      (bytes[pos + 3] & 255);

    const size = length >>> 0;
    const end = pos + 12 + size;

    if (end > bytes.length) return bytes;

    const name = String.fromCharCode(
      bytes[pos + 4] & 255,
      bytes[pos + 5] & 255,
      bytes[pos + 6] & 255,
      bytes[pos + 7] & 255
    );

    if (name !== "eXIf") {
      output = output.concat(bytes.slice(pos, end));
    }

    pos = end;

    if (name === "IEND") {
      foundEnd = true;
      output = output.concat(bytes.slice(pos));
      break;
    }
  }

  return foundEnd ? output : bytes;
}


/* تنظيف WebP مع تحديث حجم الملف وعلامة EXIF */

function stripWebpExif_(bytes) {
  if (
    bytes.length < 12 ||
    String.fromCharCode(
      bytes[0] & 255,
      bytes[1] & 255,
      bytes[2] & 255,
      bytes[3] & 255
    ) !== "RIFF" ||
    String.fromCharCode(
      bytes[8] & 255,
      bytes[9] & 255,
      bytes[10] & 255,
      bytes[11] & 255
    ) !== "WEBP"
  ) return bytes;

  const declaredSize =
    (bytes[4] & 255) |
    ((bytes[5] & 255) << 8) |
    ((bytes[6] & 255) << 16) |
    ((bytes[7] & 255) << 24);

  if ((declaredSize >>> 0) !== bytes.length - 8) {
    return bytes;
  }

  let output = bytes.slice(0, 12);
  let pos = 12;
  let foundExif = false;
  let vp8xFlagsIndex = -1;

  while (pos + 8 <= bytes.length) {
    const name = String.fromCharCode(
      bytes[pos] & 255,
      bytes[pos + 1] & 255,
      bytes[pos + 2] & 255,
      bytes[pos + 3] & 255
    );

    const length =
      (bytes[pos + 4] & 255) |
      ((bytes[pos + 5] & 255) << 8) |
      ((bytes[pos + 6] & 255) << 16) |
      ((bytes[pos + 7] & 255) << 24);

    const size = length >>> 0;
    const end = pos + 8 + size + (size % 2);

    if (end > bytes.length) return bytes;

    if (name === "VP8X") {
      if (size !== 10 || vp8xFlagsIndex !== -1) {
        return bytes;
      }

      vp8xFlagsIndex = output.length + 8;
    }

    if (name === "EXIF") {
      foundExif = true;
    } else {
      output = output.concat(bytes.slice(pos, end));
    }

    pos = end;
  }

  if (pos !== bytes.length) return bytes;

  if (!foundExif) return bytes;

  // لا نعدل الملف إذا لم نجد رأس VP8X المطلوب.
  if (vp8xFlagsIndex === -1) return bytes;

  // إزالة علامة وجود EXIF من رأس VP8X.
const flag = (output[vp8xFlagsIndex] & 255) & ~0x08;

output[vp8xFlagsIndex] =
  flag > 127 ? flag - 256 : flag;

// تحديث حجم RIFF بعد حذف EXIF.
const newSize = output.length - 8;

const sizeBytes = [
  newSize & 255,
  (newSize >>> 8) & 255,
  (newSize >>> 16) & 255,
  (newSize >>> 24) & 255
];

for (let i = 0; i < 4; i++) {
  output[4 + i] =
    sizeBytes[i] > 127
      ? sizeBytes[i] - 256
      : sizeBytes[i];
}

return output;
}
function getGalleryUploadStatus(p) {
  p = p || {};

  const nonce = String(p.nonce || "");
  const callback = String(p.callback || "");
  const origin = String(p.origin || "");

  if (!ALLOWED_PAGE_ORIGINS.includes(origin)) {
    return outputWithCallback({
      success: false,
      found: false,
      message: "مصدر الطلب غير مسموح"
    }, callback);
  }

  if (!/^[A-Za-z0-9_-]{10,120}$/.test(nonce)) {
    return outputWithCallback({
      success: false,
      found: false,
      message: "رقم الطلب غير صالح"
    }, callback);
  }

  cleanupOldGalleryUploadResults_();

  const props = PropertiesService.getScriptProperties();
  const key = "GALLERY_UPLOAD_RESULT_" + nonce;
  const savedValue = props.getProperty(key);

  if (!savedValue) {
    return outputWithCallback({
      success: true,
      found: false
    }, callback);
  }

  try {
    const saved = JSON.parse(savedValue);

    if (
      !saved.savedAt ||
      Date.now() - saved.savedAt >= 10 * 60 * 1000
    ) {
      props.deleteProperty(key);

      return outputWithCallback({
        success: true,
        found: false
      }, callback);
    }

    return outputWithCallback({
      success: true,
      found: true,
      result: saved.result || {}
    }, callback);

  } catch (error) {
    props.deleteProperty(key);

    return outputWithCallback({
      success: false,
      found: false,
      message: "تعذر قراءة نتيجة الرفع"
    }, callback);
  }
}
function cleanupOldGalleryUploadResults_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const prefix = "GALLERY_UPLOAD_RESULT_";
  const now = Date.now();
  const maxAge = 10 * 60 * 1000;

  Object.keys(all).forEach(function(key) {
    if (key.indexOf(prefix) !== 0) return;

    try {
      const saved = JSON.parse(all[key]);

      if (
        !saved.savedAt ||
        now - saved.savedAt >= maxAge
      ) {
        props.deleteProperty(key);
      }
    } catch (error) {
      props.deleteProperty(key);
    }
  });
}

/* =========================================
   أدوات الوصول إلى مجلدات ألبومات الصور
========================================= */

/**
 * الوصول إلى المجلد الرئيسي لألبومات الصور.
 */
function getPhotoAlbumsFolder() {
  const folders = DriveApp.getFoldersByName(PHOTO_ALBUMS_FOLDER_NAME);

  if (!folders.hasNext()) {
    throw new Error(
      "مجلد ألبومات الصور غير موجود في Google Drive: " +
      PHOTO_ALBUMS_FOLDER_NAME
    );
  }

  const rootFolder = folders.next();

  // منع اختيار مجلد خاطئ عند وجود مجلدات متعددة بنفس الاسم.
  if (folders.hasNext()) {
    throw new Error(
      "يوجد أكثر من مجلد باسم ألبومات الصور في Google Drive. " +
      "يرجى مراجعة المجلدات المكررة."
    );
  }

  return rootFolder;
}


/**
 * الوصول إلى مجلد ألبوم محدد باستخدام معرفه في Google Drive.
 */
function getPhotoAlbumFolder(albumId) {
  const id = String(albumId || "").trim();

  if (!id) {
    throw new Error("معرّف الألبوم غير موجود.");
  }

  let albumFolder;

  try {
    albumFolder = DriveApp.getFolderById(id);
  } catch (error) {
    throw new Error("تعذر العثور على مجلد الألبوم المحدد.");
  }

  if (albumFolder.isTrashed()) {
    throw new Error("مجلد الألبوم موجود في سلة المهملات.");
  }

  // التأكد أن المجلد تابع لمجلد ألبومات المدرسة.
  const rootFolder = getPhotoAlbumsFolder();
  const parents = albumFolder.getParents();
  let belongsToAlbums = false;

  while (parents.hasNext()) {
    if (parents.next().getId() === rootFolder.getId()) {
      belongsToAlbums = true;
      break;
    }
  }

  if (!belongsToAlbums) {
    throw new Error("مجلد الألبوم لا يتبع مجلد ألبومات المدرسة.");
  }

  return albumFolder;
}
