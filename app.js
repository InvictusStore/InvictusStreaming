import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
  increment,
  setDoc,
  deleteDoc,
} from "./firebase.js";

/** =========================
 *  Helpers / Estado
 *  ========================= */
const $ = (id) => document.getElementById(id);

function getAnonId() {
  const key = "invictus_anon_id";
  let v = localStorage.getItem(key);
  if (!v) {
    v = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
    localStorage.setItem(key, v);
  }
  return v;
}

const state = {
  settings: null,
  platforms: [],
  screens: [],
  reviews: [],
  approvedCount: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  lightboxIndex: 0,
};

/** =========================
 *  UI: Drawer / Sheets / Nav
 *  ========================= */
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

  if (tab === "home") window.scrollTo({ top: 0, behavior: "smooth" });
  if (tab === "platforms") $("platformsTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  if (tab === "gallery") $("screensTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  if (tab === "search") $("btnSearch").focus();
}

/** =========================
 *  Firebase: cargar datos
 *  ========================= */
async function loadSettings() {
  const ref = doc(db, "settings", "public");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    state.settings = {
      title: "Invictus Streaming",
      heroImageUrl: "",
      defaultAvatarUrl: "",
      whatsappDefaultUrl: "https://wa.me/",
      ratingDisplay: 4.8,
      shareUrl: window.location.href,
      platformsTitle: "Vuelve a entrar",
      screensTitle: "Para ti",
    };
    return;
  }
  state.settings = snap.data();
}

