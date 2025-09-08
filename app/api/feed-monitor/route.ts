import { NextRequest, NextResponse } from 'next/server';

// 全局变量存储最后检查的消息ID
let lastMessageId: string | null = null;
let isMonitoring = false;
const monitoringEnabled = false; // 完全禁用监控服务

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

// 格式化数字
function formatNumber(value: string, options: { maximumFractionDigits?: number } = {}): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: options.maximumFractionDigits || 6,
  });
}

// 发送 Telegram 推送 (已禁用)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function sendTelegramPush(message: unknown) {
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
    });
    
    return response.ok;
  } catch (error) {
    console.log('❌ Telegram 推送失败:', error);
    return false;
  }
}

// 检查新消息并推送
async function checkNewMessages() {
  try {
    console.log('🔍 检查新消息...');
    
    // 获取最新的 feed 数据
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/feed`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log('❌ 获取 feed 数据失败');
      return;
    }
    
    const data = await response.json();
    const list: FeedItem[] = data.list || [];
    
    if (list.length === 0) {
      console.log('📭 没有消息数据');
      return;
    }
    
    const firstMessageId = list[0]?.id;
    
    // 如果是第一次检查，只记录ID，不推送
    if (lastMessageId === null) {
      lastMessageId = firstMessageId;
      console.log('📝 初始化消息ID:', lastMessageId);
      return;
    }
    
    // 检查是否有新消息
    if (firstMessageId && firstMessageId !== lastMessageId) {
      console.log('🆕 发现新消息，ID:', firstMessageId);
      
      // 找到新消息（从最新消息开始，直到遇到上次记录的消息ID）
      const newMessages: FeedItem[] = [];
      for (const item of list) {
        if (item.id === lastMessageId) {
          break;
        }
        newMessages.push(item);
      }
      
      console.log(`📊 发现 ${newMessages.length} 条新消息`);
      
      // 处理每条新消息
      for (const item of newMessages) {
        const userName = item.body?.userHandle || item.body?.displayName || "Unknown User";
        const tokenSymbol = item.body?.ticker || item.token?.symbol || item.token?.name || "Token";
        const action = item.type === 'single_user_sell' ? '清仓' :
                      item.type?.toLowerCase().includes('buy') ? '买入' : 
                      item.type?.toLowerCase().includes('sell') ? '卖出' : '交易';
        
        // 格式化金额信息
        let amountText = '';
        if (item.type === 'single_user_sell' && item.body?.realizedPnlUsd != null) {
          const pnl = Number(item.body.realizedPnlUsd);
          const pnlText = pnl >= 0 ? `+$${formatNumber(String(pnl), { maximumFractionDigits: 2 })}` : `$${formatNumber(String(pnl), { maximumFractionDigits: 2 })}`;
          amountText = `盈亏: ${pnlText}`;
        } else if (item.body?.price) {
          amountText = `$${formatNumber(String(item.body.price), { maximumFractionDigits: 6 })}`;
        }
        
        // 准备推送消息 (已禁用)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        // Telegram 推送已禁用
        if (item.type !== 'user_trade_profit_milestone') {
          console.log(`⏭️ 跳过推送 (Telegram 已禁用): ${userName} ${action} ${tokenSymbol}`);
        } else {
          console.log(`⏭️ 跳过推送 (user_trade_profit_milestone): ${userName} ${action} ${tokenSymbol}`);
        }
      }
      
      // 更新最后消息ID
      lastMessageId = firstMessageId;
    } else {
      console.log('📭 没有新消息');
    }
    
  } catch (error) {
    console.log('❌ 检查新消息错误:', error);
  }
}

// 启动监控
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(request: NextRequest) {
  try {
    if (!monitoringEnabled) {
      console.log('⏭️ 监控服务已禁用');
      return NextResponse.json({ message: '监控服务已禁用' });
    }
    
    if (isMonitoring) {
      return NextResponse.json({ message: '监控已在运行中' });
    }
    
    isMonitoring = true;
    console.log('🚀 启动服务器端消息监控...');
    
    // 立即检查一次
    await checkNewMessages();
    
    // 设置定时器，每5秒检查一次
    const interval = setInterval(async () => {
      if (!isMonitoring) {
        clearInterval(interval);
        return;
      }
      await checkNewMessages();
    }, 5000); // 5秒
    
    return NextResponse.json({ 
      success: true, 
      message: '服务器端监控已启动，每5秒检查一次新消息' 
    });
    
  } catch (error) {
    isMonitoring = false;
    console.log('❌ 启动监控失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start monitoring' 
    }, { status: 500 });
  }
}

// 停止监控
export async function DELETE() {
  try {
    isMonitoring = false;
    console.log('🛑 停止服务器端消息监控');
    return NextResponse.json({ 
      success: true, 
      message: '监控已停止' 
    });
  } catch (error) {
    console.log('❌ 停止监控失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to stop monitoring' 
    }, { status: 500 });
  }
}

// 获取监控状态
export async function GET() {
  return NextResponse.json({
    isMonitoring,
    lastMessageId,
    message: isMonitoring ? '监控运行中' : '监控已停止'
  });
}
