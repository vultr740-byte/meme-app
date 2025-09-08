# Telegram 推送配置说明

## 1. 创建 Telegram Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/botfather)
2. 发送 `/newbot` 命令
3. 按提示设置 bot 名称和用户名
4. 获取 Bot Token（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

## 2. 获取 Chat ID

### 方法一：通过 Bot 获取
1. 将你的 bot 添加到群组或直接与 bot 私聊
2. 发送任意消息给 bot
3. 访问：`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. 在返回的 JSON 中找到 `chat.id` 字段

### 方法二：通过 @userinfobot
1. 在 Telegram 中找到 [@userinfobot](https://t.me/userinfobot)
2. 发送 `/start` 命令
3. 获取你的 Chat ID

## 3. 配置环境变量

在项目根目录创建 `.env.local` 文件，添加以下配置：

```bash
# Telegram Bot 配置
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

## 4. 推送消息格式

当检测到新的动态 feed 信息时，会推送以下格式的消息：

```
🚀 **新交易动态**

👤 **用户**: WaffleTacoCheeseFry
🪙 **代币**: SENDY
📊 **操作**: 买入
📍 **地址**: `8LFpoJWGS65GMDL7jPKPPgvns3g6vEDg15BmcUSsezuR`
💰 **价格**: $0.001112
💵 **金额**: $0.001112

⏰ **时间**: 2025-01-07 23:51:06
```

### 特殊消息类型

- **清仓消息** (`single_user_sell`)：显示盈亏信息，绿色表示盈利，红色表示亏损
- **盈利里程碑** (`user_trade_profit_milestone`)：显示总盈利金额

## 5. 服务器端推送

### 自动启动
应用启动时会自动启动服务器端监控服务，无需手动操作。

### 手动控制
如果需要手动控制监控服务：

```bash
# 启动监控
curl -X POST http://localhost:3000/api/start-monitor

# 查看监控状态
curl http://localhost:3000/api/feed-monitor

# 停止监控
curl -X DELETE http://localhost:3000/api/feed-monitor
```

### 监控特性
- **服务器端执行**：推送逻辑在服务器端运行，避免多用户重复推送
- **自动检测**：每5秒自动检查新消息
- **智能过滤**：只推送新消息，避免重复通知
- **类型过滤**：`user_trade_profit_milestone` 类型不会推送通知

## 6. 测试推送

1. 启动应用：`pnpm dev`
2. 访问页面：`http://localhost:3000`
3. 监控会自动启动，当有新的动态 feed 信息时会推送到 Telegram

## 注意事项

- 确保 Bot Token 和 Chat ID 正确配置
- Bot 需要有发送消息的权限
- 推送是服务器端异步执行，不会影响客户端性能
- 如果推送失败，会在服务器控制台输出错误信息
- 监控服务会在应用重启时自动重新启动
