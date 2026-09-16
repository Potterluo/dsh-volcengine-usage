# dsh-volcengine-usage

DeepSeek Harness (DSH) Web GUI 内的**火山引擎网关额度消耗面板**：实时展示 Token 用量、Credit 估算、可配置的日/周/月限额，自动发现 DSH 中的 provider 配置，无需任何手动设置。

![screenshot](docs/screenshot.png)

---

## 功能特性

- **自动发现配置** — 自动扫描 DSH `settings.yaml` 中的所有网关 provider（`llm-pi-ai.providers.*` 或直接风格），无需手动配置
- **实时 KPI** — 输入 Tokens（未缓存/缓存/输出）、请求数、缓存命中率
- **Credit 精确估算** — 按日分段 × 模型生效系数 ÷ 1e6，与 [BlueRegion Usage](https://github.com/blue-region/BlueRegionUsage) 同款算法
- **限额徽章** — 可配置日提醒/日预警/日封禁、周封禁、月封禁，安全绿 → 预警黄 → 超限红
- **周期切换** — 今日/本周/本月，60 秒自动刷新
- **主题适配** — 使用 DSH 平台 CSS 变量（`--dsw-alias-*`），自动适配浅色/深色/自定义主题
- **点击外部收起** — 平滑开合动画与高度过渡
- **零额外凭证** — 复用 DSH 现有凭证服务读取 API Key，不引入新的配置面

## 安装

```bash
dsh plugin --profile desktop add github:YOUR_USERNAME/dsh-volcengine-usage
```

或手动方式：

```bash
git clone https://github.com/YOUR_USERNAME/dsh-volcengine-usage.git
cd dsh-volcengine-usage
pnpm install
```

然后将 `dsh-volcengine-usage` 加入 profile 的 `dsh.profile.bundles` 列表，重启 DSH Desktop。

## 使用

安装并重启后，点击页面右下角的 **闪电 ⚡ 图标** 即可展开悬浮面板。

面板包含：

| 区块 | 说明 |
|------|------|
| **连接徽标** | 网关正常响应时显示绿色「已连接」 |
| **周期切换** | 今日 / 本周 / 本月 |
| **Token KPI** | 未缓存输入、缓存输入、输出、请求数、缓存率 |
| **Credit 卡片** | Credit 估算用量、进度条、限额徽章 |
| **模型 TOP5** | 按 Token 用量排名的前 5 个模型 |

### 配置限额

点击 Credit 卡片下方的 **⚙ 配置** 按钮可自定义限额（保存在浏览器 localStorage）：

| 限额 | 默认值 | 说明 |
|------|--------|------|
| 日提醒 | 360 | 黄色阈值 |
| 日预警 | 480 | 橙色阈值 |
| 日封禁 | 600 | 红色阈值 |
| 周封禁 | 2500 | 周维度封禁 |
| 月封禁 | 5000 | 月维度封禁 |

## 工作原理

```
┌───────────────────────────────────────────────────┐
│  浏览器（DSH Web GUI）                             │
│  ┌────────────────┐    ┌───────────────────────┐   │
│  │  client.js      │ ←→ │  /volcengine-usage/   │   │
│  │  (悬浮面板)      │    │  proxy (Node 半部)     │   │
│  └──────┬─────────┘    └──────────┬────────────┘   │
└─────────┼──────────────────────────┼───────────────┘
          │                          │
          ▼                          ▼
   ┌──────────────┐         ┌──────────────────┐
   │ DSH 设置       │         │ 火山引擎 API 网关  │
   │ (settings.yaml│         │ /v1/usage/*      │
   │ + 凭证)       │         │                  │
   └──────────────┘         └──────────────────┘
```

**Node 半部**（`lib/index.js`）：
- 从 DSH 主目录读取 `settings.yaml` 与 `.credentials.yaml`
- 自动发现最优网关 provider（按 `volceapi.com`、模型数量、`openai-completions` API 类型打分）
- 注册 `/volcengine-usage/proxy` 代理路由，API Key 保留在服务端不暴露

**Client 半部**（`lib/client.js`）：
- 注入右下角悬浮面板（fixed 定位）
- 通过同源代理路由取数（无 CORS、无 Key 暴露）
- 渲染 KPI、Credit 图、模型列表，带平滑高度过渡动画

## 开发

```bash
# 构建 client bundle
pnpm run build:client

# 校验 client bundle
pnpm run check:client
```

### 项目结构

```
volcengine-usage/
├── package.json          # 插件清单（dsh.client, dsh.bundle）
├── cordis.patch.yml      # Cordis bundle 补丁
├── LICENSE               # MIT
├── .gitignore
├── lib/
│   ├── index.js          # Node 半部（ESM）— 配置发现、代理路由
│   └── client.js         # Client bundle（__ModuleLoader__）
└── scripts/
    └── build-client.mjs  # esbuild 封装
```

## 前置条件

- DeepSeek Harness (DSH) 0.1.5+
- 已部署 [BlueRegion Usage](https://github.com/blue-region/BlueRegionUsage) 后端的火山引擎 API 网关（提供 `/v1/usage/*` 接口）
- API Key 已存入 DSH 凭证系统（通过模型设置页配置）

## 兼容性

插件可从任意 DSH 命名空间发现 provider，支持：

- `llm-pi-ai.providers.<名称>.baseURL + apiKeyEnv`（默认）
- `<命名空间>.baseURL + apiKeyEnv`（直接风格）
- `baseURL` / `baseUrl` 两种大小写
- `apiKeyEnv`（凭证引用）或 `apiKey`（直写密钥）

`/v1/usage/*` 接口契约遵循 [BlueRegion Usage](https://github.com/blue-region/BlueRegionUsage) 规范。

## License

MIT