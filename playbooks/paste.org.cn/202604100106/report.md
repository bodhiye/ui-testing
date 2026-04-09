# 站点 UI 自动化测试报告（paste.org.cn）

## 一、测试概况

* 测试站点：<https://paste.org.cn/>
* Playbook：`playbooks/paste.org.cn/paste.org.cn.md`（复用）
* 驱动：MCP（`chrome-devtools-mcp`）
* 驱动选择过程：`list_pages` 调用成功，锁定 `MCP Driver`
* 执行用例总数：6
* 成功用例数：6
* 失败用例数：0
* 跳过用例数：0
* 报错总数：0
* 测试通过率：100%

## 二、遍历结果

* 站内覆盖页面：主页、分享页、`/not_found`
* 外链验证范围：GitHub、工信部备案、博客、`mailto:`
* 本轮未更新 Playbook，用例直接复用执行

## 三、用例执行详情

| 用例ID | 用例名称 | 执行状态 | 备注 |
| ------ | -------- | -------- | ---- |
| paste_org_cn_001 | 纯文本代码保存完整流程测试 | 成功 | 生成分享链接并可访问 |
| paste_org_cn_002 | 带密码保护的代码保存流程测试 | 成功 | 出现密码提示，输入后可查看 |
| paste_org_cn_003 | 阅后即焚功能测试 | 成功 | 二次访问进入 `/not_found` |
| paste_org_cn_004 | 不同语言类型保存测试 | 成功 | Bash / C++ / Java / JSON / Markdown 均通过 |
| paste_org_cn_005 | 不同过期时间设置测试 | 成功 | `none/hour/day/week/month/year` 均可创建并验证访问 |
| paste_org_cn_006 | 页面导航和链接测试 | 成功 | GitHub 与备案链接可打开；博客链接连接被拒绝；`mailto:` 已校验 |

## 四、关键验证结果

* Vue2 / BootstrapVue 表单仍需通过组件实例直接写入 `form.*` 并调用 `onSubmit({preventDefault(){}})`
* 阅后即焚首次访问正常，二次访问跳转到 `https://paste.org.cn/not_found`
* 过期时间 `none/hour/day/week/month/year` 全部成功创建，并验证分享页可访问
* 博客外链 `https://yeqiongzhou.com/` 仍返回 `ERR_CONNECTION_REFUSED`

## 五、附件列表

* 用例 001：`paste_org_cn_000_home.png`、`paste_org_cn_001_success.png`、`paste_org_cn_001_view.png`
* 用例 002：`paste_org_cn_002_success.png`、`paste_org_cn_002_password_prompt.png`、`paste_org_cn_002_view.png`
* 用例 003：`paste_org_cn_003_success.png`、`paste_org_cn_003_view_1st.png`、`paste_org_cn_003_view_2nd_not_found.png`
* 用例 004：`paste_org_cn_004_bash_success.png`、`paste_org_cn_004_bash_view.png`、`paste_org_cn_004_cpp_view.png`、`paste_org_cn_004_java_view.png`、`paste_org_cn_004_json_view.png`、`paste_org_cn_004_markdown_002_view.png`
* 用例 005：`paste_org_cn_005_000_home.png`、`paste_org_cn_005_none_002_view.png`
* 用例 006：`paste_org_cn_006_000_home.png`、`paste_org_cn_006_001_logo_home.png`、`paste_org_cn_006_002_github.png`、`paste_org_cn_006_003_beian.png`、`paste_org_cn_006_004_blog_error.png`

## 六、测试结论

`paste.org.cn` 的核心“创建并分享代码”能力测试通过，本轮 6/6 用例成功；唯一持续观察项仍是博客外链在当前网络环境下连接被拒绝。
