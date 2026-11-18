import { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import Money from '../components/Money.jsx';
import { formatINR } from '../utils/format.js';

export default function AiPage() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'autopsy' | 'safe' | 'goals' | 'recurring' | 'simulate'
  const [loading, setLoading] = useState(false);
  const [vitals, setVitals] = useState(null);

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "👋 Hi! I'm **Spendly AI**, your personal financial intelligence copilot.\n\nI analyze your actual accounts, transactions, debts, and budgets in real time to give you verified answers and recommendations. Ask me anything or try one of the quick prompts below!",
      toolData: null,
      assumptions: [],
    },
  ]);
  const [queryInput, setQueryInput] = useState('');
  const chatEndRef = useRef(null);

  // Autopsy State
  const [autopsyData, setAutopsyData] = useState(null);

  // Safe-to-Spend State
  const [safeData, setSafeData] = useState(null);
  const [bufferPct, setBufferPct] = useState(15);
  const [hypotheticalAmt, setHypotheticalAmt] = useState('');

  // Goal Planner State
  const [goalName, setGoalName] = useState('Emergency Fund');
  const [goalTarget, setGoalTarget] = useState(50000);
  const [goalMonths, setGoalMonths] = useState(6);
  const [goalPlanData, setGoalPlanData] = useState(null);

  // Recurring State
  const [recurringData, setRecurringData] = useState(null);

  // Simulator State
  const [simCutDiscretionary, setSimCutDiscretionary] = useState(2000);
  const [simIncomeBoost, setSimIncomeBoost] = useState(0);
  const [simReturnRate, setSimReturnRate] = useState(7);
  const [simData, setSimData] = useState(null);

  // Load Initial Vitals
  useEffect(() => {
    api.aiContext()
      .then((data) => setVitals(data))
      .catch((err) => console.error('Failed to load vitals:', err));
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Tab Loaders
  useEffect(() => {
    if (activeTab === 'autopsy' && !autopsyData) {
      loadAutopsy();
    } else if (activeTab === 'safe' && !safeData) {
      loadSafeToSpend();
    } else if (activeTab === 'goals' && !goalPlanData) {
      loadGoalPlan();
    } else if (activeTab === 'recurring' && !recurringData) {
      loadRecurring();
    } else if (activeTab === 'simulate' && !simData) {
      loadSimulation();
    }
  }, [activeTab]);

  const loadAutopsy = async () => {
    setLoading(true);
    try {
      const data = await api.aiAutopsy();
      setAutopsyData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSafeToSpend = async (customBuffer = bufferPct, purchase = hypotheticalAmt) => {
    setLoading(true);
    try {
      const data = await api.aiSafeToSpend({
        bufferPct: customBuffer,
        hypotheticalPurchase: purchase ? Number(purchase) : null,
      });
      setSafeData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadGoalPlan = async (name = goalName, target = goalTarget, months = goalMonths) => {
    setLoading(true);
    try {
      const data = await api.aiGoalPlan({
        goalName: name,
        targetAmount: Number(target),
        targetMonths: Number(months),
      });
      setGoalPlanData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecurring = async () => {
    setLoading(true);
    try {
      const data = await api.aiRecurring();
      setRecurringData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSimulation = async (
    cut = simCutDiscretionary,
    boost = simIncomeBoost,
    rate = simReturnRate
  ) => {
    setLoading(true);
    try {
      const data = await api.aiSimulate({
        adjustments: {
          categoryReductions: { Discretionary: Number(cut) },
          incomeIncrease: Number(boost),
        },
        horizonMonths: 24,
        investmentReturnRate: Number(rate),
      });
      setSimData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Submit Chat Query
  const handleSendQuery = async (customText) => {
    const text = customText || queryInput;
    if (!text || !text.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setQueryInput('');
    setLoading(true);

    try {
      const res = await api.aiChat(text.trim());
      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: res.answer,
        toolUsed: res.toolUsed,
        toolData: res.toolData,
        assumptions: res.assumptions || [],
        suggestedQuestions: res.suggestedQuestions || [],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `⚠️ Error fetching analysis: ${err.message}. Please check your connection and try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Markdown renderer helper
  const renderMarkdown = (content) => {
    if (!content) return '';
    // Format bold, list items, headings simply for safe rendering
    const formatted = content
      .split('\n')
      .map((line, idx) => {
        if (line.startsWith('### ')) {
          return <h4 key={idx} className="ai-md-h4">{line.replace('### ', '')}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={idx} className="ai-md-h3">{line.replace('## ', '')}</h3>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const itemText = line.substring(2);
          return (
            <li key={idx} className="ai-md-li">
              {renderBoldText(itemText)}
            </li>
          );
        }
        if (!line.trim()) {
          return <div key={idx} style={{ height: 6 }} />;
        }
        return <p key={idx} className="ai-md-p">{renderBoldText(line)}</p>;
      });
    return formatted;
  };

  const renderBoldText = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="ai-md-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="ai-page-container">
      {/* Finova-Inspired Glow Header */}
      <header className="ai-header-card">
        <div className="ai-header-brand">
          <div className="ai-badge-pulse">
            <span className="ai-spark-icon">✨</span>
          </div>
          <div>
            <h1 className="ai-title">Spendly AI</h1>
            <p className="ai-subtitle">Intelligence Copilot & Financial Engine</p>
          </div>
        </div>

        {/* Live Financial Vitals Strip */}
        {vitals && (
          <div className="ai-vitals-strip">
            <div className="ai-vital-item">
              <span className="ai-vital-label">Liquid Cash</span>
              <span className="ai-vital-val ai-val-cash">
                <Money amount={vitals.accounts.totalLiquidBalance} />
              </span>
            </div>
            <div className="ai-vital-divider" />
            <div className="ai-vital-item">
              <span className="ai-vital-label">This Month Net</span>
              <span className={`ai-vital-val ${vitals.currentMonth.savings >= 0 ? 'ai-val-green' : 'ai-val-red'}`}>
                <Money amount={vitals.currentMonth.savings} />
              </span>
            </div>
            <div className="ai-vital-divider" />
            <div className="ai-vital-item">
              <span className="ai-vital-label">Next Payday</span>
              <span className="ai-vital-val ai-val-payday">
                {vitals.paydayInfo.daysUntilPayday}d left
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Feature Navigation Tabs */}
      <nav className="ai-nav-tabs">
        <button
          className={`ai-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          💬 Ask Spendly
        </button>
        <button
          className={`ai-tab-btn ${activeTab === 'autopsy' ? 'active' : ''}`}
          onClick={() => setActiveTab('autopsy')}
        >
          🔬 Money Autopsy
        </button>
        <button
          className={`ai-tab-btn ${activeTab === 'safe' ? 'active' : ''}`}
          onClick={() => setActiveTab('safe')}
        >
          🛡️ Safe-to-Spend
        </button>
        <button
          className={`ai-tab-btn ${activeTab === 'goals' ? 'active' : ''}`}
          onClick={() => setActiveTab('goals')}
        >
          🎯 Goal Planner
        </button>
        <button
          className={`ai-tab-btn ${activeTab === 'recurring' ? 'active' : ''}`}
          onClick={() => setActiveTab('recurring')}
        >
          🔄 Recurring
        </button>
        <button
          className={`ai-tab-btn ${activeTab === 'simulate' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulate')}
        >
          🔮 What-If Simulator
        </button>
      </nav>

      {/* TAB 1: CONVERSATIONAL ASSISTANT */}
      {activeTab === 'chat' && (
        <div className="ai-chat-view">
          <div className="ai-chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`ai-message-row ai-msg-${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="ai-msg-avatar">✨</div>
                )}
                <div className="ai-msg-bubble">
                  <div className="ai-msg-content">{renderMarkdown(m.text)}</div>

                  {/* Render Visual Tool Card if present */}
                  {m.toolData && m.toolUsed === 'safe_to_spend' && (
                    <div className="ai-inline-card">
                      <div className="ai-inline-header">
                        <span>🛡️ Safe-to-Spend Breakdown</span>
                        <strong className="ai-safe-hero-num">
                          {formatINR(m.toolData.safeToSpend)}
                        </strong>
                      </div>
                      <div className="ai-inline-progress-wrap">
                        <div
                          className="ai-inline-progress-bar"
                          style={{
                            width: `${Math.min(100, Math.round((m.toolData.safeToSpend / (m.toolData.breakdown.liquidCash || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="ai-inline-metrics-grid">
                        <div>
                          <span>Daily Allowance</span>
                          <strong>{formatINR(m.toolData.dailyAllowance)}/day</strong>
                        </div>
                        <div>
                          <span>Days to Payday</span>
                          <strong>{m.toolData.daysUntilPayday} days</strong>
                        </div>
                        <div>
                          <span>Safety Buffer</span>
                          <strong>{formatINR(m.toolData.breakdown.safetyBufferAmount)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {m.toolData && m.toolUsed === 'autopsy' && (
                    <div className="ai-inline-card">
                      <div className="ai-inline-header">
                        <span>🔬 Top Outflow Categories</span>
                        <span>{m.toolData.month}</span>
                      </div>
                      <div className="ai-autopsy-bars">
                        {m.toolData.categoryBreakdown.slice(0, 4).map((c) => (
                          <div key={c.category} className="ai-bar-row">
                            <div className="ai-bar-labels">
                              <span>{c.category}</span>
                              <span>{formatINR(c.amount)} ({c.percentage}%)</span>
                            </div>
                            <div className="ai-bar-track">
                              <div className="ai-bar-fill" style={{ width: `${c.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assumptions Accordion */}
                  {m.assumptions && m.assumptions.length > 0 && (
                    <details className="ai-assumptions-details">
                      <summary>📐 View Mathematical Assumptions</summary>
                      <ul>
                        {m.assumptions.map((ass, i) => (
                          <li key={i}>{ass}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Suggested Follow-up Chips */}
                  {m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
                    <div className="ai-followup-chips">
                      {m.suggestedQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="ai-chip-btn"
                          onClick={() => handleSendQuery(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-message-row ai-msg-assistant">
                <div className="ai-msg-avatar ai-avatar-thinking">✨</div>
                <div className="ai-msg-bubble ai-msg-thinking">
                  <div className="ai-typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="ai-thinking-text">Analyzing your financial records…</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompt Starters */}
          <div className="ai-quick-prompts-bar">
            <button
              type="button"
              className="ai-quick-pill"
              onClick={() => handleSendQuery('Where did my salary go this month?')}
            >
              💸 Where did my salary go?
            </button>
            <button
              type="button"
              className="ai-quick-pill"
              onClick={() => handleSendQuery('Can I afford a ₹15,000 purchase?')}
            >
              🛍️ Can I afford a ₹15,000 purchase?
            </button>
            <button
              type="button"
              className="ai-quick-pill"
              onClick={() => handleSendQuery('How much money can I safely spend until payday?')}
            >
              🛡️ Safe to spend until payday?
            </button>
            <button
              type="button"
              className="ai-quick-pill"
              onClick={() => handleSendQuery('Why am I saving less than last month?')}
            >
              📉 Why am I saving less?
            </button>
            <button
              type="button"
              className="ai-quick-pill"
              onClick={() => handleSendQuery('Create a plan to save ₹50,000 in six months.')}
            >
              🎯 Save ₹50,000 in 6 months
            </button>
          </div>

          {/* Query Input Box */}
          <form
            className="ai-chat-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
          >
            <input
              type="text"
              className="ai-chat-input"
              placeholder="Ask anything about your money, bills, debts, or future plans…"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={loading || !queryInput.trim()}
              aria-label="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: AI MONEY AUTOPSY */}
      {activeTab === 'autopsy' && (
        <div className="ai-tab-content">
          <div className="ai-feature-hero">
            <span className="ai-feature-badge">Flagship 1</span>
            <h2>AI Money Autopsy</h2>
            <p>Decomposes your cash outflow, highlights category surges, and audits unusual transactions.</p>
          </div>

          {loading && !autopsyData ? (
            <div className="ai-loading-state">Performing money autopsy…</div>
          ) : autopsyData ? (
            <div className="ai-autopsy-grid">
              {/* Vitals Summary Card */}
              <div className="ai-card ai-autopsy-summary-card">
                <h3>Month Comparison: {autopsyData.month} vs {autopsyData.previousMonth}</h3>
                <div className="ai-stat-row">
                  <div>
                    <span className="ai-stat-label">Income</span>
                    <strong className="ai-val-green">{formatINR(autopsyData.metrics.income)}</strong>
                  </div>
                  <div>
                    <span className="ai-stat-label">Expenses</span>
                    <strong className="ai-val-red">{formatINR(autopsyData.metrics.expense)}</strong>
                  </div>
                  <div>
                    <span className="ai-stat-label">Net Saved</span>
                    <strong>{formatINR(autopsyData.metrics.savings)}</strong>
                  </div>
                  <div>
                    <span className="ai-stat-label">Savings Rate</span>
                    <strong className="ai-badge-rate">{autopsyData.metrics.savingsRate}%</strong>
                  </div>
                </div>
                <div className="ai-delta-badge">
                  Savings change vs last month:{' '}
                  <strong className={autopsyData.metrics.savingsDelta >= 0 ? 'ai-val-green' : 'ai-val-red'}>
                    {autopsyData.metrics.savingsDelta >= 0 ? '+' : ''}
                    {formatINR(autopsyData.metrics.savingsDelta)}
                  </strong>
                </div>
              </div>

              {/* Spikes / Surges */}
              {autopsyData.topSpikes.length > 0 && (
                <div className="ai-card ai-spikes-card">
                  <h3 className="ai-card-title">⚠️ Biggest Spending Surges (Leakage)</h3>
                  <div className="ai-spike-list">
                    {autopsyData.topSpikes.map((s) => (
                      <div key={s.category} className="ai-spike-item">
                        <div className="ai-spike-info">
                          <strong>{s.category}</strong>
                          <span>Spent {formatINR(s.amount)} (was {formatINR(s.prevMonthAmount)})</span>
                        </div>
                        <span className="ai-spike-badge">+{formatINR(s.delta)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Breakdown Table */}
              <div className="ai-card">
                <h3 className="ai-card-title">Where Every Rupee Went</h3>
                <div className="ai-category-list">
                  {autopsyData.categoryBreakdown.map((c) => (
                    <div key={c.category} className="ai-cat-row">
                      <div className="ai-cat-header">
                        <span className="ai-cat-name">{c.category}</span>
                        <span className="ai-cat-amt">{formatINR(c.amount)} ({c.percentage}%)</span>
                      </div>
                      <div className="ai-cat-track">
                        <div className="ai-cat-fill" style={{ width: `${c.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unusual Transactions */}
              {autopsyData.unusualTransactions.length > 0 && (
                <div className="ai-card ai-unusual-card">
                  <h3 className="ai-card-title">🚨 Unusual Outlier Transactions</h3>
                  <div className="ai-unusual-list">
                    {autopsyData.unusualTransactions.map((u) => (
                      <div key={u.id} className="ai-unusual-item">
                        <div className="ai-unusual-main">
                          <strong>{u.note}</strong>
                          <span className="ai-unusual-cat">{u.category}</span>
                          <p className="ai-unusual-reason">{u.reason}</p>
                        </div>
                        <span className="ai-unusual-amount">{formatINR(u.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assumptions */}
              <div className="ai-card ai-assumptions-card">
                <h4>📐 Calculations & Assumptions</h4>
                <ul>
                  {autopsyData.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: SAFE-TO-SPEND CALCULATOR */}
      {activeTab === 'safe' && (
        <div className="ai-tab-content">
          <div className="ai-feature-hero">
            <span className="ai-feature-badge">Flagship 2</span>
            <h2>Safe-to-Spend Calculator</h2>
            <p>Know exactly how much discretionary money you can spend until payday without risking upcoming bills or savings.</p>
          </div>

          {/* Interactive Controls Bar */}
          <div className="ai-card ai-controls-card">
            <div className="ai-slider-group">
              <div className="ai-slider-header">
                <label>Safety Emergency Buffer: <strong>{bufferPct}%</strong></label>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={bufferPct}
                onChange={(e) => {
                  setBufferPct(Number(e.target.value));
                  loadSafeToSpend(Number(e.target.value), hypotheticalAmt);
                }}
                className="ai-range-slider"
              />
            </div>

            <div className="ai-purchase-checker">
              <label>Test a Purchase ("Can I afford ₹…?")</label>
              <div className="ai-input-inline-wrap">
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={hypotheticalAmt}
                  onChange={(e) => setHypotheticalAmt(e.target.value)}
                  className="ai-num-input"
                />
                <button
                  type="button"
                  className="ai-action-btn"
                  onClick={() => loadSafeToSpend(bufferPct, hypotheticalAmt)}
                >
                  Evaluate
                </button>
              </div>
            </div>
          </div>

          {safeData && (
            <div className="ai-safe-grid">
              {/* Verdict Banner if purchase checked */}
              {safeData.purchaseVerdict && (
                <div className={`ai-card ai-verdict-card ${safeData.purchaseVerdict.canAfford ? 'ai-verdict-yes' : 'ai-verdict-no'}`}>
                  <div className="ai-verdict-icon">
                    {safeData.purchaseVerdict.canAfford ? '✅' : '⚠️'}
                  </div>
                  <div>
                    <h4>{safeData.purchaseVerdict.canAfford ? 'Purchase Approved' : 'Budget Warning'}</h4>
                    <p>{safeData.purchaseVerdict.verdictText}</p>
                  </div>
                </div>
              )}

              {/* Main Safe-to-Spend Hero Card */}
              <div className="ai-card ai-safe-hero-card">
                <span className="ai-safe-badge">Current Allowance</span>
                <h1 className="ai-safe-giant-num">{formatINR(safeData.safeToSpend)}</h1>
                <p className="ai-safe-subtext">
                  You can safely spend <strong>{formatINR(safeData.dailyAllowance)}/day</strong> for the next{' '}
                  <strong>{safeData.daysUntilPayday} days</strong> until payday.
                </p>

                <div className="ai-safe-breakdown-list">
                  <div className="ai-breakdown-row">
                    <span>Total Liquid Cash Available</span>
                    <strong>{formatINR(safeData.breakdown.liquidCash)}</strong>
                  </div>
                  <div className="ai-breakdown-row ai-deduct">
                    <span>— Upcoming Recurring Bills</span>
                    <span>-{formatINR(safeData.breakdown.upcomingBills)}</span>
                  </div>
                  <div className="ai-breakdown-row ai-deduct">
                    <span>— Pending Debt Settlements</span>
                    <span>-{formatINR(safeData.breakdown.pendingDebt)}</span>
                  </div>
                  <div className="ai-breakdown-row ai-deduct">
                    <span>— Reserved Monthly Savings Target</span>
                    <span>-{formatINR(safeData.breakdown.targetSavingsAmount)}</span>
                  </div>
                  <div className="ai-breakdown-row ai-deduct">
                    <span>— Safety Emergency Buffer ({safeData.breakdown.bufferPct}%)</span>
                    <span>-{formatINR(safeData.breakdown.safetyBufferAmount)}</span>
                  </div>
                  <div className="ai-breakdown-divider" />
                  <div className="ai-breakdown-row ai-breakdown-total">
                    <span>= Discretionary Safe-to-Spend</span>
                    <strong className="ai-val-green">{formatINR(safeData.safeToSpend)}</strong>
                  </div>
                </div>
              </div>

              {/* Assumptions */}
              <div className="ai-card ai-assumptions-card">
                <h4>📐 Calculations & Assumptions</h4>
                <ul>
                  {safeData.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GOAL-BASED SAVINGS PLANNER */}
      {activeTab === 'goals' && (
        <div className="ai-tab-content">
          <div className="ai-feature-hero">
            <span className="ai-feature-badge">Flagship 3</span>
            <h2>Goal-Based Savings Planner</h2>
            <p>Plan milestone goals (laptop, emergency fund, trip) with realistic monthly contributions and category cut suggestions.</p>
          </div>

          {/* Goal Configuration Card */}
          <div className="ai-card ai-goal-form-card">
            <div className="ai-form-row">
              <div className="ai-form-field">
                <label>Goal Name</label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="ai-text-input"
                  placeholder="e.g. MacBook Pro, Goa Trip"
                />
              </div>
              <div className="ai-form-field">
                <label>Target Amount (₹)</label>
                <input
                  type="number"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  className="ai-text-input"
                />
              </div>
              <div className="ai-form-field">
                <label>Timeframe (Months)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={goalMonths}
                  onChange={(e) => setGoalMonths(e.target.value)}
                  className="ai-text-input"
                />
              </div>
            </div>
            <button
              type="button"
              className="ai-generate-plan-btn"
              onClick={() => loadGoalPlan(goalName, goalTarget, goalMonths)}
            >
              Generate Goal Savings Plan
            </button>
          </div>

          {goalPlanData && (
            <div className="ai-goal-results-grid">
              {/* Feasibility Hero */}
              <div className="ai-card ai-goal-hero-card">
                <div className="ai-goal-hero-header">
                  <div>
                    <span className="ai-feature-badge">{goalPlanData.goalName}</span>
                    <h2>{formatINR(goalPlanData.targetAmount)} in {goalPlanData.targetMonths} Months</h2>
                  </div>
                  <div className={`ai-feasibility-pill ${goalPlanData.isCurrentlyFeasible ? 'feasible' : 'tight'}`}>
                    {goalPlanData.isCurrentlyFeasible ? '✅ Fully Feasible' : '⚠️ Requires Spending Cuts'}
                  </div>
                </div>

                <div className="ai-goal-stat-boxes">
                  <div className="ai-goal-stat-box">
                    <span>Required Deposit</span>
                    <strong>{formatINR(goalPlanData.requiredMonthlySavings)}/mo</strong>
                  </div>
                  <div className="ai-goal-stat-box">
                    <span>Current Cash Surplus</span>
                    <strong>{formatINR(goalPlanData.currentMonthlySurplus)}/mo</strong>
                  </div>
                  <div className="ai-goal-stat-box">
                    <span>Monthly Gap / Buffer</span>
                    <strong className={goalPlanData.monthlyShortfall > 0 ? 'ai-val-red' : 'ai-val-green'}>
                      {goalPlanData.monthlyShortfall > 0
                        ? `-${formatINR(goalPlanData.monthlyShortfall)}`
                        : `+${formatINR(Math.abs(goalPlanData.currentMonthlySurplus - goalPlanData.requiredMonthlySavings))}`}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Recommended Category Cuts */}
              {goalPlanData.cutSuggestions.length > 0 && (
                <div className="ai-card ai-cuts-card">
                  <h3 className="ai-card-title">✂️ Recommended Category Budget Trims</h3>
                  <p className="ai-card-desc">
                    Trimming these discretionary categories frees up{' '}
                    <strong>{formatINR(goalPlanData.totalPotentialFromCuts)}/month</strong> towards your goal:
                  </p>
                  <div className="ai-cuts-list">
                    {goalPlanData.cutSuggestions.map((c) => (
                      <div key={c.category} className="ai-cut-item">
                        <div>
                          <strong>{c.category}</strong>
                          <span>
                            Trim {c.percentageCut}% (from {formatINR(c.currentSpend)} → {formatINR(c.newMonthlySpend)})
                          </span>
                        </div>
                        <span className="ai-cut-pill">Save +{formatINR(c.suggestedTrim)}/mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Milestones Schedule */}
              <div className="ai-card">
                <h3 className="ai-card-title">📅 Milestone Timeline</h3>
                <div className="ai-milestones-track">
                  {goalPlanData.milestones.map((m) => (
                    <div key={m.monthNumber} className="ai-milestone-step">
                      <div className="ai-milestone-dot" />
                      <div className="ai-milestone-content">
                        <div className="ai-milestone-head">
                          <strong>Month {m.monthNumber} ({m.monthName})</strong>
                          <span>{formatINR(m.projectedTotal)} ({m.progressPct}%)</span>
                        </div>
                        <div className="ai-milestone-bar-wrap">
                          <div className="ai-milestone-bar-fill" style={{ width: `${m.progressPct}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assumptions */}
              <div className="ai-card ai-assumptions-card">
                <h4>📐 Calculations & Assumptions</h4>
                <ul>
                  {goalPlanData.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RECURRING EXPENSE INTELLIGENCE */}
      {activeTab === 'recurring' && (
        <div className="ai-tab-content">
          <div className="ai-feature-hero">
            <span className="ai-feature-badge">Flagship 4</span>
            <h2>Recurring Expense Intelligence</h2>
            <p>Automatically scans your transaction history to uncover subscriptions, monthly bills, and estimated billing dates.</p>
          </div>

          {loading && !recurringData ? (
            <div className="ai-loading-state">Analyzing historical transactions…</div>
          ) : recurringData ? (
            <div className="ai-recurring-grid">
              {/* Burn Rate Summary */}
              <div className="ai-card ai-recurring-hero-card">
                <span className="ai-card-sublabel">Total Fixed Monthly Burn</span>
                <h1 className="ai-burn-hero-num">{formatINR(recurringData.totalMonthlyBurn)}</h1>
                <p>
                  Across <strong>{recurringData.count}</strong> detected active subscriptions and utilities.
                </p>
              </div>

              {/* Subscriptions List */}
              <div className="ai-card">
                <h3 className="ai-card-title">Detected Subscriptions & Commitments</h3>
                <div className="ai-recurring-list">
                  {recurringData.detected.map((d) => (
                    <div key={d.id} className="ai-recurring-item">
                      <div className="ai-rec-left">
                        <div className="ai-rec-icon">⚡</div>
                        <div>
                          <strong>{d.name}</strong>
                          <span className="ai-rec-sub">
                            {d.category} · {d.occurrences} previous payments
                          </span>
                        </div>
                      </div>
                      <div className="ai-rec-right">
                        <strong>{formatINR(d.averageAmount)}/mo</strong>
                        <span className={`ai-due-badge ${d.isPaidThisMonth ? 'paid' : d.daysUntilDue <= 3 ? 'urgent' : ''}`}>
                          {d.isPaidThisMonth
                            ? 'Paid this month'
                            : `Due in ${d.daysUntilDue} days`}
                        </span>
                      </div>
                    </div>
                  ))}
                  {recurringData.detected.length === 0 && (
                    <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
                      No recurring subscriptions detected in your recent transactions.
                    </p>
                  )}
                </div>
              </div>

              {/* Assumptions */}
              <div className="ai-card ai-assumptions-card">
                <h4>📐 Calculations & Assumptions</h4>
                <ul>
                  {recurringData.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 6: WHAT-IF FINANCIAL SIMULATOR */}
      {activeTab === 'simulate' && (
        <div className="ai-tab-content">
          <div className="ai-feature-hero">
            <span className="ai-feature-badge">Flagship 5</span>
            <h2>What-If Financial Simulator</h2>
            <p>Model the ripple effects of spending tweaks, lifestyle adjustments, and compounded investments on your future wealth.</p>
          </div>

          {/* Sliders Card */}
          <div className="ai-card ai-sim-controls-card">
            <div className="ai-sim-control">
              <div className="ai-slider-header">
                <label>Trim Discretionary Spend (Food, Shopping): <strong>{formatINR(simCutDiscretionary)}/mo</strong></label>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="500"
                value={simCutDiscretionary}
                onChange={(e) => {
                  setSimCutDiscretionary(Number(e.target.value));
                  loadSimulation(Number(e.target.value), simIncomeBoost, simReturnRate);
                }}
                className="ai-range-slider"
              />
            </div>

            <div className="ai-sim-control">
              <div className="ai-slider-header">
                <label>Boost Monthly Income (Freelance / Raise): <strong>+{formatINR(simIncomeBoost)}/mo</strong></label>
              </div>
              <input
                type="range"
                min="0"
                max="50000"
                step="2500"
                value={simIncomeBoost}
                onChange={(e) => {
                  setSimIncomeBoost(Number(e.target.value));
                  loadSimulation(simCutDiscretionary, Number(e.target.value), simReturnRate);
                }}
                className="ai-range-slider"
              />
            </div>

            <div className="ai-sim-control">
              <div className="ai-slider-header">
                <label>Expected Investment Return: <strong>{simReturnRate}% p.a.</strong></label>
              </div>
              <input
                type="range"
                min="4"
                max="14"
                step="1"
                value={simReturnRate}
                onChange={(e) => {
                  setSimReturnRate(Number(e.target.value));
                  loadSimulation(simCutDiscretionary, simIncomeBoost, Number(e.target.value));
                }}
                className="ai-range-slider"
              />
            </div>
          </div>

          {simData && (
            <div className="ai-sim-results-grid">
              {/* Extra Cash Unlocked Banner */}
              <div className="ai-card ai-sim-hero-card">
                <span className="ai-feature-badge">Simulated Monthly Boost</span>
                <h1 className="ai-val-green">+{formatINR(simData.simulationInputs.totalMonthlyNetBoost)}/mo</h1>
                <p>
                  Your projected monthly savings increases from{' '}
                  <strong>{formatINR(simData.baseMetrics.monthlySavings)}</strong> to{' '}
                  <strong>{formatINR(simData.simulationInputs.simulatedMonthlySavings)}/month</strong>.
                </p>
              </div>

              {/* Horizon Cards */}
              <div className="ai-card">
                <h3 className="ai-card-title">Accumulation Projections</h3>
                <div className="ai-projections-table">
                  <div className="ai-proj-header-row">
                    <span>Horizon</span>
                    <span>Extra Cash Saved</span>
                    <span>If Invested ({simReturnRate}%)</span>
                  </div>
                  {simData.projections.map((p) => (
                    <div key={p.months} className="ai-proj-row">
                      <strong className="ai-proj-label">{p.label}</strong>
                      <span className="ai-val-green">+{formatINR(p.additionalSaved)}</span>
                      <strong className="ai-proj-compound">{formatINR(p.simulatedCompounded)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assumptions */}
              <div className="ai-card ai-assumptions-card">
                <h4>📐 Calculations & Assumptions</h4>
                <ul>
                  {simData.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
