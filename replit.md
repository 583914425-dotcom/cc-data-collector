# Project Overview

宫颈癌数据库采集系统 — 医学数据采集与管理全栈应用，使用 AI（Gemini/DeepSeek）从病历中提取结构化数据。

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Express.js + Socket.io (实时聊天/在线状态)
- **Database**: PocketBase (自托管 SQLite，端口 8090)
- **AI**: Google Gemini API + DeepSeek (OpenAI-compatible)
- **Auth**: PocketBase 内置 auth (users collection)

## Key Files

- `server.ts` — Express 服务器，含 Socket.io、AI API 路由、Vite 中间件、`/pb-api` 代理
- `vite.config.ts` — Vite 配置（开发模式代理 `/pb-api` → localhost:8090）
- `src/lib/pb.ts` — PocketBase 客户端单例
- `src/App.tsx` — 根组件，含登录/注册逻辑
- `src/pages/` — Dashboard、PatientForm、Chat、Rewards、UserManagement
- `src/components/BatchImportModal.tsx` — 批量导入组件
- `src/presence.ts` — 在线状态管理（PocketBase presence collection）
- `pb_migrations/1750000000_init.js` — PocketBase collection 初始化迁移
- `bin/pocketbase` — PocketBase Linux AMD64 可执行文件

## Ports

- **5000** — 主服务器 (Express wraps Vite in dev mode)
- **8090** — PocketBase (单独 workflow 运行)

## Proxy Configuration

`/pb-api` 路径从 Express (5000) 代理到 PocketBase (8090)：
- **关键**：使用 `fixRequestBody` (http-proxy-middleware v3) 修复 `express.json()` 消费 body 流导致 POST 无法转发的问题
- CORS 头在代理路由前统一添加，支持跨端口请求
- `src/lib/pb.ts` 始终使用 `window.location.hostname + port(fallback:5000)` 构造 baseUrl，确保请求绕过 CDN 直达 Express

## PocketBase Collections

- `users` — 用户管理（role: admin/member/pending）
- `patients` — 患者数据（name, authorUid, authorEmail, authorName, patientData JSON blob）
- `chat_messages` — 聊天消息
- `presence` — 在线状态心跳
- `rewards` — 积分/奖励记录
- `vouchers` — 兑换券

## Admin Account

- Email: 583914425@qq.com
- Password: lijie970224
- Role: admin

## Environment Variables

- `GEMINI_API_KEY` — Google Gemini API key（AI 提取功能，可由用户在设置中填入自己的 key）

## Scripts

- `npm run dev` — 启动开发服务器 (tsx server.ts on port 5000)
- `npm run build` — 构建生产版本

## Deployment

- Target: VM (always-on，PocketBase 需持久运行)
- 生产模式下 server.ts 自动 spawn PocketBase 进程
- Build: `npm run build`
- Run: `node dist/server.cjs`
