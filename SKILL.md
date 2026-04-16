---
name: ui-testing
description: 基于 Chrome DevTools MCP 的零脚本 UI 自动化测试 Skill：输入 URL 自动遍历页面并沉淀/复用 Playbook，执行 E2E 并输出标准化报告（MCP 优先，支持 CDP Proxy 降级）。
version: 1.0.0
triggers:
  + ui 自动化测试
  + UI 测试
  + E2E 测试
  + Playbook
  + 测试报告
  + 页面遍历
  + 更新用例
  + 查询 Playbook
  + 查询报错
  + 导出测试报告
---

# ui-testing

## 作用

面向 Web 站点的 UI 自动化测试 Skill。基于 Chrome DevTools MCP 直连浏览器会话，无需编写测试脚本：接收单个待测 URL 后，按“先广后深”的方式遍历站点页面，梳理端到端测试用例并沉淀为站点专属 Playbook；在已有 Playbook 的情况下，直接复用用例执行测试，记录关键步骤、截图、报错统计，并输出标准化测试报告。

## Use when

当用户有以下需求时使用本 Skill：

* 测试某个 Web 站点或某个 path 下的 UI 功能；
* 为站点自动梳理端到端测试用例；
* 更新某个站点或 path 的 Playbook；
* 复用既有 Playbook 执行自动化测试；
* 查询 Playbook、报错明细、历史测试报告；
* 导出本次测试报告。

典型触发语：

* “用 ui-testing 测试 <https://example.com>”
* “测试这个站点并更新用例”
* “查询 example.com 的 Playbook”
* “查询本次测试的报错明细”
* “导出本次测试报告”

## Do not use when

以下场景不要使用本 Skill：

* 用户要测试的是原生 App、桌面应用、接口、数据库或非 Web 页面；
* 用户只需要静态代码审查，而不是浏览器中的 UI 行为验证；
* 用户要求执行恶意、破坏性、越权或非法操作；
* 用户要求收集、保存或泄露密码、Cookie、个人隐私等敏感信息；

## 本地浏览器连接方式

本 Skill **优先**通过 `chrome-devtools-mcp` 提供的 MCP 工具直接操作浏览器。

当 Agent 无法使用 MCP 工具（如 MCP 未接入、工具调用失败、或 Agent 不支持 MCP）时，允许**降级**到内置的 Node.js CDP Proxy（ `scripts/cdp-proxy.mjs` ）来完成同等的基础浏览器操作能力（navigate/eval/click/screenshot/snapshot 等）。

约束：

* 允许使用本仓库内置的 `cdp-proxy.mjs` 作为兜底代理（常驻服务形态）

### 前置条件

* Node.js >= 20.19（MCP 模式）
* Node.js >= 22（CDP Proxy 降级模式，使用内置 WebSocket）
* 本机已安装 Google Chrome
* （推荐）`chrome-devtools-mcp` 已作为 MCP Server 注册到 Agent 的 MCP 配置中

### MCP Server 配置（必须）

`chrome-devtools-mcp` 必须在 Agent（如 Trae、OpenClaw、Claude Code、Cursor 等）的 MCP 配置中注册，否则 Agent 无法调用浏览器操作工具。

在配置文件的 `mcpServers` 中添加：

```json
{
  "chrome-devtools": {
    "command": "npx",
    "args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:${PORT}"]
  }
}
```

其中 `--browser-url` 的端口号需要与 Chrome 实际的 remote debugging 端口一致。

### 连接验证清单

执行测试前，按以下顺序验证：

01. **Chrome 进程**：确认 Chrome 已启动且带 `--remote-debugging-port` 参数
02. **端口连通**：使用实际端口（以启动脚本输出为准），例如：`curl -sS "http://127.0.0.1:${PORT}/json/version"` 返回版本信息
03. **MCP 工具可用**：调用 `list_pages` 能返回当前标签页列表
04. 若第 3 步失败，说明 MCP 配置未生效，需检查 Agent 的 MCP 配置并重启

### Chrome 启动方式

一条命令完成 Chrome 的启动：

```bash
node ./scripts/chrome-devtools-mcp.mjs
```

脚本会自动：
01. **优先复用**：扫描 `9222..PORT_SCAN_END` 范围内已运行的 Chrome DevTools 端口，若存在则直接复用
02. **否则新启动**：选择空闲端口并启动带远程调试端口的 Chrome
03. 等待 Chrome 就绪并自检

也可通过环境变量指定固定端口：

```bash
PORT=9222 node ./scripts/chrome-devtools-mcp.mjs
```

### 连接自检

```bash
# 以脚本输出的端口为准；若需固定端口可在启动时指定 PORT
curl -sS "http://127.0.0.1:${PORT}/json/version"
curl -sS "http://127.0.0.1:${PORT}/json/list"
```

### 操作方式要求

**优先**使用 MCP 工具直接操作浏览器，可用工具包括：

* `navigate_page` — 页面导航
* `take_snapshot` — 获取页面 a11y 树快照（优先于截图，用于定位元素）
* `take_screenshot` — 截图保存到指定路径
* `click` — 点击元素（通过 uid 定位）
* `fill` — 填充表单输入框
* `type_text` — 键盘输入文字
* `evaluate_script` — 执行 JavaScript（处理复杂交互）
* `handle_dialog` — 处理 alert/confirm 弹窗
* `wait_for` — 等待页面文本出现
* `list_pages` / `select_page` / `close_page` — 多标签页管理与清理

当 MCP 工具不可用时，使用 CDP Proxy 模式（见下文）作为降级兜底。

### 驱动选择与降级

执行任何测试前，先做“驱动探活”，选择 MCP 或 CDP 两种驱动之一。后续所有浏览器操作都必须走同一套“统一接口”，只切换底层驱动实现。

#### 1) Driver Preflight

01. **尝试 MCP**：调用 `list_pages`。
02. 若 MCP 成功：使用 **MCP Driver**（直接调用 MCP 工具）。
03. 若 MCP 失败：启动/复用 **CDP Proxy**，并通过 `GET /health` 或 `GET /list_pages` 探活；成功则使用 **CDP Driver**。
04. 驱动选择仅限 **MCP Driver** 或 **CDP Driver**；禁止切换到 `Playwright`、Puppeteer 或任何独立 testing browser 作为兜底。
05. 若 MCP 与 CDP 都不可用：终止执行，进入 Failure handling（记录原因与环境信息）。