async function loadPlatforms() {
  const q = query(
    collection(db, "platforms"),
    where("active", "==", true),
    orderBy("order", "asc")
  );
  const snaps = await getDocs(q);
  state.platforms = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadScreens() {
  const q = query(
    collection(db, "screens"),
    where("active", "==", true),
    orderBy("order", "asc")
  );
  const snaps = await getDocs(q);
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
 *  Render UI
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
      <div style="text-align:right;color:rgba(255,255,255,.75);font-weight:900;">${count}</div>
    `;
    wrap.appendChild(row);
  }
}

function renderPlatforms() {
  const row = $("platformsRow");
  row.innerHTML = "";

  const fallbackWa = state.settings?.whatsappDefaultUrl || "https://wa.me/";

  state.platforms.forEach((p) => {
    const item = document.createElement("button");
    item.className = "platformItem";
    item.type = "button";
    item.title = p.name;

    item.innerHTML = `<img src="${p.logoUrl}" alt="${p.name}" loading="lazy" />`;

    item.addEventListener("click", () => {
      const url = p.whatsappUrl || fallbackWa;
      window.open(url, "_blank", "noopener,noreferrer");
    });

    row.appendChild(item);
  });
}

function renderScreens() {
  const row = $("screensRow");
  row.innerHTML = "";

  state.screens.forEach((sc, idx) => {
    const item = document.createElement("button");
    item.className = "screenItem";
    item.type = "button";
    item.innerHTML = `<img src="${sc.imageUrl}" alt="Captura ${idx + 1}" loading="lazy" />`;

    item.addEventListener("click", () => openLightbox(idx));
    row.appendChild(item);
  });
}

function starsText(n) {
  const v = Math.max(1, Math.min(5, Number(n) || 1));
  return "★".repeat(v) + "☆".repeat(5 - v);
}

function renderReviews() {
  const list = $("reviewsList");
  list.innerHTML = "";

  if (state.reviews.length === 0) {
    list.innerHTML = `<div style="color:rgba(255,255,255,.65);font-weight:800;">Aún no hay reseñas aprobadas.</div>`;
    return;
  }

  const avatar = state.settings?.defaultAvatarUrl || "";

  state.reviews.forEach((r) => {
    const card = document.createElement("div");
    card.className = "review";

    const liked = isLikedLocally(r.id);

    card.innerHTML = `
      <div class="reviewAvatar">
        <img src="${avatar}" alt="avatar" loading="lazy" />
      </div>
      <div class="reviewBody">
        <div class="reviewTop">
          <div class="reviewName">${escapeHtml(r.username || "Usuario")}</div>
          <div class="reviewStars">${starsText(r.rating)}</div>
        </div>
        <div class="reviewText">${escapeHtml(r.text || "")}</div>

        <div class="likeRow">
          <button class="likeBtn ${liked ? "liked" : ""}" data-review="${r.id}">
            ❤ <span>${Number(r.likesCount || 0)}</span>
          </button>
        </div>
      </div>
    `;

    list.appendChild(card);
  });

  list.querySelectorAll(".likeBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const reviewId = btn.getAttribute("data-review");
      await toggleLike(reviewId, btn);
    });
  });
}

/** =========================
 *  Likes sin login (anonId)
 *  ========================= */
function localLikeKey(reviewId) {
  return `invictus_like_${reviewId}`;
}
function isLikedLocally(reviewId) {
  return localStorage.getItem(localLikeKey(reviewId)) === "1";
}
function setLikedLocally(reviewId, val) {
  localStorage.setItem(localLikeKey(reviewId), val ? "1" : "0");
}

async function toggleLike(reviewId, btnEl) {
  const anonId = getAnonId();
  const likedNow = isLikedLocally(reviewId);

  const reviewRef = doc(db, "reviews", reviewId);
  const likeRef = doc(db, "reviews", reviewId, "likes", anonId);

  const countSpan = btnEl.querySelector("span");
  let current = Number(countSpan?.textContent || 0);

  try {
    if (!likedNow) {
      await setDoc(likeRef, { createdAt: serverTimestamp() });
      await updateDoc(reviewRef, { likesCount: increment(1) });

      setLikedLocally(reviewId, true);
      btnEl.classList.add("liked");
      countSpan.textContent = String(current + 1);
    } else {
      await deleteDoc(likeRef);
      await updateDoc(reviewRef, { likesCount: increment(-1) });

      setLikedLocally(reviewId, false);
      btnEl.classList.remove("liked");
      countSpan.textContent = String(Math.max(0, current - 1));
    }
  } catch (e) {
    console.error(e);
    alert("No se pudo registrar el like. Intenta de nuevo.");
  }
}

/** =========================
 *  Publicar reseña
 *  ========================= */
async function submitReview(e) {
  e.preventDefault();

  const username = $("fUsername").value.trim();
  const rating = Number($("fRating").value);
  const text = $("fText").value.trim();

  if (!username || !text || !(rating >= 1 && rating <= 5)) return;

  const payload = {
    username,
    rating,
    text,
    approved: false,
    likesCount: 0,
    createdAt: serverTimestamp(),
  };

  try {
    $("btnSubmitReview").disabled = true;

    await addDoc(collection(db, "reviews"), payload);

    $("reviewForm").reset();
    $("charNow").textContent = "0";
    closeSheet("reviewSheet");

    alert("¡Listo! Tu reseña fue enviada y quedará pendiente de aprobación.");
  } catch (err) {
    console.error(err);
    alert("No se pudo enviar la reseña. Revisa tus reglas de Firestore y vuelve a intentar.");
  } finally {
    $("btnSubmitReview").disabled = false;
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
      alert("Link copiado al portapapeles ✅");
    }
  } catch (e) {}
}

/** =========================
 *  Lightbox
 *  ========================= */
function openLightbox(index) {
  state.lightboxIndex = index;
  $("lightbox").classList.add("open");
  $("lightbox").setAttribute("aria-hidden", "false");
  renderLightbox();
}
function closeLightbox() {
  $("lightbox").classList.remove("open");
  $("lightbox").setAttribute("aria-hidden", "true");
}
function renderLightbox() {
  const item = state.screens[state.lightboxIndex];
  if (!item) return;
  $("lightboxImg").src = item.imageUrl;
}
function nextImg() {
  if (state.screens.length === 0) return;
  state.lightboxIndex = (state.lightboxIndex + 1) % state.screens.length;
  renderLightbox();
}
function prevImg() {
  if (state.screens.length === 0) return;
  state.lightboxIndex = (state.lightboxIndex - 1 + state.screens.length) % state.screens.length;
  renderLightbox();
}

/** =========================
 *  Utils
 *  ========================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** =========================
 *  Init
 *  ========================= */
function wireUI() {
  // Drawer
  $("btnMenu").addEventListener("click", openDrawer);
  $("btnCloseDrawer").addEventListener("click", closeDrawer);

  // ✅ Ya NO cerramos tocando “afuera” porque quitamos el backdrop
  // $("drawerBackdrop").addEventListener("click", closeDrawer);

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

  // ✅ Ya NO cerramos tocando “afuera”
  // $("ratingsBackdrop").addEventListener("click", () => closeSheet("ratingsSheet"));

  // Open review form
  $("btnOpenReviewForm").addEventListener("click", () => {
    closeSheet("ratingsSheet");
    openSheet("reviewSheet");
  });

  // Review sheet close
  $("btnCloseReview").addEventListener("click", () => closeSheet("reviewSheet"));

  // ✅ Ya NO cerramos tocando “afuera”
  // $("reviewBackdrop").addEventListener("click", () => closeSheet("reviewSheet"));

  // Form submit + contador caracteres
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
}

start();
