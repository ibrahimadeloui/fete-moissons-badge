const FRAME = {
  x: 12 / 682,
  y: 524 / 1024,
  w: 224 / 682,
  h: 336 / 1024,
  radius: 0.07,
};

const state = {
  poster: null,
  photo: null,
  zoom: 1,
  rotation: 0,
  cx: FRAME.x + FRAME.w / 2,
  cy: FRAME.y + FRAME.h / 2,
};

const badge = document.getElementById("badge");
const ctx = badge.getContext("2d");
const photoInput = document.getElementById("photo");
const tools = document.getElementById("tools");
const zoomInput = document.getElementById("zoom");
const rotateInput = document.getElementById("rotate");
const zoomValue = document.getElementById("zoom-value");
const rotateValue = document.getElementById("rotate-value");
const downloadBtn = document.getElementById("download");
const shareBtn = document.getElementById("share");
const statusEl = document.getElementById("status");
const loadingEl = document.getElementById("loading");

const pointers = new Map();
let dragId = null;
let pinchDist = null;

const posterImage = new Image();
posterImage.decoding = "async";
posterImage.src = "/assets/poster.jpg";
posterImage.onload = () => {
  state.poster = posterImage;
  loadingEl.hidden = true;
  layout();
};
posterImage.onerror = () => {
  loadingEl.textContent = "L'affiche n'a pas pu être chargée. Rechargez la page.";
};

function frameRect(width, height) {
  return {
    x: FRAME.x * width,
    y: FRAME.y * height,
    w: FRAME.w * width,
    h: FRAME.h * height,
  };
}

function roundRect(context, rect) {
  const radius = Math.min(rect.w, rect.h) * FRAME.radius;
  context.beginPath();
  context.moveTo(rect.x + radius, rect.y);
  context.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, radius);
  context.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, radius);
  context.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, radius);
  context.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, radius);
  context.closePath();
}

function coverScale(imgW, imgH, frameW, frameH, rotation) {
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const scaleW = frameW / (imgW * cos + imgH * sin);
  const scaleH = frameH / (imgW * sin + imgH * cos);
  return Math.max(scaleW, scaleH) * 1.03;
}

function photoScale(rect) {
  return coverScale(state.photo.width, state.photo.height, rect.w, rect.h, state.rotation) * state.zoom;
}

function clampPan(width, height) {
  if (!state.photo) return;
  const rect = frameRect(width, height);
  const scale = photoScale(rect);
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  const halfW = state.photo.width / 2;
  const halfH = state.photo.height / 2;
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h],
    [rect.x, rect.y + rect.h],
  ];
  let cx = state.cx * width;
  let cy = state.cy * height;
  for (let pass = 0; pass < 6; pass += 1) {
    let worst = 0;
    let overflowX = 0;
    let overflowY = 0;
    for (const [px, py] of corners) {
      const dx = px - cx;
      const dy = py - cy;
      const localX = (dx * cos + dy * sin) / scale;
      const localY = (-dx * sin + dy * cos) / scale;
      let ox = 0;
      let oy = 0;
      if (localX < -halfW) ox = localX + halfW;
      else if (localX > halfW) ox = localX - halfW;
      if (localY < -halfH) oy = localY + halfH;
      else if (localY > halfH) oy = localY - halfH;
      const magnitude = ox * ox + oy * oy;
      if (magnitude > worst) {
        worst = magnitude;
        overflowX = ox;
        overflowY = oy;
      }
    }
    if (worst < 0.05) break;
    cx += scale * (overflowX * cos - overflowY * sin);
    cy += scale * (overflowX * sin + overflowY * cos);
  }
  state.cx = cx / width;
  state.cy = cy / height;
}

