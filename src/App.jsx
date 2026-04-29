import React, { useMemo, useState } from "react";
import "./styles.css";

/* ---------- HELPERS ---------- */
const num = (v) => Number(String(v).replace(/[^0-9.-]/g, "")) || 0;
const money = (v) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v || 0);

const pmt = ({ amount, rate, months, balloon }) => {
  const r = rate / 100 / 12;
  if (!r) return (amount - balloon) / months;
  const pvBalloon = balloon / Math.pow(1 + r, months);
  return ((amount - pvBalloon) * r) / (1 - Math.pow(1 + r, -months));
};

/* ---------- LABELS ---------- */
const lockLabels = {
  purchase: "Purchase",
  rate: "Rate",
  balloon: "Balloon",
  term: "Term",
  deposit: "Deposit"
};

export default function App() {
  const [purchase, setPurchase] = useState(50000);
  const [deposit, setDeposit] = useState(5000);
  const [rate, setRate] = useState(7);
  const [term, setTerm] = useState(60);
  const [balloon, setBalloon] = useState(10000);

  const [target, setTarget] = useState(900);
  const [locks, setLocks] = useState([]);

  /* ---------- CALC ---------- */
  const monthly = useMemo(() => {
    return pmt({
      amount: purchase - deposit,
      rate,
      months: term,
      balloon
    });
  }, [purchase, deposit, rate, term, balloon]);

  /* ---------- MULTI LOCK ---------- */
  const toggleLock = (key) => {
    setLocks((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      if (prev.length >= 3) return prev;
      return [...prev, key];
    });
  };

  /* ---------- SOLVER ---------- */
  const scenarios = useMemo(() => {
    const results = [];

    const trySolve = (key, min, max, setter, direction) => {
      let best = null;

      for (let i = 0; i < 60; i++) {
        const mid = (min + max) / 2;

        const test = {
          purchase,
          deposit,
          rate,
          term,
          balloon
        };

        test[key] = mid;

        const m = pmt({
          amount: test.purchase - test.deposit,
          rate: test.rate,
          months: test.term,
          balloon: test.balloon
        });

        if (!best || Math.abs(m - target) < Math.abs(best.m - target)) {
          best = { value: mid, m };
        }

        if (direction === "down") {
          m > target ? (min = mid) : (max = mid);
        } else {
          m > target ? (max = mid) : (min = mid);
        }
      }

      results.push({
        key,
        value: Math.round(best.value),
        monthly: best.m,
        diff: best.m - target,
        apply: () => setter(Math.round(best.value))
      });
    };

    if (!locks.includes("balloon")) trySolve("balloon", 0, purchase * 0.8, setBalloon, "down");
    if (!locks.includes("deposit")) trySolve("deposit", 0, purchase, setDeposit, "down");
    if (!locks.includes("term")) {
      let best = term;
      let bestDiff = Infinity;

      for (let t = 12; t <= 84; t += 12) {
        const m = pmt({
          amount: purchase - deposit,
          rate,
          months: t,
          balloon
        });
        const d = Math.abs(m - target);
        if (d < bestDiff) {
          best = t;
          bestDiff = d;
        }
      }

      results.push({
        key: "term",
        value: best,
        monthly: monthly,
        diff: monthly - target,
        apply: () => setTerm(best)
      });
    }

    return results;
  }, [purchase, deposit, rate, term, balloon, target, locks]);

  /* ---------- NOT POSSIBLE ---------- */
  const notPossible = useMemo(() => {
    if (!locks.length) return false;
    return scenarios.every((s) => Math.abs(s.diff) > 100);
  }, [scenarios, locks]);

  return (
    <div className="app">
      <h1>Cavalo Finance</h1>

      {/* INPUTS */}
      <div className="grid">
        <input value={purchase} onChange={(e) => setPurchase(e.target.value)} />
        <input value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        <input value={rate} onChange={(e) => setRate(e.target.value)} />
        <input value={term} onChange={(e) => setTerm(e.target.value)} />
        <input value={balloon} onChange={(e) => setBalloon(e.target.value)} />
      </div>

      {/* TARGET */}
      <input value={target} onChange={(e) => setTarget(e.target.value)} />

      {/* LOCKS */}
      <div className="locks">
        {Object.entries(lockLabels).map(([k, v]) => (
          <button
            key={k}
            className={locks.includes(k) ? "active" : ""}
            onClick={() => toggleLock(k)}
          >
            {v}
          </button>
        ))}
      </div>

      {/* LOCKED DISPLAY */}
      {locks.length > 0 && (
        <div className="locked">
          {locks.map((l) => (
            <span key={l}>🔒 {lockLabels[l]}</span>
          ))}
        </div>
      )}

      {/* WARNING */}
      {notPossible && (
        <div className="warning">
          ⚠ Not possible with current locks
        </div>
      )}

      {/* RESULTS */}
      <div className="results">
        {scenarios.map((s) => (
          <div key={s.key} className="card">
            <b>{s.key}</b>
            <p>{s.value}</p>
            <button onClick={s.apply}>Apply</button>
          </div>
        ))}
      </div>

      <h2>{money(monthly)}</h2>
    </div>
  );
}
