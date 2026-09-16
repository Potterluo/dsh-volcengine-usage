# 发布到 GitHub

本插件按 DSH 官方插件规范组织，可直接发布为 GitHub 仓库或 npm 包。

## 1. 发布为 GitHub 仓库

```bash
# 在项目目录初始化
git init
git add .
git commit -m "feat: dsh-volcengine-usage 火山引擎网关额度面板"

# 在 GitHub 新建空仓库后关联并推送
git remote add origin git@github.com:YOUR_USERNAME/dsh-volcengine-usage.git
git branch -M main
git push -u origin main
```

> ⚠️ 发布前请把 `package.json` 中 `repository` / `bugs` / `homepage` 三个字段的
> `YOUR_USERNAME` 替换为你的 GitHub 用户名（或删掉这三个字段）。

## 2. 让用户安装（GitHub 源）

```bash
dsh plugin --profile desktop add github:YOUR_USERNAME/dsh-volcengine-usage
```

## 3. 发布为 npm 包（可选）

```bash
npm login
npm publish --access public
```

用户侧安装：

```bash
dsh plugin --profile desktop add dsh-volcengine-usage
```

## 4. 发布检查清单

- [ ] `package.json` 的 repository/bugs/homepage 已更新
- [ ] `lib/client.js` 已通过 `node scripts/build-client.mjs --check`（或确认与源码一致）
- [ ] `README.md` / `README.zh.md` 描述与功能一致
- [ ] 未包含任何真实凭证（检查 `settings.yaml`、`.credentials.yaml` 未入库，`.gitignore` 已覆盖）
- [ ] 截图 `docs/screenshot.png` 已放置（可选但推荐）
