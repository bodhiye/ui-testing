/**
 * detect.mjs — 页面探测工具集（ES Module）
 *
 * Agent 读取本文件后，将对应函数体作为 evaluate_script 的 function 参数注入页面执行。
 *
 * 导出函数：
 *   detectFramework         — 识别 SPA 框架（Vue2/Vue3/React/Angular/jQuery …）
 *   detectFormElements      — 收集页面所有表单元素的类型、选择器、当前值、可选项
 *   findVue2FormComponent   — Vue 2 专用：递归查找持有表单数据的组件路径及方法列表
 *
 * 进化规则（参见 SKILL.md §13.2）：
 *   - 遇到新框架时，在 detectFramework 的 [EXTEND: new framework] 标记处追加探测逻辑
 *   - 若新框架需要专属的组件查找函数，在文件末尾 [EXTEND: new finder] 标记处追加 export function
 */

function escapeCssIdentifier(value) {
  if (typeof value !== "string" || value.length === 0) return "";
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return value.replace(/(^-?\d)|[^a-zA-Z0-9_-]/g, (match, digitPrefix) => {
    if (digitPrefix) return `\\3${digitPrefix} `;
    return `\\${match}`;
  });
}

function toElementSelector(el, fallbackIndex = 1) {
  if (!el || !el.tagName) return null;
  if (el.id) return `#${escapeCssIdentifier(el.id)}`;
  const tagName = el.tagName.toLowerCase();
  const classNames = String(el.className || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeCssIdentifier);
  if (classNames.length) {
    return `${tagName}.${classNames.join(".")}`;
  }
  return `${tagName}:nth-of-type(${fallbackIndex})`;
}

