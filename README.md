# 观潮 · 海洋素养微信小程序

赶海主题的海洋素养科普小程序：首页探索、赶海点位与潮汐日历、海洋生物百科、知识问答、社区分享与成就系统。

> 中国海洋大学 · 大学生创业训练项目

## 技术栈

- 微信小程序原生框架（WXML / WXSS / TypeScript）
- 微信开发者工具内置 TS 编译插件，无需额外构建步骤

## 目录结构

| 目录 | 说明 |
|---|---|
| `pages/` | 全部页面，Tab 主页：首页 / 社区 / 成就 / 我的 |
| `components/` | 自定义组件（如 `unlock-popup`） |
| `services/` | 数据接口层：`api.ts` 后端接口封装、`communityMock.ts` 社区模拟数据 |
| `config/` | 全局配置 |
| `utils/` | 工具函数 |
| `typings/` | TypeScript 类型定义 |
| `assets/` | 小程序内使用的图片资源 |
| `tools/` | 设计资产处理脚本（Python） |
| `docs/` | 项目文档：接口文档、联调说明、需求与进度 |

设计源文件（Sketch 等）体积较大，不入库，通过网盘 / GitHub Release 单独分发。

## 快速上手

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版）
2. 克隆仓库：

   ```bash
   git clone https://github.com/Tony230712-debug/guanchao-miniprogram.git
   ```

3. 打开开发者工具 → 导入项目 → 选择仓库根目录
4. 直接编译预览。AppID 已配置在 `project.config.json`；如提示无权限，请联系项目管理员将你的微信号加入开发者 / 体验成员

## 协作规范

- `main` 为保护分支，禁止直接推送，所有改动通过 Pull Request 合并
- 分支命名：新功能 `feat/<简述>`，修复 `fix/<简述>`
- 提交信息示例：`feat: 新增潮汐日历页面`、`fix: 修复社区图片加载失败`
- PR 需至少一人审查通过后方可合并
- `project.private.config.json` 与设计源文件不入库（见 `.gitignore`）
- 后端接口联调参见 `docs/观潮小程序接口文档.md` 与 `docs/前端联调说明.md`
