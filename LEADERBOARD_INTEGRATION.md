# 排行榜功能集成文档

## 概述

排行榜功能用于展示用户的交易表现和持仓情况，包括24小时盈亏、总交易量、持仓信息等。

## 数据结构

### API 响应格式
```json
{
  "success": true,
  "message": "24H Leaderboard found",
  "responseObject": {
    "leaderboard": [
      {
        "id": "用户ID",
        "address": "Solana地址",
        "evmAddress": "EVM地址",
        "createdAt": "创建时间",
        "displayName": "显示名称",
        "userHandle": "用户句柄",
        "profilePictureLink": "头像链接",
        "description": "用户描述",
        "following": 关注数,
        "followers": 粉丝数,
        "activated": 是否激活,
        "isRestricted": 是否受限,
        "swapCount": 交换次数,
        "numTrades": 交易次数,
        "totalVolume": 总交易量,
        "private": 是否私有,
        "thumbhash": "缩略图哈希",
        "pnl24h": 24小时盈亏,
        "topHoldings": [
          {
            "imageUrl": "Token图片",
            "tokenAddress": "Token地址",
            "networkId": 网络ID,
            "humanAmount": 持有数量,
            "price": 价格,
            "value": 价值
          }
        ],
        "totalHoldings": 总持仓数
      }
    ]
  }
}
```

## 功能特性

### 已实现的功能
- ✅ 排行榜数据展示
- ✅ 用户基本信息（头像、名称、粉丝数）
- ✅ 24小时盈亏显示
- ✅ 总交易量显示
- ✅ 前3个持仓展示
- ✅ 响应式设计（手机端适配）

### 显示内容
- **用户信息**：头像、显示名称、粉丝数
- **交易数据**：24小时盈亏、总交易量、交易次数
- **持仓信息**：前3个持仓的Token图片、数量、价值
- **排名标识**：显示用户排名

## 技术实现

### API 调用逻辑
```typescript
const response = await fetch('/api/leaderboard', {
  method: 'GET',
  cache: 'no-store'
});
```

### 数据映射
- **排名**: 数组索引 + 1
- **用户信息**: `displayName`, `profilePictureLink`, `followers`
- **交易数据**: `pnl24h`, `totalVolume`, `numTrades`
- **持仓信息**: `topHoldings` 前3个

## 环境变量配置

排行榜 API 复用趋势接口的 token 配置，无需额外配置。

**API 地址**：`https://prod-api.fomo.family/v2/leaderboard/24h?limit=100`
**Token 来源**：复用 `FOMO_API_TOKEN` 和 token 刷新机制

## 注意事项

1. **API 配置**：确保排行榜 API 接口已正确配置
2. **数据更新**：排行榜数据需要定期更新以保持准确性
3. **响应式设计**：支持手机端和桌面端显示
4. **性能优化**：使用适当的缓存策略
5. **用户体验**：清晰的排名显示和持仓信息

## 使用说明

1. 配置环境变量中的 API 地址和 Token
2. 重启开发服务器
3. 点击"排行榜"标签查看数据

## 更新日志

- **v1.0.0**: 初始实现排行榜功能
- **v1.1.0**: 添加手机端响应式设计
- **v1.2.0**: 优化持仓信息显示
