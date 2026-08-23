# 宣传售卖落地页（landing）

对外售卖「疯狂咖啡 · 饮品点单 SaaS」的营销落地页，配色取自 Pinterest「Noire Coffee Landing Page」（pin 943293084481696762）：奶油 `#f0e0d0` / 深咖 `#201010` / 焦糖金 `#c09040` / 米白 `#f0f0f0`。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `index.html` | 单文件落地页（内联 CSS/JS，无外部依赖，可离线打开） |
| `qrcode.js` | 内嵌二维码生成库（MIT，Kazuhiko Arase），未配置小程序码时回退为「本页 URL 二维码」 |
| `img/mini-program-demo-code.png` | **小程序体验码**（需按下方步骤生成后放入），扫码直达演示店铺点单 |

## 扫码体验小程序（点单 SaaS 核心打通）

落地页 Hero 与 CTA 的「扫码体验点单」二维码指向**微信小程序演示店铺**，访客扫码即可在微信里直接点单体验，无需下载 App、无需注册登录。

### 体验路径（带体验参数）

| 项 | 值 |
| --- | --- |
| 页面路径 | `menu-pages/store-home`（店铺欢迎页：咖啡背景 + 店铺介绍 + 点单入口，点「开始点单」进菜单） |
| 场景参数（scene） | `storeId=S1001&src=landing`（共 23 字符，未超 32 字符上限） |
| 参数含义 | `storeId=S1001` 演示店铺；`src=landing` 标记体验来源，菜单页展示「官网体验店铺」提示条 |
| 页面要求 | `menu-pages/store-home` 不是 tabBar 页，符合小程序码页面要求 |

`S1001` 是平台演示店铺，运行 `migrate` 云函数后会自动写入演示分类与饮品（美式咖啡/拿铁/生椰拿铁/珍珠奶茶）。演示店的订单会进入 `S1001` 商家后台的订单列表，属测试订单。

### 生成小程序码（两种方式）

**方式 A：微信公众平台手动生成（推荐，无需写代码）**

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)（需小程序管理员/开发者权限）
2. 左侧菜单「工具」→「生成小程序码」
3. 页面路径填 `menu-pages/store-home`，场景参数填 `storeId=S1001&src=landing`
4. 生成后下载图片 → 保存为 `landing/img/mini-program-demo-code.png` → 重新部署落地页
5. 注意事项：
   - 工具生成的是**正式版**小程序码，需要小程序已发布（发布前请先用方式 B 或开发者工具预览测试）
   - 若小程序仅有体验版：把扫码测试者加入「体验成员」（公众平台 → 管理 → 成员管理 → 体验成员），体验版二维码在「开发 → 版本管理 → 体验版」获取（该码不带场景参数，落地页建议用正式版码）

**方式 B：云函数一键生成（随时可重新生成，适合换版后刷新）**

- 云函数 `storeQr` 新增 `demo` 动作：`event = { demo: true }`，仅平台创始人 openid 可调用
- 自动生成 `scene=storeId=S1001&src=landing` 的小程序码，上传云存储 `store-qr/landing-demo.png`，返回 `tempFileURL` 供下载
- 下载图片保存为 `landing/img/mini-program-demo-code.png` 即可
- 重新部署小程序后，用方式 B 重新生成一次，避免旧码指向旧版本

### 替换/回退机制

- 页面脚本顶部常量 `MINI_PROGRAM_QR = 'img/mini-program-demo-code.png'`，可改路径或留空
- 图片缺失时自动回退为「指向当前页面 URL 的二维码」，页面功能不受影响

## 部署（CloudBase 静态托管）

```bash
# 登录（任选其一）
cloudbase login --apiKeyId <SecretId> --apiKey <SecretKey>
# 或 CloudBase 环境 API Key
cloudbase login --cloudbase-api-key <key> -e cloud1-7gjfr85i3b664708

# 部署 landing 目录
cloudbase hosting:deploy landing -e cloud1-7gjfr85i3b664708

# 线上地址
# https://cloud1-7gjfr85i3b664708.tcloudbaseapp.com/
```

或用现成脚本：`bash scripts/deploy-landing.sh`（CloudBase Web 应用托管，先 `cloudbase login`）。

## 上线前请替换的占位内容

1. **客服微信**：`index.html` 中 CTA 区块的「CoffeeOrder-SaaS」替换为真实客服微信。
2. **套餐价格**：`#pricing` 区块按实际定价调整。
3. **小程序体验码**：按上文「扫码体验小程序」生成 `landing/img/mini-program-demo-code.png`；未放入前页面展示本页二维码兜底。
4. **品牌名**：默认「疯狂咖啡」，如需更名修改 `.brand-name` 与 footer。
5. **隐私政策**：footer 链接当前占位，指向小程序内隐私页；如需网页版请替换 href。

## 本地预览

直接双击 `index.html` 即可在浏览器打开（无需服务器，二维码功能同样可用）。
