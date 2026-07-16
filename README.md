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