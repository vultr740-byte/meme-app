import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    console.log('📨 收到 Telegram 推送请求');
    const message: TelegramMessage = await request.json();
    console.log('📋 消息数据:', { type: message.type, userName: message.userName, tokenSymbol: message.tokenSymbol });
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    console.log('🔧 配置检查:', { 
      hasBotToken: !!botToken, 
      hasChatId: !!chatId,
      botTokenLength: botToken?.length || 0,
      chatIdLength: chatId?.length || 0
    });
    
    if (!botToken || !chatId) {
      console.log('❌ Telegram 配置缺失: BOT_TOKEN 或 CHAT_ID 未设置');
      return NextResponse.json({ error: 'Telegram configuration missing' }, { status: 500 });
    }
    
    // 格式化消息内容
    let messageText = `🚀 **新交易动态**\n\n`;
    messageText += `👤 **用户**: ${message.userName}\n`;
    messageText += `🪙 **代币**: ${message.tokenSymbol}\n`;
    messageText += `📊 **操作**: ${message.action}\n`;
    
    if (message.tokenAddress) {
      messageText += `📍 **地址**: \`${message.tokenAddress}\`\n`;
    }
    
    if (message.price) {
      messageText += `💰 **价格**: $${message.price.toFixed(6)}\n`;
    }
    
    // 根据消息类型显示不同的金额信息
    if (message.type === 'single_user_sell' && message.realizedPnlUsd != null) {
      const pnlEmoji = message.realizedPnlUsd >= 0 ? '🟢' : '🔴';
      messageText += `${pnlEmoji} **盈亏**: $${message.realizedPnlUsd.toFixed(2)}\n`;
    } else if (message.type === 'user_trade_profit_milestone' && message.totalPnlUsd != null) {
      messageText += `🟢 **总盈利**: +$${message.totalPnlUsd.toFixed(2)}\n`;
    } else if (message.amountText) {
      messageText += `💵 **金额**: ${message.amountText}\n`;
    }
    
    messageText += `\n⏰ **时间**: ${new Date().toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
    
    // 发送到 Telegram
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot/1.0)',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!telegramResponse.ok) {
      const errorText = await telegramResponse.text();
      console.log('❌ Telegram 推送失败:', errorText);
      return NextResponse.json({ error: 'Telegram push failed' }, { status: 500 });
    }
    
    console.log('✅ Telegram 推送成功');
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.log('❌ Telegram 推送错误:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
