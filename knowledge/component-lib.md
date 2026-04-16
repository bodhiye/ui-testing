# UI 组件库交互知识库

本文件沉淀各 UI 组件库在自动化测试中的交互策略，供所有站点 Playbook 复用。
当 Agent 在测试中首次发现某组件库的新交互模式时，按 §13.5 规则回写到对应组件库章节。

## 知识条目格式

每条知识包含：
- **组件类型**：Select / Switch / Modal / Table / DatePicker / Transfer / …
- **问题**：直接 DOM 操作导致的现象
- **根因**：为什么原生操作不生效
- **解决方案**：按优先级排列的可行方案
- **置信度**：high / medium / low（基于成功应用次数）
- **适用框架**：react / vue2 / vue3 / angular
- **首次发现站点**：站点域名
- **成功应用次数**：累计在多少个站点/用例中成功应用
- **最后验证时间**：YYYY-MM-DD

---

## Arco Design

### Select（单选）

- **组件类型**：Select
- **问题**：`el.click()` 无法触发 React 合成事件，选项不选中，下拉框不关闭
- **根因**：Arco Design Select 使用 React SyntheticEvent，直接 DOM `.click()` 不触发 onChange
- **解决方案**：
  01. **MCP `click(uid)`**：通过 `take_snapshot` 获取选项 uid，用 MCP click 点击（最可靠）
  02. **`dispatchEvent` 鼠标序列**：`mousedown → mouseup → click`，每个事件 `bubbles: true`
  03. **`nativeSetter` + `input` 事件**：仅作最后手段，对 Arco Select 不可靠
- **置信度**：high
- **适用框架**：react
- **首次发现站点**：（待补充）
- **成功应用次数**：3+
- **最后验证时间**：2026-04-15

### Select（多选）

- **组件类型**：Select (Multi)
- **问题**：多选 Select 选项点击后下拉框不关闭，需手动关闭
- **根因**：多选模式设计为可连续选择，不自动关闭
- **解决方案**：
  01. 逐个点击选项
  02. 点击下拉框外部区域关闭
  03. 通过 `.arco-tag` 元素验证选中状态
- **置信度**：high
- **适用框架**：react
- **首次发现站点**：（待补充）
- **成功应用次数**：2+
- **最后验证时间**：2026-04-15

### Switch / Toggle

- **组件类型**：Switch
- **问题**：点击 Switch 后触发 Popconfirm 确认弹窗，未处理确认则操作未完成
- **根因**：业务逻辑要求二次确认（如"确定关闭删除保护？"）
- **解决方案**：
  01. 点击 Switch
  02. 立即 `take_snapshot` 检查是否出现 Popconfirm
  03. 若出现，点击"确定"按钮
  04. 再次 `take_snapshot` 验证状态变更
- **置信度**：high
- **适用框架**：react
- **首次发现站点**：（待补充）
- **成功应用次数**：3+
- **最后验证时间**：2026-04-15

### Drawer 确认按钮

- **组件类型**：Drawer
- **问题**：`evaluate_script` 中 `.click()` 对 Drawer 底部确认按钮不响应
- **根因**：按钮事件绑定在 React fiber 上，直接 DOM 操作不触发
- **解决方案**：
  01. `take_snapshot` 获取确认按钮 uid
  02. MCP `click(uid)` 点击
  03. 若 MCP 不可用，使用 `dispatchEvent` 鼠标序列
- **置信度**：high
- **适用框架**：react
- **首次发现站点**：（待补充）
- **成功应用次数**：2+
- **最后验证时间**：2026-04-15

### Input 输入

- **组件类型**：Input
- **问题**：`nativeSetter` + `dispatchEvent(new Event('input'))` 无法触发 React 状态更新
- **根因**：Arco Design Input 使用 React 合成事件系统，原生 Event 不被 React 捕获
- **解决方案**：
  01. **`document.execCommand('insertText', false, value)`**：最可靠，前提是 `el.focus(); el.select()`
  02. MCP `fill(uid, value)`：优先尝试
  03. MCP `click(uid)` + `type_text(text)`：备选
