const CATEGORY_OPTIONS = [
  ["music", "音乐"],
  ["photography", "摄影"],
  ["design", "设计"],
  ["ip", "IP 形象与延伸"],
  ["video", "视频"],
  ["hobby", "个人爱好"]
];

const adminState = {
  token: localStorage.getItem("studio-token") || "",
  content: null
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function setStatus(message, isError = false) {
  const status = $("#status");
  status.textContent = message;
  status.classList.toggle("error", isError);
  if (message) {
    window.setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = "";
        status.classList.remove("error");
      }
    }, 4200);
  }
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (adminState.token) {
    headers.set("x-admin-token", adminState.token);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const error = await response.json();
      message = error.message || error.error || message;
    } catch (_error) {
      // Keep the HTTP status text when the response is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function serializeSocialLinks(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split("|");
      return {
        label: (label || "Link").trim(),
        url: rest.join("|").trim()
      };
    })
    .filter((link) => link.url);
}

function hydrateSiteForm() {
  const form = $("#site-form");
  const site = adminState.content.site;
  form.title.value = site.title || "";
  form.owner.value = site.owner || "";
  form.tagline.value = site.tagline || "";
  form.intro.value = site.intro || "";
  form.announcement.value = site.announcement || "";
  form.contactEmail.value = site.contactEmail || "";
  form.accent.value = site.theme?.accent || "#a6ffcb";
  form.accentAlt.value = site.theme?.accentAlt || "#ff8fd8";
  form.ink.value = site.theme?.ink || "#f7f4ea";
  form.paper.value = site.theme?.paper || "#090912";
  form.heroMode.value = site.layout?.heroMode || "orbital";
  form.cursorMode.value = site.theme?.cursorMode || "comet";
  form.showMoodboard.checked = site.layout?.showMoodboard !== false;
  form.showJournal.checked = site.layout?.showJournal !== false;
  form.socialLinks.value = (site.socialLinks || []).map((link) => `${link.label} | ${link.url}`).join("\n");
}

function readSiteForm() {
  const form = $("#site-form");
  return {
    ...adminState.content.site,
    title: form.title.value.trim(),
    owner: form.owner.value.trim(),
    tagline: form.tagline.value.trim(),
    intro: form.intro.value.trim(),
    announcement: form.announcement.value.trim(),
    contactEmail: form.contactEmail.value.trim(),
    socialLinks: serializeSocialLinks(form.socialLinks.value),
    theme: {
      ...adminState.content.site.theme,
      accent: form.accent.value,
      accentAlt: form.accentAlt.value,
      ink: form.ink.value,
      paper: form.paper.value,
      cursorMode: form.cursorMode.value
    },
    layout: {
      ...adminState.content.site.layout,
      heroMode: form.heroMode.value,
      showMoodboard: form.showMoodboard.checked,
      showJournal: form.showJournal.checked
    }
  };
}

function hydrateCategorySelect() {
  const select = $('#work-form select[name="category"]');
  const sections = adminState.content.site.layout.sections || [];
  const labels = new Map(CATEGORY_OPTIONS);
  select.innerHTML = "";
  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.title || labels.get(section.id) || section.id;
    select.append(option);
  });
}

function createSectionRow(section, index) {
  const row = document.createElement("div");
  row.className = "section-row";
  row.dataset.index = String(index);
  row.innerHTML = `
    <label>
      栏目 ID
      <select name="id"></select>
    </label>
    <label>
      名称
      <input name="title">
    </label>
    <label>
      描述
      <input name="description">
    </label>
    <label>
      强调色
      <input name="accent" type="color">
    </label>
    <div class="section-tools">
      <label class="checkbox"><input name="visible" type="checkbox">显示</label>
      <button type="button" data-action="up">上移</button>
      <button type="button" data-action="down">下移</button>
      <button class="danger" type="button" data-action="delete">删除</button>
    </div>
  `;

  const select = $('select[name="id"]', row);
  CATEGORY_OPTIONS.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  select.value = section.id || "hobby";
  $('input[name="title"]', row).value = section.title || "";
  $('input[name="description"]', row).value = section.description || "";
  $('input[name="accent"]', row).value = section.accent || "#a6ffcb";
  $('input[name="visible"]', row).checked = section.visible !== false;

  row.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (!action) {
      return;
    }

    const sections = readSectionRows();
    if (action === "delete") {
      sections.splice(index, 1);
    }
    if (action === "up" && index > 0) {
      [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
    }
    if (action === "down" && index < sections.length - 1) {
      [sections[index + 1], sections[index]] = [sections[index], sections[index + 1]];
    }
    adminState.content.site.layout.sections = sections;
    renderSectionsEditor();
  });

  return row;
}

function readSectionRows() {
  return $all(".section-row").map((row) => ({
    id: $('select[name="id"]', row).value,
    title: $('input[name="title"]', row).value.trim(),
    description: $('input[name="description"]', row).value.trim(),
    accent: $('input[name="accent"]', row).value,
    visible: $('input[name="visible"]', row).checked
  }));
}

function renderSectionsEditor() {
  const editor = $("#sections-editor");
  editor.innerHTML = "";
  (adminState.content.site.layout.sections || []).forEach((section, index) => {
    editor.append(createSectionRow(section, index));
  });
  hydrateCategorySelect();
}

