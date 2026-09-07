# 观潮 · 海洋素养微信小程序

赶海主题的海洋素养科普小程序：首页探索、赶海点位与潮汐日历、海洋生物百科、知识问答、社区分享与成就系统。

## 技术栈

- 微信小程序原生框架（WXML / WXSS / TypeScript）
- 微信开发者工具内置 TS 编译插件，无需额外构建步骤

## 目录结构

| 目录 | 说明 |
|---|---|
| `pages/` | 全部页面，Tab 主页：首页 / 社区 / 成就 / 我的 |
| `components/` | 自定义组件（如 `unlock-popup`） |
| `services/` | 数据接口层：`api.ts` 后端接口封装、`communityMock.ts` 社区模拟数据 |
| `config/` | 全局配置（敏感配置仅本地，见下） |
| `utils/` | 工具函数 |
| `typings/` | TypeScript 类型定义 |
| `assets/` | 小程序内使用的图片资源 |
| `tools/` | 设计资产处理脚本（Python） |
| `hooks/` | Git 安全检查钩子（安装方式见 [CONTRIBUTING.md](CONTRIBUTING.md)） |

设计源文件（Sketch 等）与项目内部文档（接口文档、规划文档等）体积较大或含内部信息，**不入库**，通过团队私有渠道分发。

## 快速上手

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版）
2. 克隆仓库：

   ```bash
   git clone https://github.com/guanchao-dev/guanchao-miniprogram.git
   ```

3. 复制敏感配置模板并填入本机 Key（见 [CONTRIBUTING.md](CONTRIBUTING.md) 第〇节）：

   ```bash
   cp config/env.example.ts config/env.local.ts
   ```

4. 打开开发者工具 → 导入项目 → 选择仓库根目录
5. 直接编译预览。AppID 已配置在 `project.config.json`；如提示无权限，请联系项目管理员将你的微信号加入开发者 / 体验成员

## 协作规范

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。核心约定：

- `main` 为生产保护分支，禁止直接推送，所有改动通过 Pull Request 审查合并
- `develop` 为开发集成分支，日常开发成果先合入此处
- 新功能走 `feature/*` 分支，修复走 `fix/*` 分支
- 提交信息遵循 Conventional Commits，如 `feat: 新增潮汐日历页面`
- PR 需至少一人审查通过后方可合并
- **禁止提交任何密钥、内部文档、含真实个人信息的材料**（提交前会自动扫描）
- `project.private.config.json`、`config/env.local.ts` 与设计源文件不入库（见 `.gitignore`）