#### 2) Unified Interface Mapping（MCP ↔ CDP Proxy）

以下“统一接口”在 Skill 内部语义保持一致；实现层根据驱动不同映射到 MCP 工具调用或 CDP Proxy HTTP 调用：

| 统一接口 | MCP Driver | CDP Driver（HTTP） |
| --- | --- | --- |
| 列表页 | `list_pages()` | `GET http://127.0.0.1:${PROXY_PORT}/list_pages` |
| 选页 | `select_page(pageId/targetId)` | `POST /select_page` |
| 新建页 | `new_page(url)` | `POST /new_page` |
| 关页 | `close_page(pageId)` | `POST /close_page` |
| 导航 | `navigate_page({type:'url', url})` | `POST /navigate_page` |
| 执行脚本 | `evaluate_script({function, args})` | `POST /evaluate_script` |
| 快照 | `take_snapshot({verbose})` | `POST /take_snapshot` |
| 点击 | `click({uid})` | `POST /click` （支持 `uid` 或 `selector` ） |
| 截图 | `take_screenshot({fullPage,filePath,uid?,selector?})` | `POST /take_screenshot` （支持 `uid` 或 `selector` 元素截图） |

#### 3) CDP Proxy Mode（兜底）

启动命令（示例）：

```bash
CHROME_PORT=${PORT} PROXY_PORT=8888 node ./scripts/cdp-proxy.mjs
```

说明：

* `CHROME_PORT`：Chrome remote debugging 端口（由 `chrome-devtools-mcp.mjs` 输出）
* `PROXY_PORT`：CDP Proxy HTTP 监听端口（默认 8888）
* CDP Proxy 需要 Node.js 22+（使用内置 WebSocket）

#### 4) 临时执行脚本产物

当 Agent 在 `CDP Driver` 模式下，因执行复杂流程需要临时生成辅助执行脚本（例如 `run_test.mjs` ）时，按以下规则处理：

* 临时脚本只能放在本轮运行目录 `playbooks/{domain}/{YYYYMMDDHHmm}/` 下
* 临时脚本默认**保留**，作为本轮测试产物的一部分，便于复现、排查和二次执行
* 若用户明确要求“清理临时文件”或“只保留最终产物”，才额外删除临时脚本
* 最终运行目录允许保留 `report.md`、`results.json`、截图文件（`*.png`）、临时执行脚本（如 `run_test.mjs` ）以及其他明确对用户有价值的日志或附件
* 若执行过程中生成了多个临时脚本，应优先复用并收敛，避免在单个运行目录内留下无意义的重复脚本
* 若用户要求清理但删除失败，应在最终结果中明确说明失败原因与残留路径

## Inputs

### 必填输入

* `url: string`
  + 待测试 URL。
  + 必须是完整的 `http://` 或 `https://` URL。

### 可选输入

* `updateCase: boolean = false`

  + 是否更新用例。
  + `true`：重新遍历页面、重建并覆盖对应 Playbook。
  + `false`：优先读取现有 Playbook；若不存在则自动创建。
* `command: string`

  + 辅助指令，可选值包括但不限于：
    - `queryPlaybook`
    - `exportReport`
    - `stopTest`
    - `queryErrors`
    - `editCase`
    - `deleteCase`
* `instruction: string`

  + 用户的自然语言补充要求，例如：
    - “只更新用例，不执行测试”
    - “只查询 Playbook”
    - “删除 example_com_001 用例”
    - “修改 example_com_002 的预期结果”

## Core principles

01. **先校验，后执行**：先做 URL 格式校验与可达性检测，不通过则终止。
02. **先广后深**：页面遍历使用 BFS，先同层后下钻。
03. **域内约束**：仅遍历待测 URL 所属域名下的页面；跳过外域新开页面。
04. **去重与容错**：已访问 URL 不重复遍历；遇到 404、500、超时等异常时记录并跳过。
05. **端到端优先**：只梳理完整业务流程用例，不拆成零散步骤用例。
06. **功能正交**：优先覆盖核心功能路径，减少冗余组合。
07. **Playbook 复用优先**：未明确要求更新用例时，优先读取现有 Playbook。
08. **不中断全局流程**：单个页面或单个用例失败时，记录问题并继续后续流程。
09. **可追溯**：关键步骤、报错、截图、报告都要可关联到 URL、用例和步骤。
10. **页面可回收**：默认复用已有标签页；测试过程中新增的标签页必须及时关闭，避免一轮执行后残留大量窗口。
11. **安全合规**：不执行恶意操作，不存储敏感凭据，不泄露测试数据。

## Workflow

### 1. 识别用户意图

先判断本次请求属于哪一类：

* 执行测试；
* 更新用例；
* 查询 Playbook；
* 编辑 / 删除用例；
* 查询报错；
* 导出报告；
* 终止当前测试。

如果用户意图不明确，先用一句话澄清最小必要信息。

### 2. 校验 URL

对输入 URL 执行以下检查：

* 是否包含 `http://` 或 `https://` 协议；
* 域名是否合法；
* 是否可访问；
* 是否属于单个明确的站点入口。

若校验失败，返回清晰提示，例如：

* “请输入有效的 URL，格式为 `http://域名[:端口][/路径]` 或 `https://域名[:端口][/路径]`”
* “目标 URL 当前不可访问，已终止本次测试流程”

### 3. 解析 Playbook 存储路径

按“站点域名 + path”分层管理 Playbook：

* 站点根目录名：使用域名，例如 `www.example.com/`
* 若 URL 仅为域名级：
  + Playbook 文件名为 `{domain}.md`
  + 例如：`www.demo.com/www.demo.com.md`
* 若 URL 包含 path：
  + 在站点根目录下生成 path 对应的 Playbook 文件
  + 例如：`www.example.com/path1.md`

path 文件名规则：

* 去掉开头 `/`
* 将剩余路径中的 `/` 转为 `_`
* 保留可读性，避免空文件名
* 若 path 为空，则回退为域名级文件名

