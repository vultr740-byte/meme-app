import { NextRequest, NextResponse } from 'next/server';

interface FeedItem {
  id: string;
  type: string;
  tokenAddress?: string;
  body?: {
    ticker?: string;
    price?: number;
    realizedPnlUsd?: number;
    totalPnlUsd?: number;
    userHandle?: string;
    displayName?: string;
  };
  token?: {
    symbol?: string;
    name?: string;
  };
}

interface TelegramMessage {
  type: string;
  userName: string;
  tokenSymbol: string;
  action: string;
  amountText?: string;
  tokenAddress?: string;
  price?: number;
  realizedPnlUsd?: number;
  totalPnlUsd?: number;
}

// 使用 Map 存储监控状态，避免全局变量
const monitorState = new Map<string, {
  isRunning: boolean;
  intervalId?: NodeJS.Timeout;
  lastMessageId: string | null;
  startTime: number;
}>();

// 监控服务类
class MonitorService {
  private static instance: MonitorService;
  private isInitialized = false;
  private telegramEnabled = false; // 禁用 Telegram 推送
  private monitoringEnabled = false; // 完全禁用监控服务
  
  static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }
  
  async initialize() {
    if (this.isInitialized) return;
    
    if (this.monitoringEnabled) {
      // 30秒后自动启动监控
      setTimeout(() => {
        this.startMonitor('auto');
      }, 30000);
      console.log('🚀 MonitorService 已初始化，将在30秒后自动启动监控');
    } else {
      console.log('🚀 MonitorService 已初始化，监控服务已禁用');
    }
    
    this.isInitialized = true;
  }
  
  async startMonitor(instanceId: string = 'default') {
    if (!this.monitoringEnabled) {
      console.log(`⏭️ 监控服务已禁用，跳过启动: ${instanceId}`);
      return { success: true, message: '监控服务已禁用' };
    }
    
    const existing = monitorState.get(instanceId);
    if (existing?.isRunning) {
      console.log(`⏭️ 监控实例 ${instanceId} 已在运行中`);
      return { success: true, message: '监控已在运行中' };
    }
    
    console.log(`🚀 启动监控实例: ${instanceId}`);
    
    // 立即检查一次
    await this.checkNewMessages(instanceId);
    
    // 设置定时器
    const intervalId = setInterval(async () => {
      const state = monitorState.get(instanceId);
      if (!state?.isRunning) {
        clearInterval(intervalId);
        return;
      }
      await this.checkNewMessages(instanceId);
    }, 5000);
    
    // 保存状态
    monitorState.set(instanceId, {
      isRunning: true,
      intervalId,
      lastMessageId: null,
      startTime: Date.now()
    });
    
    return { success: true, message: '监控已启动' };
  }
  
  async stopMonitor(instanceId: string = 'default') {
    const state = monitorState.get(instanceId);
    if (!state) {
      return { success: false, message: '监控实例不存在' };
    }
    
    if (state.intervalId) {
      clearInterval(state.intervalId);
    }
    
    monitorState.set(instanceId, {
      ...state,
      isRunning: false,
      intervalId: undefined
    });
    
    console.log(`🛑 停止监控实例: ${instanceId}`);
    return { success: true, message: '监控已停止' };
  }
  
  getStatus(instanceId: string = 'default') {
    const state = monitorState.get(instanceId);
    if (!state) {
      return { isRunning: false, message: '监控实例不存在' };
    }
    
    return {
      isRunning: state.isRunning,
      lastMessageId: state.lastMessageId,
      uptime: state.isRunning ? Date.now() - state.startTime : 0,
      message: state.isRunning ? '监控运行中' : '监控已停止'
    };
  }
  
  private async checkNewMessages(instanceId: string) {
    try {
      console.log(`🔍 [${instanceId}] 检查新消息...`);
      
      // 确保 token 有效
      await this.ensureFreshToken();
      
      // 获取最新的 feed 数据
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/feed`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        console.log(`❌ [${instanceId}] 获取 feed 数据失败: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      const list = data.list || [];
      
      if (list.length === 0) {
        console.log(`📭 [${instanceId}] 没有消息数据`);
        return;
      }
      
      const state = monitorState.get(instanceId);
      if (!state) return;
      
      const firstMessageId = list[0]?.id;
      
      // 如果是第一次检查，只记录ID，不推送
      if (state.lastMessageId === null) {
        state.lastMessageId = firstMessageId;
        monitorState.set(instanceId, state);
        console.log(`📝 [${instanceId}] 初始化消息ID: ${state.lastMessageId}`);
        return;
      }
      
      // 检查是否有新消息
      if (firstMessageId && firstMessageId !== state.lastMessageId) {
        console.log(`🆕 [${instanceId}] 发现新消息，ID: ${firstMessageId}`);
        
        // 找到新消息
        const newMessages = [];
        for (const item of list) {
          if (item.id === state.lastMessageId) {
            break;
          }
          newMessages.push(item);
        }
        
        console.log(`📊 [${instanceId}] 发现 ${newMessages.length} 条新消息`);
        
        // 处理每条新消息
        for (const item of newMessages) {
          await this.processNewMessage(item, instanceId);
        }
        
        // 更新最后消息ID
        state.lastMessageId = firstMessageId;
        monitorState.set(instanceId, state);
      } else {
        console.log(`📭 [${instanceId}] 没有新消息`);
      }
      
    } catch (error) {
      console.log(`❌ [${instanceId}] 检查新消息错误:`, error);
    }
  }
  
  private async processNewMessage(item: FeedItem, instanceId: string) {
    try {
      const userName = item.body?.userHandle || item.body?.displayName || "Unknown User";
      const tokenSymbol = item.body?.ticker || item.token?.symbol || item.token?.name || "Token";
      const action = item.type === 'single_user_sell' ? '清仓' :
                    item.type?.toLowerCase().includes('buy') ? '买入' : 
                    item.type?.toLowerCase().includes('sell') ? '卖出' : '交易';
      
      // 格式化金额信息
      let amountText = '';
      if (item.type === 'single_user_sell' && item.body?.realizedPnlUsd != null) {
        const pnl = Number(item.body.realizedPnlUsd);
        const pnlText = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `$${pnl.toFixed(2)}`;
        amountText = `盈亏: ${pnlText}`;
      } else if (item.body?.price) {
        amountText = `$${item.body.price.toFixed(6)}`;
      }
      
      // 准备推送消息
      const telegramMessage = {
        type: item.type,
        userName,
        tokenSymbol,
        action,
        amountText,
        tokenAddress: item.tokenAddress,
        price: item.body?.price,
        realizedPnlUsd: item.body?.realizedPnlUsd,
        totalPnlUsd: item.body?.totalPnlUsd
      };
      
      // 发送推送（除了 user_trade_profit_milestone 类型）
      if (item.type !== 'user_trade_profit_milestone' && this.telegramEnabled) {
        console.log(`📤 [${instanceId}] 推送消息: ${userName} ${action} ${tokenSymbol}`);
        await this.sendTelegramPush(telegramMessage);
      } else if (item.type === 'user_trade_profit_milestone') {
        console.log(`⏭️ [${instanceId}] 跳过推送 (user_trade_profit_milestone): ${userName} ${action} ${tokenSymbol}`);
      } else if (!this.telegramEnabled) {
        console.log(`⏭️ [${instanceId}] 跳过推送 (Telegram 已禁用): ${userName} ${action} ${tokenSymbol}`);
      }
      
    } catch (error) {
      console.log(`❌ [${instanceId}] 处理新消息错误:`, error);
    }
  }
  
  private async sendTelegramPush(message: TelegramMessage) {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      
      if (!botToken || !chatId) {
        console.log('❌ Telegram 配置缺失');
        return false;
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/telegram-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(10000)
      });
      
      return response.ok;
    } catch (error) {
      console.log('❌ Telegram 推送失败:', error);
      return false;
    }
  }
  
  private async ensureFreshToken() {
    try {
      // 调用 token 刷新接口
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/refresh-token`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000)
      });
    } catch (error) {
      console.log('⚠️ Token 刷新失败，继续使用现有 token:', error);
    }
  }
}

// API 路由处理
export async function POST(request: NextRequest) {
  try {
    const { action, instanceId = 'default' } = await request.json().catch(() => ({}));
    const service = MonitorService.getInstance();
    
    switch (action) {
      case 'start':
        const startResult = await service.startMonitor(instanceId);
        return NextResponse.json(startResult);
        
      case 'stop':
        const stopResult = await service.stopMonitor(instanceId);
        return NextResponse.json(stopResult);
        
      case 'init':
        await service.initialize();
        return NextResponse.json({ success: true, message: '监控服务已初始化' });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.log('❌ Monitor service error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const instanceId = url.searchParams.get('instanceId') || 'default';
    
    const service = MonitorService.getInstance();
    const status = service.getStatus(instanceId);
    
    return NextResponse.json(status);
  } catch (error) {
    console.log('❌ Get monitor status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const instanceId = url.searchParams.get('instanceId') || 'default';
    
    const service = MonitorService.getInstance();
    const result = await service.stopMonitor(instanceId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.log('❌ Stop monitor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
