import { useState, useEffect, useCallback } from "react";
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
}

interface UserBet {
  yesAmount: bigint;
  noAmount: bigint;
  claimed: boolean;
}

type Filter = "all" | "active" | "resolved";

const e = (v: number) => BigInt(Math.floor(v * 1e18));
const nowTs = Math.floor(Date.now() / 1000);

const MOCK_MARKETS: Market[] = [
  { id: 0, question: "Will AVAX reach $100 by end of Q2 2026?", deadline: BigInt(nowTs + 90 * 86400), resolver: "0x0", yesPool: e(342.5), noPool: e(187.3), resolved: false, winningOutcome: 0 },
  { id: 1, question: "Will Ethereum complete the Pectra upgrade by June 2026?", deadline: BigInt(nowTs + 90 * 86400), resolver: "0x0", yesPool: e(1205.8), noPool: e(412.1), resolved: false, winningOutcome: 0 },
  { id: 2, question: "Will Bitcoin hit $150k in 2026?", deadline: BigInt(nowTs + 180 * 86400), resolver: "0x0", yesPool: e(2841.2), noPool: e(1950.6), resolved: false, winningOutcome: 0 },
  { id: 3, question: "Will Avalanche TVL exceed $5B by April 2026?", deadline: BigInt(nowTs + 30 * 86400), resolver: "0x0", yesPool: e(523.9), noPool: e(678.4), resolved: false, winningOutcome: 0 },
  { id: 4, question: "Will the US pass a stablecoin regulation bill in 2026?", deadline: BigInt(nowTs + 180 * 86400), resolver: "0x0", yesPool: e(890.0), noPool: e(1120.5), resolved: false, winningOutcome: 0 },
  { id: 5, question: "Will NFT trading volume surpass $2B monthly by Q3 2026?", deadline: BigInt(nowTs + 180 * 86400), resolver: "0x0", yesPool: e(156.7), noPool: e(445.2), resolved: false, winningOutcome: 0 },
  { id: 6, question: "Will a major centralized exchange get hacked in 2026?", deadline: BigInt(nowTs + 180 * 86400), resolver: "0x0", yesPool: e(732.1), noPool: e(298.8), resolved: false, winningOutcome: 0 },
  { id: 7, question: "Will Avalanche launch 100+ L1s on its network by mid 2026?", deadline: BigInt(nowTs + 90 * 86400), resolver: "0x0", yesPool: e(415.6), noPool: e(389.3), resolved: false, winningOutcome: 0 },
  { id: 8, question: "Will DeFi total TVL exceed $300B by end of 2026?", deadline: BigInt(nowTs - 10 * 86400), resolver: "0x0", yesPool: e(1680.0), noPool: e(920.4), resolved: true, winningOutcome: 0 },
  { id: 9, question: "Will a country adopt Bitcoin as legal tender in 2026?", deadline: BigInt(nowTs + 180 * 86400), resolver: "0x0", yesPool: e(576.3), noPool: e(843.7), resolved: false, winningOutcome: 0 },
];

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userBets, setUserBets] = useState<Record<number, UserBet>>({});
  const [betAmounts, setBetAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getProvider = () => {
    if (!(window as any).ethereum) {
      showToast("Install MetaMask or Core Wallet", "error");
      return null;
    }
    return new BrowserProvider((window as any).ethereum);
  };

  const connect = async () => {
    const provider = getProvider();
    if (!provider) return;
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
          id: i,
          question: m.question,
          deadline: m.deadline,
          resolver: m.resolver,
          yesPool: m.yesPool,
          noPool: m.noPool,
          resolved: m.resolved,
          winningOutcome: Number(m.winningOutcome),
        });
      }
      setMarkets(loaded);
      setDemoMode(false);

      if (account) {
        const bets: Record<number, UserBet> = {};
        for (let i = 0; i < count; i++) {
          const b = await contract.getUserBet(i, account);
          if (b.yesAmount > 0n || b.noAmount > 0n) {
            bets[i] = {
              yesAmount: b.yesAmount,
              noAmount: b.noAmount,
              claimed: b.claimed,
            };
          }
        }
        setUserBets(bets);
      }
    } catch (e: any) {
      console.error(e);
      setMarkets(MOCK_MARKETS);
      setDemoMode(true);
    }
    setLoading(false);
  }, [account]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const onAccounts = (accounts: string[]) =>
      setAccount(accounts[0] || null);
    eth.on("accountsChanged", onAccounts);
    eth.request({ method: "eth_accounts" }).then((a: string[]) => {
      if (a[0]) setAccount(a[0]);
    });
    return () => eth.removeListener("accountsChanged", onAccounts);
  }, []);

  const placeBet = async (marketId: number, outcome: number) => {
    if (demoMode) {
      const amount = betAmounts[marketId];
      if (!amount || parseFloat(amount) <= 0) return showToast("Enter a valid amount", "error");
      const val = e(parseFloat(amount));
      setMarkets((prev) => prev.map((m) => m.id === marketId ? { ...m, yesPool: outcome === 0 ? m.yesPool + val : m.yesPool, noPool: outcome === 1 ? m.noPool + val : m.noPool } : m));
      setBetAmounts((p) => ({ ...p, [marketId]: "" }));
      showToast(`Demo: bet ${amount} AVAX on ${outcome === 0 ? "Yes" : "No"}`, "success");
      return;
    }
    const provider = getProvider();
    if (!provider || !account) return connect();
    const amount = betAmounts[marketId];
    if (!amount || parseFloat(amount) <= 0) {
      return showToast("Enter a valid amount", "error");
    }
    try {
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);
      const tx = await contract.placeBet(marketId, outcome, {
        value: parseEther(amount),
      });
      showToast("Transaction submitted...", "success");
      await tx.wait();
      showToast("Bet placed!", "success");
      setBetAmounts((p) => ({ ...p, [marketId]: "" }));
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

  const filtered = markets.filter((m) => {
    if (filter === "active") return isActive(m);
    if (filter === "resolved") return m.resolved;
    return true;
  });

  const totalPool = markets.reduce(
    (s, m) => s + m.yesPool + m.noPool,
    0n
  );
  const activeCount = markets.filter(isActive).length;

  const fmtEth = (v: bigint) => {
    const f = parseFloat(formatEther(v));
    return f < 0.001 && f > 0 ? "<0.001" : f.toFixed(3);
  };

  const fmtDeadline = (ts: bigint) => {
    const d = new Date(Number(ts) * 1000);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const yesPercent = (m: Market) => {
    const total = m.yesPool + m.noPool;
    if (total === 0n) return 50;
    return Number((m.yesPool * 100n) / total);
  };

  return (
    <>
      <header className="header">
        <div className="logo-section">
          <div className="logo-icon">◆</div>
          <div className="logo-text">
            Avalanche <span>Predictions</span>
          </div>
        </div>
        {account ? (
          <div className="connected-badge">
            <div className="connected-dot" />
            {account.slice(0, 6)}...{account.slice(-4)}
          </div>
        ) : (
          <button className="connect-btn" onClick={connect}>
            Connect Wallet
          </button>
        )}
      </header>

      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-value">{markets.length}</div>
          <div className="stat-label">Total Markets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Active Markets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmtEth(totalPool)} AVAX</div>
          <div className="stat-label">Total Volume</div>
        </div>
      </div>

      {demoMode && (
        <div className="demo-banner">Demo mode — showing sample data. Connect a wallet with a deployed contract for live markets.</div>
      )}

      <div className="markets-header">
        <div className="markets-title">Markets</div>
        <div className="filter-pills">
          {(["all", "active", "resolved"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`filter-pill ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <div>Loading markets...</div>
        </div>
      ) : (
        <div className="markets-grid">
          {filtered.length === 0 && (
            <div className="loading">No markets found</div>
          )}
          {filtered.map((m) => {
            const active = isActive(m);
            const expired = isExpired(m);
            const bet = userBets[m.id];
            const pct = yesPercent(m);

            return (
              <div className="market-card" key={m.id}>
                <div className="market-top">
                  <div className="market-question">{m.question}</div>
                  <div
                    className={`market-badge ${
                      m.resolved
                        ? "badge-resolved"
                        : expired
                        ? "badge-expired"
                        : "badge-active"
                    }`}
                  >
                    {m.resolved
                      ? `Resolved: ${m.winningOutcome === 0 ? "YES" : "NO"}`
                      : expired
                      ? "Expired"
                      : "Active"}
                  </div>
                </div>

                <div className="market-meta">
                  <span>Deadline: {fmtDeadline(m.deadline)}</span>
                  <span>ID: #{m.id}</span>
                </div>

                <div className="pool-section">
                  <div className="pool-labels">
                    <span className="pool-yes">
                      Yes {pct}% · {fmtEth(m.yesPool)} AVAX
                    </span>
                    <span className="pool-no">
                      No {100 - pct}% · {fmtEth(m.noPool)} AVAX
                    </span>
                  </div>
                  <div className="pool-bar">
                    <div
                      className="pool-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="pool-total">
                    Total: {fmtEth(m.yesPool + m.noPool)} AVAX
                  </div>
                </div>

                {active && (
                  <div className="bet-section">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="AVAX amount"
                      value={betAmounts[m.id] || ""}
                      onChange={(e) =>
                        setBetAmounts((p) => ({
                          ...p,
                          [m.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className="btn-yes"
                      onClick={() => placeBet(m.id, 0)}
                    >
                      Bet Yes
                    </button>
                    <button
                      className="btn-no"
                      onClick={() => placeBet(m.id, 1)}
                    >
                      Bet No
                    </button>
                  </div>
                )}

                {m.resolved && bet && !bet.claimed && (
                  <button className="btn-claim" onClick={() => claim(m.id)}>
                    Claim Payout
                  </button>
                )}

                {bet && (
                  <div className="user-bet">
                    {bet.yesAmount > 0n && (
                      <span>
                        Your Yes: <strong>{fmtEth(bet.yesAmount)} AVAX</strong>
                      </span>
                    )}
                    {bet.noAmount > 0n && (
                      <span>
                        Your No: <strong>{fmtEth(bet.noAmount)} AVAX</strong>
                      </span>
                    )}
                    {bet.claimed && <span>✓ Claimed</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}

export default App;
