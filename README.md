# 轻量级 Python 后台管理系统

这是一个前后端分目录的轻量级后台管理系统骨架。

## 目录结构

- `frontend/`：前端静态页面与资源
- `backend/`：Python 后端服务

## 当前状态

- 已完成一个后台风格的登录页
- 暂不开放注册入口
- 已预留 MongoDB 环境变量配置
- 已实现登录鉴权逻辑
- 已预留 PGR 服务器状态页

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改。

MongoDB 支持两种方式配置：

1. 直接填写 `MONGO_URI`
2. 通过 `MONGO_HOST`、`MONGO_PORT`、`MONGO_DB`、`MONGO_USERNAME`、`MONGO_PASSWORD` 组合生成

管理员登录账号由环境变量提供：

1. `ADMIN_USERNAME`
2. `ADMIN_PASSWORD`

后端不再读取 `local_data.json`，也不再通过 MongoDB 进行登录授权。

健康检查会按 `HEALTHY_CHECK_INTERVAL` 定时执行，结果缓存在内存中并提供给前端状态页读取。

## 后端启动

```bash
cd backend
pip3 install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

## 前端预览

可以直接用静态服务器打开 `frontend/index.html`，或者后续接入任意前端开发服务器。