### 4. 决定是否更新用例

* 若用户明确要求“更新用例”，则必须重新遍历页面并覆盖对应 Playbook。
* 若用户未明确要求更新：
  + 先查找对应 Playbook；
  + 若存在，则直接读取并复用；
  + 若不存在，则自动执行遍历与用例梳理，并创建 Playbook。

### 5. 页面遍历

遍历时必须遵循以下规则：

* 使用 BFS（先广后深）；
* 识别页面中的可点击有效链接，包括：
  + `<a>` 链接
  + 按钮触发的站内跳转
* 过滤以下链接：
  + `mailto:`
  + `javascript:`
  + 明显无效链接
  + 外域链接
* 记录已访问 URL，避免重复遍历；
* 遇到 404、500、超时、加载失败时：
  + 记录 URL、错误类型、错误详情；
  + 跳过当前页面，继续遍历。

### 6. 梳理测试用例

基于遍历结果，梳理端到端测试用例。要求：

* 优先生成 E2E 生命周期用例；对于具备创建/编辑/删除能力的页面，**必须**生成完整生命周期用例（创建→查询→更新→查询→删除），不得降级为仅展示/查询验证
* 特性覆盖原则：页面中多个独立的可配置功能点，应分别生成独立的测试用例，不得将多个功能点合并为一个笼统的验证步骤
* 对于纯展示/只读页面，允许生成展示验证类用例，但需标注为 P2
* 结合功能正交法减少冗余；
* 自动去重；
* 为每个用例标注优先级：P0 / P1 / P2。

每个用例必须包含：

* 用例 ID
* 用例名称
* 前置条件
* 执行步骤
* 预期结果
* 优先级

用例 ID 规则：

* 域名级：`example_com_001`
* path 级：`example_com_path1_001`

### 7. 写入或更新 Playbook

Playbook 使用 Markdown 保存，内容至少包括：

* 标题
* 基本信息
  + 测试 URL
  + 站点根文件夹
  + Playbook 文件名
  + 创建时间
  + 更新时间
  + 用例总数
* 测试用例列表
  + 用例总览表格（包含用例ID、功能模块、优先级、用例名称、类型列，按功能模块排序）
  + 用例详情按功能模块分组，每组内按优先级 P0→P1→P2 排序

若是更新用例：

* 覆盖原有用例内容；
* 更新时间刷新为当前时间；
* 创建时间可保留原值，若无法读取原值则重置并说明。

### 8. 执行测试

若当前请求需要执行测试，则：

* 先执行“驱动选择与降级（统一逻辑）”的 Driver Preflight，确定本次使用 MCP Driver 或 CDP Driver，并在报告中记录所用驱动类型；
* 按优先级从高到低执行用例；
* 严格按 Playbook 中的步骤执行；
* 通过 chrome-devtools-mcp 的 MCP 工具直接操作浏览器；
* 适配动态页面加载，加入合理等待与重试；
* 执行期间必须遵守“页面生命周期管理”规则，避免累计打开多个残留标签页；
* 单个用例失败时：
  + 记录失败原因；
  + 暂停当前用例；
  + 跳过到下一个用例；
  + 不中断整个测试任务。

#### 8.0 页面生命周期管理

浏览器页面的默认策略是“**优先复用，新增必回收**”。执行测试时必须按以下顺序处理：

01. **记录基线页面**：在正式执行前调用一次 `list_pages`，记录当前已存在的页面列表，作为本轮测试前的基线。
02. **优先复用单一工作页**：若已有可操作页面，优先 `select_page` 后 `navigate_page` 到目标 URL；不要为站内跳转频繁调用 `new_page`。
03. **仅在必要时新开页**：只有当页面行为天然要求新标签页承载内容，或必须保留来源页状态时，才允许调用 `new_page` 或跟随站点打开新页。
04. **新页立即接管**：一旦出现新标签页，立即再次 `list_pages`，识别新增页面，`select_page` 到该页面完成检查、截图或断言。
05. **检查完立即关闭**：对非主工作页，完成当前步骤后立刻调用 `close_page` 关闭；关闭后切回主工作页或原来源页继续执行。
06. **外链默认不驻留**：站外链接、帮助页、GitHub、备案页等只用于验证“能否打开/内容是否正确”时，验证完成即关闭，不得保留到用例结束。
07. **结束时统一清场**：整轮测试结束后再次 `list_pages`，关闭所有“本轮新增且不在基线中的页面”；若只能保留最后一个页面，则优先保留原基线页面。
08. **清场失败要记录**：若有页面因为浏览器限制或页面状态无法关闭，需在最终结果和报告中明确写出残留页面标题、URL 与原因。

补充约束：

* MCP Driver 下使用 `close_page(pageId)` 完成关闭。
* CDP Driver 下使用 `POST /close_page` 完成关闭。
* 若页面数量在执行中持续增长，应优先判定为流程缺陷，先清理页面再继续，不要放任累计到数十个窗口。

#### 8.1 SPA 框架表单交互策略

现代 Web 应用大量使用 Vue、React、Angular 等 SPA 框架，其表单通过双向绑定（如 Vue 的 v-model）管理状态。直接操作 DOM 或键盘输入可能无法触发框架的响应式系统。

**标准操作流程**：

01. **探测框架类型**：通过 `evaluate_script` 执行 `scripts/detect.mjs` 中 `detectFramework` 的函数体，识别页面使用的 SPA 框架
02. **探测组件库**：通过 `evaluate_script` 执行 `scripts/detect.mjs` 中 `detectComponentLib` 的函数体，识别页面使用的 UI 组件库
03. **探测页面模式**：通过 `evaluate_script` 执行 `scripts/detect.mjs` 中 `detectPagePattern` 的函数体，识别页面结构模式
04. **查询组件库知识**：读取 `knowledge/component-lib.md`，查找与当前组件库匹配的交互策略，优先使用高置信度方案
05. **优先使用 MCP 原生工具**：先尝试 `fill` 或 `click` + `type_text` 填充表单
06. **验证是否生效**：提交后通过 `take_snapshot` 检查页面是否发生预期变化
07. **若未生效，使用框架实例操作**：根据探测到的框架类型，通过 `evaluate_script` 执行对应的探测函数

