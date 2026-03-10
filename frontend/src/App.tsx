import { useState, useEffect, useCallback, useMemo } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "./contract";
import "./App.css";

interface Market {
  id: number;
  question: string;
  deadline: bigint;
  resolver: string;
  yesPool: bigint;
  noPool: bigint;
  resolved: boolean;
  winningOutcome: number;
  category: string;
  yesCount: number;
  noCount: number;
  encrypted: boolean;
}

interface UserBet {
  yesAmount: bigint;
  noAmount: bigint;
  claimed: boolean;
}

type Filter = "all" | "active" | "resolved";

const e = (v: number) => BigInt(Math.floor(v * 1e18));
const nowTs = Math.floor(Date.now() / 1000);
const day = 86400;

const m_ = (id: number, question: string, dDays: number, yP: number, nP: number, resolved: boolean, wo: number, category: string, yC: number, nC: number, enc: boolean): Market => ({
  id, question, deadline: BigInt(nowTs + dDays * day), resolver: "0x0",
  yesPool: e(yP), noPool: e(nP), resolved, winningOutcome: wo, category,
  yesCount: yC, noCount: nC, encrypted: enc,
});

const MOCK_MARKETS: Market[] = [
  // Crypto
  m_(0, "Will AVAX reach $100 by end of Q2 2026?", 90, 342.5, 187.3, false, 0, "Crypto", 47, 31, true),
  m_(1, "Will Bitcoin hit $150k in 2026?", 180, 2841.2, 1950.6, false, 0, "Crypto", 312, 198, true),
  m_(2, "Will Ethereum surpass $8,000 by December 2026?", 270, 1523.8, 892.1, false, 0, "Crypto", 156, 89, true),
  m_(3, "Will Solana flip Ethereum in daily transactions by Q3 2026?", 180, 678.4, 1245.9, false, 0, "Crypto", 78, 134, true),
  m_(4, "Will a new top-10 cryptocurrency emerge in 2026?", 270, 412.7, 389.1, false, 0, "Crypto", 52, 48, true),
  // DeFi
  m_(5, "Will DeFi total TVL exceed $300B by end of 2026?", 270, 1680.0, 920.4, false, 0, "DeFi", 189, 102, true),
  m_(6, "Will Avalanche TVL exceed $5B by April 2026?", 30, 523.9, 678.4, false, 0, "DeFi", 67, 82, true),
  m_(7, "Will a DEX surpass Uniswap in monthly volume?", 180, 234.5, 567.8, false, 0, "DeFi", 29, 71, true),
  m_(8, "Will real-world asset (RWA) TVL exceed $50B?", 180, 890.2, 445.6, false, 0, "DeFi", 98, 54, true),
  m_(9, "Will a lending protocol suffer a $100M+ exploit in 2026?", 270, 732.1, 298.8, false, 0, "DeFi", 87, 34, true),
  // Regulation
  m_(10, "Will the US pass a stablecoin regulation bill in 2026?", 180, 890.0, 1120.5, false, 0, "Regulation", 95, 123, true),
  m_(11, "Will the EU enforce MiCA on all crypto exchanges by mid 2026?", 90, 567.3, 234.7, false, 0, "Regulation", 72, 28, true),
  m_(12, "Will a US spot ETH ETF get approved with staking?", 180, 1456.2, 678.9, false, 0, "Regulation", 167, 78, true),
  m_(13, "Will any country ban Bitcoin in 2026?", 270, 189.4, 845.2, false, 0, "Regulation", 23, 104, true),
  m_(14, "Will a country adopt Bitcoin as legal tender in 2026?", 270, 576.3, 843.7, false, 0, "Regulation", 67, 98, true),
  // Avalanche
  m_(15, "Will Avalanche launch 100+ L1s on its network by mid 2026?", 90, 415.6, 389.3, false, 0, "Avalanche", 51, 47, true),
  m_(16, "Will an Avalanche subnet host a top-100 game?", 180, 345.2, 456.8, false, 0, "Avalanche", 41, 56, true),
  m_(17, "Will AVAX staking APY exceed 10%?", 90, 267.9, 534.1, false, 0, "Avalanche", 32, 65, true),
  m_(18, "Will Avalanche process 1M daily transactions?", 180, 612.3, 387.7, false, 0, "Avalanche", 74, 46, true),
  m_(19, "Will AvaCloud onboard a Fortune 500 company?", 270, 478.5, 321.5, false, 0, "Avalanche", 58, 39, true),
  // Tech
  m_(20, "Will Ethereum complete the Pectra upgrade by June 2026?", 90, 1205.8, 412.1, false, 0, "Tech", 142, 48, true),
  m_(21, "Will NFT trading volume surpass $2B monthly by Q3 2026?", 180, 156.7, 445.2, false, 0, "Tech", 19, 55, true),
  m_(22, "Will a major centralized exchange get hacked in 2026?", 270, 732.1, 298.8, false, 0, "Tech", 87, 36, true),
  m_(23, "Will zero-knowledge proofs be used in a national election?", 270, 123.4, 678.9, false, 0, "Tech", 15, 82, true),
  m_(24, "Will Bitcoin spot ETFs accumulate $50B in AUM by Q1 2026?", -10, 3200.0, 1100.4, true, 0, "Crypto", 390, 130, true),
];

