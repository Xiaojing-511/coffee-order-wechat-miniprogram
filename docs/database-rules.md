# 数据库权限规则（多租户安全）

在 **云开发控制台 → 数据库 → 各集合 → 权限设置 → 自定义安全规则** 中逐集合配置。

## 规则一览

| 集合 | 读 | 写 | 说明 |
|---|---|---|---|
| `drink_items` | 所有用户可读 | 仅云函数 | 公开菜单（顾客浏览） |
| `categories` | 所有用户可读 | 仅云函数 | 公开分类 |
| `stores` | 所有用户可读 | 仅云函数 | 店铺公开信息（店名/公告/地址等） |
| `orders` | 仅云函数 | 仅云函数 | 订单保密（防止顾客篡改/偷看他人订单） |
| `merchants` | 仅云函数/控制台 | 仅云函数 | 商家白名单保密 |
| `records` / `daily_reports` | 仅创建者 | 仅创建者 | 预留个人数据 |

## 规则粘贴模板

**drink_items / categories / stores**：
```json
{
  "read": true,
  "write": false
}
```

**orders / merchants**：
```json
{
  "read": false,
  "write": false
}
```

**records / daily_reports**：
```json
{
  "read": "auth.openid == doc._openid",
  "write": "auth.openid == doc._openid"
}
```

## 注意事项

1. 配置 `write: false` 后，客户端直写会被拒绝。本项目所有**写操作均已改为云函数**（`menu` / `order` / `storeQr`），客户端只读，不受影响。
2. **导入演示数据**请使用饮品页的「导入演示数据」按钮（走 `menu.seedDemo` 云函数），不要手动往集合里插文档。
3. 配置顺序建议：先部署全部云函数并验证功能，再收紧权限规则。