**通用探测脚本**： `scripts/detect.mjs` （ES Module），包含以下导出函数：

| 函数 | 用途 |
| --- | --- |
| `detectFramework` | 识别 SPA 框架类型（Vue2/Vue3/React/Angular/jQuery） |
| `detectFormElements` | 收集页面所有表单元素的类型、选择器、当前值、可选项 |
| `findVue2FormComponent` | Vue 2 专用：递归查找持有表单数据的组件路径及方法列表 |
| `detectComponentLib` | 识别 UI 组件库（Arco Design/Ant Design/Element UI/Element Plus/MUI/Chakra UI/Bootstrap/Tailwind） |
| `detectPagePattern` | 识别页面结构模式（crud-list/wizard-form/list-detail/tabbed-detail/dashboard 等） |

注意： `evaluate_script` 的 `function` 参数要求是**可直接执行的函数声明**（如 `() => { ... }` ）。 `detect.mjs` 中是 `export function ...` ，因此注入时需要做一次轻量转换：

```js
// 伪代码：读取 detect.mjs 后，取出 export function detectFramework() {...}
// 将其转换为 () => { ... } 再传给 evaluate_script
(() => {
    // paste detectFramework 的函数体到这里
})()
```

**框架实例操作原则**：

* **Vue 2**：通过 `rootEl.__vue__` 获取实例 → 递归 `$children` 找到表单组件 → 直接设置 `comp.form.xxx` → 调用 `comp.onSubmit()`
* **Vue 3**：通过 `rootEl.__vue_app__` 获取实例
* **React**：查找 `_reactRootContainer` 或 React fiber tree
* **通用回退**：按以下优先级尝试输入方法
  01. `document.execCommand('insertText', false, value)` — 对 React + Arco Design / Ant Design 等组件库最可靠，能正确触发 React 内部状态更新
  02. `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` + `dispatchEvent(new Event('input', {bubbles: true}))` — 仅在 `execCommand` 不可用时使用，对部分 React 组件可能无法触发状态更新
  03. 框架实例直接操作 — 作为最后手段

  **重要**： `execCommand('insertText')` 的前提是输入框已获得焦点且选中了已有文本（ `el.focus(); el.select()` ），否则会在光标位置插入而非替换。

每个站点首次探测后，应将框架类型、组件路径、表单字段映射等信息沉淀到对应 Playbook 的「站点技术特征」章节中，供后续用例复用。

#### 8.2 表单元素值探测

下拉框（select）的显示文本和实际 value 经常不同（如显示"一天"但 value 是 `day` ）。用错误的 value 提交会导致 API 错误。

**标准流程**：首次操作新页面的表单前，通过 `evaluate_script` 执行 `scripts/detect.mjs` 中 `detectFormElements` 的函数体，一次性收集所有表单元素的 option 值映射，并将映射结果沉淀到 Playbook 的「站点技术特征」章节。

#### 8.3 SPA 路由页面判断

SPA 应用的页面跳转不一定改变 `window.location.href` （Vue Router 的 hash mode 或部分 history mode 只更新视图不刷新 URL）。判断操作是否成功应优先检查：

01. 页面 DOM 内容变化（通过 `take_snapshot` 获取最新 a11y 树）
02. `document.body.innerText` 中是否包含预期文本
03. 最后才看 URL 变化

**SPA 直接 URL 导航风险**：部分 SPA 应用（尤其是有路由守卫或权限校验的应用）在通过 `navigate_page` 直接访问深层 URL 时，可能跳转到引导页、登录页或首页。此时应改为从列表页通过 UI 点击进入详情页，而非直接导航。判断方法：导航后检查 `document.body.innerText` 是否包含目标页面特征文本，若不包含则说明发生了重定向。

#### 8.4 UI 组件库交互策略（Arco Design / Ant Design 等）

基于 React 的组件库（Arco Design、Ant Design 等）封装了原生 HTML 元素，其事件系统使用 React 合成事件（SyntheticEvent）。直接调用 DOM 的 `.click()` 方法可能无法触发 React 合成事件，导致状态不更新。

**判断条件**：页面使用 React + 组件库，且 `.click()` 操作后组件状态未变化（如 Select 选项未选中、Drawer 确认按钮无响应）。

**处理策略**：

01. **优先使用 MCP `click(uid)` + `take_snapshot`**：通过 `take_snapshot` 获取 a11y 树中的 `uid`，再用 `click(uid)` 点击。MCP 的 click 实现会正确触发 React 合成事件。

02. **MCP 不可用时使用 `dispatchEvent`**：通过 `evaluate_script` 模拟完整的鼠标事件序列：
    

```js
    el.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true
    }));
    el.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true
    }));
    el.dispatchEvent(new MouseEvent("click", {
        bubbles: true
    }));
```

03. **多选 Select 选项**：组件库多选 Select 的选项点击后不会关闭下拉框，需逐个选择后点击其他区域关闭下拉框，再检查选中状态（通过标签元素确认，如 `.arco-tag`、`.ant-select-selection-item` 等）。

04. **Switch/Toggle 操作**：组件库的 Switch 组件点击后可能触发 Popconfirm 确认弹窗（如"确定关闭此开关吗？"），必须处理确认弹窗后才算操作完成。

05. **Drawer/Modal 确认按钮**：若 `evaluate_script` 中 `.click()` 不响应，改用 `take_snapshot` 获取按钮 `uid` 后用 MCP `click(uid)` 点击，或使用 `dispatchEvent` 方式。

#### 8.5 表单预勾选项与依赖字段验证

部分表单会预勾选某些选项（如通知渠道、集成方式等），但对应的依赖字段（如地址、Token 等）为空，导致表单提交时验证失败。

**判断条件**：表单提交后出现"不能为空"或"不符合输入规则"等验证错误，且报错字段并非主动填写的字段。

**处理策略**：