function resetWorkForm() {
  const form = $("#work-form");
  form.reset();
  form.id.value = "";
  form.removeFile.checked = false;
  if (form.category.options.length) {
    form.category.selectedIndex = 0;
  }
}

function workCategoryLabel(category) {
  const section = adminState.content.site.layout.sections.find((item) => item.id === category);
  return section?.title || new Map(CATEGORY_OPTIONS).get(category) || category;
}

function renderWorksTable() {
  const table = $("#works-table");
  table.innerHTML = "";

  if (!adminState.content.works.length) {
    table.innerHTML = '<div class="work-row"><p>还没有作品，先上传一个文件或创建一个外部链接作品。</p></div>';
    return;
  }

  adminState.content.works.forEach((work) => {
    const row = document.createElement("article");
    row.className = "work-row";
    row.innerHTML = `
      <div>
        <h3></h3>
        <p></p>
      </div>
      <span></span>
      <div class="row-actions"></div>
    `;
    $("h3", row).textContent = work.title;
    $("p", row).textContent = `${work.year || "Now"} · ${work.medium || "未设置媒介"} · ${(work.tags || []).join(", ")}`;
    $("span", row).textContent = workCategoryLabel(work.category);

    const actions = $(".row-actions", row);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => populateWorkForm(work));
    actions.append(edit);

    if (work.file?.downloadUrl) {
      const download = document.createElement("a");
      download.href = work.file.downloadUrl;
      download.textContent = "下载";
      actions.append(download);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "删除";
    remove.addEventListener("click", () => deleteWork(work.id));
    actions.append(remove);

    table.append(row);
  });
}

function populateWorkForm(work) {
  const form = $("#work-form");
  form.id.value = work.id;
  form.category.value = work.category;
  form.year.value = work.year || "";
  form.title.value = work.title || "";
  form.description.value = work.description || "";
  form.medium.value = work.medium || "";
  form.tags.value = (work.tags || []).join(", ");
  form.externalUrl.value = work.externalUrl || "";
  form.featured.checked = Boolean(work.featured);
  form.removeFile.checked = false;
  form.file.value = "";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteWork(id) {
  if (!window.confirm("确认删除这个作品吗？关联上传文件也会被移除。")) {
    return;
  }

  await api(`/api/works/${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadContent();
  setStatus("作品已删除");
}

function syncJsonEditor() {
  $("#json-editor").value = JSON.stringify(adminState.content, null, 2);
}

async function loadContent() {
  adminState.content = await api("/api/content");
  hydrateSiteForm();
  renderSectionsEditor();
  renderWorksTable();
  syncJsonEditor();
}

function bindEvents() {
  $("#token-input").value = adminState.token;

  $("#token-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    adminState.token = $("#token-input").value.trim();
    localStorage.setItem("studio-token", adminState.token);
    setStatus("管理口令已保存");
    try {
      await loadContent();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  $("#reload-content").addEventListener("click", async () => {
    await loadContent();
    setStatus("内容已重新加载");
  });

  $("#site-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    adminState.content.site = readSiteForm();
    adminState.content = await api("/api/content", {
      method: "PUT",
      body: JSON.stringify(adminState.content)
    });
    hydrateSiteForm();
    renderSectionsEditor();
    syncJsonEditor();
    setStatus("站点框架已保存");
  });

  $("#add-section").addEventListener("click", () => {
    adminState.content.site.layout.sections.push({
      id: "hobby",
      title: "新栏目",
      description: "",
      accent: "#a6ffcb",
      visible: true
    });
    renderSectionsEditor();
  });

  $("#save-sections").addEventListener("click", async () => {
    adminState.content.site.layout.sections = readSectionRows();
    adminState.content = await api("/api/content", {
      method: "PUT",
      body: JSON.stringify(adminState.content)
    });
    renderSectionsEditor();
    renderWorksTable();
    syncJsonEditor();
    setStatus("栏目结构已保存");
  });

  $("#reset-work-form").addEventListener("click", resetWorkForm);

  $("#work-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!form.featured.checked) {
      data.set("featured", "false");
    }
    if (!form.removeFile.checked) {
      data.delete("removeFile");
    }

    const id = form.id.value;
    const method = id ? "PUT" : "POST";
    const url = id ? `/api/works/${encodeURIComponent(id)}` : "/api/works";
    await api(url, {
      method,
      body: data
    });

    resetWorkForm();
    await loadContent();
    setStatus("作品已保存");
  });

  $("#format-json").addEventListener("click", () => {
    const parsed = JSON.parse($("#json-editor").value);
    $("#json-editor").value = JSON.stringify(parsed, null, 2);
  });

  $("#save-json").addEventListener("click", async () => {
    const parsed = JSON.parse($("#json-editor").value);
    adminState.content = await api("/api/content", {
      method: "PUT",
      body: JSON.stringify(parsed)
    });
    hydrateSiteForm();
    renderSectionsEditor();
    renderWorksTable();
    syncJsonEditor();
    setStatus("完整 JSON 已保存");
  });

  window.addEventListener("unhandledrejection", (event) => {
    setStatus(event.reason?.message || "操作失败", true);
  });
}

bindEvents();
loadContent().catch((error) => setStatus(error.message, true));
