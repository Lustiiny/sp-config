const state = {
  content: null,
  activeSection: "all",
  pointer: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  orb: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  trail: []
};

const mediaMatchers = {
  image: /^image\//,
  audio: /^audio\//,
  video: /^video\//
};

const categoryIcon = {
  music: "♪",
  photography: "◐",
  design: "✦",
  ip: "◎",
  video: "▶",
  hobby: "※"
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function sectionById(id) {
  return state.content?.site?.layout?.sections?.find((section) => section.id === id);
}

function visibleSections() {
  return (state.content?.site?.layout?.sections || []).filter((section) => section.visible !== false);
}

function setText(selector, value) {
  $all(selector).forEach((node) => {
    node.textContent = value || "";
  });
}

function applyTheme(site) {
  const root = document.documentElement;
  root.style.setProperty("--accent", site.theme?.accent || "#a6ffcb");
  root.style.setProperty("--accent-alt", site.theme?.accentAlt || "#ff8fd8");
  root.style.setProperty("--ink", site.theme?.ink || "#f7f4ea");
  root.style.setProperty("--paper", site.theme?.paper || "#090912");
  document.title = site.title || "Deming's World";
}

function renderSiteCopy(site) {
  setText('[data-site="title"]', site.title);
  setText('[data-site="owner"]', site.owner);
  setText('[data-site="role"]', site.role);
  setText('[data-site="tagline"]', site.tagline);
  setText('[data-site="intro"]', site.intro);

  const contact = $("[data-contact]");
  if (contact) {
    contact.textContent = site.contactEmail || "Say hello";
    contact.href = site.contactEmail ? `mailto:${site.contactEmail}` : "#about";
  }

  const socials = $("#social-links");
  socials.innerHTML = "";
  (site.socialLinks || []).forEach((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.textContent = link.label;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    socials.append(anchor);
  });
}

function formatTickerDate(iso) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function buildTickerFeed() {
  const feed = [];

  (state.content?.works || []).forEach((work) => {
    const section = sectionById(work.category);
    const createdAt = work.createdAt || work.updatedAt;
    const updatedAt = work.updatedAt || work.createdAt;
    const isFresh = createdAt && updatedAt && Math.abs(new Date(updatedAt) - new Date(createdAt)) < 60_000;

    feed.push({
      kind: isFresh ? "new" : "update",
      label: isFresh ? "新增" : "更新",
      text: `${section?.title || work.category} · ${work.title}${work.year ? ` · ${work.year}` : ""}`,
      at: updatedAt || createdAt
    });
  });

  (state.content?.journal || []).forEach((entry) => {
    feed.push({
      kind: "note",
      label: "笔记",
      text: entry.title,
      at: entry.createdAt
    });
  });

  feed.sort((left, right) => new Date(right.at || 0) - new Date(left.at || 0));

  const announcement = state.content?.site?.announcement?.trim();
  if (announcement) {
    feed.push({
      kind: "info",
      label: "公告",
      text: announcement,
      at: null
    });
  }

  return feed.slice(0, 14);
}

function createTickerItem(item) {
  const node = document.createElement("span");
  node.className = `ticker-item ticker-item--${item.kind}`;

  const label = document.createElement("strong");
  label.className = "ticker-label";
  label.textContent = item.label;

  const copy = document.createElement("span");
  copy.className = "ticker-copy";
  const date = formatTickerDate(item.at);
  copy.textContent = date ? `${date} · ${item.text}` : item.text;

  node.append(label, copy);
  return node;
}

function renderTicker() {
  const track = $("#ticker-track");
  const feed = buildTickerFeed();
  const messages = feed.length
    ? feed
    : [{
        kind: "info",
        label: "提示",
        text: "还没有内容，先去传一件作品吧",
        at: null
      }];

  track.innerHTML = "";
  [...messages, ...messages].forEach((item) => {
    track.append(createTickerItem(item));
  });
}

function renderTabs() {
  const tabs = $("#section-tabs");
  tabs.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.textContent = "全部";
  allButton.className = state.activeSection === "all" ? "active" : "";
  allButton.addEventListener("click", () => {
    state.activeSection = "all";
    renderTabs();
    renderWorks();
  });
  tabs.append(allButton);

  visibleSections().forEach((section) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${categoryIcon[section.id] || "•"} ${section.title}`;
    button.className = state.activeSection === section.id ? "active" : "";
    button.style.setProperty("--accent", section.accent);
    button.addEventListener("click", () => {
      state.activeSection = section.id;
      renderTabs();
      renderWorks();
    });
    tabs.append(button);
  });
}

function mediaKind(file) {
  if (!file) {
    return "placeholder";
  }

  if (mediaMatchers.image.test(file.mimeType)) {
    return "image";
  }
  if (mediaMatchers.audio.test(file.mimeType)) {
    return "audio";
  }
  if (mediaMatchers.video.test(file.mimeType)) {
    return "video";
  }
  return "file";
}

function renderMedia(work, target) {
  const kind = mediaKind(work.file);
  target.innerHTML = "";

  if (kind === "image") {
    const image = document.createElement("img");
    image.src = work.file.url;
    image.alt = work.title;
    image.loading = "lazy";
    target.append(image);
    return;
  }

  if (kind === "audio") {
    const wrapper = document.createElement("div");
    wrapper.className = "media-placeholder";
    wrapper.innerHTML = `<strong>${categoryIcon[work.category] || "♪"}</strong><span>${work.file.originalName}</span>`;
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = work.file.url;
    wrapper.append(audio);
    target.append(wrapper);
    return;
  }

  if (kind === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.src = work.file.url;
    target.append(video);
    return;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "media-placeholder";
  placeholder.innerHTML = `<strong>${categoryIcon[work.category] || "✦"}</strong><span>${work.medium || "No media uploaded yet"}</span>`;
  target.append(placeholder);
}

function applyRevealStagger(container, selector) {
  if (!container) {
    return;
  }

  $all(selector, container).forEach((item, index) => {
    item.classList.add("reveal-item");
    item.style.setProperty("--reveal-delay", `${Math.min(index * 90, 540)}ms`);
  });
}

function setupSectionReveals() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = $all("[data-reveal]");

  if (reducedMotion) {
    revealTargets.forEach((section) => section.classList.add("is-visible"));
    return;
  }

  const hero = $('[data-reveal="hero"]');
  if (hero) {
    window.requestAnimationFrame(() => {
      hero.classList.add("is-visible");
    });
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.14,
    rootMargin: "0px 0px -8% 0px"
  });

  revealTargets.forEach((section) => {
    if (section.dataset.reveal === "hero") {
      return;
    }
    observer.observe(section);
  });
}

function renderWorks() {
  const grid = $("#works-grid");
  const template = $("#work-card-template");
  const visibleIds = new Set(visibleSections().map((section) => section.id));
  const works = (state.content?.works || []).filter((work) => {
    if (!visibleIds.has(work.category)) {
      return false;
    }
    return state.activeSection === "all" || work.category === state.activeSection;
  });

  grid.innerHTML = "";
  const totalWorks = (state.content?.works || []).length;
  $("#featured-count").textContent = String(totalWorks);

  if (!works.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state reveal-item";
    empty.textContent = "这个分类还是空的。";
    grid.append(empty);
    return;
  }

  works.forEach((work, index) => {
    const section = sectionById(work.category);
    const card = template.content.firstElementChild.cloneNode(true);
    card.classList.add("reveal-item");
    if (work.featured && state.activeSection === "all" && index === 0) {
      card.classList.add("work-card--lead");
    }
    card.style.setProperty("--reveal-delay", `${Math.min(index * 90, 540)}ms`);
    card.style.setProperty("--card-accent", section?.accent || "var(--accent)");
    $('[data-field="category"]', card).textContent = section?.title || work.category;
    $('[data-field="year"]', card).textContent = work.year || "Now";
    $('[data-field="title"]', card).textContent = work.title;
    $('[data-field="description"]', card).textContent = work.description;

    renderMedia(work, $(".work-media", card));

    const tags = $('[data-field="tags"]', card);
    (work.tags || []).forEach((tag) => {
      const pill = document.createElement("span");
      pill.textContent = tag;
      tags.append(pill);
    });

    const actions = $(".work-actions", card);
    if (work.externalUrl) {
      const link = document.createElement("a");
      link.href = work.externalUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "外部链接";
      actions.append(link);
    }
    if (work.file?.downloadUrl) {
      const download = document.createElement("a");
      download.href = work.file.downloadUrl;
      download.textContent = "下载";
      actions.append(download);
    }
    if (!actions.children.length) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "收藏";
      button.addEventListener("click", () => card.classList.toggle("is-saved"));
      actions.append(button);
    }

    grid.append(card);
  });
}

function renderMoodboard() {
  const moodboard = $("#moodboard");
  const grid = $("#moodboard-grid");
  const shouldShow = state.content?.site?.layout?.showMoodboard !== false;
  moodboard.hidden = !shouldShow;
  grid.innerHTML = "";

  if (!shouldShow) {
    return;
  }

  const featured = (state.content?.works || []).filter((work) => work.featured).slice(0, 6);
  const pool = featured.length ? featured : (state.content?.works || []).slice(0, 6);

  pool.forEach((work, index) => {
    const section = sectionById(work.category);
    const tile = document.createElement("article");
    tile.className = "mood-tile magnetic reveal-item";
    tile.style.setProperty("--reveal-delay", `${Math.min(index * 110, 660)}ms`);
    tile.style.setProperty("--tile-accent", section?.accent || "var(--accent)");
    tile.innerHTML = `<span>${section?.title || work.category}</span><strong>${work.title}</strong><span>${(work.tags || []).join(" / ")}</span>`;
    grid.append(tile);
  });
}

function renderJournal() {
  const journal = $("#journal");
  const list = $("#journal-list");
  const shouldShow = state.content?.site?.layout?.showJournal !== false;
  journal.hidden = !shouldShow;
  list.innerHTML = "";

  if (!shouldShow) {
    return;
  }

  (state.content?.journal || []).forEach((entry, index) => {
    const card = document.createElement("article");
    card.className = "journal-card reveal-item";
    card.style.setProperty("--reveal-delay", `${Math.min(index * 120, 480)}ms`);
    card.innerHTML = `<h3></h3><p></p>`;
    $("h3", card).textContent = entry.title;
    $("p", card).textContent = entry.body;
    list.append(card);
  });
}

function renderAll() {
  const { site } = state.content;
  applyTheme(site);
  renderSiteCopy(site);
  renderTicker();
  renderTabs();
  renderWorks();
  renderMoodboard();
  renderJournal();
  bindMagneticElements();
  applyRevealStagger($("#about"), ".about-card");
  setupSectionReveals();
}

async function loadContent() {
  const response = await fetch("/api/content");
  if (!response.ok) {
    throw new Error("无法加载站点内容");
  }
  state.content = await response.json();
  renderAll();
}

function bindMagneticElements() {
  $all(".magnetic").forEach((element) => {
    if (element.dataset.magneticBound) {
      return;
    }

    element.dataset.magneticBound = "true";
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      element.style.transform = `translate(${x * 0.04}px, ${y * 0.08}px)`;
      document.body.classList.add("cursor-active");
    });
    element.addEventListener("pointerleave", () => {
      element.style.transform = "";
      document.body.classList.remove("cursor-active");
    });
  });
}

function setupCursor() {
  const canvas = $("#cursor-canvas");
  const context = canvas.getContext("2d");
  const orb = $(".cursor-orb");
  const dot = $(".cursor-dot");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !context) {
    return;
  }

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function draw() {
    state.orb.x += (state.pointer.x - state.orb.x) * 0.16;
    state.orb.y += (state.pointer.y - state.orb.y) * 0.16;
    orb.style.left = `${state.orb.x}px`;
    orb.style.top = `${state.orb.y}px`;
    dot.style.left = `${state.pointer.x}px`;
    dot.style.top = `${state.pointer.y}px`;

    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    state.trail.forEach((point, index) => {
      point.life -= 0.018;
      const alpha = Math.max(point.life, 0);
      const radius = 18 * alpha;
      const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `rgba(166, 255, 203, ${0.22 * alpha})`);
      gradient.addColorStop(1, "rgba(166, 255, 203, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      if (point.life <= 0) {
        state.trail.splice(index, 1);
      }
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (event) => {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
    document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
    state.trail.push({ x: event.clientX, y: event.clientY, life: 1 });
    if (state.trail.length > 48) {
      state.trail.shift();
    }
  });

  resize();
  draw();
}

setupCursor();
loadContent().catch((error) => {
  $("#works-grid").innerHTML = `<div class="empty-state">${error.message}</div>`;
});
