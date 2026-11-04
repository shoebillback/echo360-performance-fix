# Echo360 Performance Fix

A small Tampermonkey userscript that avoids repeated rebuilding of Echo360’s unchanged static global stylesheet.

[安装 / Install](https://raw.githubusercontent.com/shoebillback/echo360-performance-fix/main/echo360-static-global-style-fix.user.js) · [中文说明](#中文说明) · [English](#english)

## 中文说明

### 解决什么问题

在已测试的 Echo360 播放器版本中，静态全局样式每次渲染都会先被删除，再通过 CSS 解析器重新解析并插入。样式内容包含基础排版、字体声明及页面默认外观。即使 CSS 规则总数变化不大，这种重复工作也可能造成较高的主线程占用。

本脚本仅处理已核实的模块 `867`：确认导出的全局样式为静态样式，在同一样式表中成功渲染且规则仍存在时，跳过重复重建。组件卸载、样式被移除或切换样式表后，允许重新生成。

### 安装

1. 安装 Tampermonkey，并按扩展提示允许用户脚本运行。
2. 点击上方“安装 / Install”，确认安装脚本。
3. 禁用旧的 Echo360 Progress CSS Fix（v0.1、v0.2、v0.2.1），仅启用本脚本。
4. 刷新 Echo360 课程页面并播放。

当前匹配范围为 `https://echo360.org.uk/lesson/*`。其他地区域名和播放器版本尚未验证，不会自动启用。

### 验证

在开发者工具 Console 执行：

```javascript
Echo360GlobalStyleFix.status()
```

预期 `factoryPatched` 和 `stylePatched` 为 `1`，播放时 `skipped` 增长，而 `rebuilds` 基本稳定。若未匹配成功，脚本不会尝试修改其他模块。

临时恢复原始样式重建行为：

```javascript
Echo360GlobalStyleFix.disable()
```

重新开启：

```javascript
Echo360GlobalStyleFix.enable()
```

完全移除补丁：在 Tampermonkey 中禁用脚本，再刷新页面。`disable()` 保留加载拦截及统计包装。

### 已观察到的结果

以下结果来自单个 Windows / Chrome 156 环境的两次 Performance 录制，不是多设备基准测试，也不是操作系统 CPU 使用率。

| 指标（按采样时长归一化） | 修复前 | 开启后 |
| --- | ---: | ---: |
| CSS 解析 `se()` 自身采样耗时 | 538 ms/秒 | 0.032 ms/秒 |
| `insertRule` 自身采样耗时 | 61.8 ms/秒 | 0.46 ms/秒 |
| 主线程非空闲采样比例 | 86.6% | 19.7% |

另一次开关测试中，关闭时 112 次全局样式请求产生 112 次重建；开启时 114 次请求全部复用，重建为 0。两段录制的操作状态不同，不能将这些比例视为所有设备上的预期收益。

### 兼容性与限制

- 已测试播放器资源：`6f4efdc0188459a905b6e1a627d0f559-echoPlayerV2FullApp.react-bundle.js`。
- 模块编号及其源码特征可能随 Echo360 更新而改变；脚本会检查特征，无法匹配时跳过。
- 不修改视频解码、倍速、播放进度精度或字幕内容。
- 不发送网络请求，不上传浏览记录、课程信息或性能记录。
- 这是独立社区补丁，与 Echo360 无隶属关系。请实际验证全屏、布局切换、进度拖动和字幕显示。

## English

### What it fixes

In the tested Echo360 build, a static global-style component removes and recreates its stylesheet on each render. Repeated CSS parsing and rule insertion caused substantial main-thread work in the observed environment.

This userscript checks the known application global-style module (`867`) and wraps only its static style instance. It reuses a successfully rendered stylesheet while the style ID remains present. Removal, unmounting, or a different stylesheet allows rebuilding again. It does not change the CSS parser globally.

### Install and verify

Install Tampermonkey, open the **Install** link above, disable previous Echo360 Progress CSS Fix scripts, and reload the lesson page. Only `https://echo360.org.uk/lesson/*` is currently supported and tested.

Run `Echo360GlobalStyleFix.status()` in the browser console. Both patch counters should be `1`; `skipped` should grow during playback. Use `.disable()` and `.enable()` for comparison. Disable the userscript and reload to remove all hooks.

The table above reports observations from one Windows / Chrome 156 environment. Recording lengths and user activity differed. These are CPU-profile sample measurements, not OS CPU percentages or cross-device guarantees. The script may stop matching after a site update.

No telemetry or external requests are added. No course data, account data, or raw performance traces are included in this repository. Unofficial and unaffiliated with Echo360.

## Development

Node.js 18 or later; no dependencies:

```sh
node --check echo360-static-global-style-fix.user.js
node --test tests/global-style.test.cjs
```

Tests simulate the loader and stylesheet lifecycle. They do not replace testing against the live Echo360 player.

## License

MIT. See [LICENSE](LICENSE).