function findFrameworkRoot() {
  const root = document.documentElement || document.body;
  if (
    !root ||
    !document.createTreeWalker ||
    typeof NodeFilter === "undefined"
  ) {
    return null;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let index = 0;
  let current = walker.currentNode;
  while (current) {
    index += 1;
    if (current.__vue__) {
      return { framework: "vue2", element: current, index };
    }
    if (current.__vue_app__) {
      return { framework: "vue3", element: current, index };
    }
    current = walker.nextNode();
  }
  return null;
}

export function detectFramework() {
  const result = { framework: "unknown", version: null, rootSelector: null };

  const frameworkRoot = findFrameworkRoot();
  if (frameworkRoot) {
    result.framework = frameworkRoot.framework;
    result.rootSelector = toElementSelector(
      frameworkRoot.element,
      frameworkRoot.index,
    );
    try {
      result.version =
        frameworkRoot.framework === "vue2"
          ? frameworkRoot.element.__vue__.$root.$options._base.version || null
          : frameworkRoot.element.__vue_app__.version || null;
    } catch (e) {}
  }

  if (result.framework === "unknown") {
    const rootEl =
      document.getElementById("root") || document.getElementById("app");
    if (
      rootEl &&
      (rootEl._reactRootContainer ||
        Object.keys(rootEl).some((k) => k.startsWith("__reactFiber")))
    ) {
      result.framework = "react";
      result.rootSelector = rootEl.id
        ? "#" + rootEl.id
        : rootEl.tagName.toLowerCase();
      try {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (hook && hook.renderers) {
          const renderer = hook.renderers.get(1);
          result.version = renderer ? renderer.version : null;
        }
      } catch (e) {}
    }
  }

  if (result.framework === "unknown") {
    const ngRoot =
      document.querySelector("[ng-version]") ||
      document.querySelector("[_nghost]");
    if (ngRoot) {
      result.framework = "angular";
      result.version = ngRoot.getAttribute("ng-version") || null;
      result.rootSelector = ngRoot.tagName.toLowerCase();
    }
  }

  if (result.framework === "unknown" && window.jQuery) {
    result.framework = "jquery";
    result.version = window.jQuery.fn.jquery || null;
  }

  // [EXTEND: new framework] — 在此处追加新框架探测逻辑，格式：
  // if (result.framework === 'unknown') {
  //   /* 探测条件 */
  //   result.framework = 'xxx';
  //   result.version = ...;
  //   result.rootSelector = ...;
  // }

  return result;
}

export function detectFormElements() {
  const forms = [];

  const selectorFor = (el, tagName, index) => {
    if (el.id) return `#${escapeCssIdentifier(el.id)}`;

    const escapedName = el.name
      ? `"${String(el.name).replace(/"/g, '\\"')}"`
      : null;
    if (tagName === "input") {
      const escapedType = escapeCssIdentifier(el.type || "text");
      const nameSelector = escapedName ? `[name=${escapedName}]` : "";
      return `${tagName}[type="${escapedType}"]${nameSelector}`;
    }

    const classNames = String(el.className || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeCssIdentifier);
    if (classNames.length) {
      return `${tagName}.${classNames.join(".")}`;
    }
    return `${tagName}:nth-of-type(${index + 1})`;
  };

  document.querySelectorAll("select").forEach((sel, i) => {
    const options = [];
    sel.querySelectorAll("option").forEach((o) => {
      options.push({
        text: o.text.trim(),
        value: o.value,
        selected: o.selected,
      });
    });
    forms.push({
      type: "select",
      index: i,
      id: sel.id || null,
      name: sel.name || null,
      className: sel.className || null,
      selector: selectorFor(sel, "select", i),
      currentValue: sel.value,
      options,
    });
  });

  document.querySelectorAll("input").forEach((inp, i) => {
    forms.push({
      type: "input",
      inputType: inp.type,
      index: i,
      id: inp.id || null,
      name: inp.name || null,
      className: inp.className || null,
      selector: selectorFor(inp, "input", i),
      currentValue: inp.type === "password" ? "(hidden)" : inp.value,
      placeholder: inp.placeholder || null,
      checked:
        inp.type === "checkbox" || inp.type === "radio"
          ? inp.checked
          : undefined,
    });
  });

  document.querySelectorAll("textarea").forEach((ta, i) => {
    forms.push({
      type: "textarea",
      index: i,
      id: ta.id || null,
      name: ta.name || null,
      className: ta.className || null,
      selector: selectorFor(ta, "textarea", i),
      currentValue: ta.value
        ? ta.value.substring(0, 100) + (ta.value.length > 100 ? "..." : "")
        : "",
      placeholder: ta.placeholder || null,
    });
  });

  return forms;
}

export function findVue2FormComponent() {
  const rootEl =
    document.getElementById("app") || document.querySelector("[data-app]");
  if (!rootEl || !rootEl.__vue__) {
    return { error: "Vue 2 instance not found" };
  }

  const vm = rootEl.__vue__;
  const formKeywords = [
    "content",
    "code",
    "form",
    "text",
    "password",
    "title",
    "body",
    "message",
    "input",
    "query",
    "search",
    "data",
    "payload",
  ];

  function walk(comp, path, depth) {
    if (depth > 10) return [];
    let results = [];
    const data = comp._data || {};
    const keys = Object.keys(data);
    if (keys.some((k) => formKeywords.includes(k))) {
      const snapshot = {};
      keys.forEach((k) => {
        try {
          const v = data[k];
          if (v === null || v === undefined) snapshot[k] = null;
          else if (typeof v === "object")
            snapshot[k] = JSON.stringify(v).substring(0, 200);
          else snapshot[k] = String(v).substring(0, 100);
        } catch (e) {
          snapshot[k] = "(unreadable)";
        }
      });
      const methods = Object.keys(comp.$options.methods || {});
      results.push({ path, keys, snapshot, methods });
    }
    (comp.$children || []).forEach((c, i) => {
      results = results.concat(
        walk(c, path + ".$children[" + i + "]", depth + 1),
      );
    });
    return results;
  }

  return walk(vm, "root", 0);
}

// [EXTEND: new finder] — 在此处追加新框架专属的组件查找函数，格式：
// export function findXxxFormComponent() { ... }
