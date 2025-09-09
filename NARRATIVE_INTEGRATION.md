# 叙事集成说明

## ✅ 已完成集成

叙事功能已成功集成到应用中，使用真实的 API 接口：

### 接口信息
- **URL**: `https://xxx/{tokenAddress}`
- **方法**: `GET`
- **认证**: Bearer Token
- **参数**: `tokenAddress` (代币合约地址，作为 URL 路径参数)

### 返回数据格式
```json
{
  "returnCode": 200,
  "returnDesc": "Success",
  "data": {
    "analysisId": 499951,
    "summary": "叙事摘要内容...",
    "report": "详细报告内容...",
    "thumbUp": 0,
    "thumbDown": 0,
    "thumbStatus": 2
  }
}
```

### 数据映射
- **标题**: `项目叙事`
- **内容**: `data.summary` 字段
- **分类**: `other`
- **标签**: `['AI 分析']`
- **作者**: `ai-analysis`

## 环境变量配置

需要在 `.env.local` 文件中添加：

```bash
# 叙事 API 配置（服务端使用，不暴露给客户端）
NARRATIVE_API_TOKEN=your_narrative_api_bearer_token_here
```

## 功能特性

### 已实现的功能
- ✅ 真实 API 集成
- ✅ Bearer Token 认证
- ✅ 叙事信息显示
- ✅ AI 分析标签
- ✅ 展开/收起功能
- ✅ 作者信息显示（AI 分析）
- ✅ 响应式设计
- ✅ 错误处理

### 显示效果
- 叙事标签显示在价格信息区域
- 点击标签展开叙事抽屉
- 显示 AI 分析的叙事内容
- 包含来源标识（AI 分析）

## 技术实现

### API 调用逻辑

**服务端叙事 API** (`/api/narrative/route.ts`):
```typescript
// 强制设置为中文
const contentLanguage = 'zh';

const narrativeRes = await fetch(`https://xxx/${tokenAddress}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.NARRATIVE_API_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Language': contentLanguage
  },
  cache: 'no-store'
});
```

**前端按需请求** (`app/page.tsx`):
```typescript
// 只有当用户点击叙事标签时才发起请求
const fetchNarrative = useCallback(async (index: number, tokenAddress: string) => {
  if (narrativeCache.has(index)) {
    return narrativeCache.get(index);
  }

  setLoadingNarratives(prev => new Set(prev).add(index));

  try {
    const response = await fetch(`/api/narrative?tokenAddress=${tokenAddress}`, {
      method: 'GET',
      cache: 'no-store'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.narrative) {
        setNarrativeCache(prev => new Map(prev).set(index, data.narrative));
        return data.narrative;
      }
    }
  } catch (error) {
    console.log(`❌ 获取叙事失败:`, error);
  } finally {
    setLoadingNarratives(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }
  return null;
}, [narrativeCache]);
```

### 错误处理
- API 调用失败时不影响主要功能
- 控制台输出详细的错误信息
- 友好的用户界面提示：
  - 加载中状态：显示"加载中..."
  - 失败状态：显示"暂无叙事"标签
  - 重试功能：提供🔄按钮重新尝试获取
- 智能缓存：避免重复请求失败的叙事

## 注意事项

1. **认证配置**：确保 `NARRATIVE_API_TOKEN` 环境变量已正确配置（服务端环境变量）
2. **安全性**：叙事 API Token 只在服务端使用，不会暴露给客户端
3. **按需加载**：只有当用户点击叙事标签时才发起请求，提高性能
4. **缓存机制**：已获取的叙事数据会缓存在前端，避免重复请求
5. **加载状态**：点击叙事标签时会显示"加载中..."状态
6. **语言设置**：强制使用中文叙事内容
7. **错误处理**：友好的失败提示和重试机制
8. **用户体验**：智能状态管理，避免重复请求

## 使用说明

1. 配置环境变量中的 Bearer Token
2. 重启开发服务器
3. 访问应用，有叙事的 token 会显示"叙事"标签
4. 点击标签展开查看 AI 分析的叙事内容
