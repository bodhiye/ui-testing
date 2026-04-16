# 站点Playbook（paste.org.cn）

## 基本信息

* 测试URL：https://paste.org.cn/
* 站点根文件夹：paste.org.cn
* Playbook文件名：paste.org.cn.md
* 创建时间：2026-04-09 14:34:30
* 更新时间：2026-04-15 00:10:00 UTC+08:00
* 用例总数：6

## 用例总览

| 用例ID | 功能模块 | 优先级 | 用例名称 | 类型 |
|--------|---------|--------|---------|------|
| 001 | 代码保存 | P0 | 纯文本代码保存完整流程测试 | E2E |
| 002 | 代码保存 | P0 | 带密码保护的代码保存流程测试 | E2E |
| 003 | 代码保存 | P0 | 阅后即焚功能测试 | E2E |
| 004 | 代码保存 | P1 | 不同语言类型保存测试 | E2E |
| 005 | 代码保存 | P1 | 不同过期时间设置测试 | E2E |
| 006 | 页面导航 | P2 | 页面导航和链接测试 | 展示 |

## 用例详情

### 代码保存

#### paste_org_cn_001（P0）

* 用例名称：纯文本代码保存完整流程测试
* 前置条件：已进入 https://paste.org.cn/ 主页
* 执行步骤：
  01. 选择语言为"纯文本"
  02. 密码字段留空
  03. 选择过期时间为"无"
  04. 在文本框中输入测试代码内容
  05. 点击"保存"按钮
  06. 验证是否生成分享链接
* 预期结果：
  01. 成功保存代码
  02. 页面显示分享链接
  03. 可以通过链接访问保存的代码

#### paste_org_cn_002（P0）

* 用例名称：带密码保护的代码保存流程测试
* 前置条件：已进入 https://paste.org.cn/ 主页
* 执行步骤：
  01. 选择语言为"Python"
  02. 在密码字段输入测试密码
  03. 选择过期时间为"一天"
  04. 在文本框中输入 Python 代码
  05. 点击"保存"按钮
  06. 验证是否生成带密码保护的分享链接
* 预期结果：
  01. 成功保存代码
  02. 页面显示分享链接
  03. 访问链接时需要输入密码

#### paste_org_cn_003（P0）

* 用例名称：阅后即焚功能测试
* 前置条件：已进入 https://paste.org.cn/ 主页
* 执行步骤：
  01. 选择语言为"Go"
  02. 密码字段留空
  03. 选择过期时间为"一小时"
  04. 在文本框中输入 Go 代码
  05. 勾选"阅后即焚"选项
  06. 点击"保存"按钮
  07. 记录生成的分享链接
  08. 通过链接访问代码
  09. 再次访问同一链接
* 预期结果：
  01. 首次访问可以正常查看代码
  02. 第二次访问时提示代码已被销毁

#### paste_org_cn_004（P1）

* 用例名称：不同语言类型保存测试
* 前置条件：已进入 https://paste.org.cn/ 主页
* 执行步骤：
  01. 选择语言为"Bash"
  02. 输入 Bash 脚本
  03. 点击"保存"按钮
  04. 验证语法高亮是否正确
  05. 重复上述步骤测试 C/C++、Java、JSON、Markdown
* 预期结果：
  01. 所有语言类型都能成功保存
  02. 语法高亮显示正确

#### paste_org_cn_005（P1）

* 用例名称：不同过期时间设置测试
* 前置条件：已进入 https://paste.org.cn/ 主页
* 执行步骤：
  01. 选择语言为"纯文本"
  02. 输入测试内容
  03. 依次测试过期时间选项：无、一小时、一天、一周、一个月、一年
  04. 每次保存后验证链接有效性
* 预期结果：
  01. 所有过期时间选项都能正常设置
  02. 链接在有效期内可访问

### 页面导航

#### paste_org_cn_006（P2）

* 用例名称：页面导航和链接测试
* 前置条件：已进入 https://paste.org.cn/ 主页
* 执行步骤：
  01. 点击"代码便利贴"Logo，验证返回主页
  02. 点击 GitHub 图标，验证跳转到 GitHub 仓库
  03. 点击页脚"博客"链接，验证跳转
  04. 点击页脚"联系我"链接，验证邮件功能
  05. 点击备案号链接，验证跳转
* 预期结果：
  01. 所有导航链接都能正常跳转
  02. 外部链接在新标签页打开

## 站点技术特征

### 框架信息

* 框架：Vue 2（BootstrapVue）
* 根元素：`#app`
* 实例获取方式：`document.getElementById('app').__vue__`

### 表单组件路径

主页表单数据持有组件路径：

```
root.$children[0].$children[1].$children[0]
```

该组件包含：
* `form.langtype` — 语言类型
* `form.content` — 代码内容
* `form.password` — 密码（null 表示不设密码，对应 `#__BVID__22`，placeholder: "无需设置密码请留空"）
* `form.expireDate` — 过期时间
* `read_once` — 阅后即焚 checkbox 的 v-model（`['on']` 表示开启，`[]` 表示关闭）
* `flag` — 阅后即焚的组件级 data 属性（`true` 表示开启，`false` 表示关闭），与 `read_once` 关联但独立；通过 Vue 实例操作时设置 `comp.flag = true` 即可
* `onSubmit()` 方法 — 提交表单（需传入 `{ preventDefault: () => {} }` 参数）

> ⚠️ 注意： `form.password` 是密码字段，不是阅后即焚字段。误设 `form.password = "true"` 会导致粘贴被密码保护而非阅后即焚。

### 表单交互方式

MCP 的 `fill` / `type_text` 无法触发 BootstrapVue 的 v-model 绑定，必须通过 Vue 实例直接操作：

```javascript
const vm = document.getElementById('app').__vue__;
const comp = vm.$children[0].$children[1].$children[0];
comp.form.langtype = 'python';
comp.form.content = '代码内容';
comp.form.password = null;
comp.form.expireDate = 'day';
comp.read_once = [];
await comp.onSubmit({
    preventDefault: () => {}
});
```

### 表单字段值映射

**语言类型**（ `form.langtype` ）：

| 显示文本 | 实际 value |
|---------|-----------|
| 纯文本 | `plain` |
| Bash | `bash` |
| C/C++ | `cpp` |
| Go | `go` |
| Java | `java` |
| JSON | `json` |
| Python | `python` |
| Markdown | `markdown` |

**过期时间**（ `form.expireDate` ）：

| 显示文本 | 实际 value |
|---------|-----------|
| 无 | `none` |
| 一小时 | `hour` |
| 一天 | `day` |
| 一周 | `week` |
| 一个月 | `month` |
| 一年 | `year` |

### SPA 路由特征

* 使用 Vue Router（history mode）
* 保存成功后不改变 `window.location.href`，仅切换组件视图
* 判断保存成功需检查 `take_snapshot` 中是否出现分享链接文本
* 访问无效链接时会跳转到 `https://paste.org.cn/not_found`，显示"您访问的页面没有找到"
* 阅后即焚粘贴首次查看后再次访问会跳转到 `/not_found`

### 表单元素选择器映射

| 字段 | 选择器 | 类型 |
|------|--------|------|
| 语言类型 | `#__BVID__20` | select |
| 密码 | `#__BVID__22` | input[type=password] |
| 过期时间 | `#__BVID__24` | select |
| 代码内容 | `#__BVID__26` | textarea |
| 阅后即焚 | `#__BVID__29` | checkbox |