- **置信度**：high
- **适用框架**：react
- **首次发现站点**：（待补充）
- **成功应用次数**：5+
- **最后验证时间**：2026-04-15

---

## Ant Design

### Select

- **组件类型**：Select
- **问题**：与 Arco Design Select 相同，`.click()` 不触发 React 合成事件
- **根因**：Ant Design 同样使用 React SyntheticEvent
- **解决方案**：
  01. MCP `click(uid)` 优先
  02. `dispatchEvent` 鼠标序列备选
- **置信度**：medium
- **适用框架**：react
- **首次发现站点**：（待补充）
- **成功应用次数**：0
- **最后验证时间**：—

### Modal 确认

- **组件类型**：Modal
- **问题**：Modal 底部按钮可能不响应 `.click()`
- **根因**：React 合成事件
- **解决方案**：
  01. MCP `click(uid)` 优先
  02. `dispatchEvent` 鼠标序列备选
- **置信度**：medium
- **适用框架**：react
- **首次发现站点**：（待补充）
- **成功应用次数**：0
- **最后验证时间**：—

---

## Element UI (Vue 2)

### Select

- **组件类型**：Select
- **问题**：原生 `<select>` 被 Element UI 的自定义下拉组件替代，直接操作无效
- **根因**：Element UI Select 使用 Vue 组件渲染下拉选项
- **解决方案**：
  01. 点击 Select 触发下拉展开
  02. 通过 `take_snapshot` 获取选项 uid
  03. MCP `click(uid)` 选择
- **置信度**：medium
- **适用框架**：vue2
- **首次发现站点**：（待补充）
- **成功应用次数**：0
- **最后验证时间**：—

---

## BootstrapVue (Vue 2)

### Form Submit

- **组件类型**：Form
- **问题**：`form.submit()` 或按钮 `.click()` 不触发 Vue 方法
- **根因**：BootstrapVue 使用 `@submit.prevent` 或 `@click` 绑定 Vue 方法
- **解决方案**：
  01. 通过 Vue 实例直接调用 `vm.onSubmit({preventDefault(){}})`
  02. 或 `dispatchEvent(new Event('submit', {bubbles: true}))`
- **置信度**：high
- **适用框架**：vue2
- **首次发现站点**：paste.org.cn
- **成功应用次数**：1
- **最后验证时间**：2026-04-10

---

## 通用模式

### 表单预勾选项与依赖字段

- **组件类型**：Form (通用)
- **问题**：表单预勾选某些选项，但依赖字段为空，导致提交验证失败
- **根因**：业务默认值与测试意图不一致
- **解决方案**：
  01. 提交前检查验证错误元素
  02. 取消非必要预勾选项
  03. 补填必要依赖字段
  04. 沉淀到 Playbook
- **置信度**：high
- **适用框架**：react, vue2, vue3
- **首次发现站点**：（待补充）
- **成功应用次数**：2+
- **最后验证时间**：2026-04-15

### CodeMirror / 富文本编辑器

- **组件类型**：CodeMirror
- **问题**：不使用标准 input/textarea，无法用 fill/type_text 直接输入
- **根因**：CodeMirror 使用自定义 DOM 结构和事件系统
- **解决方案**：
  01. `el.focus()` 聚焦编辑区域
  02. `document.execCommand('insertText', false, value)` 写入
  03. 或通过 CodeMirror 实例 API：`cm.setValue(value)`
- **置信度**：high
- **适用框架**：react, vue2, vue3
- **首次发现站点**：（待补充）
- **成功应用次数**：1
- **最后验证时间**：2026-04-15

---

## [EXTEND: new component lib]

当 Agent 在测试中首次遇到新的 UI 组件库时，按以下格式追加：

```markdown
## {组件库名称}

### {组件类型}

- **组件类型**：...
- **问题**：...
- **根因**：...
- **解决方案**：
  01. ...
- **置信度**：low
- **适用框架**：...
- **首次发现站点**：...
- **成功应用次数**：0
- **最后验证时间**：YYYY-MM-DD
```
