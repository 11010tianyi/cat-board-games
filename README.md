# 猫猫棋局

黑色黄眼睛短毛田园猫和白色淡黄眼睛长毛田园猫主题的 SVG 下棋游戏合集。

## 玩法

- 五子棋：15 路连五，支持真人对弈和白猫 AI。
- 围棋：9 路简化吃子规则，支持停着、提子计分和白猫 AI。
- 象棋：双猫阵营的中国象棋，包含车马炮兵等走法，支持黑猫 AI。
- 跳跳棋：双猫对角跳跃，可连跳，支持白猫 AI。
- 大富翁：双猫掷骰、买地、收租，支持白猫 AI 自动回合。

所有棋局都支持侧栏“悔棋”按钮、键盘 `U` / `Z`、以及 `Cmd/Ctrl + Z` 撤回上一步；人机模式下会把玩家行动和 AI 应手作为同一步一起撤回。

侧栏可切换猫咪形象：

- 手绘猫：SVG 手绘棋子。
- 扣图猫：来自参考图的透明 PNG 猫咪头像棋子。
- 全家福猫：新增的卡通全家福头像棋子。

## 本地运行

```bash
bun install
bun run dev
```

## 构建

```bash
bun run build
```

GitHub Pages 会在 `main` 分支推送后自动部署到：

https://11010tianyi.github.io/cat-board-games/

## 移动端打包

项目已接入 Capacitor：

- Android 包名：`com.tianyi.catboardgames`
- iOS Bundle Identifier：`com.tianyi.catboardgames`
- App 名称：`猫猫棋局`
- 移动端 WebView 构建使用 `bun run build:mobile`，会把资源路径改成 App 可加载的相对路径。

常用命令：

```bash
bun run mobile:sync
bun run android:apk
bun run ios:sync
bun run ios:open
```

本机如未安装 Android SDK，可以使用 GitHub Actions 的 `Build Mobile Apps` workflow 生成 debug APK artifact。

### Android 本机打包

需要 JDK 17+ 和 Android SDK 36。工具链就绪后运行：

```bash
bun run android:apk
```

APK 输出位置：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS 打包到最后一步

需要完整 Xcode 和 Apple Developer 账号。资源同步后运行：

```bash
bun run ios:open
```

在 Xcode 中完成：

1. 选择 `App` target。
2. 打开 `Signing & Capabilities`。
3. 选择自己的 Team，确认 Bundle Identifier 是 `com.tianyi.catboardgames`。
4. 连接真机或选择 `Any iOS Device`。
5. 真机安装点 `Run`；上架/导出点 `Product > Archive`，再按 Organizer 提示 Distribute App。
