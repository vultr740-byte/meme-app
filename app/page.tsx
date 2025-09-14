"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FaGlobe, FaTwitter, FaTelegramPlane, FaDiscord, FaInfoCircle, FaUser, FaRobot } from "react-icons/fa";
import { FiCopy } from "react-icons/fi";
import toast from "react-hot-toast";

type TrendingToken = {
  priceUSD?: string;
  marketCap?: string;
  liquidity?: string;
  volume24?: string;
  change1?: string;
  change4?: string;
  change12?: string;
  change24?: string;
  createdAt?: number;
  token?: {
    address?: string;
    name?: string;
    symbol?: string;
    info?: {
      imageThumbUrl?: string;
    };
    socialLinks?: {
      discord?: string | null;
      telegram?: string | null;
      twitter?: string | null;
      website?: string | null;
    };
  };
  narrative?: {
    title: string;
    content: string;
    category: string;
    tags: string[];
    author: string;
  };
};

type ApiResponse = {
  success: boolean;
  message?: string;
  responseObject?: TrendingToken[];
};

function formatNumber(value?: string, opts: Intl.NumberFormatOptions = {}) {
  if (!value) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat(undefined, opts).format(num);
}

function formatPercent(value?: string) {
  if (!value) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `${(num * 100).toFixed(2)}%`;
}

function toNumber(value?: string) {
  if (!value) return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function trendTextClass(delta: number) {
  if (delta > 0) return "text-emerald-500";
  if (delta < 0) return "text-rose-500";
  return "text-gray-500";
}

function trendBadgeClass(delta: number) {
  if (delta > 0) return "bg-emerald-500/10 text-emerald-500";
  if (delta < 0) return "bg-rose-500/10 text-rose-500";
  return "bg-gray-500/10 text-gray-500";
}

function formatCompact(value?: string) {
  if (!value) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
}

function shortenAddress(addr?: string) {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  // Handle different address formats
  if (addr.includes('...')) return addr; // Already shortened
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 10) return "刚刚";
  if (diffSec < 60) return `${diffSec}秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}天前`;
}

type FeedItem = {
  id?: string;
  type?: string;
  createdAt?: number | string;
  token?: { name?: string; symbol?: string; address?: string };
  amountUSD?: string;
  message?: string;
  tokenAddress?: string;
  body?: {
    displayName?: string;
    userHandle?: string;
    userImageUrl?: string | null;
    tokenImageUrl?: string | null;
    ticker?: string;
    price?: number | string;
    marketCap?: number | string;
    realizedPnlUsd?: number;
    totalPnlUsd?: number;
    description?: string;
  };
};

type LeaderboardItem = {
  id?: string;
  address?: string;
  evmAddress?: string;
  createdAt?: string;
  displayName?: string;
  userHandle?: string;
  profilePictureLink?: string;
  description?: string | null;
  following?: number;
  followers?: number;
  activated?: boolean;
  isRestricted?: boolean;
  swapCount?: number;
  numTrades?: number;
  totalVolume?: number;
  private?: boolean;
  thumbhash?: string;
  pnl24h?: number;
  topHoldings?: Array<{
    imageUrl?: string;
    tokenAddress?: string;
    networkId?: number;
    humanAmount?: number;
    price?: number;
    value?: number;
  }>;
  totalHoldings?: number;
};

type LeaderboardResponse = {
  success: boolean;
  message?: string;
  responseObject?: {
    leaderboard?: LeaderboardItem[];
  };
};

