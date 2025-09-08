"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FaGlobe, FaTwitter, FaTelegramPlane, FaDiscord } from "react-icons/fa";
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
  };
};

export default function Page() {
  const [items, setItems] = useState<TrendingToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const initializedRef = useRef(false);
  const fetchingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'feed'>('trending');
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const feedFetchingRef = useRef(false);
  const lastTokenRefreshRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const isFirstFeedLoadRef = useRef(true);

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
      setItems(json.responseObject || []);
      console.log('✅ handleFetch 完成');
    } catch (err) {
      console.log('❌ handleFetch 失败:', err);
      setError((err as Error).message);
    } finally {
      // 确保在任何情况下都重置状态
      fetchingRef.current = false;
    }
  }, []);

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
  }, [handleFetch, handleFetchFeed]);

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
          </div>
        </div>
        <div className="flex items-center gap-4">
          {countdown !== null && (
            <div className="text-xs text-neutral-400">下次刷新：{countdown}s</div>
          )}
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
              <div key={idx} className="border border-neutral-800 rounded-xl p-4 flex items-start gap-4 bg-neutral-900 shadow-sm relative">
                {it.token?.info?.imageThumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.token.info.imageThumbUrl}
                    alt={it.token?.symbol || "token"}
                    className="w-14 h-14 rounded object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded bg-neutral-800" />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-lg tracking-tight text-white flex items-center gap-2">
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
                  <div className="mt-1 text-sm text-gray-300 flex flex-wrap items-center gap-4">
                    <span className={`text-base font-semibold ${trendTextClass(delta24)}`}>
                      ${formatNumber(it.priceUSD, { maximumFractionDigits: 6 })}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                      市值 {formatCompact(it.marketCap)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                      流动性 {formatCompact(it.liquidity)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                      交易量 {formatCompact(it.volume24)}
                    </span>
                  </div>
                  <div className="mt-3 text-sm flex flex-wrap gap-2">
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
                <div className="flex items-center gap-2 ml-2 self-start">
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
                {it.createdAt && (
                  <div className="absolute bottom-4 right-4 text-xs text-neutral-500">
                    创建于 {timeAgo(new Date(it.createdAt * 1000))}
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
            return (
              <div key={f.id || i} className="border border-neutral-800 rounded-xl p-3 bg-neutral-900">
                <div className="flex items-center justify-between gap-3">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
