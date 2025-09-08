# 监控系统设计文档

## 概述

新的监控系统采用更健壮的架构设计，解决了原有系统的问题，提供了更好的可靠性和可维护性。

## 架构改进

### 1. 问题分析

**原有系统的问题：**
- 使用全局变量存储状态，在 Next.js 无状态 API 中不稳定
- `setInterval` 在 API 路由中运行，可能被 Next.js 回收
- 客户端每次访问都会启动监控，可能导致重复实例
- 没有错误恢复和自动重启机制
- 状态在服务器重启后丢失

### 2. 新架构设计

**核心组件：**

1. **MonitorService 类** (`app/api/monitor-service/route.ts`)
   - 单例模式，确保全局唯一实例
   - 使用 Map 存储多个监控实例状态
   - 提供完整的生命周期管理
   - 内置错误处理和重试机制

2. **监控客户端** (`scripts/start-monitor.js`)
   - 独立的 Node.js 进程
   - 自动重试和错误恢复
   - 优雅关闭处理
   - 状态监控和自动重启

3. **API 接口**
   - `POST /api/monitor-service` - 启动/停止/初始化监控
   - `GET /api/monitor-service` - 获取监控状态
   - `DELETE /api/monitor-service` - 停止监控

## 使用方式

### 开发环境

```bash
# 安装依赖
npm install

# 同时启动开发服务器和监控
npm run monitor:dev

# 或者分别启动
npm run dev        # 启动 Next.js 开发服务器
npm run monitor    # 启动监控客户端
```

### 生产环境

```bash
# 构建应用
npm run build

# 启动生产服务器
npm start

# 在另一个终端启动监控
npm run monitor
```

### 手动控制

```bash
# 启动监控
curl -X POST http://localhost:3000/api/monitor-service \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "instanceId": "manual"}'

# 查看状态
curl http://localhost:3000/api/monitor-service?instanceId=manual

# 停止监控
curl -X DELETE http://localhost:3000/api/monitor-service?instanceId=manual
```

## 特性

### 1. 多实例支持
- 支持多个监控实例同时运行
- 每个实例有独立的 ID 和状态
- 避免重复启动和资源冲突

### 2. 自动初始化
- 服务器启动后自动初始化监控服务
- 30秒延迟启动，避免与客户端请求竞争资源
- 客户端访问页面时自动触发初始化

### 3. 错误恢复
- 内置重试机制，指数退避策略
- 自动检测监控状态，异常时自动重启
- 网络错误和 API 错误的优雅处理

### 4. 资源管理
- 正确的定时器清理机制
- 内存泄漏防护
- 优雅关闭处理

### 5. 状态持久化
- 监控状态在服务运行期间保持
- 支持状态查询和监控
- 运行时间统计

## 配置

### 环境变量

```bash
# Telegram 配置
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 服务器配置
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Privy 配置
PRIVY_REFRESH_TOKEN=your_refresh_token
PRIVY_AUTHORIZATION_BEARER=your_bearer_token
```

### 监控参数

- **检查频率**: 5秒
- **启动延迟**: 30秒
- **超时设置**: 10秒
- **最大重试**: 3次
- **状态检查**: 30秒

## 监控流程

1. **初始化阶段**
   - 服务器启动时自动初始化 MonitorService
   - 客户端访问页面时触发初始化（如果未初始化）

2. **启动阶段**
   - 30秒延迟后自动启动监控
   - 立即执行一次消息检查
   - 设置定时器，每5秒检查一次

3. **运行阶段**
   - 定期检查新消息
   - 自动刷新 token
   - 处理新消息并推送到 Telegram
   - 状态监控和错误恢复

4. **关闭阶段**
   - 收到退出信号时优雅关闭
   - 清理定时器和资源
   - 停止所有监控实例

## 日志输出

```
🚀 MonitorService 已初始化，将在30秒后自动启动监控
⏰ 30秒延迟结束，开始启动服务器端监控...
🚀 启动监控实例: auto
🔍 [auto] 检查新消息...
📝 [auto] 初始化消息ID: abc123
🆕 [auto] 发现新消息，ID: def456
📊 [auto] 发现 2 条新消息
📤 [auto] 推送消息: User1 买入 TOKEN
✅ Telegram 推送成功
```

## 优势

1. **可靠性**: 单例模式 + 错误恢复 + 自动重启
2. **可扩展性**: 多实例支持 + 独立状态管理
3. **可维护性**: 清晰的架构 + 完整的日志
4. **性能**: 资源优化 + 延迟启动
5. **用户体验**: 自动初始化 + 透明运行

## 迁移指南

从旧系统迁移到新系统：

1. 停止旧的监控服务
2. 安装新依赖: `npm install`
3. 使用新的启动命令: `npm run monitor:dev`
4. 更新环境变量配置
5. 测试监控功能

新系统向后兼容，原有的 Telegram 推送接口保持不变。
