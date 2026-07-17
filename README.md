# Portable Local Codex Pool

Windows 本地 Codex OAuth 号池，基于：

- [CLIProxyAPI v7.2.80](https://github.com/router-for-me/CLIProxyAPI)
- [CPA Manager Plus v1.11.2](https://github.com/seakee/CPA-Manager-Plus)

账号 JSON 和所有 Key 只以 AES-256-GCM 加密包 `secrets.enc` 提交。运行时二进制、明文凭据、数据库和日志均被 `.gitignore` 排除。

## 新电脑使用

```powershell
git clone <private-repository-url>
cd <repository-directory>
.\start.cmd
```

首次启动会：

1. 下载固定版本的官方 Windows Release 并校验 SHA256。
2. 提示输入加密包密码。
3. 解密到被 Git 忽略的 `.local` 目录。
4. 根据当前克隆目录生成配置并导入账号。
5. 启动两个本地服务。

## CC Switch

```text
URL: http://127.0.0.1:8317/v1
Model: gpt-5.6-sol
Wire API: responses
```

API Key、Management Key 和 CPA Manager Admin Key 保存在加密包中。首次解密后可在 `.local/secrets.json` 查看；该文件不会进入 Git。

## Web

- CLIProxyAPI：`http://127.0.0.1:8317/management.html`
- 额度与监控：`http://127.0.0.1:18317/management.html`

## 更新账号备份

将新的 Sub2API JSON 放到项目根目录，然后运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-secrets.ps1
git add secrets.enc
git commit -m "update encrypted accounts"
git push
```

不要遗失加密密码；仓库中不保存密码，也无法恢复密码。
## 新增账号

1. 将新的 `*.sub2api-active.json` 放到项目根目录。
2. 运行 `node .\import-sub2api.mjs`，让当前电脑立即加载新账号。
3. 运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-secrets.ps1`，输入并确认加密密码。
4. 提交并推送：

```powershell
git add secrets.enc
git commit -m "Update encrypted accounts"
git push
```

其他电脑运行 `git pull` 后再次执行 `.\start.cmd`。脚本检测到 `secrets.enc` 更新时会要求输入密码，并自动重新解密和导入全部账号。
