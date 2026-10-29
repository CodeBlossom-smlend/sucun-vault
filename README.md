# 速存

一款本地加密的快捷密码保存应用。**当前交付 macOS Apple Silicon 版本**；Windows 版本按用户要求留待后续完成。应用启动后留在菜单栏；默认按 **Command + Shift + P** 打开小窗口，也可以在设置中改键位。列表区域支持滚轮和触控板滚动，顶部搜索与保存按钮保持可见。

> 本项目尚未接受独立安全审计。当前 macOS 安装包未签名，适合本地体验；公开分发前需要完成签名、公证和相应验证。

## 功能

- API 密钥：标题、密钥；一键复制密钥。
- 账号密码：标题、账号、密码；账号和密码各有独立复制按钮。
- 待办事项：标题、可选说明、到期日期；所选日期结束后的下一个本地零点删除。
- 首次使用设置主密码。日常可用 Mac Touch ID 解锁，也可以始终用主密码。
- 将加密文件导出为 `.sucun` 备份，在另一台电脑用主密码导入。
- 复制敏感值后，如果剪贴板内容未被再次修改，30 秒后自动清空。

## 本地数据与安全

记录保存在 Electron 应用数据目录的 `vault.enc`，采用 scrypt 派生密钥与 AES-256-GCM 加密。主密码不会写入文件。加密备份可以复制到其他电脑，并用主密码恢复。

快速解锁所需的密钥副本由操作系统加密后保存在本机。当前 macOS 版本使用 Keychain；指纹图像由操作系统管理，应用只接收验证结果。主密码是跨电脑恢复的唯一凭据；忘记后无法从备份恢复。macOS 发布版本应保持稳定的代码签名，以免 Keychain 在更新后反复要求授权。参考：[Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)、[Apple Local Authentication](https://developer.apple.com/documentation/localauthentication)。

应用在启动、休眠恢复、打开窗口及本地零点检查过期待办。若系统加密不可用且应用处于锁定状态，待办会在下次输入主密码解锁时清理。

## 开发

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

Mac 开发命令会启动 Vite 和 Electron。应用初始隐藏在菜单栏；点击托盘图标或按默认快捷键打开。修改主进程 TypeScript 后需要重启 `npm run dev`，渲染进程由 Vite 热更新。

```bash
npm test
npm run format:check
npm run typecheck
npm run build
npm run package:mac
```

macOS 安装包输出在 `release/`。未签名的开发包可用于本地测试，但 Touch ID 和 Keychain 行为应在稳定签名的发布包上复测。

### 后续 Windows 构建与 Windows Hello

以下是后续开发预留的源码与构建步骤，**当前没有 Windows 安装包，也没有完成 Windows Hello 实机验证**。Windows Hello 适配代码使用 Microsoft 的 [dynwinrt](https://github.com/microsoft/dynwinrt) 调用系统 `UserConsentVerifier`。构建 Windows 版需要 Windows 11、Windows SDK 中的 `Windows.winmd`，以及 NuGet 包 `Microsoft.Windows.SDK.Win32Metadata` 中的 `Windows.Win32.winmd`。后者应位于默认 NuGet 缓存，或通过 `DYNWINRT_WIN32_WINMD` 环境变量指定。可在临时目录运行 `dotnet new classlib`，再运行 `dotnet add package Microsoft.Windows.SDK.Win32Metadata --prerelease` 将其放入 NuGet 缓存。生成脚本以 [Microsoft 的 Electron 示例](https://github.com/microsoft/dynwinrt/tree/main/samples/js/windows-hello) 为参考。

在 Windows 上运行：

```powershell
npm install
npm run generate:windows
npm run dev:win
npm run package:win
```

`generate:windows` 生成系统 API 绑定到 `windows-generated/`。`package:win` 会再次执行生成步骤并在 `release/` 输出安装包。Windows Hello 需要当前用户已在系统设置中配置；没有配置时可使用主密码。Windows 10 可使用主密码，但 Windows Hello 桌面窗口交互需要 Windows 11 的系统 API。

本仓库在 macOS 开发。Windows 安装包和 Windows Hello 的实际运行仍需要在 Windows 设备上验证。

## 参与贡献与许可

贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。项目以 [MIT 许可证](LICENSE) 发布。