01. **提交前检查验证错误**：填写完主动字段后，先检查是否存在表单验证错误元素（如 `.arco-form-message`、`.ant-form-item-explain-error` 等），若有则定位到对应表单项。
02. **取消非必要预勾选项**：对于未主动勾选但被默认勾选的选项，若其依赖字段无法/无需填写，应取消勾选。
03. **填写依赖字段**：若预勾选项是业务必需的，则补填其依赖字段。
04. **沉淀到 Playbook**：将表单的预勾选项及其依赖关系记录到 Playbook「站点技术特征 → 表单交互方式」中，避免后续重复踩坑。

#### 8.6+ 待沉淀的新场景

以下为已知但尚未遇到的场景占位。当 Agent 在测试中首次遇到并找到有效方案时，按 §13.3 规则将方案回写到此处，替换对应占位：

* **Shadow DOM**：组件内部 DOM 被隔离在 shadow root 中，`take_snapshot` 可能无法直接获取内部元素
* **iframe 嵌套**：表单位于跨域或同域 iframe 内，需切换执行上下文
* **Web Components**：自定义元素的属性/事件模型与原生 HTML 不同
* **富文本编辑器**：CodeMirror、Monaco、Quill、TinyMCE 等不使用标准 input/textarea
* **SSR Hydration**：页面初始 HTML 由服务端渲染，客户端 hydrate 后才具备交互能力，过早操作会失败

### 9. 记录过程与截图

执行过程中必须记录：

* 操作时间
* 操作内容
* 当前页面 URL
* 所属用例 ID
* 所属步骤编号

以下场景应优先截图：

* 用例开始执行时
* 核心功能触发时
* 用例成功时
* 用例失败时
* 报错发生时

#### 9.1 截图策略

默认使用 **fullPage 整页截图**，确保页面完整内容可见。截图调用示例：

```text
take_screenshot(fullPage=true, filePath="截图路径")
```

当页面过长（如无限滚动页面）时，可改为对关键区域元素截图：

```text
take_screenshot(uid="目标元素uid", filePath="截图路径")
```

**禁止**只截取 viewport 可视区域（不带 fullPage 且不指定 uid），因为这往往只截到导航栏，遗漏核心内容。

#### 9.2 截图前等待

截图前必须做“页面稳定等待”，避免拿到 loading / skeleton 画面。优先级如下：

01. **优先等业务文本**：对外部页面或慢站点，先用 `wait_for` 等到关键文本出现（例如备案页等“ICP备案查询”）。
02. **其次等页面就绪**：使用 `evaluate_script` 判断 `document.readyState === 'complete'`，必要时再加一小段延迟让渲染稳定。
03. **最后兜底重试**：若截图仍明显为 loading，可在 2~3 次内重试（每次间隔 300~800ms），并在报告中注明重试。

CDP Driver 说明：

* `cdp-proxy` 的 `/take_screenshot` 已做 best-effort 的页面稳定等待（`readyState` / 常见 loading mask / 图片完成），但对无限加载/重定向页仍可能超时；遇到这类页面依然建议使用“等业务文本”的方式兜底。

### 10. 统计报错

对报错进行分类与汇总，至少包括：

* 页面加载报错
  + 404
  + 500
  + 超时
* 元素操作报错
  + 元素找不到
  + 点击失败
  + 输入失败
* 功能逻辑报错
  + 实际结果与预期不符

每条报错至少记录：

* 报错类型
* 报错时间
* 报错页面 URL
* 报错用例 ID
* 报错步骤
* 报错详情
* 关联截图

### 11. 生成测试报告

测试完成或被手动终止后，生成标准化 Markdown 报告。报告至少包含：

* 测试概况
  + 测试站点 URL
  + 驱动类型（必须标注本次使用 `chrome-devtools-mcp` 还是 `cdp-proxy`）
  + 驱动选择过程摘要（如：`MCP list_pages 失败 -> CDP /health 成功 -> 锁定 CDP Driver`）
  + 开始时间 / 结束时间
  + 执行用例总数
  + 成功数 / 失败数 / 跳过数
  + 报错总数
  + 测试通过率
* 用例执行详情
* 报错统计
* 测试结论
* 附件列表

报告命名建议：

* 运行目录：`playbooks/{domain}/{YYYYMMDDHHmm}/`
  + 测试报告：`playbooks/{domain}/{YYYYMMDDHHmm}/report.md`
  + 截图：`playbooks/{domain}/{YYYYMMDDHHmm}/{case_id}_{step}.png`
* Playbook：`playbooks/{domain}/{domain}.md`

### 12. 返回结果给用户

默认返回简洁版结果，重点包含：

* 当前处理状态或最终状态
* Playbook 是否复用 / 更新
* 本轮实际使用的驱动与驱动选择依据
* 页面遍历结果摘要
* 用例执行摘要
* 报错统计摘要
* 测试结论
* 完整报告位置（若已生成）

### 13. 经验进化

每次测试结束后，Agent 必须执行一轮「经验回写」检查。目标是让 Skill 在反复使用中自动积累能力，而不只是完成当次测试。

回写分九层，由近到远依次检查：

#### 13.1 Playbook 层（站点级）

触发条件：每次测试必执行。

回写内容：

* 「站点技术特征」章节：框架信息、组件库信息、页面模式、表单组件路径、字段值映射、交互方式、SPA 路由特征
* 新发现的页面行为模式（如特殊弹窗、验证码、动态加载策略等）
* 失败用例的恢复方案（若 Agent 在测试中成功恢复了某个失败步骤）

判断标准：对比测试前后 Playbook 的「站点技术特征」章节，若有字段为空或与本次探测结果不一致，则更新。

#### 13.2 通用脚本层（scripts/detect.mjs）

触发条件（扩展为以下任一）：

* `detectFramework` 返回 `framework: 'unknown'` 但 Agent 通过其他手段识别出了框架类型
* `detectComponentLib` 返回 `library: 'unknown'` 但 Agent 通过其他手段识别出了组件库
* `detectPagePattern` 返回 `primaryPattern: 'unknown'` 但 Agent 识别出了页面模式

回写内容：

* 在 `detectFramework` 函数中追加新框架的探测逻辑
* 在 `detectComponentLib` 的 `checks` 数组中追加新组件库探测规则
* 在 `detectPagePattern` 中追加新页面模式识别规则
* 若新框架/组件库需要特殊的表单组件查找方式，追加对应的 `findXxxFormComponent` 导出函数

