# PC 装机实验室 // 桌面端独立安装包构建指南 (Desktop Build Guide)

本项目已全面支持通过 **Electron + electron-builder** 编译打包为原生的桌面端应用程序。

无需配置 Python 后端或依赖外部网络，即可脱机运行高精度 3D 电脑主机装配与数字孪生实验室。

---

## 🌟 桌面端特性

1. **零外部运行时依赖**：彻底剥离庞大的 Python 环境，价格与目录网关直接由 Electron 主进程 IPC 安全高效平替。
2. **离线独立运行**：所有 3D 渲染、空间防穿模、水流仿真、硬件兼容诊断与智能配机算法 100% 本地运算。
3. **原生系统集成**：
   - 原生文件选择与保存对话框（支持自由保存 PDF / CSV / JSON 装机单至自定义磁盘路径）。
   - 数据安全持久化于用户应用数据目录 `app.getPath('userData')`（如 Windows 的 `%APPDATA%\PCForge\`）。
   - 窗口大小、位置与最大化状态智能记忆。
4. **硬核硬件加速**：针对 Three.js WebGL 与 WebAudio 进行专用底层 GPU 光栅化与内存零拷贝优化，保证 60FPS 满帧运行。
5. **标准 Windows 安装向导 (NSIS)**：
   - 纯中文安装引导向导。
   - 允许用户自定义软件安装路径。
   - 自动生成桌面快捷方式与开始菜单磁贴。
   - 提供标准控制面板卸载程序。

---

## 🛠️ 环境准备

- **操作系统**：Windows 10/11 (x64) 或 macOS (12+)
- **Node.js**：`>= 20.0.0`
- **npm**：`>= 10.0.0`

---

## 🚀 开发与打包命令

### 1. 桌面端热重载开发 (Dev Mode)
```powershell
# 安装依赖 (首次运行)
npm install

# 启动桌面端开发模式 (Vite + Electron 热更新)
npm run dev:desktop
```
执行后将自动启动本地 Vite 服务，并拉起 Electron 桌面应用窗口。对前端代码的修改均可触发实时 HMR 热更新。

---

### 2. 编译 Windows 安装程序 (.exe)
```powershell
# 编译前端生产包、构建 Electron 脚本并生成 NSIS 安装程序
npm run build:win
```
- **生成产物目录**：`dist-desktop/`
- **安装包文件**：`PC装机实验室 Setup 1.0.0.exe`（单文件中文图形化安装程序）
- **便携绿色免安装版**：`dist-desktop/win-unpacked/PC装机实验室.exe`

---

### 3. 编译 macOS 安装镜像 (.dmg)（在 macOS 环境下执行）
```bash
npm run build:mac
```
- **生成产物目录**：`dist-desktop/`
- **安装包文件**：`PC装机实验室-1.0.0.dmg`

---

## 📂 数据持久化路径说明

桌面端用户的私有配置单与自定义硬件录入数据**严格隔离于应用安装目录**，保存在操作系统标准的应用数据区：

- **Windows**：
  `C:\Users\<用户名>\AppData\Roaming\PCForge\user_data\`
- **macOS**：
  `~/Library/Application Support/PCForge/user_data/`

在此目录下，系统自动维护：
- `user_builds_state.json`：用户保存的配置单、配件对比槽位、全机定制方案。
- `window-state.json`：窗口尺寸、坐标与最大化记录。

---

## ❓ 常见问题排查 (FAQ)

### Q1: 在国内网络环境下打包时，下载 Electron 或 NSIS 较慢怎么办？
可在命令行中配置国内镜像加速环境变量：
```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run build:win
```

### Q2: 安装程序未签名出现 SmartScreen 提示？
开源自编译安装包由于未购买商业数字签名证书（EV Code Signing Certificate），Windows Defender 可能弹出“未知发布者”提示。点击**“更多信息” -> “仍要运行”**即可正常安装。

### Q3: 原有的 Web 运行方式是否受影响？
完全不受影响！
- 运行 Web 开发模式：`npm run dev`
- 运行 Web 生产打包：`npm run build`
两者均 100% 独立保留。
