/* global chrome */

const DEFAULT_API = "http://localhost:4000";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  // Load saved settings
  chrome.storage.sync.get({ apiEndpoint: DEFAULT_API }, (items) => {
    $("api-endpoint").value = items.apiEndpoint;
  });

  // Save
  $("btn-save").addEventListener("click", () => {
    const endpoint = $("api-endpoint").value.trim().replace(/\/+$/, "");
    if (!endpoint) {
      showStatus("Please enter a valid URL", "error");
      return;
    }

    try {
      new URL(endpoint);
    } catch {
      showStatus("Invalid URL format", "error");
      return;
    }

    chrome.storage.sync.set({ apiEndpoint: endpoint }, () => {
      showStatus("✅ Settings saved!", "success");
    });
  });

  // Test Connection
  $("btn-test").addEventListener("click", async () => {
    const endpoint = $("api-endpoint").value.trim().replace(/\/+$/, "");
    if (!endpoint) {
      showStatus("Please enter a valid URL", "error");
      return;
    }
    showStatus("Testing connection…", "success");
    try {
      const res = await fetch(`${endpoint}/api/status`, { method: "GET" });
      if (res.ok) {
        showStatus("✅ Connection successful!", "success");
      } else {
        showStatus(`❌ Server responded with HTTP ${res.status}`, "error");
      }
    } catch {
      showStatus("❌ Connection failed — is the server running?", "error");
    }
  });

  // Reset
  $("btn-reset").addEventListener("click", () => {
    $("api-endpoint").value = DEFAULT_API;
    chrome.storage.sync.set({ apiEndpoint: DEFAULT_API }, () => {
      showStatus("✅ Reset to default", "success");
    });
  });
});

function showStatus(message, type) {
  const el = $("status");
  el.textContent = message;
  el.className = "status " + type;
  setTimeout(() => {
    el.className = "status";
  }, 3000);
}