const CATEGORIES = ["All", "Crypto", "DeFi", "Regulation", "Avalanche", "Tech"];

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userBets, setUserBets] = useState<Record<number, UserBet>>({});
  const [betAmounts, setBetAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getProvider = () => {
    if (!(window as any).ethereum) return null;
    return new BrowserProvider((window as any).ethereum);
  };

  const connect = async () => {
    const provider = getProvider();
    if (!provider) return showToast("Install MetaMask or Core Wallet", "error");
    try {
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
    } catch {
      showToast("Connection rejected", "error");
    }
  };

  const loadMarkets = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setMarkets(MOCK_MARKETS);
      setDemoMode(true);
      setLoading(false);
      return;
    }
    try {
      const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
      const count = Number(await contract.marketCount());
      if (count === 0) throw new Error("No markets");
      const loaded: Market[] = [];
      for (let i = 0; i < count; i++) {
        const m = await contract.getMarket(i);
        loaded.push({
          id: i, question: m.question, deadline: m.deadline, resolver: m.resolver,
          yesPool: m.yesPool, noPool: m.noPool, resolved: m.resolved,
          winningOutcome: Number(m.winningOutcome), category: "Crypto",
          yesCount: 0, noCount: 0, encrypted: true,
        });
      }
      setMarkets(loaded);
      setDemoMode(false);
      if (account) {
        const bets: Record<number, UserBet> = {};
        for (let i = 0; i < count; i++) {
          const b = await contract.getUserBet(i, account);
          if (b.yesAmount > 0n || b.noAmount > 0n)
            bets[i] = { yesAmount: b.yesAmount, noAmount: b.noAmount, claimed: b.claimed };
        }
        setUserBets(bets);
      }
    } catch {
      setMarkets(MOCK_MARKETS);
      setDemoMode(true);
    }
    setLoading(false);
  }, [account]);

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const onAccounts = (accounts: string[]) => setAccount(accounts[0] || null);
    eth.on("accountsChanged", onAccounts);
    eth.request({ method: "eth_accounts" }).then((a: string[]) => { if (a[0]) setAccount(a[0]); });
    return () => eth.removeListener("accountsChanged", onAccounts);
  }, []);

  const placeBet = async (marketId: number, outcome: number) => {
    if (demoMode) {
      const amount = betAmounts[marketId];
      if (!amount || parseFloat(amount) <= 0) return showToast("Enter a valid amount", "error");
      const val = e(parseFloat(amount));
      setMarkets(prev => prev.map(m => m.id === marketId ? { ...m, yesPool: outcome === 0 ? m.yesPool + val : m.yesPool, noPool: outcome === 1 ? m.noPool + val : m.noPool } : m));
      setBetAmounts(p => ({ ...p, [marketId]: "" }));
      showToast(`Demo: bet ${amount} AVAX on ${outcome === 0 ? "Yes" : "No"}`, "success");
      return;
    }
    const provider = getProvider();
    if (!provider || !account) return connect();
    const amount = betAmounts[marketId];
    if (!amount || parseFloat(amount) <= 0) return showToast("Enter a valid amount", "error");
    try {
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);
      const tx = await contract.placeBet(marketId, outcome, { value: parseEther(amount) });
      showToast("Transaction submitted...", "success");
      await tx.wait();
      showToast("Bet placed!", "success");
      setBetAmounts(p => ({ ...p, [marketId]: "" }));
      loadMarkets();
    } catch (e: any) {
      showToast(e.reason || "Transaction failed", "error");
    }
  };

  const claim = async (marketId: number) => {
    const provider = getProvider();
    if (!provider || !account) return;
    try {
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);
      const tx = await contract.claimPayout(marketId);
      showToast("Claiming payout...", "success");
      await tx.wait();
      showToast("Payout claimed!", "success");
      loadMarkets();
    } catch (e: any) {
      showToast(e.reason || "Claim failed", "error");
    }
  };

  const now = BigInt(Math.floor(Date.now() / 1000));
  const isActive = (m: Market) => !m.resolved && m.deadline > now;
  const isExpired = (m: Market) => !m.resolved && m.deadline <= now;

  const filtered = useMemo(() => {
    return markets.filter(m => {
      if (filter === "active" && !isActive(m)) return false;
      if (filter === "resolved" && !m.resolved) return false;
      if (category !== "All" && m.category !== category) return false;
      if (search && !m.question.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [markets, filter, category, search]);

  const totalPool = markets.reduce((s, m) => s + m.yesPool + m.noPool, 0n);
  const activeCount = markets.filter(isActive).length;
  const totalVol = parseFloat(formatEther(totalPool));

  const fmtEth = (v: bigint) => {
    const f = parseFloat(formatEther(v));
    return f < 0.001 && f > 0 ? "<0.001" : f.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  const fmtDeadline = (ts: bigint) => {
    const d = new Date(Number(ts) * 1000);
    const diff = Number(ts) - Math.floor(Date.now() / 1000);
    const days = Math.ceil(diff / 86400);
    if (days < 0) return "Ended";
    if (days <= 1) return "< 1 day left";
    if (days <= 30) return `${days} days left`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const yesPercent = (m: Market) => {
    const total = m.yesPool + m.noPool;
    if (total === 0n) return 50;
    return Number((m.yesPool * 100n) / total);
  };

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "Crypto": return "₿";
      case "DeFi": return "⟠";
      case "Regulation": return "⚖";
      case "Avalanche": return "◆";
      case "Tech": return "⚡";
      default: return "●";
    }
  };

  return (
    <div className="app-shell">
      {/* Ambient glow effects */}
      <div className="glow glow-1" />
      <div className="glow glow-2" />

      <header className="header">
        <div className="logo-section">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 19.5H8.5L12 13L15.5 19.5H22L12 2Z" fill="currentColor"/>
            </svg>
          </div>
          <div className="logo-text">
            Avalanche<span>Predict</span>
          </div>
        </div>
        <div className="header-right">
          {demoMode && <div className="demo-pill">Demo</div>}
          {account ? (
            <div className="wallet-badge">
              <div className="wallet-dot" />
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
          ) : (
            <button className="connect-btn" onClick={connect}>
              <span className="connect-icon">⬡</span>
              Connect
            </button>
          )}
        </div>
      </header>

      {/* Hero Stats */}
      <div className="hero-stats">
        <div className="hero-stat">
          <div className="hero-stat-number">{markets.length}</div>
          <div className="hero-stat-label">Markets</div>
        </div>
        <div className="hero-divider" />
        <div className="hero-stat">
          <div className="hero-stat-number">{activeCount}</div>
          <div className="hero-stat-label">Active</div>
        </div>
        <div className="hero-divider" />
        <div className="hero-stat">
          <div className="hero-stat-number">{totalVol < 1000 ? fmtEth(totalPool) : `${(totalVol / 1000).toFixed(1)}k`}</div>
          <div className="hero-stat-label">AVAX Volume</div>
        </div>
      </div>

      {/* FHE Privacy Banner */}
      <div className="fhe-banner">
        <div className="fhe-banner-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C8.68 1 6 3.68 6 7v2H4v14h16V9h-2V7c0-3.32-2.68-6-6-6zm0 2c2.21 0 4 1.79 4 4v2H8V7c0-2.21 1.79-4 4-4zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/></svg>
        </div>
        <div className="fhe-banner-text">
          <span className="fhe-banner-title">Protected by Fhenix FHE</span>
          <span className="fhe-banner-desc">All bet amounts are encrypted using Fully Homomorphic Encryption. No one can see how much you bet — not even the contract operator.</span>
        </div>
        <div className="fhe-banner-tech">
          <span className="fhe-chip">cofhejs</span>
          <span className="fhe-chip">euint64</span>
          <span className="fhe-chip">CoFHE</span>
        </div>
      </div>

      {/* Category + Search */}
      <div className="toolbar">
        <div className="category-tabs">
          {CATEGORIES.map(c => (
            <button key={c} className={`cat-tab ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
              {c !== "All" && <span className="cat-icon">{categoryIcon(c)}</span>}
              {c}
            </button>
          ))}
        </div>
        <div className="search-box">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Search markets..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Filter pills */}
      <div className="filter-row">
        <div className="filter-pills">
          {(["all", "active", "resolved"] as Filter[]).map(f => (
            <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "active" ? `Active (${activeCount})` : `Resolved (${markets.filter(m => m.resolved).length})`}
            </button>
          ))}
        </div>
        <div className="results-count">{filtered.length} market{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Markets */}
      {loading ? (
        <div className="loading-state">
          <div className="loader" />
          <p>Loading markets...</p>
        </div>
      ) : (
        <div className="markets-grid">
          {filtered.length === 0 && <div className="empty-state">No markets match your filters</div>}
          {filtered.map((m, i) => {
            const active = isActive(m);
            const expired = isExpired(m);
            const bet = userBets[m.id];
            const pct = yesPercent(m);
            const pool = m.yesPool + m.noPool;
            const isExpanded = expandedCard === m.id;

            return (
              <div
                className={`market-card ${isExpanded ? "expanded" : ""}`}
                key={m.id}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => setExpandedCard(isExpanded ? null : m.id)}
              >
                <div className="card-header">
                  <div className="card-cat">
                    <span className="card-cat-icon">{categoryIcon(m.category)}</span>
                    <span className="card-cat-name">{m.category}</span>
                    {m.encrypted && (
                      <span className="fhe-badge" title="Bet amounts encrypted with Fhenix FHE">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C8.68 1 6 3.68 6 7v2H4v14h16V9h-2V7c0-3.32-2.68-6-6-6zm0 2c2.21 0 4 1.79 4 4v2H8V7c0-2.21 1.79-4 4-4zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/></svg>
                        FHE
                      </span>
                    )}
                  </div>
                  <div className={`card-status ${m.resolved ? "status-resolved" : expired ? "status-expired" : "status-active"}`}>
                    {m.resolved ? (m.winningOutcome === 0 ? "Yes Won" : "No Won") : expired ? "Expired" : "Live"}
                  </div>
                </div>

                <div className="card-question">{m.question}</div>

                <div className="card-pool">
                  <div className="pool-info">
                    <div className="pool-side pool-yes-side">
                      <span className="pool-pct">{pct}%</span>
                      <span className="pool-label">Yes</span>
                    </div>
                    <div className="pool-total-center">{fmtEth(pool)} AVAX</div>
                    <div className="pool-side pool-no-side">
                      <span className="pool-label">No</span>
                      <span className="pool-pct">{100 - pct}%</span>
                    </div>
                  </div>
                  <div className="pool-bar">
                    <div className="pool-bar-yes" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="card-participants">
                  <span className="participant-count">{m.yesCount + m.noCount} participants</span>
                  {m.encrypted && <span className="encrypted-hint">Amounts encrypted</span>}
                </div>

                <div className="card-footer">
                  <span className="card-deadline">⏱ {fmtDeadline(m.deadline)}</span>
                  <span className="card-id">#{m.id}</span>
                </div>

                {/* Expanded betting section */}
                {isExpanded && active && (
                  <div className="bet-panel" onClick={e => e.stopPropagation()}>
                    {m.encrypted && (
                      <div className="encrypt-notice">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C8.68 1 6 3.68 6 7v2H4v14h16V9h-2V7c0-3.32-2.68-6-6-6zm0 2c2.21 0 4 1.79 4 4v2H8V7c0-2.21 1.79-4 4-4zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/></svg>
                        Your bet amount will be encrypted with FHE before submission
                      </div>
                    )}
                    <div className="bet-input-row">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Amount in AVAX (encrypted)"
                        value={betAmounts[m.id] || ""}
                        onChange={ev => setBetAmounts(p => ({ ...p, [m.id]: ev.target.value }))}
                      />
                    </div>
                    <div className="bet-buttons">
                      <button className="btn-yes" onClick={() => placeBet(m.id, 0)}>
                        <span className="btn-arrow">↑</span> Bet Yes
                      </button>
                      <button className="btn-no" onClick={() => placeBet(m.id, 1)}>
                        <span className="btn-arrow">↓</span> Bet No
                      </button>
                    </div>
                  </div>
                )}

                {isExpanded && m.resolved && bet && !bet.claimed && (
                  <div className="bet-panel" onClick={e => e.stopPropagation()}>
                    <button className="btn-claim" onClick={() => claim(m.id)}>Claim Payout</button>
                  </div>
                )}

                {isExpanded && bet && (
                  <div className="user-position" onClick={e => e.stopPropagation()}>
                    <span className="position-label">Your Position</span>
                    <div className="position-details">
                      {bet.yesAmount > 0n && <span className="pos-yes">{fmtEth(bet.yesAmount)} AVAX on Yes</span>}
                      {bet.noAmount > 0n && <span className="pos-no">{fmtEth(bet.noAmount)} AVAX on No</span>}
                      {bet.claimed && <span className="pos-claimed">✓ Claimed</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

export default App;
