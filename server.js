const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const express = require("express");
const multer = require("multer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "studio-admin";
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const CONTENT_FILE = path.join(DATA_DIR, "site.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE || 200 * 1024 * 1024);

const CATEGORY_IDS = new Set(["music", "photography", "design", "ip", "video", "hobby"]);

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFileStem(value) {
  return String(value || "file")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function normalizeWork(input, existing = {}) {
  const timestamp = nowIso();
  const category = String(input.category || existing.category || "hobby").trim();

  return {
    id: existing.id || input.id || `work-${crypto.randomUUID()}`,
    category: CATEGORY_IDS.has(category) ? category : "hobby",
    title: String(input.title || existing.title || "Untitled work").trim(),
    description: String(input.description || existing.description || "").trim(),
    year: String(input.year || existing.year || "").trim(),
    medium: String(input.medium || existing.medium || "").trim(),
    tags: normalizeTags(input.tags ?? existing.tags),
    externalUrl: String(input.externalUrl || existing.externalUrl || "").trim(),
    file: input.file === undefined ? existing.file || null : input.file,
    featured: normalizeBoolean(input.featured ?? existing.featured),
    createdAt: existing.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeSection(section) {
  const id = String(section.id || "").trim().toLowerCase();

  return {
    id: CATEGORY_IDS.has(id) ? id : "hobby",
    title: String(section.title || id || "栏目").trim(),
    description: String(section.description || "").trim(),
    accent: String(section.accent || "#a6ffcb").trim(),
    visible: section.visible !== false
  };
}

function normalizeContent(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Content payload must be an object.");
  }

  const site = payload.site && typeof payload.site === "object" ? payload.site : {};
  const layout = site.layout && typeof site.layout === "object" ? site.layout : {};
  const theme = site.theme && typeof site.theme === "object" ? site.theme : {};
  const sections = Array.isArray(layout.sections) ? layout.sections.map(normalizeSection) : [];
  const works = Array.isArray(payload.works) ? payload.works.map((work) => normalizeWork(work, work)) : [];
  const journal = Array.isArray(payload.journal)
    ? payload.journal.map((entry) => ({
        id: entry.id || `note-${crypto.randomUUID()}`,
        title: String(entry.title || "Untitled note").trim(),
        body: String(entry.body || "").trim(),
        createdAt: entry.createdAt || nowIso()
      }))
    : [];

  return {
    site: {
      title: String(site.title || "Personal Works Studio").trim(),
      owner: String(site.owner || "").trim(),
      tagline: String(site.tagline || "").trim(),
      intro: String(site.intro || "").trim(),
      announcement: String(site.announcement || "").trim(),
      contactEmail: String(site.contactEmail || "").trim(),
      socialLinks: Array.isArray(site.socialLinks)
        ? site.socialLinks.map((link) => ({
            label: String(link.label || "Link").trim(),
            url: String(link.url || "").trim()
          })).filter((link) => link.url)
        : [],
      theme: {
        accent: String(theme.accent || "#a6ffcb").trim(),
        accentAlt: String(theme.accentAlt || "#ff8fd8").trim(),
        ink: String(theme.ink || "#f7f4ea").trim(),
        paper: String(theme.paper || "#090912").trim(),
        cursorMode: String(theme.cursorMode || "comet").trim()
      },
      layout: {
        heroMode: String(layout.heroMode || "orbital").trim(),
        showMoodboard: layout.showMoodboard !== false,
        showJournal: layout.showJournal !== false,
        sections
      }
    },
    works,
    journal
  };
}

async function ensureStorage() {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
}

async function readContent() {
  const raw = await fsp.readFile(CONTENT_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeContent(content) {
  const normalized = normalizeContent(content);
  const nextJson = `${JSON.stringify(normalized, null, 2)}\n`;
  const tempFile = `${CONTENT_FILE}.${process.pid}.${Date.now()}.tmp`;

  try {
    const current = await fsp.readFile(CONTENT_FILE, "utf8");
    const backupName = `site-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await fsp.writeFile(path.join(BACKUP_DIR, backupName), current);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await fsp.writeFile(tempFile, nextJson);
  await fsp.rename(tempFile, CONTENT_FILE);
  return normalized;
}

function createFilePayload(file) {
  if (!file) {
    return null;
  }

  return {
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${encodeURIComponent(file.filename)}`,
    downloadUrl: `/api/files/${encodeURIComponent(file.filename)}/download`
  };
}

async function deleteStoredFile(file) {
  if (!file || !file.storedName) {
    return;
  }

  const target = path.join(UPLOAD_DIR, path.basename(file.storedName));
  try {
    await fsp.unlink(target);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function requireAdmin(req, res, next) {
  const suppliedToken = req.header("x-admin-token") || req.query.token;
  if (!suppliedToken || suppliedToken !== ADMIN_TOKEN) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Set the admin token with the x-admin-token header."
    });
  }

  return next();
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const stem = sanitizeFileStem(path.basename(file.originalname || "upload", extension));
    callback(null, `${Date.now()}-${crypto.randomUUID()}-${stem}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE
  }
});

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders(res) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
}));
app.use(express.static(PUBLIC_DIR));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    adminTokenConfigured: Boolean(process.env.ADMIN_TOKEN),
    maxUploadSize: MAX_UPLOAD_SIZE
  });
});

app.get("/api/content", async (_req, res, next) => {
  try {
    res.json(await readContent());
  } catch (error) {
    next(error);
  }
});

app.get("/api/site", async (_req, res, next) => {
  try {
    const content = await readContent();
    res.json(content.site);
  } catch (error) {
    next(error);
  }
});

app.put("/api/content", requireAdmin, async (req, res, next) => {
  try {
    res.json(await writeContent(req.body));
  } catch (error) {
    next(error);
  }
});

app.put("/api/site", requireAdmin, async (req, res, next) => {
  try {
    const content = await readContent();
    const nextContent = {
      ...content,
      site: {
        ...content.site,
        ...req.body,
        theme: {
          ...content.site.theme,
          ...(req.body.theme || {})
        },
        layout: {
          ...content.site.layout,
          ...(req.body.layout || {})
        }
      }
    };
    res.json((await writeContent(nextContent)).site);
  } catch (error) {
    next(error);
  }
});

app.get("/api/works", async (req, res, next) => {
  try {
    const content = await readContent();
    const category = String(req.query.category || "").trim();
    const works = category ? content.works.filter((work) => work.category === category) : content.works;
    res.json(works);
  } catch (error) {
    next(error);
  }
});

app.post("/api/works", requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    const content = await readContent();
    const work = normalizeWork({
      ...req.body,
      file: createFilePayload(req.file)
    });

    content.works.unshift(work);
    const saved = await writeContent(content);
    res.status(201).json(saved.works.find((item) => item.id === work.id));
  } catch (error) {
    if (req.file) {
      await deleteStoredFile(createFilePayload(req.file));
    }
    next(error);
  }
});

app.put("/api/works/:id", requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    const content = await readContent();
    const index = content.works.findIndex((work) => work.id === req.params.id);

    if (index === -1) {
      if (req.file) {
        await deleteStoredFile(createFilePayload(req.file));
      }
      return res.status(404).json({ error: "Work not found." });
    }

    const existing = content.works[index];
    const removeExistingFile = normalizeBoolean(req.body.removeFile);
    const nextFile = req.file ? createFilePayload(req.file) : removeExistingFile ? null : existing.file;
    const nextWork = normalizeWork({
      ...req.body,
      file: nextFile
    }, existing);

    content.works[index] = nextWork;
    const saved = await writeContent(content);

    if ((req.file || removeExistingFile) && existing.file) {
      await deleteStoredFile(existing.file);
    }

    return res.json(saved.works[index]);
  } catch (error) {
    if (req.file) {
      await deleteStoredFile(createFilePayload(req.file));
    }
    return next(error);
  }
});

app.delete("/api/works/:id", requireAdmin, async (req, res, next) => {
  try {
    const content = await readContent();
    const index = content.works.findIndex((work) => work.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Work not found." });
    }

    const [removed] = content.works.splice(index, 1);
    await writeContent(content);
    await deleteStoredFile(removed.file);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.get("/api/files/:storedName/download", async (req, res, next) => {
  try {
    const storedName = path.basename(req.params.storedName);
    const content = await readContent();
    const work = content.works.find((item) => item.file && item.file.storedName === storedName);

    if (!work) {
      return res.status(404).json({ error: "File not found." });
    }

    return res.download(path.join(UPLOAD_DIR, storedName), work.file.originalName || storedName);
  } catch (error) {
    return next(error);
  }
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.code,
      message: error.message
    });
  }

  console.error(error);
  return res.status(500).json({
    error: "Internal Server Error",
    message: error.message
  });
});

if (require.main === module) {
  ensureStorage()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Personal works studio running at http://localhost:${PORT}`);
        console.log(`Admin token: ${process.env.ADMIN_TOKEN ? "configured from env" : ADMIN_TOKEN}`);
      });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  app,
  normalizeContent,
  normalizeTags,
  normalizeWork,
  sanitizeFileStem
};