function drawCamera(context, rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h * 0.46;
  const size = rect.w * 0.22;
  context.save();
  context.translate(cx, cy);
  context.strokeStyle = "#ffd45a";
  context.fillStyle = "rgba(255, 212, 90, 0.14)";
  context.lineWidth = Math.max(2, rect.w * 0.012);
  roundLocal(context, -size, -size * 0.62, size * 2, size * 1.45, size * 0.18);
  context.fill();
  context.stroke();
  context.beginPath();
  context.arc(0, size * 0.05, size * 0.38, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  context.fillStyle = "#fff8e6";
  context.font = `700 ${Math.round(rect.w * 0.075)}px Montserrat, sans-serif`;
  context.textAlign = "center";
  context.fillText("Votre photo", cx, rect.y + rect.h * 0.68);
  context.font = `600 ${Math.round(rect.w * 0.05)}px Montserrat, sans-serif`;
  context.fillStyle = "rgba(255, 248, 230, 0.85)";
  context.fillText("Choisissez une photo", cx, rect.y + rect.h * 0.75);
}

function roundLocal(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBadge(context, width, height, mode) {
  context.clearRect(0, 0, width, height);
  if (!state.poster) return;
  context.drawImage(state.poster, 0, 0, width, height);
  const rect = frameRect(width, height);

  context.save();
  context.shadowColor = "rgba(2, 16, 60, 0.4)";
  context.shadowBlur = width * 0.012;
  context.shadowOffsetY = width * 0.004;
  roundRect(context, rect);
  context.fillStyle = "rgba(3, 24, 90, 0.35)";
  context.fill();
  context.restore();

  roundRect(context, rect);
  context.save();
  context.clip();
  if (state.photo) {
    const scale = photoScale(rect);
    context.translate(state.cx * width, state.cy * height);
    context.rotate(state.rotation);
    context.scale(scale, scale);
    context.drawImage(state.photo, -state.photo.width / 2, -state.photo.height / 2);
  } else {
    context.fillStyle = "rgba(4, 28, 100, 0.55)";
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
    if (mode !== "export") drawCamera(context, rect);
  }
  context.restore();

  const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  gradient.addColorStop(0, "#fff6cc");
  gradient.addColorStop(0.45, "#e2a51a");
  gradient.addColorStop(1, "#fff6cc");
  roundRect(context, rect);
  context.lineWidth = Math.max(3, rect.w * 0.028);
  context.strokeStyle = gradient;
  context.stroke();
  context.lineWidth = Math.max(1.5, rect.w * 0.008);
  context.strokeStyle = "rgba(255, 255, 255, 0.85)";
  context.stroke();
}

function layout() {
  const column = document.querySelector(".stage").clientWidth || 360;
  const maxH = Math.min(window.innerHeight * 0.78, 860);
  let cssW = column;
  let cssH = cssW * (1024 / 682);
  if (cssH > maxH) {
    cssH = maxH;
    cssW = cssH * (682 / 1024);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  badge.style.width = `${cssW}px`;
  badge.style.height = `${cssH}px`;
  badge.width = Math.round(cssW * dpr);
  badge.height = Math.round(cssH * dpr);
  clampPan(badge.width, badge.height);
  drawBadge(ctx, badge.width, badge.height, "preview");
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

function syncSliders() {
  zoomInput.value = String(Math.round(state.zoom * 100));
  rotateInput.value = String(Math.round((state.rotation * 180) / Math.PI));
  zoomValue.textContent = `${zoomInput.value} %`;
  rotateValue.textContent = `${rotateInput.value}°`;
}

function setZoom(next) {
  state.zoom = Math.min(3, Math.max(1, next));
  syncSliders();
  clampPan(badge.width, badge.height);
  drawBadge(ctx, badge.width, badge.height, "preview");
}

function resetFraming() {
  state.zoom = 1;
  state.rotation = 0;
  state.cx = FRAME.x + FRAME.w / 2;
  state.cy = FRAME.y + FRAME.h / 2;
  syncSliders();
  clampPan(badge.width, badge.height);
  drawBadge(ctx, badge.width, badge.height, "preview");
}

function enableActions(on) {
  downloadBtn.disabled = !on;
  shareBtn.disabled = !on;
  tools.hidden = !on;
}

async function loadPhoto(file) {
  if (!file) return;
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (file.type && !allowed.includes(file.type)) {
    setStatus("Format non pris en charge. Utilisez une photo JPG, PNG ou WebP.", true);
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    setStatus("Cette photo est trop lourde. Choisissez une image de moins de 15 Mo.", true);
    return;
  }
  try {
    let bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxSide = 1800;
    const largest = Math.max(bitmap.width, bitmap.height);
    if (largest > maxSide) {
      const ratio = maxSide / largest;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      bitmap = await createImageBitmap(canvas);
    }
    if (state.photo && state.photo.close) state.photo.close();
    state.photo = bitmap;
    resetFraming();
    enableActions(true);
    setStatus("Photo ajoutée. Glissez-la pour cadrer votre visage.");
  } catch (error) {
    setStatus("Impossible de lire cette photo. Essayez un fichier JPG, PNG ou WebP.", true);
  }
}

function canvasPoint(event) {
  const bounds = badge.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) * badge.width) / bounds.width,
    y: ((event.clientY - bounds.top) * badge.height) / bounds.height,
  };
}

function hitFrame(point) {
  const rect = frameRect(badge.width, badge.height);
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function exportCanvas() {
  const width = state.poster.naturalWidth;
  const height = state.poster.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  clampPan(width, height);
  drawBadge(canvas.getContext("2d"), width, height, "export");
  return canvas;
}

function exportBlob() {
  const canvas = exportCanvas();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob"))),
      "image/jpeg",
      0.93
    );
  });
}

function downloadBlob(blob) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = "Jy-serai-Fete-des-Moissons-54.jpg";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function shareText() {
  return `J'y serai ! Grande fête des Moissons, 54e édition, le 08 novembre 2026. Paroisse Cité d'Abraham de Djègan-Kpévi. Crée ton badge : ${location.href}`;
}

