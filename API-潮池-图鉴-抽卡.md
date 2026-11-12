# 潮池 / 图鉴分类 / 卡包抽卡 前端接口说明

> 版本：V1.0　日期：2026-11-12
> 对应分支：前端 `feature/aquarium`，后端 `feat/encyclopedia-unlock`
> 完整后端文档在 `guanchao-backend/docs/API-v2.md` 第十六节；本文只列前端需要接的部分。

## 1. 约定

- Base URL：`https://www.blueakaiwu.cn/api/v1`
- 需要登录的接口带 `Authorization: Bearer <accessToken>`
- 图鉴列表/详情游客可读；潮池、代币、卡包需要登录
- 统一响应：`{ code, message, data, requestId }`，`code=0` 表示成功
- `utils/http.ts` 已有 `get/post/put/upload/delete`

## 2. 潮池生物

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/aquarium/residents` | 我的潮池生物 |
| POST | `/aquarium/residents` | 新增生物 |
| PUT | `/aquarium/residents/{id}` | 改大小 / 旋转 |
| DELETE | `/aquarium/residents/{id}` | 删除单个 |
| DELETE | `/aquarium/residents` | 清空 |

新增请求：

```json
{
  "name": "沙蟹",
  "kind": "crab",
  "objectKey": "private/user_xxx/aquarium/up_xxx.png",
  "uploadId": "up_xxx",
  "sourceUploadId": "up_appeal_xxx",
  "speciesName": "招潮蟹",
  "aspect": 0.72,
  "scale": 1.0,
  "rotation": 0,
  "baseFlip": false
}
```

- `objectKey` / `uploadId` 二选一
- `sourceUploadId` 只有「从申诉记录加入」时传
- `scale` 0.5~1.8，`rotation` -180~180
- `speciesName` 用审核返回的物种名；同账号同物种只发一次代币

返回：

```json
{
  "id": "ar_xxx",
  "name": "沙蟹",
  "kind": "crab",
  "url": "https://...",
  "objectKey": "private/user_xxx/aquarium/xxx.png",
  "aspect": 0.72,
  "scale": 1.0,
  "rotation": 0,
  "speciesName": "招潮蟹",
  "baseFlip": false,
  "createdAtMs": 1760000000000,
  "createdAt": "2026-11-12T10:00:00+08:00",
  "coinsAwarded": 20,
  "coins": 120
}
```

`PUT /aquarium/residents/{id}`：

```json
{ "scale": 1.2, "rotation": 90 }
```

## 3. 潮池外观

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/aquarium/settings` | 背景 / 主题 / 横竖版 |
| PUT | `/aquarium/settings` | 修改设置 |
| POST | `/aquarium/background` | 上传自定义背景（multipart） |

`GET /aquarium/settings`：

```json
{
  "backgroundKey": "private/user_xxx/aquarium-bg/bg_xxx.jpg",
  "backgroundUrl": "https://...",
  "theme": "day",
  "landscape": false
}
```

`PUT /aquarium/settings` 可传：

```json
{ "theme": "night", "landscape": true, "backgroundKey": "" }
```

`backgroundKey` 传空字符串表示恢复默认背景。

`POST /aquarium/background` 成功：

```json
{ "ok": true, "status": "approved", "uploadId": "bg_xxx", "backgroundKey": "...", "backgroundUrl": "..." }
```

被拒：

```json
{ "ok": false, "status": "rejected", "rejectReason": "含二维码", "uploadId": "bg_xxx" }
```

背景只审合法合规，不要求是海洋/风景。

## 4. 抠图

`POST /aquarium/cutout` 新增表单字段：

- `engine=local`（默认，本地 u2net）
- `engine=ai`（千问图像编辑精修，按张计费，每天 20 次）

`POST /aquarium/cutout/{upload_id}?engine=ai` 也支持。

`engine=ai` 失败不会静默回退，前端保留原贴纸并提示。

## 5. 申诉记录

`GET /uploads/mine?scene=aquarium&appealedOnly=1`

只返回用户点过申诉的记录，新增字段 `usedAt`：

```json
{ "usedAt": "2026-11-12T10:00:00Z" }
```

前端展示：

| 状态 | 展示 | 操作 |
|---|---|---|
| `appealed` | 复核中 | 无 |
| `approved` + `usedAt` 为空 | 已通过 | 「加入潮池」 |
| `approved` + `usedAt` 非空 | 已加入潮池 | 无，禁止二次加入 |
| `rejected` | 未通过 | 无 |

从申诉记录加入时，新增生物要带 `sourceUploadId`；后端会拒绝第二次。

## 6. 图鉴分类

`GET /encyclopedia?category=forage|physical|tech|other_marine`

- `forage` = 原 `shell/crab/algae/fish/other` 并集，即「赶海生物」
- `physical` 物理海洋
- `tech` 海洋科技
- `other_marine` 其他海洋生物

详情 `GET /encyclopedia/{id}` 新增 `summary`，`category` 原样返回。

前端一级分类：赶海生物 / 物理海洋 / 海洋科技 / 其他海洋生物 / 我的收藏；赶海生物下保留贝类/蟹类/海藻/鱼类/其他二级筛选。

新图鉴条目暂无封面，前端用分类色块占位。

## 7. 代币和卡包

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/wallet` | 代币余额 |
| POST | `/gacha/draw` | 100 代币抽一包 |

`GET /wallet`：

```json
{ "coins": 120 }
```

第一次打开钱包：补发历史成就代币并送 100 起始代币；管理员设置过代币的账号不再补发。

`POST /gacha/draw`：

```json
{
  "coins": 20,
  "cost": 100,
  "cards": [
    { "id": "sp_rov", "name": "水下机器人", "category": "tech", "summary": "...", "coverUrl": "" }
  ],
  "remaining": 12
}
```

- 每包最多 3 张，只抽三类新图鉴的未点亮项
- 抽到即写入图鉴点亮
- 代币不足 / 卡池集齐返回 400，前端提示即可

代币来源：

| 来源 | 代币 |
|---|---|
| 潮池加入新物种 | +20（每账号每物种一次） |
| 成就 common / rare / epic / legendary / hidden | +20 / +50 / +100 / +200 / +80 |
| 首次打开钱包 | +100 |

## 8. 管理后台

`GET /admin/users` 用户项新增 `coins`。

`POST /admin/users/{user_id}/coins`：

```json
{ "coins": 500 }
```

范围 0~1,000,000。设置后会标记 `coins_seeded=true`，钱包不再补发。

## 9. 前端文件

- `utils/aquariumStore.ts`：账号同步、设置、大小/旋转、删除
- `utils/http.ts`：新增 `put`
- `pages/aquarium/aquarium.*`：潮池、管理面板、长按调整、背景/昼夜/横版
- `pages/aquarium-add/aquarium-add.*`：直接选图、抠图、旋转、加入潮池
- `pages/aquarium-audit/aquarium-audit.*`：申诉记录
- `pages/card-pack/card-pack.*`：卡包页
- `pages/wiki/*`、`pages/wiki-detail/*`：分类与科普详情
- `pages/home/*`：卡包入口

## 10. 注意

- 新页面已注册到 `app.json`：`pages/aquarium-audit/aquarium-audit`、`pages/card-pack/card-pack`
- 卡包入口只在首页；图鉴和「我的」页入口已删
- 潮池页锁竖屏；横版是全屏内容旋转 90°，需要真机测试
- 注销账号会清理潮池、图鉴点亮、代币记录等关联数据
