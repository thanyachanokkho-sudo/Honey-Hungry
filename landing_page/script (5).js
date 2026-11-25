/* ==========================================================
   Honey Hungry — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : โหลดสินค้า + ปุ่มกรอง mood + ลิงก์สั่งซื้อ
   - order.html   : เติมฟอร์มจาก URL parameter + ส่งออเดอร์
   - admin.html   : ดึงออเดอร์จาก Google Sheet มาแสดงเป็นตาราง
   ========================================================== */

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwzGEXvKub0g19lhMOSgtEAPLTstZmxAgWJDNk0sHZdPEogMX1EsJnHJiGxE5DN3xPY/exec";

const SHEET_ID = "1ZYX5fdVqkMWEYI0WsriKvTeSNfFpD-1R3KEbWcqH-To";
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv";

/* class สีประจำรส (ตรงกับ style.css) */
const MOOD_CLASS = {
  "รสดั้งเดิม": "mood--original",
  "รสมะลิ": "mood--jasmine",
  "รสหอมหมื่นลี้": "mood--osmanthus",
  "รสกุหลาบ": "mood--rose",
  "รสเกลือ": "mood--salt",
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("product-list")) initProductPage();
  if (document.getElementById("orderForm")) initOrderPage();
  if (document.getElementById("ordersTable")) initAdminPage();
});

/* ==========================================================
   1) หน้าสินค้า (product.html)
   ========================================================== */
let allProducts = [];

async function initProductPage() {
  const list = document.getElementById("product-list");
  const bar = document.getElementById("filter-bar");

  try {
    const res = await fetch("products.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    allProducts = await res.json();
  } catch (err) {
    console.error(err);
    list.textContent = "ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง";
    return;
  }

  // สร้างปุ่มกรองจากค่า mood ที่มีอยู่จริงใน products.json
  const moods = [...new Set(allProducts.map((p) => p.mood))];
  const initial = resolveMoodParam(
    new URLSearchParams(window.location.search).get("mood"),
    moods
  );

  if (bar) {
    bar.innerHTML = "";
    ["ทั้งหมด", ...moods].forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.textContent = m;
      btn.dataset.mood = m === "ทั้งหมด" ? "all" : m;
      btn.addEventListener("click", () => applyFilter(btn.dataset.mood));
      bar.appendChild(btn);
    });
  }

  applyFilter(initial);
}

/* แปลงค่า ?mood=xxx ให้ตรงกับ mood จริง (รองรับพิมพ์ไม่ใส่คำว่า "รส") */
function resolveMoodParam(param, moods) {
  if (!param) return "all";
  const v = param.trim();
  if (!v || v.toLowerCase() === "all" || v === "ทั้งหมด") return "all";
  const found = moods.find((m) => m === v || m === "รส" + v || m.replace(/^รส/, "") === v);
  return found || "all";
}

function applyFilter(mood) {
  document.querySelectorAll("#filter-bar .filter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mood === mood);
  });
  const items = mood === "all" ? allProducts : allProducts.filter((p) => p.mood === mood);
  renderProducts(items);
}

function renderProducts(items) {
  const list = document.getElementById("product-list");
  list.innerHTML = "";

  if (!items.length) {
    list.textContent = "ไม่พบสินค้าในหมวดนี้";
    return;
  }

  items.forEach((p) => {
    const card = document.createElement("article");
    card.className = "card";

    // รูป
    const media = document.createElement("div");
    media.className = "card-media";
    const img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    media.appendChild(img);

    // เนื้อหา
    const body = document.createElement("div");
    body.className = "card-body";

    const type = document.createElement("div");
    type.className = "card-type";
    type.textContent = p.type;

    const mood = document.createElement("span");
    mood.className = "mood " + (MOOD_CLASS[p.mood] || "");
    mood.textContent = p.mood;

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = p.name;

    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = p.description;

    // ราคา + ไซส์
    const foot = document.createElement("div");
    foot.className = "card-foot";

    const price = document.createElement("span");
    price.className = "price";
    price.textContent = Number(p.price).toLocaleString("th-TH");
    const unit = document.createElement("small");
    unit.textContent = "บาท";
    price.appendChild(unit);

    const size = document.createElement("span");
    size.className = "size";
    size.textContent = p.size;

    foot.append(price, size);

    // ปุ่มสั่งซื้อ -> order.html?item=...&price=...
    const params = new URLSearchParams({
      item: p.name + " " + p.size,
      price: String(p.price),
    });
    const buy = document.createElement("a");
    buy.className = "btn btn--gold btn--sm";
    buy.href = "order.html?" + params.toString();
    buy.textContent = "สั่งซื้อ";
    buy.style.marginTop = "1rem";
    buy.style.textAlign = "center";

    body.append(type, mood, title, desc, foot, buy);
    card.append(media, body);
    list.appendChild(card);
  });
}

/* ==========================================================
   2) หน้าสั่งซื้อ (order.html)
   ========================================================== */
function initOrderPage() {
  const form = document.getElementById("orderForm");
  const params = new URLSearchParams(window.location.search);

  // เติมช่องสินค้า (#items) และราคา (#total) อัตโนมัติ
  const item = params.get("item");
  const price = params.get("price");
  const itemsEl = document.getElementById("items");
  const totalEl = document.getElementById("total");
  if (itemsEl && item !== null) itemsEl.value = item;
  if (totalEl && price !== null) totalEl.value = price;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const payload = {
      customerName: document.getElementById("customerName").value.trim(),
      contact: document.getElementById("contact").value.trim(),
      items: document.getElementById("items").value.trim(),
      total: document.getElementById("total").value.trim(),
      note: document.getElementById("note").value.trim(),
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(() => {
        window.location.href = "thankyou.html";
      })
      .catch((error) => {
        console.error(error);
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        if (submitBtn) submitBtn.disabled = false;
      });
  });
}

/* ==========================================================
   3) หน้าแอดมิน (admin.html)
   ========================================================== */
async function initAdminPage() {
  const tbody = document.querySelector("#ordersTable tbody");
  tbody.innerHTML = "";
  showAdminMessage(tbody, "กำลังโหลดข้อมูล...");

  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    let rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ""));

    // ถ้าแถวแรกเป็นหัวตาราง (ช่องจำนวนเงินไม่ใช่ตัวเลข) ให้ข้ามไป
    if (rows.length && isNaN(parseFloat((rows[0][4] || "").replace(/,/g, "")))) {
      rows = rows.slice(1);
    }

    // รายการใหม่ในชีตถูกต่อท้ายเสมอ -> กลับลำดับให้ล่าสุดขึ้นก่อน
    rows.reverse();

    tbody.innerHTML = "";
    if (!rows.length) {
      showAdminMessage(tbody, "ยังไม่มีรายการสั่งซื้อ");
      return;
    }

    rows.forEach((r) => {
      const tr = document.createElement("tr");
      for (let i = 0; i < 6; i++) {
        const td = document.createElement("td");
        td.textContent = r[i] !== undefined ? r[i] : "";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = "";
    showAdminMessage(tbody, "ไม่สามารถโหลดข้อมูลได้ (ตรวจสอบว่าชีตเปิดแชร์แบบ Anyone with the link)");
  }
}

function showAdminMessage(tbody, msg) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
  td.textContent = msg;
  td.style.textAlign = "center";
  tr.appendChild(td);
  tbody.appendChild(tr);
}

/* ---------- parse CSV เอง (รองรับ "", เครื่องหมายคำพูด, ขึ้นบรรทัดใหม่ในช่อง) ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