回写规则：

01. 新增框架探测逻辑追加在 `detectFramework` 的 `[EXTEND: new framework]` 标记处
02. 新增组件库探测规则追加在 `detectComponentLib` 的 `checks` 数组末尾 `[EXTEND: new component lib]` 标记处
03. 新增函数追加在文件末尾 `[EXTEND: new finder]` 标记处，以 `export function` 导出
04. 同时更新 SKILL.md 8.1 节的函数引用表
05. 回写前先读取 `detect.mjs` 当前内容，避免覆盖已有逻辑

#### 13.3 策略层（SKILL.md）

触发条件：当测试过程中遇到 SKILL.md 现有策略未覆盖的场景，且 Agent 找到了有效的解决方案时。

典型场景：

* 新的 DOM 隔离模式（Shadow DOM、iframe 嵌套、Web Components）
* 新的表单交互模式（非 v-model 的双向绑定、第三方富文本编辑器、拖拽上传等）
* 新的页面加载模式（SSR hydration、Islands Architecture、流式渲染等）

回写内容：

* 在 SKILL.md 第 8 节（执行测试）下追加新的子章节（如 8.7、8.8）
* 子章节包含：场景描述、判断条件、处理策略、示例代码（若需要）

回写规则：

01. 新策略必须是通用的，不能包含站点专属信息（站点专属信息沉淀到 Playbook）
02. 回写前先读取 SKILL.md 相关区域，确认当前策略确实不覆盖该场景
03. 若场景与已有策略部分重叠，优先扩展已有章节而非新建
04. 新增策略时必须附带元数据：`创建时间`、`置信度: low`、`成功应用次数: 0`

#### 13.4 跨站点经验复用

当新站点的技术栈与某个已测站点有交集时，Agent 应主动读取已有 Playbook 的「站点技术特征」作为参考，跳过重复的试错过程。

查找策略（按优先级）：

01. **组件库匹配**（最高优先级）：读取 `knowledge/component-lib.md` 中与当前站点组件库一致的条目，直接复用交互策略
02. **框架 + 组件库匹配**：遍历 `playbooks/` 下所有站点目录的 Playbook，筛选「框架信息」+「组件库」与当前站点一致的条目
03. **框架匹配**（最低优先级）：仅框架一致时，复用通用交互方式

#### 13.5 组件库知识层（knowledge/component-lib.md）

触发条件（以下任一）：

* 测试中遇到某组件库的新交互问题并找到了解决方案
* 从 Playbook 的「站点技术特征 → 表单交互方式」中提取出可泛化的交互模式
* `detectComponentLib` 识别出组件库但 `knowledge/component-lib.md` 中无对应章节

回写内容：

* 在 `knowledge/component-lib.md` 对应组件库章节下追加新的知识条目
* 知识条目必须包含：组件类型、问题、根因、解决方案、置信度、适用框架、首次发现站点、成功应用次数、最后验证时间

回写规则：

01. 回写前先读取 `knowledge/component-lib.md`，确认当前确实没有覆盖该交互模式
02. 若已有类似条目但方案不同，追加为新的解决方案选项而非覆盖
03. 新增条目初始置信度为 `low`，成功应用次数为 `0`
04. 若组件库章节不存在，按模板格式新建章节

#### 13.6 失败模式挖掘

触发条件：每次测试结束后，若有失败用例则必须执行。

执行步骤：

01. **收集失败用例**：从本轮测试报告中提取所有失败用例的报错信息
02. **分类归因**：将失败原因归类为以下模式之一：
    - `element-not-found`：元素选择器失效（DOM 结构变化）
    - `interaction-failed`：交互操作未触发预期效果（组件库事件问题）
    - `state-mismatch`：操作成功但状态未如预期变化（业务逻辑/时序问题）
    - `timeout`：等待超时（页面加载慢、API 延迟）
    - `dependency-blocked`：前置依赖未满足（如删除保护未关闭、联系人未创建）
    - `navigation-failed`：页面跳转异常（SPA 路由守卫、重定向）
    - `unknown`：无法归因
03. **匹配已有知识**：检查 `knowledge/component-lib.md` 和 SKILL.md §8.x 中是否已有对应的解决方案
04. **生成恢复方案**：若 Agent 在测试中成功恢复了失败步骤，将恢复方案沉淀为结构化知识
05. **更新 Playbook**：将失败归因和恢复方案写入 Playbook 的「站点技术特征 → 已知问题与恢复方案」
06. **更新组件库知识**：若失败模式可泛化到组件库级别，同步更新 `knowledge/component-lib.md`

恢复方案格式：

```md

#### {失败模式名称}

- **触发条件**：...
- **现象**：...
- **根因**：...
- **恢复步骤**：
  01. ...
- **预防措施**：...
- **来源用例**：{case_id}
- **首次发现**：YYYY-MM-DD
```

#### 13.7 知识置信度与生命周期

目标：确保知识库中的知识是可信的、最新的，避免过时或冲突的知识积累。

**置信度升级规则**：

| 当前置信度 | 升级条件 | 升级后置信度 |
|-----------|---------|------------|
| low | 在 1 个以上新站点成功应用 | medium |
| medium | 在 3 个以上站点成功应用，或连续 5 次成功 | high |
| high | 连续 10 次成功且无失败 | high（维持） |

**置信度降级规则**：

| 当前置信度 | 降级条件 | 降级后置信度 |
|-----------|---------|------------|
| high | 连续 2 次应用失败 | medium |
| medium | 连续 2 次应用失败 | low |
| low | 连续 3 次应用失败 | deprecated |

**废弃规则**：

* 标记为 `deprecated` 的知识条目保留 30 天后删除
* 废弃条目在删除前需在 `knowledge/evolution-log.md` 中记录废弃原因
* 若 `deprecated` 条目在 30 天内被重新验证成功，恢复为 `low` 置信度

**冲突检测**：

* 当同一组件类型在同一组件库下存在多条解决方案时，按置信度从高到低排序
* 若两条 high 置信度的方案互相矛盾，在 `knowledge/evolution-log.md` 中记录冲突，并将两者降级为 medium 待进一步验证

