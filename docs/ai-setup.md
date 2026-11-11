# 真实大模型：生成每日行程

入口是「新建旅行 → AI 智能生成行程」。模型根据目的地、日期、人数、预算、风格、节奏、住宿区域和备注生成每日活动。小程序保存结果到本地，可以在旅行详情和每日行程查看。预算记账、日记、收藏和行李清单仍由本地功能处理。

## 在 Windows 本机试用

需要 Node.js 20.12 或以上、微信开发者工具和可用的模型 API 密钥。默认提供商是 [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)，默认模型是 `deepseek-flash`。

### 启动后端

1. 双击 [启动脚本](../server/start-ai.cmd)，输入模型 API 密钥并回车。输入时会隐藏密钥，脚本只把它交给本次运行的后端。
2. 看到 `Voyager AI backend: http://127.0.0.1:8787/api/itinerary` 后，保持窗口打开。后端运行期间可以反复打开或编译微信小程序。

需要换模型时，在 `server/.env` 修改 API 地址和模型名，然后重启脚本。如果配置文件不存在，把同目录的 `.env.example` 复制为 `.env`。

### 查看运行状态

在 Windows 的 PowerShell 中运行以下命令。使用默认端口时，`TcpTestSucceeded` 为 `True` 表示端口可连接，为 `False` 表示连不上。

```powershell
Test-NetConnection 127.0.0.1 -Port 8787
```

### 关闭后端

- **通过启动脚本运行时**，在脚本窗口按 `Ctrl+C`。如果提示 `Terminate batch job (Y/N)?`，输入 `Y` 并回车。也可以直接关闭该窗口。
- **在后台运行时**，在 PowerShell 运行下面的命令，找到本地地址为 `127.0.0.1:8787`、状态为 `LISTENING` 的那行。最后一列是当前进程 PID。打开「任务管理器 → 详细信息」，按 PID 找到对应的 `node.exe`，确认命令行包含 `itinerary-api.js` 后结束该进程。可在「详细信息」的列标题上右键启用「命令行」列。

```powershell
netstat -ano -p tcp | Select-String '127\.0\.0\.1:8787\s'
```

关闭后可以再次检查端口。「使用本地模板」仍可继续生成行程。

### 在微信开发者工具里验证

1. 导入项目，在本地调试设置中关闭域名和 HTTPS 校验后编译。模拟器默认请求 `http://127.0.0.1:8787/api/itinerary`。
2. 新建一条不超过 7 天的旅行。例如杭州 3 天、两人、预算 1800 元，备注填「带老人，尽量少走路」。点击「AI 智能生成行程」，检查旅行详情和每日行程是否有带时间、地点及注意事项的活动。
3. 后端未启动、密钥未配置或模型请求失败时，页面会提示重试，也可以选择「使用本地模板」继续。AI 建议中的营业时间、票价、路线和预约条件需自行核实。

## 换模型或在真机使用

- 服务端支持 `AI_BASE_URL` 和 `AI_MODEL`，可使用其他支持 Chat Completions JSON 输出的服务。地址填 API 基址，例如 `https://provider.example/v1`，服务会追加 `/chat/completions`。只在服务端配置 `AI_API_KEY`。
- 本地服务仅监听回环地址。真机正式使用时，在服务端前配置 HTTPS、用户鉴权及限流，再把 `services/ai-config.js` 的地址改成该接口，并在小程序后台登记 HTTPS 请求域名。当前本机试用接口没有用户鉴权，不应直接暴露到公网。
- `npm test` 使用模拟的上游响应检查接口和小程序的数据衔接，不需要密钥，也不会产生模型调用费用。
