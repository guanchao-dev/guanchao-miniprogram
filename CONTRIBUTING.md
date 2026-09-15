# 贡献指南

感谢你参与寻潮记小程序的开发！请先阅读本指南，了解团队协作规范。

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
