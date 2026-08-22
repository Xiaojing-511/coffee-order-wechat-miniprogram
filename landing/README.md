# 宣传售卖落地页（landing）

对外售卖「疯狂咖啡 · 饮品点单 SaaS」的营销落地页，配色取自 Pinterest「Noire Coffee Landing Page」（pin 943293084481696762）：奶油 `#f0e0d0` / 深咖 `#201010` / 焦糖金 `#c09040` / 米白 `#f0f0f0`。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `index.html` | 单文件落地页（内联 CSS/JS，无外部依赖，可离线打开） |
| `qrcode.js` | 内嵌二维码生成库（MIT，Kazuhiko Arase），页面加载后生成指向**当前页面 URL** 的二维码 |

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

## 上线前请替换的占位内容

1. **客服微信**：`index.html` 中 CTA 区块的「CoffeeOrder-SaaS」替换为真实客服微信。
2. **套餐价格**：`#pricing` 区块按实际定价调整。
3. **小程序码**：页面二维码当前指向落地页自身 URL（方便转发/扫码打开本页）；如需放「点单小程序码」，可用小程序 `storeQr` 云函数生成后替换 `#heroQr` / `#ctaQr` 容器内容。
4. **品牌名**：默认「疯狂咖啡」，如需更名修改 `.brand-name` 与 footer。
5. **隐私政策**：footer 链接当前占位，指向小程序内隐私页；如需网页版请替换 href。

## 本地预览

直接双击 `index.html` 即可在浏览器打开（无需服务器，二维码功能同样可用）。