**每次测试后的元数据更新**：

* 对本轮应用到的每条知识条目：`成功应用次数 += 1`，`最后验证时间 = 当前日期`
* 对本轮应用失败的每条知识条目：按降级规则处理

#### 13.8 历史趋势与回归检测

目标：追踪测试质量随时间的变化，检测回归和 flaky 用例。

**趋势记录**：

每次测试完成后，在 Playbook 的「测试历史」章节追加一条记录：

```md

### 测试历史

| 测试时间 | 驱动 | 用例总数 | 成功 | 失败 | 跳过 | 通过率 | 报告路径 |
|---------|------|---------|------|------|------|-------|---------|
| 2026-04-15 19:00 | MCP | 40 | 29 | 6 | 5 | 82.9% | playbooks/.../report.md |
```

**回归检测**：

当本轮通过率低于上一轮时，Agent 必须：

01. 对比两轮报告，找出从"成功"变为"失败"的用例
02. 分析回归原因：是站点变更导致的，还是策略修改导致的
03. 若是策略修改导致的回归，考虑回滚策略并在 `knowledge/evolution-log.md` 中记录

**Flaky 用例检测**：

当同一用例在最近 3 次测试中出现"成功→失败→成功"或"失败→成功→失败"的交替模式时，标记为 flaky，并在 Playbook 中标注：

```md
* flaky 标记：是
* flaky 原因：（如"API 超时偶发"、"元素加载时序不稳定"）
* 建议处理：增加等待时间 / 增加重试 / 降级为 P2
```

#### 13.9 进化日志

所有进化变更必须记录到 `knowledge/evolution-log.md` ，用于追踪知识增长、验证进化效果。

日志条目格式：

```md

### {序号}. {变更标题}

- **时间**：YYYY-MM-DD HH:mm
- **层级**：playbook / script / strategy / knowledge / evolution-engine
- **变更类型**：新增 / 更新 / 废弃 / 验证
- **变更内容**：简要描述
- **触发来源**：哪个站点/用例触发了本次进化
- **效果验证**：进化后是否经过验证，验证结果
```

**进化引擎自检**：

每累计 10 次测试后，Agent 应执行一次进化引擎自检：

01. 统计各层级知识的条目数和平均置信度
02. 检查是否存在 `deprecated` 条目需要清理
03. 检查是否存在冲突条目需要解决
04. 检查是否有 `low` 置信度条目可以升级
05. 将自检结果追加到 `knowledge/evolution-log.md`

## Supported commands

### 1. 执行测试

示例：

* “用 ui-testing 测试 <https://www.example.com>”
* “用 ui-testing 测试 <https://www.example.com/path1>，更新用例”

处理规则：

* 识别 URL；
* 识别是否更新用例；
* 执行完整流程。

### 2. 查询 Playbook

示例：

* “查询 example.com 的 Playbook”
* “查询 `www.example.com` 站点 `path1` 的 Playbook”

返回内容至少包括：

* Playbook 路径
* 用例总数
* 用例列表（ID、名称、优先级）

### 3. 编辑 / 删除用例

示例：

* “删除 example_com_001 用例”
* “修改 example_com_002 的预期结果”

处理规则：

* 先定位对应 Playbook；
* 再定位用例 ID；
* 仅修改用户明确指定的字段；
* 修改后返回变更摘要。

### 4. 查询报错

示例：

* “查询本次测试的报错明细”

返回内容至少包括：

* 报错分类统计
* 报错明细
* 关联用例 / 页面 / 截图

### 5. 导出报告

示例：

* “导出本次测试报告”

返回内容至少包括：

* 报告文件路径
* 报告摘要

### 6. 终止测试

示例：

* "终止当前测试"

处理规则：

* 立即停止后续用例；
* 保留已执行记录；
* 生成部分测试报告；
* 明确标记未执行用例。

### 7. 查询组件库知识

示例：

* "查询 Arco Design 的交互策略"
* "查询 Select 组件在各组件库中的处理方式"

返回内容至少包括：

* 匹配的知识条目列表
* 每条知识的置信度、适用框架、成功应用次数

### 8. 查询进化状态

示例：

* "查询进化日志"
* "查询知识库统计"

返回内容至少包括：

* 各层级知识的条目数和平均置信度
* 最近 5 条进化变更
* 是否有 deprecated 条目待清理
* 是否有冲突条目待解决

## Output requirements

### 状态反馈

在长流程任务中，持续向用户反馈阶段状态，优先使用以下表达：

* “正在校验 URL”
* “正在检测页面可达性”
* “正在遍历页面”
* “正在梳理测试用例”
* “正在更新 Playbook”
* “正在执行用例 {case_id}”
* “当前用例执行失败，已跳过并继续后续用例”
* “正在生成测试报告”
* “测试完成”

### 最终输出格式

最终回复尽量使用以下结构：

01. **执行结果**：成功 / 部分成功 / 失败
02. **目标范围**：测试 URL、Playbook 范围
03. **Playbook 处理**：复用 / 新建 / 更新
04. **遍历结果**：发现页面数、跳过页面数
05. **用例结果**：总数、成功、失败、跳过
06. **报错统计**：按类型汇总
07. **测试结论**：一句话结论
08. **产物位置**：Playbook 路径、报告路径、截图目录

## Data format requirements

### Playbook Markdown 结构

