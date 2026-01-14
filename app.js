import {
  app,
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  increment,
  setDoc,
  serverTimestamp,
} from "./firebase.js";

/** =========================
 *  Helpers DOM / state
 *  ========================= */
const $ = (id) => document.getElementById(id);

const state = {
  settings: {},
  platforms: [],
  screens: [],
  reviews: [],
  approvedCount: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  lightbox: { items: [], index: 0 },
};

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openDrawer() {
  $("drawer").classList.add("open");
  $("drawer").setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  $("drawer").classList.remove("open");
  $("drawer").setAttribute("aria-hidden", "true");
}
function openSheet(sheetId) {
  $(sheetId).classList.add("open");
  $(sheetId).setAttribute("aria-hidden", "false");
}
function closeSheet(sheetId) {
  $(sheetId).classList.remove("open");
  $(sheetId).setAttribute("aria-hidden", "true");
}

function setActiveTab(tab) {
  document.querySelectorAll(".navBtn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  if (tab === "search") alert("Búsqueda próximamente 😉");
  if (tab === "bag") alert("Carrito próximamente 😉");
}

/** =========================
 *  Estrellas + fecha (Hoy/Ayer)
 *  ========================= */
function dayLabel(createdAt) {
  let d = null;
  if (createdAt && typeof createdAt.toDate === "function") d = createdAt.toDate();
  else if (createdAt instanceof Date) d = createdAt;
  else if (typeof createdAt === "number") d = new Date(createdAt);

  if (!d || isNaN(d.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - that) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function starsText(rating) {
  const n = Math.max(1, Math.min(5, Number(rating) || 1));
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

/** =========================
 *  Likes sin login (localStorage)
 *  ========================= */
function likesKey(reviewId) {
  return `liked_review_${reviewId}`;
}
function isLikedLocally(reviewId) {
  return localStorage.getItem(likesKey(reviewId)) === "1";
}
function setLikedLocally(reviewId, val) {
  localStorage.setItem(likesKey(reviewId), val ? "1" : "0");
}

async function toggleLike(reviewId) {
  try {
    const liked = isLikedLocally(reviewId);
    const ref = doc(db, "reviews", reviewId);

    // Solo sumamos (sin auth no podemos evitar 100% abuso, pero reducimos con localStorage)
    if (!liked) {
      await updateDoc(ref, { likesCount: increment(1) });
      setLikedLocally(reviewId, true);
    } else {
      // opcional: permitir “deslike” (si quieres, lo deshabilitamos)
      // await updateDoc(ref, { likesCount: increment(-1) });
      // setLikedLocally(reviewId, false);
      return;
    }

    await loadApprovedReviews();
    renderRatingLine();
    renderBreakdown();
    renderSheetReviews();
    renderReviews();
  } catch (err) {
    console.error(err);
    alert("No se pudo dar like. Revisa tus reglas o consola.");
  }
}

/** =========================
 *  Firestore loads
 *  ========================= */
async function loadSettings() {
  try {
    const ref = doc(db, "settings", "public");
    const snap = await getDoc(ref);
    state.settings = snap.exists() ? snap.data() : {};
  } catch (e) {
    console.warn("Sin settings/public aún. (OK si no lo creaste)");
    state.settings = {};
  }
}

async function loadPlatforms() {
  const snaps = await getDocs(query(collection(db, "platforms"), orderBy("order", "asc")));
  state.platforms = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadScreens() {
  const snaps = await getDocs(query(collection(db, "screens"), orderBy("order", "asc")));
  state.screens = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadApprovedReviews() {
  const q = query(
    collection(db, "reviews"),
    where("approved", "==", true),
    orderBy("createdAt", "desc")
  );
  const snaps = await getDocs(q);
  state.reviews = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.approvedCount = state.reviews.length;

  state.breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of state.reviews) {
    const val = Number(r.rating) || 0;
    if (val >= 1 && val <= 5) state.breakdown[val] += 1;
  }
}

/** =========================
 *  Render
 *  ========================= */
function renderHero() {
  const s = state.settings;

  if (s.heroImageUrl) {
    $("heroBg").style.backgroundImage = `url("${s.heroImageUrl}")`;
  } else {
    $("heroBg").style.backgroundImage = `linear-gradient(120deg, #1a0b24, #0b0b0f)`;
  }

  const title = (s.title || "Invictus Streaming").toUpperCase();
  $("brandTitle").textContent = title;

  $("platformsTitle").textContent = s.platformsTitle || "Vuelve a entrar";
  $("screensTitle").textContent = s.screensTitle || "Para ti";
}

function renderRatingLine() {
  const s = state.settings;
  const ratingDisplay = typeof s.ratingDisplay === "number" ? s.ratingDisplay : 4.8;

  $("ratingValue").textContent = ratingDisplay.toFixed(1);
  $("ratingCount").textContent = `(${state.approvedCount})`;

  $("sheetRatingValue").textContent = ratingDisplay.toFixed(1);
  $("sheetRatingCount").textContent = `${state.approvedCount} reseñas`;
}

function renderBreakdown() {
  const wrap = $("breakdown");
  wrap.innerHTML = "";

  const total = Math.max(1, state.approvedCount);

  for (let star = 5; star >= 1; star--) {
    const count = state.breakdown[star] || 0;
    const pct = Math.round((count / total) * 100);

    const row = document.createElement("div");
    row.className = "rowBar";
    row.innerHTML = `
      <div><strong>${star}</strong> ★</div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div style="text-align:right; font-weight:900;">${count}</div>
    `;
    wrap.appendChild(row);
  }
}

function renderPlatforms() {
  const row = $("platformsRow");
  row.innerHTML = "";

  state.platforms.forEach((p) => {
    const item = document.createElement("div");
    item.className = "platformItem";
    item.innerHTML = `<img src="${p.logoUrl}" alt="${escapeHtml(p.name)}" loading="lazy">`;
    item.addEventListener("click", () => {
      const url = p.whatsappUrl || state.settings?.whatsappUrl;
      if (url) window.open(url, "_blank");
    });
    row.appendChild(item);
  });
}

function openLightbox(items, startIndex = 0) {
  state.lightbox.items = items;
  state.lightbox.index = startIndex;
  $("lightboxImg").src = items[startIndex];
  $("lightbox").classList.add("open");
  $("lightbox").setAttribute("aria-hidden", "false");
}
function closeLightbox() {
  $("lightbox").classList.remove("open");
  $("lightbox").setAttribute("aria-hidden", "true");
}
function nextImg() {
  const items = state.lightbox.items;
  if (!items.length) return;
  state.lightbox.index = (state.lightbox.index + 1) % items.length;
  $("lightboxImg").src = items[state.lightbox.index];
}
function prevImg() {
  const items = state.lightbox.items;
  if (!items.length) return;
  state.lightbox.index = (state.lightbox.index - 1 + items.length) % items.length;
  $("lightboxImg").src = items[state.lightbox.index];
}

function renderScreens() {
  const row = $("screensRow");
  row.innerHTML = "";

  const imgs = state.screens.map((s) => s.imageUrl);

  state.screens.forEach((s, idx) => {
    const item = document.createElement("div");
    item.className = "screenItem";
    item.innerHTML = `<img src="${s.imageUrl}" alt="captura" loading="lazy">`;
    item.addEventListener("click", () => openLightbox(imgs, idx));
    row.appendChild(item);
  });
}

function renderReviews() {
  const list = $("reviewsList");
  list.innerHTML = "";

  if (state.reviews.length === 0) {
    list.innerHTML = `<div style="color:rgba(255,255,255,.65);font-weight:800;">Aún no hay reseñas aprobadas.</div>`;
    return;
  }

  const avatar = state.settings?.defaultAvatarUrl || "";
  const preview = state.reviews.slice(0, 4);

  preview.forEach((r) => {
    const item = document.createElement("div");
    item.className = "reviewItem";

    const liked = isLikedLocally(r.id);
    const day = dayLabel(r.createdAt);
    const service = r.service || "Invictus Streaming";

    item.innerHTML = `
      <div class="reviewAvatar">
        <img src="${avatar}" alt="avatar" loading="lazy" />
      </div>
      <div class="reviewContent">
        <div class="reviewStarsRow">${starsText(r.rating)}</div>

        <div class="reviewMeta">
          <div class="reviewName">${escapeHtml(r.username || "Usuario")}</div>
          ${day ? `<div class="reviewDay">· ${escapeHtml(day)}</div>` : ``}
        </div>

        <div class="reviewService">${escapeHtml(service)}</div>

        <div class="reviewText2">${escapeHtml(r.text || "")}</div>

        <div class="helpfulRow">
          <button class="helpfulBtn ${liked ? "liked" : ""}" data-review="${r.id}">
            <span class="heart">❤</span> Útil <span>${Number(r.likesCount || 0)}</span>
          </button>
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  list.onclick = async (e) => {
    const btn = e.target.closest("[data-review]");
    if (!btn) return;
    const id = btn.getAttribute("data-review");
    await toggleLike(id);
  };
}

function renderSheetReviews() {
  const list = $("sheetReviewsList");
  const countEl = $("sheetReviewsCount");
  if (!list || !countEl) return;

  list.innerHTML = "";
  countEl.textContent = `${state.approvedCount}`;

  if (state.reviews.length === 0) {
    list.innerHTML = `<div style="color:rgba(0,0,0,.55);font-weight:800;padding:8px 0;">Aún no hay reseñas.</div>`;
    return;
  }

  const avatar = state.settings?.defaultAvatarUrl || "";

  state.reviews.forEach((r) => {
    const item = document.createElement("div");
    item.className = "reviewItem";

    const liked = isLikedLocally(r.id);
    const day = dayLabel(r.createdAt);
    const service = r.service || "Invictus Streaming";

    item.innerHTML = `
      <div class="reviewAvatar">
        <img src="${avatar}" alt="avatar" loading="lazy" />
      </div>
      <div class="reviewContent">
        <div class="reviewStarsRow">${starsText(r.rating)}</div>

        <div class="reviewMeta">
          <div class="reviewName">${escapeHtml(r.username || "Usuario")}</div>
          ${day ? `<div class="reviewDay">· ${escapeHtml(day)}</div>` : ``}
        </div>

        <div class="reviewService">${escapeHtml(service)}</div>

        <div class="reviewText2">${escapeHtml(r.text || "")}</div>

        <div class="helpfulRow">
          <button class="helpfulBtn ${liked ? "liked" : ""}" data-review="${r.id}">
            <span class="heart">❤</span> Útil <span>${Number(r.likesCount || 0)}</span>
          </button>
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  list.onclick = async (e) => {
    const btn = e.target.closest("[data-review]");
    if (!btn) return;
    const id = btn.getAttribute("data-review");
    await toggleLike(id);
  };
}

/** =========================
 *  Publicar reseña
 *  ========================= */
async function submitReview(e) {
  e.preventDefault();

  const username = $("fUsername").value.trim();
  const rating = Number($("fRating").value);
  const service = $("fService").value.trim();
  const text = $("fText").value.trim();

  if (!username || !service || !text || !(rating >= 1 && rating <= 5)) return;

  const payload = {
    username,
    rating,
    service,
    text,
    approved: false,
    likesCount: 0,
    createdAt: serverTimestamp(),
  };

  try {
    $("btnSubmitReview").disabled = true;
    $("btnSubmitReview").textContent = "Enviando...";

    await addDoc(collection(db, "reviews"), payload);

    $("fUsername").value = "";
    $("fService").value = "";
    $("fRating").value = "5";
    $("fText").value = "";
    $("charNow").textContent = "0";

    alert("¡Gracias! Tu reseña quedó pendiente de aprobación ✅");
    closeSheet("reviewSheet");
    openSheet("ratingsSheet");
  } catch (err) {
    console.error(err);
    alert("No se pudo publicar. Revisa tus reglas de Firestore y la consola.");
  } finally {
    $("btnSubmitReview").disabled = false;
    $("btnSubmitReview").textContent = "Enviar (queda pendiente de aprobación)";
  }
}

/** =========================
 *  Compartir link
 *  ========================= */
async function sharePage() {
  const url = state.settings?.shareUrl || window.location.href;
  const title = state.settings?.title || "Invictus Streaming";

  try {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copiado ✅");
    }
  } catch (e) {
    console.warn(e);
  }
}

/** =========================
 *  Wire UI
 *  ========================= */
function wireUI() {
  // Drawer
  $("btnMenu").addEventListener("click", openDrawer);
  $("btnCloseDrawer").addEventListener("click", closeDrawer);
  $("drawerBackdrop").addEventListener("click", closeDrawer);

  document.querySelectorAll(".drawerItem").forEach((b) => {
    b.addEventListener("click", () => {
      closeDrawer();
      setActiveTab(b.dataset.tab);
    });
  });

  // Share
  $("btnShare").addEventListener("click", sharePage);

  // Ratings sheet
  $("btnOpenRatings").addEventListener("click", () => openSheet("ratingsSheet"));
  $("btnCloseRatings").addEventListener("click", () => closeSheet("ratingsSheet"));
  // ✅ Sin overlay: NO cerramos al tocar fuera

  // Open review form
  $("btnOpenReviewForm").addEventListener("click", () => {
    closeSheet("ratingsSheet");
    openSheet("reviewSheet");
  });

  $("btnCloseReview").addEventListener("click", () => closeSheet("reviewSheet"));
  // ✅ Sin overlay: NO cerramos al tocar fuera

  // Form
  $("reviewForm").addEventListener("submit", submitReview);
  $("fText").addEventListener("input", () => {
    $("charNow").textContent = String($("fText").value.length);
  });

  // Bottom nav
  document.querySelectorAll(".navBtn").forEach((b) => {
    b.addEventListener("click", () => setActiveTab(b.dataset.tab));
  });

  // Lightbox
  $("btnCloseLightbox").addEventListener("click", closeLightbox);
  $("lightboxBackdrop").addEventListener("click", closeLightbox);
  $("btnNextImg").addEventListener("click", nextImg);
  $("btnPrevImg").addEventListener("click", prevImg);

  // “Iniciar sesión” sin funcionalidad
  $("btnLogin").addEventListener("click", () => alert("Próximamente 😉"));

  // Search sin funcionalidad por ahora
  $("btnSearch").addEventListener("click", () => alert("Búsqueda próximamente 😉"));
}

async function start() {
  wireUI();

  await loadSettings();
  await loadPlatforms();
  await loadScreens();
  await loadApprovedReviews();

  renderHero();
  renderPlatforms();
  renderScreens();
  renderReviews();

  renderRatingLine();
  renderBreakdown();
  renderSheetReviews();
}

start();
