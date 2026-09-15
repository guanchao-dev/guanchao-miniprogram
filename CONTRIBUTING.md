# 贡献指南

感谢你参与寻潮记小程序的开发！请先阅读本指南，了解团队协作规范。

## 〇、首次配置：本地敏感信息

仓库**不包含**任何真实密钥。克隆代码后必须先完成以下配置，否则无法编译：

```bash
# 复制配置模板，填入自己的腾讯位置服务 Key
cp config/env.example.ts config/env.local.ts
```

- `config/env.local.ts` 已在 `.gitignore` 中，**永远不要提交**
- 腾讯位置服务 Key 需在[腾讯位置服务控制台](https://lbs.qq.com/)申请，场景选择「微信小程序」，并绑定本项目 AppID

### 安装提交安全钩子（必做，一次即可）

仓库内置了敏感信息扫描钩子，克隆后执行一次：

```bash
git config core.hooksPath hooks
```

此后每次 `git commit` 会自动拦截：密钥、手机号、证件号、内网 IP、本机路径、内部文档（`docs/`）、私钥证书、`.env`、`*.docx` 等。确认误报需经管理员同意后才可 `git commit --no-verify` 跳过。

### 内部文档规则

- `docs/` 目录已整体忽略：接口文档、进度说明、PPT 大纲、技术路线等**内部材料一律通过团队私有渠道（飞书/网盘）分发，禁止入库**
- 本仓库是**公开仓库**，任何提交、PR、Issue 中都不得出现：真实姓名、手机号、学号、私人邮箱、服务器地址、账号密码、商业合作信息
- 提交前请自问：这条内容明天出现在外网头条上，是否可以接受？不确定就先发群里确认


## 一、分支策略

本项目采用 **Git Flow 简化版**：

| 分支 | 用途 | 谁可以推送 |
|------|------|-----------|
| `main` | 生产环境代码，始终稳定可发布 | ❌ 禁止直接推送，必须通过 PR |
| `develop` | 开发集成分支 | 团队成员可推送 |
| `feature/*` | 新功能开发 | 开发者个人 |
| `fix/*` | Bug 修复 | 开发者个人 |
| `hotfix/*` | 线上紧急修复 | 管理员 |

**命名规范：**
- 功能分支：`feature/模块名-简短描述`，如 `feature/tide-optimize`
- 修复分支：`fix/问题简述`，如 `fix/login-crash`
- 紧急修复：`hotfix/问题简述`

## 二、提交信息规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type 类型：**

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不影响功能） |
| `perf` | 性能优化 |
| `style` | 代码格式（不影响逻辑） |
| `docs` | 文档更新 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |
| `revert` | 回滚提交 |

**示例：**
```
feat(tide): 新增潮汐日历切换动画

- 支持左右滑动切换日期
- 优化曲线渲染性能

Closes #12
```

**注意事项：**
- subject 不超过 50 个字符，用中文描述
- body 说明「做了什么」和「为什么」，每行不超过 72 字符
- 关联 Issue 用 `Closes #12` 或 `Refs #12`

## 三、Pull Request 流程

1. **创建分支**：从 `develop` 拉出新分支
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature
   ```

2. **开发提交**：完成功能后提交到自己的分支

3. **发起 PR**：目标分支为 `develop`（紧急修复为 `main`）
   - PR 标题遵循 commit 规范
   - 填写 PR 模板中的所有项
   - 关联相关 Issue

4. **代码审核**：至少 1 名审核人（见 CODEOWNERS）批准后才能合并
   - 审核人会检查：功能正确性、代码规范、性能、安全
   - 如有修改意见，在 PR 中讨论并提交修复

5. **合并**：审核通过后由审核人或管理员合并（Squash Merge）

## 四、代码规范

### TypeScript
- 启用 `strictNullChecks`，避免隐式 `any`（`noImplicitAny`）
- 优先用 `interface` 定义对象类型
- 异步操作统一用 `async/await`
- 错误处理：网络请求必须 `.catch()` 并给出用户提示

### 小程序
- 页面文件遵循 `pages/页面名/页面名.{ts,wxml,wxss,json}`
- 全局样式在 `app.wxss`，页面私有样式在各自 wxss
- 图片资源统一走 CDN（`https://www.blueakaiwu.cn/api/v1/static/assets/...`），**不要提交大图片到仓库**
- 网络请求统一走 `services/api.ts` → `utils/http.ts`，不要直接 `wx.request`

### 资源管理
- `assets/` 下的图片仅用于 tabBar 图标等必须打包的资源
- 其他图片（徽章、插画、地图等）放 CDN，本地目录在 `.gitignore` 和 `packOptions.ignore` 中排除

## 五、提交前检查清单

- [ ] 代码能在微信开发者工具中正常编译
- [ ] 无 `console.log` 残留（用 `showError` / `toast`）
- [ ] 新增接口在 `services/api.ts` 中定义
- [ ] 敏感信息（密钥、token）不硬编码，走 `config/env.ts`
- [ ] 图片资源已上传 CDN，未提交大图到仓库
- [ ] 无内部文档、个人信息、本机路径、内网 IP（安全钩子会自动拦截）
- [ ] commit message 符合规范

## 六、审核标准

审核人审核时关注：

1. **功能正确**：需求是否实现，边界情况是否处理
2. **代码质量**：命名清晰、无重复代码、无魔法数字
3. **性能**：无不必要的重复请求、图片已压缩
4. **安全**：无敏感信息泄露、输入有校验
5. **兼容性**：基础库 3.5.5+，iOS/Android 双端

---

如有疑问，在 PR 中 @ 管理员或在群里讨论。