export default function Page() {
  const [items, setItems] = useState<TrendingToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const initializedRef = useRef(false);
  const fetchingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'feed' | 'leaderboard'>('trending');
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[] | null>(null);
  const feedFetchingRef = useRef(false);
  const lastTokenRefreshRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const isFirstFeedLoadRef = useRef(true);
  const [expandedNarratives, setExpandedNarratives] = useState<Set<string>>(new Set());
  const [narrativeCache, setNarrativeCache] = useState<Map<string, TrendingToken['narrative']>>(new Map());
  const [loadingNarratives, setLoadingNarratives] = useState<Set<string>>(new Set());
  const [failedNarratives, setFailedNarratives] = useState<Set<string>>(new Set());
  const [highlightedFeed, setHighlightedFeed] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // 播放提示音
  const playNotificationSound = useCallback(() => {
    console.log('🔊 playNotificationSound 被调用, soundEnabled:', soundEnabled);
    if (!soundEnabled) {
      console.log('🔇 音效被禁用，跳过播放');
      return; // 如果音效被禁用，直接返回
    }
    
    try {
      // 创建音频上下文
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // 成功提示音：上升三音调 C-E-G (Do-Mi-Sol)
      const playSuccessTone = (startTime: number, frequency: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // 连接节点
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 设置音调：固定频率
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine'; // 使用正弦波，更柔和
        
        // 设置音量：温和的淡入淡出
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.1); // 温和上升
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration); // 温和下降
        
        // 播放音调
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // 播放成功提示音：重复2次 C-E-G 三音调
      const baseTime = audioContext.currentTime;
      
      // 第一组：C-E-G
      playSuccessTone(baseTime, 261.63, 0.3);        // C4 - Do
      playSuccessTone(baseTime + 0.2, 329.63, 0.3);  // E4 - Mi
      playSuccessTone(baseTime + 0.4, 392.00, 0.4);  // G4 - Sol
      
      // 第二组：重复第一组，间隔1.0秒
      playSuccessTone(baseTime + 1.0, 261.63, 0.3);  // C4 - Do
      playSuccessTone(baseTime + 1.2, 329.63, 0.3);  // E4 - Mi
      playSuccessTone(baseTime + 1.4, 392.00, 0.4);  // G4 - Sol
      
      console.log('🔊 播放成功提示音');
    } catch (error) {
      console.log('❌ 播放提示音失败:', error);
    }
  }, [soundEnabled]);


  const handleFetch = useCallback(async () => {
    console.log('🔄 handleFetch 被调用, fetchingRef.current:', fetchingRef.current);
    if (fetchingRef.current) {
      console.log('⏭️ handleFetch 跳过（正在执行中）');
      return;
    }
    fetchingRef.current = true;
    console.log('✅ handleFetch 开始执行');
    setError(null);
    try {
      const res = await fetch("/api/trendingTokens", { 
        method: "GET", 
        cache: "no-store",
        signal: AbortSignal.timeout(30000) // 30秒超时
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      if (!json.success) {
        throw new Error(json.message || "接口返回失败");
      }
      
      const newItems = json.responseObject || [];
      setItems(newItems);
      
      
      console.log('✅ handleFetch 完成');
    } catch (err) {
      console.log('❌ handleFetch 失败:', err);
      setError((err as Error).message);
    } finally {
      // 确保在任何情况下都重置状态
      fetchingRef.current = false;
    }
  }, []);


  // 切换叙事展开状态
  const fetchNarrative = useCallback(async (tokenAddress: string) => {
    if (narrativeCache.has(tokenAddress)) {
      return narrativeCache.get(tokenAddress);
    }

    // 如果之前已经失败过，直接返回失败状态
    if (failedNarratives.has(tokenAddress)) {
      return 'failed';
    }

    setLoadingNarratives(prev => new Set(prev).add(tokenAddress));

    try {
      const response = await fetch(`/api/narrative?tokenAddress=${tokenAddress}`, {
        method: 'GET',
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.narrative) {
          setNarrativeCache(prev => new Map(prev).set(tokenAddress, data.narrative));
          return data.narrative;
        } else {
          // API 返回成功但没有叙事数据
          setFailedNarratives(prev => new Set(prev).add(tokenAddress));
          return 'failed';
        }
      } else {
        // HTTP 请求失败
        setFailedNarratives(prev => new Set(prev).add(tokenAddress));
        return 'failed';
      }
    } catch (error) {
      console.log(`❌ 获取叙事失败:`, error);
      setFailedNarratives(prev => new Set(prev).add(tokenAddress));
      return 'failed';
    } finally {
      setLoadingNarratives(prev => {
        const newSet = new Set(prev);
        newSet.delete(tokenAddress);
        return newSet;
      });
    }
  }, [narrativeCache, failedNarratives]);

  const retryNarrative = useCallback(async (tokenAddress: string) => {
    // 清除失败状态，重新尝试
    setFailedNarratives(prev => {
      const newSet = new Set(prev);
      newSet.delete(tokenAddress);
      return newSet;
    });

    const result = await fetchNarrative(tokenAddress);
    if (result !== 'failed') {
      setExpandedNarratives(prev => new Set(prev).add(tokenAddress));
    }
  }, [fetchNarrative]);

  const toggleNarrative = useCallback(async (tokenAddress: string) => {
    // 如果已经展开，直接收起
    if (expandedNarratives.has(tokenAddress)) {
      setExpandedNarratives(prev => {
        const newSet = new Set(prev);
        newSet.delete(tokenAddress);
        return newSet;
      });
      return;
    }

    // 如果之前失败过，提供重试选项
    if (failedNarratives.has(tokenAddress)) {
      return;
    }

    // 如果缓存中没有叙事数据，先获取
    if (!narrativeCache.has(tokenAddress)) {
      const result = await fetchNarrative(tokenAddress);
      // 如果获取失败，不展开叙事
      if (result === 'failed') {
        return;
      }
    }

    // 展开叙事
    setExpandedNarratives(prev => new Set(prev).add(tokenAddress));
  }, [expandedNarratives, narrativeCache, fetchNarrative, failedNarratives]);

  const handleFetchFeed = useCallback(async () => {
    console.log('🔄 handleFetchFeed 被调用, feedFetchingRef.current:', feedFetchingRef.current);
    if (feedFetchingRef.current) {
      console.log('⏭️ handleFetchFeed 跳过（正在执行中）');
      return;
    }
    feedFetchingRef.current = true;
    console.log('✅ handleFetchFeed 开始执行');
    try {
      // Opportunistically refresh token every 15 minutes via client ping
      // Fire and forget; server maintains token store
      const now = Date.now();
      const shouldRefreshToken = now - lastTokenRefreshRef.current > 15 * 60 * 1000; // 15 minutes
      
      if (shouldRefreshToken) {
        lastTokenRefreshRef.current = now;
        fetch('/api/refresh-token', { method: 'POST' }).catch(() => {});
      }
      
      const res = await fetch("/api/feed", { 
        method: "GET", 
        cache: "no-store",
        signal: AbortSignal.timeout(30000) // 30秒超时
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = await res.json();
      const ro = json?.responseObject?.feed ?? json?.responseObject ?? json?.data ?? json?.items ?? json;
      const list: FeedItem[] = Array.isArray(ro) ? ro : (Array.isArray(ro?.feed) ? ro.feed : []);
      
      // Check for new items and show toast notifications
      console.log(`🔍 检查新消息: isFirstLoad=${isFirstFeedLoadRef.current}, listLength=${list.length}`);
      if (!isFirstFeedLoadRef.current && list.length > 0) {
        const firstMessageId = list[0]?.id;
        const lastMessageId = lastMessageIdRef.current;
        
        console.log(`📊 ID 比较: 最新消息ID=${firstMessageId}, 上次记录ID=${lastMessageId}`);
        
        if (firstMessageId && firstMessageId !== lastMessageId) {
          // Find all new messages (from the beginning until we hit the last known message)
          const newItems = [];
          for (const item of list) {
            if (item.id === lastMessageId) break; // Stop when we reach the last known message
            if (item.id) newItems.push(item);
          }
          
          console.log(`🆕 发现 ${newItems.length} 条新消息:`, newItems.map(item => item.id));
          newItems.forEach(item => {
            const userName = item.body?.userHandle || item.body?.displayName || "用户";
            const tokenSymbol = item.body?.ticker || item.token?.symbol || item.token?.name || "Token";
            const action = item.type === 'single_user_sell' ? '清仓' :
                          item.type?.toLowerCase().includes('buy') ? '买入' : 
                          item.type?.toLowerCase().includes('sell') ? '卖出' : '交易';
            
            // Log basic message info (no sensitive data)
            console.log(`📝 新消息: ${item.type} - ${userName} ${action} ${tokenSymbol}`);
            
            // For single_user_sell (清仓), show realized PnL instead of amount
            let amountText = '';
            let toastType = 'success';
            if (item.type === 'single_user_sell' && item.body?.realizedPnlUsd != null) {
              const pnl = Number(item.body.realizedPnlUsd);
              const pnlText = pnl >= 0 ? `+$${formatNumber(String(pnl), { maximumFractionDigits: 2 })}` : `$${formatNumber(String(pnl), { maximumFractionDigits: 2 })}`;
              amountText = `盈亏: ${pnlText}`;
              // Use success (green) for profit, error (red) for loss
              toastType = pnl >= 0 ? 'success' : 'error';
            } else if (item.body?.price) {
              amountText = `$${formatNumber(String(item.body.price), { maximumFractionDigits: 6 })}`;
            }
            
            // Note: Telegram push is now handled server-side to avoid duplicate notifications
            
            // Don't show toast for user_trade_profit_milestone
            if (item.type !== 'user_trade_profit_milestone') {
              console.log(`🔔 显示 toast 通知: ${userName} ${action} ${tokenSymbol} - ${amountText || '无金额信息'}`);
              const toastFunction = toastType === 'success' ? toast.success : toast.error;
              toastFunction(
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{userName} {action} {tokenSymbol}</div>
                    {amountText && (
                      <div className="text-xs text-gray-300">{amountText}</div>
                    )}
                  </div>
                </div>,
                {
                  duration: 4000,
                  position: 'top-right',
                }
              );
            } else {
              console.log(`⏭️ 跳过 toast 通知 (user_trade_profit_milestone): ${userName} ${action} ${tokenSymbol}`);
            }
          });
        }
      }
      
      // 检测动态一栏第一条消息是否发生变化（使用与toast相同的检测逻辑）
      console.log(`🔍 检测动态变化: isFirstLoad=${isFirstFeedLoadRef.current}, listLength=${list.length}, lastMessageId=${lastMessageIdRef.current}`);
      if (!isFirstFeedLoadRef.current && list.length > 0) {
        const firstMessageId = list[0]?.id;
        const lastMessageId = lastMessageIdRef.current;
        
        console.log(`📊 ID 比较: 最新消息ID=${firstMessageId}, 上次记录ID=${lastMessageId}`);
        
        if (firstMessageId && firstMessageId !== lastMessageId) {
          console.log('🎯 动态第一条发生变化:', lastMessageId, '->', firstMessageId);
          setHighlightedFeed(firstMessageId);
          console.log('🔊 准备播放提示音...');
          playNotificationSound(); // 播放提示音
          // 5秒后取消高亮
          setTimeout(() => {
            setHighlightedFeed(null);
          }, 5000);
        }
      }
      
      // Update last message ID for next comparison
      if (list.length > 0 && list[0]?.id) {
        lastMessageIdRef.current = list[0].id;
      }
      
      isFirstFeedLoadRef.current = false;
      
      console.log(`💾 更新ID记录: 最新消息ID=${lastMessageIdRef.current}, isFirstLoad=${isFirstFeedLoadRef.current}`);
      
      setFeed(list);
    } catch {
      // keep silent; shown via trending error if needed, or extend with feedError
      console.log('❌ handleFetchFeed 失败');
    } finally {
      // 确保在任何情况下都重置状态
      console.log('✅ handleFetchFeed 完成');
      feedFetchingRef.current = false;
    }
  }, [playNotificationSound]);

  const handleFetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LeaderboardResponse = await res.json();
      if (!json.success) throw new Error(json.message || "接口返回失败");
      setLeaderboard(json.responseObject?.leaderboard || []);
      console.log('✅ handleFetchLeaderboard 完成');
    } catch (err) {
      console.log('❌ handleFetchLeaderboard 失败:', err);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // Initialize token refresh timestamp to ensure first call happens
    lastTokenRefreshRef.current = 0;
    
    // 第一次加载时，先获取数据，成功后再启动倒计时
    const initializeData = async () => {
      console.log('🚀 开始初始化数据');
      
      // 先尝试刷新 token，给一些时间让 token 准备好
      try {
        console.log('🔄 尝试刷新 token...');
        await fetch('/api/refresh-token', { method: 'POST' });
        console.log('✅ Token 刷新完成');
      } catch (error) {
        console.log('❌ Token 刷新失败，继续使用现有 token:', error);
      }
      
      // 等待一小段时间让 token 生效
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 先获取数据，等待完成
      try {
        console.log('🔄 开始获取数据...');
        await Promise.all([
          handleFetch(),
          handleFetchFeed()
        ]);
        console.log('✅ 初始数据加载完成，开始倒计时');
        
        // 数据加载完成后，启动倒计时
        setCountdown(5);
        const intervalId = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              handleFetch();
              handleFetchFeed();
              return 5;
            }
            return prev - 1;
          });
        }, 1000);
        
        // 返回清理函数
        return () => clearInterval(intervalId);
      } catch (error) {
        console.log('❌ 初始数据加载失败:', error);
        // 即使失败也启动倒计时，给用户重试的机会
        setCountdown(5);
        const intervalId = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              handleFetch();
              handleFetchFeed();
              return 5;
            }
            return prev - 1;
          });
        }, 1000);
        
        return () => clearInterval(intervalId);
      }
    };
    
    // 启动服务器端监控（只启动一次）
    fetch('/api/monitor-service', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'init' }),
    }).catch(error => {
      console.log('❌ 启动服务器端监控失败:', error);
    });
    
    // 执行初始化，并处理清理函数
    let cleanup: (() => void) | undefined;
    let isMounted = true;
    
    initializeData().then((cleanupFn) => {
      if (isMounted) {
        cleanup = cleanupFn;
      } else if (cleanupFn) {
        // 如果组件已经卸载，立即清理
        cleanupFn();
      }
    });
    
    return () => {
      isMounted = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, []); // 空依赖数组，确保定时器只创建一次

  return (
    <div className="min-h-screen p-6 flex flex-col items-center gap-4 bg-black text-white">
      <div className="w-full max-w-5xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab('trending')}
              className={`px-2 py-1 rounded ${activeTab === 'trending' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              趋势
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className={`px-2 py-1 rounded ${activeTab === 'feed' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              动态
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('leaderboard');
                handleFetchLeaderboard();
              }}
              className={`hidden sm:block px-2 py-1 rounded ${activeTab === 'leaderboard' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              排行榜
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {countdown !== null && (
            <div className="text-xs text-neutral-400">下次刷新：{countdown}s</div>
          )}
          {/* 音效开关 - 仅在桌面端显示 */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`hidden sm:block px-3 py-1 text-xs rounded transition-colors ${
              soundEnabled 
                ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-600' 
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700'
            }`}
            title={soundEnabled ? '关闭提示音' : '开启提示音'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {activeTab === 'trending' && Array.isArray(items) && (
        <div className="w-full max-w-5xl grid grid-cols-1 gap-4">
          {items.length === 0 && (
            <div className="text-gray-400">暂无数据</div>
          )}
          {items.map((it, idx) => {
            const title = `${it.token?.name || "-"} (${it.token?.symbol || "-"})`;
            const delta24 = toNumber(it.change24);
            return (
              <div key={idx} className="space-y-0">
                <div className={`border p-3 sm:p-4 flex items-start gap-3 sm:gap-4 shadow-sm relative transition-all duration-500 border-neutral-800 bg-neutral-900 ${
                  it.token?.address && expandedNarratives.has(it.token.address) ? 'rounded-t-xl' : 'rounded-xl'
                }`}>
                {it.token?.info?.imageThumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.token.info.imageThumbUrl}
                    alt={it.token?.symbol || "token"}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded bg-neutral-800" />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
                    <span>{title}</span>
                    {it.token?.address && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(it.token!.address!)}
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                        aria-label="复制地址"
                        title={it.token.address}
                      >
                        <FiCopy size={14} />
                      </button>
                    )}
                  </div>
                  {/* 价格显示 */}
                  <div className="mt-1">
                    <span className={`text-sm sm:text-base font-semibold ${trendTextClass(delta24)}`}>
                      ${formatNumber(it.priceUSD, { maximumFractionDigits: 6 })}
                    </span>
                  </div>
                  
                  {/* 数据标签 - 响应式布局 */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                      市值 {formatCompact(it.marketCap)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                      流动性 {formatCompact(it.liquidity)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                      交易量 {formatCompact(it.volume24)}
                    </span>
                    {/* 可点击的叙事标签 */}
                    {it.token?.address && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => it.token?.address && toggleNarrative(it.token.address)}
                          disabled={!it.token?.address || loadingNarratives.has(it.token.address) || failedNarratives.has(it.token.address)}
                          className={`text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed ${
                            failedNarratives.has(it.token?.address || '')
                              ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
                          } ${loadingNarratives.has(it.token?.address || '') ? 'opacity-50' : ''}`}
                          title={
                            failedNarratives.has(it.token?.address || '')
                              ? '该 Token 暂无叙事数据'
                              : '点击查看项目叙事'
                          }
                        >
                          {loadingNarratives.has(it.token?.address || '') 
                            ? '加载中...' 
                            : failedNarratives.has(it.token?.address || '') 
                              ? '暂无叙事' 
                              : '叙事'
                          }
                        </button>
                        {it.token?.address && failedNarratives.has(it.token.address) && (
                          <button
                            onClick={() => it.token?.address && retryNarrative(it.token.address)}
                            disabled={loadingNarratives.has(it.token.address)}
                            className="text-xs px-1 py-0.5 rounded-full bg-neutral-600 text-neutral-400 hover:bg-neutral-500 hover:text-white transition-colors"
                            title="重新尝试获取叙事"
                          >
                            🔄
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* 趋势数据 - 响应式显示 */}
                  <div className="mt-3 text-sm flex flex-wrap gap-2">
                    {/* 手机端只显示 1h 和 24h */}
                    <div className="flex gap-2 sm:hidden">
                      {[
                        { label: "1h", v: toNumber(it.change1) },
                        { label: "24h", v: toNumber(it.change24) },
                      ].map(({ label, v }) => (
                        <span
                          key={label}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${trendBadgeClass(v)}`}
                        >
                          {label} {formatPercent(String(v))}
                        </span>
                      ))}
                    </div>
                    
                    {/* 桌面端显示全部趋势 */}
                    <div className="hidden sm:flex gap-2">
                      {[
                        { label: "1h", v: toNumber(it.change1) },
                        { label: "4h", v: toNumber(it.change4) },
                        { label: "12h", v: toNumber(it.change12) },
                        { label: "24h", v: toNumber(it.change24) },
                      ].map(({ label, v }) => (
                        <span
                          key={label}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${trendBadgeClass(v)}`}
                        >
                          {label} {formatPercent(String(v))}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* 社交链接 - 响应式显示 */}
                <div className="flex items-center gap-1 sm:gap-2 ml-2 self-start">
                  {/* 手机端只显示 Twitter 和 Telegram */}
                  <div className="flex gap-1 sm:hidden">
                    {it.token?.socialLinks?.twitter && (
                      <a
                        href={it.token.socialLinks.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Twitter"
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                      >
                        <FaTwitter size={14} />
                      </a>
                    )}
                    {it.token?.socialLinks?.telegram && (
                      <a
                        href={it.token.socialLinks.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Telegram"
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                      >
                        <FaTelegramPlane size={14} />
                      </a>
                    )}
                  </div>
                  
                  {/* 桌面端显示全部社交链接 */}
                  <div className="hidden sm:flex gap-2">
                    {it.token?.socialLinks?.website && (
                      <a
                        href={it.token.socialLinks.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Website"
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                      >
                        <FaGlobe size={16} />
                      </a>
                    )}
                    {it.token?.socialLinks?.twitter && (
                      <a
                        href={it.token.socialLinks.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Twitter"
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                      >
                        <FaTwitter size={16} />
                      </a>
                    )}
                    {it.token?.socialLinks?.telegram && (
                      <a
                        href={it.token.socialLinks.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Telegram"
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                      >
                        <FaTelegramPlane size={16} />
                      </a>
                    )}
                    {it.token?.socialLinks?.discord && (
                      <a
                        href={it.token.socialLinks.discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Discord"
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                      >
                        <FaDiscord size={16} />
                      </a>
                    )}
                  </div>
                </div>
                
                
                {it.createdAt && (
                  <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 text-xs text-neutral-500">
                    <span className="hidden sm:inline">创建于 </span>{timeAgo(new Date(it.createdAt * 1000))}
                  </div>
                )}
                </div>
                
                {/* 展开的叙事内容 - 抽屉效果 */}
                {it.token?.address && expandedNarratives.has(it.token.address) && narrativeCache.has(it.token.address) && (
                  <div className="overflow-hidden transition-all duration-300 ease-in-out max-h-96 opacity-100">
                    <div className="bg-neutral-800 border-l border-r border-b border-neutral-800 rounded-b-xl p-4 -mt-px">
                      {(() => {
                        const narrative = narrativeCache.get(it.token.address);
                        if (!narrative) return null;
                        
                        return (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <FaInfoCircle className="text-blue-400" size={16} />
                                <h3 className="text-lg font-semibold text-white">{narrative.title}</h3>
                              </div>
                              <button
                                onClick={() => it.token?.address && toggleNarrative(it.token.address)}
                                className="text-neutral-400 hover:text-white transition-colors"
                              >
                                <span className="text-sm">收起</span>
                              </button>
                            </div>

                            <div className="space-y-4">
                              <p className="text-neutral-300 leading-relaxed">{narrative.content}</p>

                              {narrative.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {narrative.tags.map((tag: string, tagIdx: number) => (
                                    <span
                                      key={tagIdx}
                                      className="text-xs px-3 py-1 rounded-full bg-neutral-700 text-neutral-300"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-2 text-sm text-neutral-500 pt-2 border-t border-neutral-700">
                                {narrative.author === 'ai-analysis' ? (
                                  <FaRobot size={14} />
                                ) : (
                                  <FaUser size={14} />
                                )}
                                <span>来源: {narrative.author === 'ai-analysis' ? 'AI 分析' : narrative.author}</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'feed' && Array.isArray(feed) && (
        <div className="w-full max-w-5xl grid grid-cols-1 gap-3">
          {feed.length === 0 && <div className="text-gray-400">暂无动态</div>}
          {feed.map((f, i) => {
            const b = f.body || {};
            const userName = b.userHandle || b.displayName || "-";
            const userImg = b.userImageUrl || undefined;
            const tokenImg = b.tokenImageUrl || undefined;
            const tokenSymbol = b.ticker || f.token?.symbol || f.token?.name || "-";
            const priceStr = b.price != null ? String(b.price) : undefined;
            const mcStr = b.marketCap != null ? String(b.marketCap) : undefined;
            const isBuy = (f.type || '').toLowerCase().includes('buy') && f.type !== 'single_user_buy';
            const isSell = (f.type || '').toLowerCase().includes('sell');
            const buyUsdRaw = (b as Record<string, unknown>)?.humanUsdAmount
              ?? (b as Record<string, unknown>)?.inHumanAmount
              ?? (f as Record<string, unknown>)?.amountUSD;
            const sellUsdRaw = (b as Record<string, unknown>)?.humanUsdAmount
              ?? (b as Record<string, unknown>)?.outHumanAmount
              ?? (f as Record<string, unknown>)?.amountUSD;
            const buyUsd = buyUsdRaw != null ? String(buyUsdRaw) : undefined;
            const sellUsd = sellUsdRaw != null ? String(sellUsdRaw) : undefined;
            const isManual = f.type === 'manual';
            
            return (
              <div key={f.id || i} className={`border rounded-xl p-3 sm:p-4 shadow-sm relative transition-all duration-500 ${
                f.id && highlightedFeed === f.id
                  ? 'border-blue-500 bg-blue-500/10 shadow-blue-500/20 shadow-lg animate-pulse'
                  : 'border-neutral-800 bg-neutral-900'
              }`} style={{
                animation: f.id && highlightedFeed === f.id 
                  ? 'shake 0.5s ease-in-out 3' 
                  : undefined
              }}>
                {/* 新动态提示标签 */}
                {f.id && highlightedFeed === f.id && (
                  <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg animate-pulse">
                    新
                  </div>
                )}
                {/* 公告类型显示 */}
                {isManual ? (
                  <div className="space-y-3">
                    {/* 公告头部 */}
                    <div className="flex items-center gap-2">
                      {userImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={userImg} alt={userName} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-neutral-800" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">公告</div>
                        <div className="text-xs text-neutral-500">
                          {f.createdAt && (() => {
                            const ts = typeof f.createdAt === 'string' ? new Date(f.createdAt) : new Date(Number(f.createdAt) * 1000);
                            return timeAgo(ts);
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {/* 公告内容 */}
                    <div className="bg-neutral-800 rounded-lg p-3">
                      <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                        {b.description || '暂无公告内容'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 手机端布局 */}
                    <div className="block sm:hidden space-y-3">
                  {/* 用户信息行 */}
                  <div className="flex items-center gap-2">
                    {userImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userImg} alt={userName} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-neutral-800" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{userName}</div>
                      <div className="text-xs text-neutral-500">
                        {f.createdAt && (() => {
                          const ts = typeof f.createdAt === 'string' ? new Date(f.createdAt) : new Date(Number(f.createdAt) * 1000);
                          return timeAgo(ts);
                        })()}
                      </div>
                    </div>
                    {/* 操作类型标签 */}
                    <div className="flex-shrink-0">
                      {isBuy && buyUsd && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-900 text-emerald-300">
                          买入 ${formatCompact(buyUsd)}
                        </span>
                      )}
                      {isSell && sellUsd && f.type !== 'single_user_sell' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-rose-900 text-rose-300">
                          卖出 ${formatCompact(sellUsd)}
                        </span>
                      )}
                      {f.type === 'single_user_sell' && f.body?.realizedPnlUsd != null && (
                        <span className={`text-xs px-2 py-1 rounded-full ${Number(f.body.realizedPnlUsd) >= 0 ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}`}>
                          清仓 {Number(f.body.realizedPnlUsd) >= 0 ? '+' : ''}${formatNumber(String(f.body.realizedPnlUsd), { maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {f.type === 'user_trade_profit_milestone' && f.body?.totalPnlUsd != null && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-900 text-emerald-300">
                          获利 +${formatNumber(String(f.body.totalPnlUsd), { maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {f.type === 'single_user_buy' && buyUsd && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-900 text-blue-300">
                          持仓 ${formatCompact(buyUsd)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Token 信息行 */}
                  <div className="flex items-center gap-2">
                    {tokenImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tokenImg} alt={tokenSymbol} className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-neutral-800" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{tokenSymbol}</div>
                      <div className="text-xs text-neutral-500 truncate flex items-center gap-1">
                        <span>{shortenAddress(f.tokenAddress)}</span>
                        {f.tokenAddress && (
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(f.tokenAddress!)}
                            className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                            aria-label="复制地址"
                            title={f.tokenAddress}
                          >
                            <FiCopy size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-white">
                        {priceStr ? `$${formatNumber(priceStr, { maximumFractionDigits: 6 })}` : '-'}
                      </div>
                      <div className="text-xs text-neutral-500">市值 {formatCompact(mcStr)}</div>
                    </div>
                  </div>
                </div>

                {/* 桌面端布局 */}
                <div className="hidden sm:flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* User */}
                    {userImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userImg} alt={userName} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-neutral-800" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate flex items-center gap-2">
                        <span className="truncate">{userName}</span>
                        {isBuy && buyUsd && (
                          <span 
                            className="text-[11px] text-emerald-400"
                            title={f.type}
                          >
                            买入 ${formatCompact(buyUsd)}
                          </span>
                        )}
                        {isSell && sellUsd && f.type !== 'single_user_sell' && (
                          <span 
                            className="text-[11px] text-rose-400"
                            title={f.type}
                          >
                            卖出 ${formatCompact(sellUsd)}
                          </span>
                        )}
                        {f.type === 'single_user_sell' && f.body?.realizedPnlUsd != null && (
                          <span 
                            className={`text-[11px] ${Number(f.body.realizedPnlUsd) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                            title={f.type}
                          >
                            清仓 {Number(f.body.realizedPnlUsd) >= 0 ? '+' : ''}${formatNumber(String(f.body.realizedPnlUsd), { maximumFractionDigits: 2 })}
                          </span>
                        )}
                        {f.type === 'user_trade_profit_milestone' && f.body?.totalPnlUsd != null && (
                          <span 
                            className="text-[11px] text-emerald-400"
                            title={f.type}
                          >
                            获利 +${formatNumber(String(f.body.totalPnlUsd), { maximumFractionDigits: 2 })}
                          </span>
                        )}
                        {f.type === 'single_user_buy' && buyUsd && (
                          <span 
                            className="text-[11px] text-blue-400"
                            title={f.type}
                          >
                            持仓 ${formatCompact(buyUsd)}
                          </span>
                        )}
                        {f.createdAt && (() => {
                          const ts = typeof f.createdAt === 'string' ? new Date(f.createdAt) : new Date(Number(f.createdAt) * 1000);
                          return <span className="text-[11px] text-neutral-500">· {timeAgo(ts)}</span>;
                        })()}
                      </div>
                    </div>
                    {/* Separator */}
                    <div className="w-px h-6 bg-neutral-800 mx-1" />
                    {/* Token */}
                    {tokenImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tokenImg} alt={tokenSymbol} className="w-7 h-7 rounded object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-neutral-800" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{tokenSymbol}</div>
                      <div className="text-[11px] text-neutral-500 truncate flex items-center gap-1">
                        <span>{shortenAddress(f.tokenAddress)}</span>
                        {f.tokenAddress && (
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(f.tokenAddress!)}
                            className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                            aria-label="复制地址"
                            title={f.tokenAddress}
                          >
                            <FiCopy size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {priceStr ? `$${formatNumber(priceStr, { maximumFractionDigits: 6 })}` : '-'}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">市值 {formatCompact(mcStr)}</div>
                  </div>
                </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'leaderboard' && Array.isArray(leaderboard) && (
        <div className="w-full max-w-5xl grid grid-cols-1 gap-3">
          {leaderboard.length === 0 && <div className="text-gray-400">暂无排行榜数据</div>}
          {leaderboard.map((item, index) => (
            <div key={item.id || index} className="border border-neutral-800 rounded-xl p-3 sm:p-4 bg-neutral-900">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* 排名 */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">#{index + 1}</span>
                  </div>
                  
                  {/* 用户信息 */}
                  {item.profilePictureLink ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={item.profilePictureLink} 
                      alt={item.displayName || "用户"} 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0" 
                    />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-neutral-800 flex-shrink-0" />
                  )}
                  
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">
                      {item.displayName || item.userHandle || "未知用户"}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {item.followers ? `${formatCompact(String(item.followers))} 粉丝` : ''}
                    </div>
                  </div>
                </div>

                {/* 交易数据 */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-lg sm:text-xl font-bold ${(item.pnl24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.pnl24h ? `${(item.pnl24h >= 0 ? '+' : '')}$${formatNumber(String(item.pnl24h), { maximumFractionDigits: 2 })}` : '-'}
                  </div>
                  <div className="text-sm text-neutral-400 font-medium">
                    24h 盈亏
                  </div>
                </div>
              </div>

              {/* 交易统计 */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-400">
                <span>总交易量: ${formatCompact(String(item.totalVolume || 0))}</span>
                <span>交易次数: {item.numTrades || 0}</span>
                <span>持仓数: {item.totalHoldings || 0}</span>
              </div>

              {/* 前3个持仓 */}
              {item.topHoldings && item.topHoldings.length > 0 && (
                <div className="mt-4 pt-3 border-t border-neutral-800">
                  <div className="text-xs text-neutral-500 mb-3 font-medium">前3持仓</div>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {item.topHoldings.slice(0, 3).map((holding, holdingIndex) => (
                      <div key={holdingIndex} className="bg-neutral-800 rounded-lg px-3 py-2.5 hover:bg-neutral-750 transition-colors min-w-0 flex-1 sm:flex-none sm:w-auto">
                        <div className="flex items-center gap-2.5">
                          {holding.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={holding.imageUrl} 
                              alt="Token" 
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0" 
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-white truncate">
                              ${formatNumber(String(holding.value || 0), { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-neutral-400 truncate">
                              {holding.tokenAddress === 'So11111111111111111111111111111111111111112' 
                                ? formatNumber(String(holding.humanAmount || 0), { maximumFractionDigits: 4 })
                                : formatCompact(String(holding.humanAmount || 0))
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
