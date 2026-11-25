# Agency 专家库面板（DSH 插件）

给 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）用的侧栏面板：按分类浏览、搜索、开关 **283 个 agency skill**。

核心价值一句话：**关掉的 skill 不再注入 `catalog`，省的是每一轮的固定 token 开销。**

![panel](https://img.shields.io/badge/skills-283-blue) ![license](https://img.shields.io/badge/license-MIT-green)

---

## 它解决什么问题

装上 [agency-agents](https://github.com/msitarzewski/agency-agents) 的 283 个 skill 之后，它们会整包注入系统提示，成为每轮的固定成本。全都要用的人不多，但一个个去改 `SKILL.md` 太笨。

这个面板做的事很简单：**把「改哪一行 frontmatter」变成点一个开关。**

## 功能

- **18 个分类**侧栏筛选（工程研发、专业专项、市场营销…），带数量
- **搜索**：同时匹配 slug、中文名、中文描述、英文原文、分类名；空格分词后逐词 AND（「抖音 策略」是收窄，不是放大）；全角/半角等价；结果实时计数，`Esc` 清空
- **单个开关**：即时生效，落盘到 `state.json` + 文件 frontmatter
- **分类级批量** / **全部开启** / **全部关闭**（两段式确认，防误触）
- **省下的 token** 实时估算
- 全中文界面，可切英文

## 安装

```bash
# 在 DSH 里，把本仓库目录作为 bundle 安装
plugin_manager install_bundle <本仓库绝对路径>
```

或者写进 profile 的 `package.json` 依赖并用 `link:` 指过来（`dsh.bundle.patch` 已声明，DSH 会自动挂载）。

装完后侧栏「更多」下会出现 **Agency 专家库**。

> 前置条件：先装好 agency-agents 的 283 个 skill（`~/.dsh/skills/agency-*/SKILL.md`）。面板扫的是这两个目录：`$DSH_HOME/skills` 与 `~/.agents/skills`。

## 开关到底怎么生效的

面板**不碰 catalog**，走的是 Harness 自己的机制：

- `dsh-tool-skill` 注入时按 `snapshot.skills.filter(isModelInvocable)` 过滤
- `dsh-skill-filesystem` 把 frontmatter 的 `disable-model-invocation: true` 解析成 `modelInvocable: false`

所以面板只做一件事：**改写那个 skill 文件 frontmatter 的那一行**。文件 watcher 看到写入 → provider 缓存失效 → 下一步重渲染时它就不在 catalog 里了。

两层状态，故意的：

| 层 | 位置 | 作用 |
|---|---|---|
| 持久意图 | `~/.dsh/agency-skill-panel/state.json` | 重装技能后依然记得你关了哪些 |
| 实时生效 | 每个 `SKILL.md` 的 frontmatter | 真正决定它是否进 catalog |

激活时会把 `state.json` 重新套到文件上，所以跑一遍上游的 `convert.sh` / `install.sh` 覆盖了 frontmatter，也不会把关掉的技能全悄悄打开。

## HTTP 接口

`/agency-skill-panel/api/*`，走 Harness 的 `connection.requestRejection` 鉴权（未认证一律 401/403）。

| 路由 | 方法 | 说明 |
|---|---|---|
| `/state` | GET | 全部 skill + 分类统计 |
| `/toggle` | POST | `{slug, disabled}` 单个开关 |
| `/bulk` | POST | `{slugs[], disabled}` 批量 |
| `/sync` | POST | 按 `state.json` 重新套一遍到文件 |

slug 走白名单校验（`agency-` 前缀、不含 `/` `\` `..`），拒绝路径穿越。

## 踩过的坑（都修了，写在这里省你时间）

### 1. 重启后必 404

这是本项目最贵的一课。

```js
// 旧代码（错的）
export const inject = ['skills'];            // 硬依赖：services 不存在 → 插件永久 pending
ctx.inject(['webServer'], (webCtx) => {
  const connection = webCtx.get('connection');
  if (connection === undefined) return;      // 取不到就永久放弃，无重试
  webCtx.webServer.register({ ... });
});
```

两个独立缺陷叠成同一个症状：

1. **`inject = ['skills']` 是硬依赖**。如果那个 profile 的 `skill-filesystem` / `tool-skill` 是 inactive，`skills` 服务根本不存在 → 整个插件永久 pending，`apply()` 一次都不执行。
2. **重启后 `connection` 晚于 `apply` 就绪**。实测探针记录：`APPLY webServer=ok connection=MISSING`。旧代码一次判空就 `return`，之后永不重试 → 路由没注册 → 面板全 404。

阴险之处：**热重载时 `connection` 恰好已经在**，所以改完代码刷新页面一切正常，一重启就复发。

现在的做法：

```js
export const inject = [];                    // 面板直接扫盘读 SKILL.md，不需要 skills 服务

const mountApi = () => {
  const webServer = ctx.get('webServer');
  const connection = ctx.get('connection');
  if (webServer === undefined || connection === undefined) return false;
  ctx.effect(() => webServer.register({ ... }), 'api routes');
  return true;
};
if (!mountApi()) {
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (mountApi() || tries > 100) clearInterval(timer);   // 100ms × 100 = 最多等 10s
  }, 100);
  ctx.effect(() => () => clearInterval(timer), 'api mount retry');
}
```

### 2. 搜索：三层问题，各修一次

搜索是这块面板最容易出问题的地方，改了三版才收敛。

**第一层 · 子串误命中。** 最初用裸 `includes()`，两字母查询会命中单词中间——搜 `ui` 拿到 `b(ui)lder`、`recr(ui)tment`，10 条里 6 条是假的。改成按词元切分（非字母数字 + 驼峰断词），拉丁词要求整词命中。保留两条豁免：1 字符允许前缀匹配（打 `u` 还能找到 UI）、3+ 字符允许前缀匹配（`devel` → developer）。

**第二层 ·「含非 ASCII」不等于「是中文」。** 修完还有噪声，因为判断「字段是不是中文」用错了方法。94 条英文描述里带破折号 `—`，还有一批夹了 1 个中文字（`B站`、`等保`），整条被误判成中文走子串分支，于是 `community b(ui)lding`、`R(ui)jie`、`Fl(ux)UI` 全中。改成 CJK 用真汉字正则 `[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]`，且混排字段里的拉丁词必须落在**词边界**上。

**第三层 · 名称、分类、描述被同等对待。** 搜「设计」有 21 条不相关——它们是「系统设计」「边界设计」「实验设计」，那个「设计」是动词，不构成身份。所以：名称/slug/分类命中算**高权重**，仅描述命中算**低权重**；高权重 ≥ 3 条时只显示高权重，不足 3 条才追加低权重（否则 `抖音`、`wechat` 这类极少出现在名称里的词会显示 0 条）。

**第四层 · 中文输入法吞字**（独立问题）。受控 input 在组词期被 React 回写旧值，英文能打、中文打不了。改成非受控 `defaultValue` + `ref`，`onInput` 里判 `event.nativeEvent.isComposing` 跳过组词中间态，`onCompositionEnd` 再同步。另加 `NFKC` 归一化、实时命中数、`×` 清空（`Esc` 也行）。

实测（283 条真实数据）：`ui`→4、`设计`→18（全真设计岗）、`开发`→35、`地理`→14、`api`→12、`wechat`→5、`抖音`→2、`市场营销 数据分析`→0。

### 3. 前缀路由带尾斜杠 = 永远 404

`webServer` 的匹配是 `pathname === prefix || pathname.startsWith(prefix + '/')`。注册路径写成 `'/x/api/'` 只可能匹配到双斜杠。

### 4. Host 模块按 URL 缓存

改完 `host.js`，刷新页面、`set_plugin` 关再开，都**不会**重新 import——Host 一直跑安装那一刻的代码。要换一个目录（新 URL）重装，或重启 DSH。

### 5. 写文件别过 PowerShell

`Set-Content -Encoding UTF8` 会写 BOM 并把中文写成乱码（「专家库」→「涓撳搴?」）。BOM 会让浏览器端 `window.__ModuleLoader__.load({...})` 前面多三个字节，整个模块解析失败。用编辑器或 Python 写。

## 自测

```bash
node test-host.mjs      # 19 项，全部离线，不依赖 DSH
```

覆盖：加标志 / 保留 body / 保留其他 frontmatter / 幂等 / 开关互转 / 无 frontmatter 拒绝 / CRLF 保持 / 路由解析（含尾斜杠回归）。

## 已知限制

- 中文名与描述是**静态翻译**，存在 `catalog.zh.json`。上游新增 agent 后需要补译，否则回退显示英文原文
- token 估算按描述字符数 /2.4，只看量级，不是精确计数
- 只识别 `~/.dsh/skills` 与 `~/.agents/skills` 两个根；项目级 `.dsh/skills` 里的 `agency-*` 不显示
- 中文翻译覆盖 283 条原文，上游若改描述，译文不会自动跟着变

## 目录

```
host.js               Host 半边：扫盘、frontmatter 读写、HTTP 路由
client.js             Client 半边：sidebar.panellist + main 两个 slot
catalog.zh.json       283 条中文名/描述 + 18 分类名 + divisionOf 映射
cordis.patch.yml      bundle 挂载声明
locale/{zh,en}.json   插件元信息文案
icon.svg              侧栏图标
test-host.mjs         离线自测
```

## License

MIT。`catalog.zh.json` 是 [agency-agents](https://github.com/msitarzewski/agency-agents)（MIT, Copyright (c) 2025 AgentLand Contributors）描述文本的中文译本，按同许可分发，详见 [LICENSE](./LICENSE) 的 Third-party notices。
