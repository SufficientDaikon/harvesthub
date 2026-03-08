/* global chrome */

const DEFAULT_API = "http://localhost:4000";

const $ = (id) => document.getElementById(id);

let currentUrl = "";
let lastResult = null;

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url ?? "";
  $("current-url").textContent = currentUrl || "No URL detected";

  // Disable scrape if not http(s)
  if (!currentUrl.startsWith("http")) {
    $("btn-scrape").disabled = true;
    $("btn-text").textContent = "Cannot scrape this page";
  }

  // Listeners
  $("btn-scrape").addEventListener("click", handleScrape);
  $("btn-save").addEventListener("click", handleSave);
  $("btn-copy-json").addEventListener("click", handleCopyJson);

  // Set dashboard link
  getApiEndpoint().then((apiBase) => {
    $("btn-dashboard").href = apiBase + "/dashboard";
  });
});

// ── Scrape ────────────────────────────────────────────────────────────────────

async function handleScrape() {
  hideAll();

  const btn = $("btn-scrape");
  const spinner = $("spinner");
  const btnText = $("btn-text");

  btn.disabled = true;
  spinner.classList.add("active");
  btnText.textContent = "Scraping…";

  try {
    const apiBase = await getApiEndpoint();
    const res = await fetch(`${apiBase}/api/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [currentUrl] }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    const data = await res.json();

    // The batch endpoint returns a job — poll for results or show immediate
    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      if (r.product) {
        showResult(r.product);
      } else if (r.status === "pending" || r.status === "running") {
        // Poll for result
        await pollJob(apiBase, data.jobId);
      } else {
        throw new Error(r.error || "Scrape returned no data");
      }
    } else if (data.jobId) {
      await pollJob(apiBase, data.jobId);
    } else {
      throw new Error("Unexpected response format");
    }
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    spinner.classList.remove("active");
    btnText.textContent = "🌾 Scrape This Page";
  }
}

// ── Poll job until complete ───────────────────────────────────────────────────

async function pollJob(apiBase, jobId) {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    const res = await fetch(`${apiBase}/api/batch/${jobId}`);
    if (!res.ok) continue;

    const data = await res.json();
    if (data.status === "completed" || data.status === "partial") {
      const r = data.results?.find((r) => r.status === "success");
      if (r?.product) {
        showResult(r.product);
        return;
      }
      const failed = data.results?.find((r) => r.status === "failed");
      throw new Error(
        failed?.error || "Scrape completed but no product data found",
      );
    }
    if (data.status === "failed") {
      throw new Error("Scrape job failed");
    }
  }
  throw new Error("Scrape timed out after 60 seconds");
}

// ── Display result ────────────────────────────────────────────────────────────

function showResult(product) {
  lastResult = product;

  $("res-title").textContent = product.title || "—";
  $("res-title").title = product.title || "";

  const price =
    product.price != null ? `${product.currency || "$"}${product.price}` : "—";
  $("res-price").textContent = price;

  const availability = product.availability || "unknown";
  $("res-availability").textContent = availability.replace(/_/g, " ");

  const conf = product.confidence?.overall;
  $("res-confidence").textContent = conf != null ? `${Math.round(conf)}%` : "—";

  // Show image thumbnail if available
  const imgUrl = product.image || product.imageUrl || (product.images && product.images[0]);
  if (imgUrl) {
    $("res-thumb-img").src = imgUrl;
    $("res-thumb").classList.add("visible");
  } else {
    $("res-thumb").classList.remove("visible");
  }

  $("results").classList.add("visible");
}

// ── Save to HarvestHub ────────────────────────────────────────────────────────

async function handleSave() {
  if (!lastResult) return;

  try {
    showStatus("Saving…");
    const apiBase = await getApiEndpoint();

    // Product is already saved by the batch scrape job.
    // This button confirms to the user it's persisted.
    showStatus("✅ Saved to HarvestHub!");
  } catch (err) {
    showError(err.message);
  }
}

// ── Copy JSON ─────────────────────────────────────────────────────────────────

async function handleCopyJson() {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
    showStatus("📋 Copied to clipboard!");
  } catch {
    showError("Failed to copy to clipboard");
  }
}

// ── Settings helper ───────────────────────────────────────────────────────────

async function getApiEndpoint() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.sync) {
      chrome.storage.sync.get({ apiEndpoint: DEFAULT_API }, (items) => {
        resolve(items.apiEndpoint || DEFAULT_API);
      });
    } else {
      resolve(DEFAULT_API);
    }
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function hideAll() {
  $("results").classList.remove("visible");
  $("error").classList.remove("visible");
  $("status").classList.remove("visible");
}

function showError(msg) {
  $("error").textContent = `❌ ${msg}`;
  $("error").classList.add("visible");
}

function showStatus(msg) {
  $("status").textContent = msg;
  $("status").classList.add("visible");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
