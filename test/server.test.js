const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeContent,
  normalizeTags,
  normalizeWork,
  sanitizeFileStem
} = require("../server");

test("normalizeTags accepts arrays and comma-separated strings", () => {
  assert.deepEqual(normalizeTags("music, demo, , night"), ["music", "demo", "night"]);
  assert.deepEqual(normalizeTags([" design ", "", "poster"]), ["design", "poster"]);
});

test("sanitizeFileStem removes unsafe filename characters", () => {
  assert.equal(sanitizeFileStem("../My Demo @ 01!.wav"), "..-My-Demo-01-.wav");
  assert.equal(sanitizeFileStem("   "), "file");
});

test("normalizeWork keeps known categories and falls back safely", () => {
  const work = normalizeWork({
    category: "music",
    title: "Demo",
    tags: "a,b",
    featured: "true"
  });

  assert.equal(work.category, "music");
  assert.equal(work.title, "Demo");
  assert.deepEqual(work.tags, ["a", "b"]);
  assert.equal(work.featured, true);

  const fallback = normalizeWork({ category: "unknown" });
  assert.equal(fallback.category, "hobby");
});

test("normalizeContent preserves editable site framework", () => {
  const content = normalizeContent({
    site: {
      title: "Archive",
      theme: {
        accent: "#ffffff"
      },
      layout: {
        showMoodboard: false,
        sections: [
          {
            id: "photography",
            title: "Photos",
            visible: false
          }
        ]
      }
    },
    works: [],
    journal: [
      {
        title: "Note",
        body: "Body"
      }
    ]
  });

  assert.equal(content.site.title, "Archive");
  assert.equal(content.site.theme.accent, "#ffffff");
  assert.equal(content.site.layout.showMoodboard, false);
  assert.equal(content.site.layout.sections[0].id, "photography");
  assert.equal(content.site.layout.sections[0].visible, false);
  assert.equal(content.journal[0].title, "Note");
});
