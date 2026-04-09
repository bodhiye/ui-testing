/**
 * chrome-devtools-mcp.mjs
 *
 * Cross-platform Chrome launcher for DevTools remote debugging.
 *
 * Behavior:
 * - If PORT is provided:
 *   - Reuse it if it's already a Chrome DevTools endpoint.
 *   - Fail if it's occupied by a non-DevTools service.
 *   - Otherwise start Chrome on that port.
 * - If PORT is not provided:
 *   - First try to reuse any running DevTools endpoint within DEFAULT_PORT..PORT_SCAN_END
 *   - Otherwise pick a free port in that range and start Chrome.
 *
 * Outputs:
 * - Prints the selected remote debugging port and an MCP server config snippet.
 *
 * Env vars:
 * - PORT: fixed remote debugging port (optional)
 * - DEFAULT_PORT: start of scan range (default: 9222)
 * - PORT_SCAN_END: end of scan range (default: 9310)
 * - USER_DATA_DIR: Chrome user-data-dir (default: ~/.chrome-devtools-mcp-profile)
 * - CHROME_APP: macOS app name (default: "Google Chrome")
 * - CHROME_BIN: linux/windows chrome binary path or name (optional; recommended for Windows)
 * - DISABLE_EXTENSIONS: set to "1" to disable Chrome extensions for more stable automation (optional)
 * - WAIT_SEC: max seconds to wait for Chrome to be ready (default: 15)
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const DEFAULT_PORT = Number.parseInt(process.env.DEFAULT_PORT || "9222", 10);
const PORT_SCAN_END = Number.parseInt(process.env.PORT_SCAN_END || "9310", 10);
const WAIT_SEC = Number.parseInt(process.env.WAIT_SEC || "15", 10);

const CHROME_APP = process.env.CHROME_APP || "Google Chrome";
const USER_DATA_DIR =
  process.env.USER_DATA_DIR ||
  path.join(os.homedir(), ".chrome-devtools-mcp-profile");
const DISABLE_EXTENSIONS = process.env.DISABLE_EXTENSIONS === "1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, json: await res.json() };
  } catch (e) {
    return { ok: false, error: e };
  } finally {
    clearTimeout(t);
  }
}

async function isChromeDevtoolsPort(port) {
  const r = await fetchJson(`http://127.0.0.1:${port}/json/version`, 800);
  if (!r.ok) return false;
  const browser = (r.json && r.json.Browser) || "";
  return browser.includes("Chrome") || browser.includes("Chromium");
}

async function isPortListening(port) {
  // Robust "is port in use" check (works for non-HTTP services too).
  return new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port, timeout: 400 });
    const done = (v) => {
      try {
        s.destroy();
      } catch {
        // ignore
      }
      resolve(v);
    };
    s.on("connect", () => done(true));
    s.on("timeout", () => done(true));
    s.on("error", () => done(false));
  });
}

function findInPath(binNames) {
  const p = process.env.PATH || "";
  const parts = p.split(path.delimiter).filter(Boolean);
  for (const name of binNames) {
    for (const dir of parts) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

function pickChromeBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  if (process.platform === "linux")
    return findInPath([
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
    ]);
  if (process.platform === "win32") {
    // Windows: require CHROME_BIN to avoid hardcoded installation paths.
    return process.env.CHROME_BIN || null;
  }
  return null;
}

function startChrome({ port, userDataDir }) {
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];

  // Extensions (including enterprise/policy-installed ones) can interfere with XHR/fetch
  // and make E2E unstable. Allow disabling them for test runs.
  if (DISABLE_EXTENSIONS) {
    args.push("--disable-extensions");
    args.push("--disable-component-extensions-with-background-pages");
  }

  if (process.platform === "darwin") {
    const p = spawn("open", ["-na", CHROME_APP, "--args", ...args], {
      stdio: "ignore",
      detached: true,
    });
    p.unref();
    return;
  }

  const bin = pickChromeBinary();
  if (!bin) {
    if (process.platform === "win32")
      throw new Error(
        "CHROME_BIN is required on Windows (set to chrome.exe full path).",
      );
    throw new Error(
      "Chrome binary not found. Set CHROME_BIN (e.g. google-chrome / chromium).",
    );
  }

  const p = spawn(bin, args, { stdio: "ignore", detached: true });
  p.on("error", (e) => {
    // eslint-disable-next-line no-console
    console.error(
      `Failed to start Chrome: ${String(e && e.message ? e.message : e)}`,
    );
  });
  p.unref();
}

async function waitChromeReady(port) {
  const maxWaitMs = Math.max(1, WAIT_SEC) * 1000;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const r = await fetchJson(`http://127.0.0.1:${port}/json/version`, 1200);
    if (r.ok) return r.json;
    await sleep(1000);
  }
  throw new Error(
    `Chrome did not become ready within ${WAIT_SEC}s on port ${port}`,
  );
}

async function main() {
  console.log("=============================================");
  console.log(" Chrome + DevTools MCP 一键启动");
  console.log("=============================================");

  let port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : null;
  let reused = false;

  if (port) {
    if (await isChromeDevtoolsPort(port)) {
      reused = true;
    } else if (await isPortListening(port)) {
      throw new Error(
        `Port ${port} is already in use (not a Chrome DevTools endpoint)`,
      );
    } else {
      startChrome({ port, userDataDir: USER_DATA_DIR });
    }
  } else {
    // Prefer reuse.
    for (let p = DEFAULT_PORT; p <= PORT_SCAN_END; p++) {
      if (await isChromeDevtoolsPort(p)) {
        port = p;
        reused = true;
        break;
      }
    }
    if (!port) {
      // Find a free port by probing /json/version; if anything responds, consider occupied.
      for (let p = DEFAULT_PORT; p <= PORT_SCAN_END; p++) {
        if (!(await isPortListening(p))) {
          port = p;
          break;
        }
      }
      if (!port)
        throw new Error(
          `No available port in range ${DEFAULT_PORT}..${PORT_SCAN_END}`,
        );
      startChrome({ port, userDataDir: USER_DATA_DIR });
    }
  }

  if (!port) throw new Error("Failed to determine port");
  if (reused) console.log(`[1/2] 复用已运行的 Chrome DevTools 端口: ${port}`);
  else console.log(`[1/2] 启动 Chrome (remote-debugging port: ${port}) ...`);

  console.log("[2/2] 等待 Chrome 就绪 ...");
  const ver = await waitChromeReady(port);
  console.log(`       ✅ Chrome 已就绪 (${ver.Browser || "unknown"})`);

  console.log("");
  console.log("=============================================");
  console.log(" ✅ Chrome 已就绪");
  console.log(`    远程调试端口: ${port}`);
  console.log(`    验证: curl -sS http://127.0.0.1:${port}/json/version`);
  console.log(
    `    模式: ${reused ? "复用已有实例" : `新启动实例 (profile: ${USER_DATA_DIR})`}`,
  );
  console.log("");
  console.log(" 请确保 Agent 的 MCP 配置中包含：");
  console.log("");
  console.log('    "chrome-devtools": {');
  console.log('      "command": "npx",');
  console.log(
    `      "args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:${port}"]`,
  );
  console.log("    }");
  console.log("=============================================");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