```md
# 站点Playbook（www.example.com/path1）

## 基本信息

- 测试URL：https://www.example.com/path1
- 站点根文件夹：www.example.com
- Playbook文件名：path1.md
- 创建时间：2024-10-01 10:00:00
- 更新时间：2024-10-01 10:30:00
- 用例总数：20

## 用例总览

| 用例ID | 功能模块 | 优先级 | 用例名称 | 类型 |
|--------|---------|--------|---------|------|
| 001 | 实例管理 | P0 | 实例创建-更新-删除完整流程测试 | E2E |
| 002 | 实例管理 | P0 | 实例详情-自动续费开关完整流程测试 | E2E |
| 003 | 实例管理 | P1 | 实例详情-标签管理完整流程测试 | E2E |
| 010 | 配置管理 | P0 | 配置项完整生命周期测试 | E2E |
| 020 | 页面导航 | P2 | 左侧导航栏完整性验证测试 | 展示 |

## 用例详情

### 实例管理

#### example_com_path1_001（P0）

- 用例名称：实例创建-更新-删除完整流程测试
- 前置条件：已进入目标页面，已登录测试账号
- 执行步骤：
  01. 点击【创建实例】按钮
  02. 输入实例名称并确认
- 预期结果：
  01. 弹出创建表单
  02. 实例创建成功

#### example_com_path1_002（P0）

- 用例名称：实例详情-自动续费开关完整流程测试
- 前置条件：已进入实例详情页
- 执行步骤：
  01. 关闭自动续费开关，确认操作
  02. 验证自动续费状态变为"未开启"
  03. 重新开启自动续费开关，确认操作
  04. 验证自动续费状态恢复为"已开启"
- 预期结果：
  01. 自动续费关闭成功
  02. 自动续费重新开启成功

### 配置管理

#### example_com_path1_010（P0）

- 用例名称：配置项完整生命周期测试
- ...

### 页面导航

#### example_com_path1_020（P2）

- 用例名称：左侧导航栏完整性验证测试
- ...

## 站点技术特征

### 框架信息

- 框架：Vue 2 / Vue 3 / React / Angular / 无框架
- 根元素：#app
- 实例获取方式：document.getElementById('app').__vue__

### 组件库信息

- 组件库：Arco Design / Ant Design / Element UI / 无
- 组件库前缀：arco / ant / el
- 版本：...

### 页面模式

- 主要模式：crud-list / wizard-form / list-detail / tabbed-detail / dashboard / ...
- 模式特征：...

### 表单组件路径

（记录持有表单数据的组件在组件树中的路径）

### 表单字段值映射

（记录 select 等元素的显示文本与实际 value 的对应关系）

### 表单交互方式

（记录 MCP fill/type_text 是否有效，若无效则记录通过框架实例操作的代码模式）

### SPA 路由特征

（记录页面跳转行为：URL 是否变化、如何判断操作成功等）

### 已知问题与恢复方案

（记录测试中遇到的失败模式及其恢复方案，格式参见 §13.6）

### 测试历史

| 测试时间 | 驱动 | 用例总数 | 成功 | 失败 | 跳过 | 通过率 | 报告路径 |
|---------|------|---------|------|------|------|-------|---------|
| ... | ... | ... | ... | ... | ... | ... | ... |
```

### 测试报告 Markdown 结构

```md
# 站点UI自动化测试报告（example.com）

## 一、测试概况

- 测试站点：https://www.example.com
- 驱动：MCP（`chrome-devtools-mcp`） / CDP（`cdp-proxy`）
- 测试时间：2024-10-01 10:30:00 - 2024-10-01 11:30:00
- 执行用例总数：20
- 成功用例数：18
- 失败用例数：2
- 报错总数：3
- 测试通过率：90%

## 二、用例执行详情

| 用例ID | 用例名称 | 执行状态 | 执行时间 | 备注 |
| ------ | -------- | -------- | -------- | ---- |
| example_com_001 | 实例创建-更新-删除完整流程测试 | 成功 | 25秒 | 无 |

## 三、报错统计

- 元素操作报错：2次
- 页面加载报错：1次

## 四、测试结论

核心功能测试通过，存在少量次要问题，建议修复后回归。
```

### 日志格式

统一使用：

```text
时间戳 | 日志类型 | 日志内容
```

日志类型包括：

* 操作日志
* 执行日志
* 报错日志

## Constraints

* 仅处理单个 URL；
* 仅测试 Web 页面；
* 不跨域遍历；
* 不执行恶意、破坏性、越权操作；
* 不保存用户密码、Cookie、个人隐私等敏感信息；
* 遇到登录页时，如需真实凭据，提示用户提供测试账号并说明不会持久化存储；若用户未提供，则跳过需登录场景并在报告中注明；
* 当页面数量明显过大时，应提示范围风险；默认建议控制在 500 个子页面以内；

## Success criteria

当且仅当满足以下条件时，可视为任务完成：

01. 已正确识别用户意图；
02. 已完成 URL 校验与可达性判断；
03. 已正确复用或更新对应 Playbook；
04. 若执行测试，已按优先级完成用例执行或生成部分执行结果；
05. 本轮执行全程只使用 `MCP Driver` 或 `CDP Driver` 中的一种，且未触发 Forbidden Paths；
06. 已记录关键步骤、截图与报错；
07. 已生成可读的结果摘要；
08. 若需要导出，已生成 Markdown 报告并返回路径。

## Failure handling

遇到以下情况时，必须明确反馈并尽量保留中间产物：

* URL 无效；
* 页面不可达；
* 无法连接浏览器；
* MCP 与 CDP 都不可用；
* 执行过程中误用了 `Playwright`、Puppeteer、Agent testing browser 或其他第三套浏览器驱动；
* 执行过程中发生跨驱动切换；
* Playbook 文件损坏或无法读取；
* 报告生成失败；
* 用户中途终止。

反馈时说明：

* 失败阶段；
* 已完成部分；
* 未完成部分；
* 是否已生成部分报告或日志。

## Examples

### 示例 1：执行测试并更新用例

用户：

> 用 ui-testing 测试 <https://www.example.com/path1>，更新用例

期望行为：

* 校验 URL；
* 遍历 `path1` 范围内页面；
* 梳理并覆盖 `www.example.com/path1.md`；
* 执行新用例；
* 输出测试摘要与报告路径。

### 示例 2：直接复用 Playbook 执行

用户：

> 用 ui-testing 测试 <https://www.demo.com>，不更新用例

期望行为：

* 优先读取 `www.demo.com/www.demo.com.md`；
* 若存在则直接执行；
* 若不存在则自动创建后执行。

### 示例 3：查询 Playbook

用户：

> 查询 `www.example.com` 站点 `path1` 的 Playbook

期望行为：

* 定位 `www.example.com/path1.md`；
* 返回用例列表摘要。

### 示例 4：查询报错

用户：

> 查询本次测试的报错明细

期望行为：

* 返回报错分类统计；
* 返回每条报错的页面、用例、步骤、详情与截图关联信息。
