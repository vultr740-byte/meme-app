import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tokenAddress = url.searchParams.get('tokenAddress');

    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'Token address is required' },
        { status: 400 }
      );
    }

    const narrativeApiToken = process.env.NARRATIVE_API_TOKEN;
    if (!narrativeApiToken) {
      console.log('⚠️ NARRATIVE_API_TOKEN 环境变量未配置');
      return NextResponse.json(
        { success: false, error: 'Narrative API token not configured' },
        { status: 500 }
      );
    }

    // 强制设置为中文
    const contentLanguage = 'zh';
    
    console.log(`🔍 请求叙事数据，Token: ${tokenAddress}，语言: ${contentLanguage}`);

    // 调用叙事接口
    const narrativeRes = await fetch(
      `https://api.djdog.ai/openApi/grok/report/${tokenAddress}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${narrativeApiToken}`,
          'Content-Type': 'application/json',
          'Content-Language': contentLanguage
        },
        cache: 'no-store'
      }
    );

    if (!narrativeRes.ok) {
      console.log(`❌ 叙事 API 请求失败: ${narrativeRes.status}`);
      return NextResponse.json(
        { success: false, error: `Narrative API request failed: ${narrativeRes.status}` },
        { status: narrativeRes.status }
      );
    }

    const narrativeData = await narrativeRes.json();
    console.log(`📊 叙事 API 响应:`, narrativeData);

    // 处理认证过期
    if (narrativeData.returnCode === 429) {
      console.log(`❌ 叙事 API 认证过期: ${narrativeData.returnDesc}`);
      return NextResponse.json(
        { success: false, error: 'Narrative API authorization expired' },
        { status: 401 }
      );
    }

    if (narrativeData.returnCode === 200 && narrativeData.data?.summary) {
      return NextResponse.json({
        success: true,
        narrative: {
          title: '项目叙事',
          content: narrativeData.data.summary,
          category: 'other',
          tags: ['AI 分析'],
          author: 'ai-analysis'
        }
      });
    } else {
      console.log(`ℹ️ Token ${tokenAddress} 没有叙事数据:`, narrativeData.returnDesc);
      return NextResponse.json(
        { success: false, error: 'No narrative data available' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('❌ 获取叙事数据失败:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch narrative data' },
      { status: 500 }
    );
  }
}
