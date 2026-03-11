# macOS Signing Setup

> 文档状态：当前有效的 macOS 签名补充文档。
>
> 这份文档只用于签名与 notarization 材料准备。
> 如涉及当前产品行为、交互或实现状态，请以 [../technical-documentation.md](../technical-documentation.md) 为准。


这份文档说明如何为桌面端 v1.0 准备 macOS 正式分发所需的签名与 notarization 材料。

## 结论

我已经能替你生成：
- 私钥
- CSR（证书签名请求）
- 本地与 CI 的校验脚本
- GitHub Actions 发布流程

我不能替你直接生成：
- `Developer ID Application` 证书
- Apple notarization 凭据

原因很直接：这两者必须由 Apple Developer 账号签发或绑定。

## 当前仓库状态

仓库内已具备：
- macOS entitlements
- 发布环境变量校验脚本
- 本地 macOS 打包脚本
- GitHub Actions Draft Release 工作流

相关文件：
- `build/entitlements.mac.plist`
- `build/entitlements.mac.inherit.plist`
- `scripts/check-macos-release-env.mjs`
- `scripts/generate-macos-signing-materials.sh`
- `.github/workflows/release.yml`

## 1. 生成本地私钥和 CSR

执行：

```bash
./scripts/generate-macos-signing-materials.sh
```

默认输出：
- `certs/macos/developer-id.key.pem`
- `certs/macos/developer-id.csr.pem`

自定义输出目录和 CSR 名称：

```bash
./scripts/generate-macos-signing-materials.sh ./certs/macos "Your Legal Entity Name"
```

## 2. 在 Apple Developer 创建证书

进入 Apple Developer 后台，创建：
- `Developer ID Application`

上传刚生成的 CSR：
- `certs/macos/developer-id.csr.pem`

Apple 签发后，下载 `.cer` 文件。

## 3. 导出 .p12 证书

在 macOS 上操作：
1. 双击 `.cer` 导入 Keychain Access
2. 找到对应的 `Developer ID Application` 证书和私钥
3. 导出为 `.p12`
4. 为 `.p12` 设置导出密码

## 4. 配置 GitHub Secrets

至少需要：
- `CSC_LINK`
- `CSC_KEY_PASSWORD`

其中：
- `CSC_LINK` 推荐放 Base64 或受保护下载链接
- `CSC_KEY_PASSWORD` 是导出 `.p12` 时设置的密码

notarization 三选一：
- `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
- `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`
- `APPLE_KEYCHAIN_PROFILE`

## 5. 先在本地校验发布环境

```bash
npm run release:check:mac
```

## 6. 正式发布

推送标签：

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions 会：
- 构建 macOS / Windows / Linux 安装包
- 将产物上传到 Draft Release

## 7. 当前 GitHub 仓库信息

当前已配置 GitHub 远程仓库：
- `https://github.com/beyond-snail/ai-desk-pet.git`

本地仓库和 `package.json.repository` 已对齐到这个地址。
