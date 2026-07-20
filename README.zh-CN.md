# Depthline

**在并行智能时代，保护人类思考的深度。**

Depthline 是一个开源、local-first 的 AI 协作注意力防火墙，第一版基于 Codex。

它不鼓励你监控更多 Agent，而是只回答一个问题：

> 这件事现在真的需要人类思考吗？

Depthline 将真实决策与进度噪音分开，把已经完成的工作留到合适时间批量验收，并在你回来时提供一张最小上下文恢复卡。

## 为什么要做

Agent 让执行变成异步。一个人可以在几分钟内启动多项复杂工作，但每项工作都会变成一个未闭合的认知现场：它是否阻塞、是否完成、我上次做了什么判断、回来后要验收什么？

多数 Agent 产品优化的是机器吞吐量。Depthline 优化的是 AI 时代依然稀缺的资源：人的注意力。

## V0.1 能做什么

- 通过本地 `codex app-server` 协议读取最近的 Codex 任务。
- 将任务归一成六种人类状态：需要判断、等待审批、需要恢复、等待验收、安静执行、已停放。
- Agent 正常执行时保持安静，只有等待人类时才进入决策收件箱。
- 自动形成“目标 / 最新结果 / 下一步人类动作”恢复卡。
- 提供50分钟深度工作、稍后提醒、已处理和返回 Codex 工作区。
- 只保存注意力元数据，不保存原始提示词、回答、终端内容或文件。

## 快速开始

需要 Node.js 20+ 和当前版本的 Codex CLI。

```bash
git clone https://github.com/ZacLEE666/depthline.git
cd depthline
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。

不读取本机 Codex 数据、只体验样例：

```bash
DEPTHLINE_DEMO=1 npm run dev
```

## 隐私边界

- 服务只绑定 `127.0.0.1`。
- Depthline 自身不发起任何外部网络请求。
- 不读取 Codex 密钥和私有 SQLite 表。
- 不自动批准任何 Codex 操作。
- 默认只在 `~/.depthline/state.json` 保存专注、稍后处理和已处理时间。
- 所有前端资源随项目打包，不使用远程字体、统计或追踪。

## 项目原则

Depthline 不是另一个 Agent 舰队看板。看板可能只是让“频繁巡检”变得更方便，却没有消除巡检本身。

**Depthline 的成功标准，是你越来越少需要打开它。**

## 当前限制

V0.1 会启动独立的 `codex app-server` 进程，可以稳定发现近期任务和已完成结果；但另一个 Codex App 进程中的实时“正在执行 / 等待人类”状态，仍取决于当前 Codex 版本是否共享事件。路线图的最高优先级是接入共享事件流。Depthline 不会为了制造“实时”的假象去读取 Codex 私有数据库。

更多信息见：[产品契约](docs/PRODUCT.md)、[架构](docs/ARCHITECTURE.md)、[隐私](docs/PRIVACY.md)、[路线图](docs/ROADMAP.md)。

## 许可证

[MIT](LICENSE)
