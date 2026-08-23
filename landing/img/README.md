# landing/img 说明

本目录存放落地页用到的图片资源。

## mini-program-demo-code.png（小程序体验码）

落地页 Hero 与 CTA 两个「扫码体验点单」二维码展示的就是这张图。

**生成方式（任选其一）：**

1. **微信公众平台手动生成（推荐）**
   - 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com) → 左侧菜单「工具」→「生成小程序码」
   - 页面路径填：`menu-pages/store-home`
   - 场景参数填：`storeId=S1001&src=landing`
   - 生成后下载图片，命名为 `mini-program-demo-code.png` 放在本目录
   - 注意：该工具生成的是**正式版**小程序码，小程序需先发布；若只是体验版，需把扫码者加入「体验成员」

2. **云函数一键生成**
   - 小程序内调用云函数 `storeQr`（`event.demo = true`，仅创始人 openid 可用）
   - 返回 `tempFileURL`，浏览器打开即可下载图片，存为本目录的 `mini-program-demo-code.png`

**不放入此图时**：落地页会自动回退为「指向当前页面 URL 的二维码」，页面功能不受影响。
