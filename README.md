# WACMK PGR GM Tool

一个基于 `FastAPI` 的战双帕弥什 GM 管理工具。
项目采用后端统一启动并直接托管前端静态页面的方式，启动后可通过浏览器访问登录页和管理后台，完成游戏服务器状态查看、数据库状态检查、账号选择，以及玩家角色、武器、意识、道具、战斗进度等数据管理。

## 项目结构

```text
.
├─ backend/
│  ├─ app/
│  │  ├─ main.py              # 启动入口
│  │  ├─ config.py            # 配置解析
│  │  ├─ apis/                # API 路由
│  │  ├─ services/            # 业务服务与健康检查
│  │  └─ db/                  # MongoDB 访问
│  └─ requirements.txt        # Python 依赖
├─ frontend/
│  ├─ index.html              # 登录页
│  ├─ dashboard.html          # 控制台页
│  ├─ src/                    # 前端脚本与样式
│  └─ assets/                 # 静态资源
└─ .env.example               # 配置参考模板
```

## 技术架构

- 后端：`FastAPI`
- Web 服务：`uvicorn`
- 数据库：`MongoDB`
- Mongo 驱动：`motor`
- 前端：原生 HTML / CSS / JavaScript
- 进程管理与状态检测：`psutil`

## 启动完整逻辑

项目不是前后端分别启动的模式，而是由后端统一启动并托管前端静态页面。

### 1. 应用启动入口

启动入口为：

```bash
python -m backend.app.main
```

对应代码位置：

- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/services/__init__.py`

### 2. 启动时会做什么

应用启动时，后端会依次完成以下工作：

1. 解析启动参数。
2. 读取环境变量和 CLI 参数。
3. 构建运行时配置 `Settings`。
4. 创建 `FastAPI` 应用。
5. 初始化业务服务，包括：
   - 数据库账号服务
   - 数据库修复服务
   - 玩家资料服务
   - 玩家角色服务
   - 玩家装备服务
   - 玩家道具服务
   - 玩家战斗关卡服务
   - 游戏服务器控制器
6. 挂载前端静态目录：
   - `/src`
   - `/assets`
7. 注册所有 `/api/*` 接口。
8. 在 `startup` 事件中创建两个后台轮询任务：
   - 游戏服务器健康检查循环
   - 数据库健康检查循环

### 3. 页面访问逻辑

应用启动后，访问路径如下：

- `/login`：登录页
- `/`：主控制台页

页面访问逻辑：

1. 访问 `/`。
2. 后端检查 Cookie `login_session_token`。
3. 如果未登录，重定向到 `/login`。
4. 如果已登录，返回 `frontend/dashboard.html`。

### 4. 登录逻辑

登录页前端会调用：

- `POST /api/login`
- `GET /api/session`

认证逻辑说明：

- 登录账号密码来自后端配置。
- 登录成功后，服务端会生成内存会话。
- 会话通过 Cookie `login_session_token` 维持。
- 默认有效期为 12 小时。
- 该会话是内存态，不会持久化到数据库。
- 服务重启后，现有登录会话会失效，需要重新登录。

### 5. 后台管理逻辑

管理后台主要包含两大模块：

1. 游戏服务器管理。
2. 用户数据管理。

#### 游戏服务器管理

页面会轮询调用：

- `GET /api/server-status`

用于检查：

- SDK 服务 HTTP/HTTPS 状态
- 游戏服务器 TCP 状态

如果配置了可执行文件路径且文件存在，还支持：

- 启动游戏服务器：`POST /api/server-control/start`
- 停止游戏服务器：`POST /api/server-control/stop`
- 查看实时日志：`GET /api/server-control/logs`
- 读取/保存服务器配置：`GET /api/server-control/config`、`PUT /api/server-control/config`

#### 用户数据管理

页面会轮询调用：

- `GET /api/database-status`

用于检查 MongoDB 连接是否正常。

数据库管理功能依赖两个前提：

1. 数据库健康状态正常。
2. 已在账号管理中选中目标账号。

之后才可以继续操作：

- 用户名片
- 角色管理
- 武器管理
- 意识管理
- 道具管理
- 通关战斗管理

## 依赖安装

### 运行环境

建议环境：

- Python 3.12+
- MongoDB 可访问
- 浏览器最新版 Chrome / Edge

### Python 依赖

项目后端依赖定义在：

```text
backend/requirements.txt
```

包含：

- `fastapi`
- `uvicorn[standard]`
- `motor`
- `python-dotenv`
- `psutil`

### 安装步骤

先创建虚拟环境：

```bash
python -m venv .venv
```

#### Windows PowerShell

```bash
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

#### Windows CMD

```bash
.venv\Scripts\activate.bat
pip install -r backend/requirements.txt
```

#### macOS / Linux

```bash
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## 启动方式和命令

### 方式一：直接使用项目入口启动

这是最贴近当前代码实现的启动方式：

```bash
python -m backend.app.main
```

默认监听：

- Host: `0.0.0.0`
- Port: `8000`

启动后访问：

```text
http://127.0.0.1:8000/login
```

或：

```text
http://localhost:8000/login
```

### 方式二：启动时传入 CLI 参数

项目支持直接通过命令行参数覆盖配置，例如：

```bash
python -m backend.app.main --APP_HOST 0.0.0.0 --APP_PORT 8000 --ADMIN_USERNAME admin --ADMIN_PASSWORD password
```

还可以同时指定数据库和服务器参数：

```bash
python -m backend.app.main --APP_PORT 8000 --MONGO_HOST 127.0.0.1 --MONGO_PORT 27017 --MONGO_DB asc_net --SDK_SERVER_HOST 127.0.0.1 --SDK_SERVER_PORT 80 --GAME_SERVER_HOST 127.0.0.1 --GAME_SERVER_PORT 2335
```

### 方式三：使用环境变量启动

#### Windows PowerShell

```bash
$env:APP_HOST="0.0.0.0"
$env:APP_PORT="8000"
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="password"
python -m backend.app.main
```

#### macOS / Linux

```bash
export APP_HOST=0.0.0.0
export APP_PORT=8000
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=password
python -m backend.app.main
```

### 方式四：使用 uvicorn 启动

也可以直接用 `uvicorn`：

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

但如果你希望完全遵循当前仓库入口逻辑，仍建议优先使用：

```bash
python -m backend.app.main
```

## 参数配置方式

项目当前支持两类配置方式：

1. 环境变量。
2. CLI 启动参数。

例如：

- 环境变量：`APP_PORT=8000`
- CLI 参数：`--APP_PORT 8000`

### 配置优先级

当前代码中的优先级如下：

1. CLI 参数。
2. 环境变量。
3. 代码默认值。

但是有一个重要例外：

如果 `SERVER_PATH/Configs/config.json` 存在且能被正常读取，系统会优先读取这个配置文件，并覆盖以下运行时参数：

- `SDK_SERVER_SCHEME`
- `SDK_SERVER_HOST`
- `SDK_SERVER_PORT`
- `GAME_SERVER_HOST`
- `GAME_SERVER_PORT`
- `MONGO_HOST`
- `MONGO_PORT`
- `MONGO_DB`
- `MONGO_USERNAME`
- `MONGO_PASSWORD`
- `MONGO_AUTH_SOURCE`

也就是说，针对 SDK、游戏服、Mongo 的连接配置，最终生效值可能来自服务器目录下的 `Configs/config.json`，而不是环境变量。

## 关于 `.env.example`

仓库中存在 `.env.example`，它更适合作为配置模板参考。

需要注意：

- 当前代码中没有发现自动加载 `.env` 的逻辑。
- 这意味着仅仅把 `.env.example` 复制成 `.env`，不一定会自动生效。
- 运行时更稳妥的方式仍然是：
  - 使用系统环境变量
  - 或使用 CLI 参数

如果后续项目补充了 `load_dotenv()` 或等价逻辑，再将 `.env` 作为正式加载方式使用。

## 推荐启动示例

如果你只需要最小可运行配置，建议至少设置：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `MONGO_HOST`
- `MONGO_PORT`
- `MONGO_DB`

示例：

```bash
python -m backend.app.main --ADMIN_USERNAME admin --ADMIN_PASSWORD password --MONGO_HOST 127.0.0.1 --MONGO_PORT 27017 --MONGO_DB asc_net
```

如果还需要控制游戏服务器，则再额外设置：

- `SERVER_PATH`
- `SERVER_BINARY_FILE`
- `SERVER_RUNTIME_LOG_PATH`
- `SDK_SERVER_HOST`
- `SDK_SERVER_PORT`
- `GAME_SERVER_HOST`
- `GAME_SERVER_PORT`

## 参数表

| 参数名 | 说明 | 默认值 | 配置方式 | 备注 |
| --- | --- | --- | --- | --- |
| `APP_NAME` | 应用名称 | `WACMK PGR Management` | 环境变量 / CLI | 页面标题和应用信息使用 |
| `APP_HOST` | Web 服务监听地址 | `0.0.0.0` | 环境变量 / CLI | FastAPI/uvicorn 监听地址 |
| `APP_PORT` | Web 服务监听端口 | `8000` | 环境变量 / CLI | FastAPI/uvicorn 监听端口 |
| `GAME_VERSION` | 游戏版本号 | `2.3` | 环境变量 / CLI | 影响部分业务数据装载 |
| `ADMIN_USERNAME` | 后台管理员账号 | 空 | 环境变量 / CLI | 必须配置，否则无法正常登录 |
| `ADMIN_PASSWORD` | 后台管理员密码 | 空 | 环境变量 / CLI | 必须配置，否则无法正常登录 |
| `HEALTHY_CHECK_INTERVAL` | 健康检查间隔，单位秒 | `60` | 环境变量 / CLI | 同时影响服务状态和数据库状态轮询 |
| `SERVER_PATH` | 游戏服务器目录 | `/root/wacmk-pgr-server` | 环境变量 / CLI | 用于拼接服务器可执行文件及配置文件路径 |
| `SERVER_BINARY_FILE` | 游戏服务器可执行文件名 | `Wacmk.Pgr.Server` | 环境变量 / CLI | 与 `SERVER_PATH` 一起决定启动目标 |
| `SERVER_RUNTIME_LOG_PATH` | 游戏服务器运行日志路径 | `/tmp/rpg-server.log` | 环境变量 / CLI | 实时日志功能依赖此路径 |
| `SDK_SERVER_SCHEME` | SDK 服务协议 | `http` | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `SDK_SERVER_HOST` | SDK 服务地址 | `127.0.0.1` | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `SDK_SERVER_PORT` | SDK 服务端口 | `80` | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `GAME_SERVER_HOST` | 游戏服务器地址 | `127.0.0.1` | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `GAME_SERVER_PORT` | 游戏服务器端口 | `2335` | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `MONGO_URI` | MongoDB 完整连接串 | 空 | 环境变量 / CLI | 配置后优先使用完整连接串 |
| `MONGO_HOST` | MongoDB 主机 | `localhost` | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `MONGO_PORT` | MongoDB 端口 | `27017` | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `MONGO_DB` | MongoDB 数据库名 | `asc_net` | 环境变量 / CLI | `.env.example` 示例值与代码默认值不同 |
| `MONGO_USERNAME` | MongoDB 用户名 | 空 | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `MONGO_PASSWORD` | MongoDB 密码 | 空 | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `MONGO_AUTH_SOURCE` | MongoDB 认证库 | `admin` | 环境变量 / CLI | 若存在服务器配置文件可能被覆盖 |
| `MONGO_TLS` | MongoDB 是否启用 TLS | `false` | 环境变量 / CLI | 仅在非 `MONGO_URI` 模式下参与拼接 |
| `MAX_CHARACTER_USE_FIX_MEMORY_RESONANCE` | 一键全满时是否使用固定意识共鸣策略 | `true` | 环境变量 / CLI | 高级业务开关，`.env.example` 中未列出 |

## 服务器配置文件覆盖说明

当以下文件存在时：

```text
{SERVER_PATH}/Configs/config.json
```

系统会读取该文件，并将其中的内容合并到默认服务器配置中。
这会直接影响：

- SDK 服务检查地址
- 游戏服务器检查地址
- MongoDB 连接配置

因此在排查“为什么我改了环境变量却没生效”时，优先检查这个文件是否存在。

## 前端是否需要单独启动

不需要。

当前仓库没有发现：

- `package.json`
- `npm run dev`
- `pnpm dev`
- `yarn dev`

前端页面由后端直接返回：

- `frontend/index.html`
- `frontend/dashboard.html`

对应静态资源目录由后端挂载：

- `/src`
- `/assets`

因此正常运行只需要启动后端服务即可。

## 常见使用流程

### 场景一：仅启动管理后台并连接 MongoDB

1. 安装 Python 依赖。
2. 配置管理员账号密码。
3. 配置 MongoDB 连接参数。
4. 启动 `python -m backend.app.main`。
5. 浏览器访问 `/login`。
6. 登录后检查数据库状态。
7. 在账号管理中选中账号。
8. 进入角色、道具、武器等页面管理数据。

### 场景二：同时管理游戏服务器

1. 配置 `SERVER_PATH`。
2. 配置 `SERVER_BINARY_FILE`。
3. 配置 `SERVER_RUNTIME_LOG_PATH`。
4. 保证目标二进制文件真实存在且可执行。
5. 启动后台。
6. 在“游戏服务器管理”页使用启动、停止、日志、配置功能。

> Note
> 在 Windows 下，查看日志和修改配置主要依赖 `SERVER_PATH`、`SERVER_BINARY_FILE`、`SERVER_RUNTIME_LOG_PATH` 配置正确。
> 这些值需要在启动管理后台时通过环境变量或 CLI 参数提供，而不是在页面点击按钮时动态传入。
> 若使用 Windows，请将 `SERVER_BINARY_FILE` 指向实际的 `.exe` 文件，并将两个路径参数改为 Windows 实际路径。

## 注意事项

1. 当前前端不需要单独安装依赖，也不需要单独启动。
2. 当前 `.env.example` 更适合作为配置模板参考，不应默认认为 `.env` 会自动生效。
3. 登录会话保存在内存中，服务重启后需要重新登录。
4. 很多数据库管理接口依赖“先选中账号”，不是登录后立即可用。
5. 数据修改类功能在前端存在额外风险提示，属于正常设计。
6. `SERVER_PATH`、`SERVER_RUNTIME_LOG_PATH` 默认值偏 Linux 风格，如果在 Windows 下运行，需要自行改成 Windows 路径。
7. Windows 下的游戏服务器控制当前仅支持直接启动 `.exe` 文件；查看日志和修改配置只依赖路径配置正确。
8. `.env.example` 中的 `MONGO_DB=admin_system` 与代码默认值 `asc_net` 不一致，实际请以你自己的部署目标为准。
9. 如果游戏服务器控制按钮没有显示，通常表示：
   - `SERVER_PATH` 配置错误
   - `SERVER_BINARY_FILE` 不存在
   - Windows 下目标不是 `.exe`
   - 非 Windows 下文件不可执行

## 快速启动示例

### 最小可运行示例

```bash
python -m backend.app.main --ADMIN_USERNAME admin --ADMIN_PASSWORD password --MONGO_HOST 127.0.0.1 --MONGO_PORT 27017 --MONGO_DB asc_net
```

### 启动后访问

```text
http://127.0.0.1:8000/login
```

使用上面配置的管理员账号登录即可。