async function shareBadge() {
  if (!state.photo) return;
  const blob = await exportBlob();
  const file = new File([blob], "Jy-serai-Fete-des-Moissons-54.jpg", { type: "image/jpeg" });
  const payload = { files: [file], title: "J'y serai — Fête des Moissons", text: shareText() };
  if (navigator.canShare && navigator.canShare(payload)) {
    try {
      await navigator.share(payload);
      setStatus("Badge prêt à être envoyé.");
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  downloadBlob(blob);
  setStatus("Le partage direct n'est pas disponible ici. Le badge a été téléchargé.");
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files && photoInput.files[0];
  loadPhoto(file);
  photoInput.value = "";
});

zoomInput.addEventListener("input", () => setZoom(Number(zoomInput.value) / 100));
rotateInput.addEventListener("input", () => {
  state.rotation = (Number(rotateInput.value) * Math.PI) / 180;
  rotateValue.textContent = `${rotateInput.value}°`;
  clampPan(badge.width, badge.height);
  drawBadge(ctx, badge.width, badge.height, "preview");
});
document.getElementById("reset").addEventListener("click", resetFraming);

downloadBtn.addEventListener("click", async () => {
  if (!state.photo) return;
  downloadBtn.disabled = true;
  try {
    const blob = await exportBlob();
    downloadBlob(blob);
    setStatus("Badge téléchargé.");
  } catch (error) {
    setStatus("Le téléchargement a échoué. Réessayez.", true);
  } finally {
    downloadBtn.disabled = false;
  }
});

shareBtn.addEventListener("click", () => {
  shareBadge().catch(() => setStatus("Le partage a échoué. Téléchargez le badge, puis envoyez-le.", true));
});

document.getElementById("whatsapp").addEventListener("click", () => {
  const url = `https://wa.me/?text=${encodeURIComponent(shareText())}`;
  window.open(url, "_blank", "noopener");
});

document.getElementById("facebook").addEventListener("click", () => {
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}`;
  window.open(url, "_blank", "noopener,width=640,height=680");
});

badge.addEventListener("click", (event) => {
  if (!state.photo && hitFrame(canvasPoint(event))) photoInput.click();
});

badge.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  pointers.set(event.pointerId, point);
  if (!state.photo) {
    pointers.delete(event.pointerId);
    return;
  }
  if (pointers.size === 1 && hitFrame(point)) {
    dragId = event.pointerId;
    badge.setPointerCapture(event.pointerId);
    badge.style.touchAction = "none";
  }
  if (pointers.size === 2) pinchDist = distanceBetweenPointers();
});

badge.addEventListener("pointermove", (event) => {
  if (!pointers.has(event.pointerId) || !state.photo) return;
  const previous = pointers.get(event.pointerId);
  const point = canvasPoint(event);
  pointers.set(event.pointerId, point);
  if (pointers.size === 1 && dragId === event.pointerId) {
    state.cx += (point.x - previous.x) / badge.width;
    state.cy += (point.y - previous.y) / badge.height;
    clampPan(badge.width, badge.height);
    drawBadge(ctx, badge.width, badge.height, "preview");
    return;
  }
  if (pointers.size >= 2) {
    const dist = distanceBetweenPointers();
    if (pinchDist && dist) setZoom(state.zoom * (dist / pinchDist));
    pinchDist = dist;
  }
});

function distanceBetweenPointers() {
  const points = [...pointers.values()];
  if (points.length < 2) return null;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function endPointer(event) {
  pointers.delete(event.pointerId);
  if (dragId === event.pointerId) dragId = null;
  if (pointers.size < 2) pinchDist = null;
  if (pointers.size === 0) badge.style.touchAction = "pan-y";
}

badge.addEventListener("pointerup", endPointer);
badge.addEventListener("pointercancel", endPointer);

badge.addEventListener(
  "wheel",
  (event) => {
    if (!state.photo || !hitFrame(canvasPoint(event))) return;
    event.preventDefault();
    setZoom(state.zoom * (event.deltaY < 0 ? 1.06 : 0.94));
  },
  { passive: false }
);

window.addEventListener("resize", layout);

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
if (isIOS) document.getElementById("ios-note").hidden = false;

const sparks = document.getElementById("sparks");
const sparksCtx = sparks.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const motes = Array.from({ length: reduceMotion ? 0 : 42 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.8 + 0.6,
  s: Math.random() * 0.12 + 0.04,
  a: Math.random() * 0.45 + 0.15,
}));

function resizeSparks() {
  sparks.width = window.innerWidth;
  sparks.height = window.innerHeight;
}

function drawSparks(time) {
  sparksCtx.clearRect(0, 0, sparks.width, sparks.height);
  for (const mote of motes) {
    const y = (mote.y - (time * 0.00003 * mote.s) % 1 + 1) % 1;
    sparksCtx.beginPath();
    sparksCtx.fillStyle = `rgba(255, 214, 110, ${mote.a})`;
    sparksCtx.arc(mote.x * sparks.width, y * sparks.height, mote.r, 0, Math.PI * 2);
    sparksCtx.fill();
  }
  if (!reduceMotion) requestAnimationFrame(drawSparks);
}

resizeSparks();
window.addEventListener("resize", resizeSparks);
if (!reduceMotion) requestAnimationFrame(drawSparks);
