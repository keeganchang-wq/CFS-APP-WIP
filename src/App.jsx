
import React, { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Calculator,
  Car,
  ChevronDown,
  Download,
  FileText,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Percent,
  Save,
  Search,
  User,
  Wrench,
  X
} from "lucide-react";
import { jsPDF } from "jspdf";

const LENDERS = {
  VWFS: { name: "VWFS", originationFee: 1595, establishmentFee: 590, ppsr: 0, monthlyAccountFee: 0 },
  PEPPER: { name: "Pepper", originationFee: 1990, establishmentFee: 490, ppsr: 8, monthlyAccountFee: 8.9 },
  ANGLE_COMM: { name: "Angle Commercial", originationFee: 1595, establishmentFee: 599, ppsr: 6, monthlyAccountFee: 20 },
  ANGLE_CON: { name: "Angle Consumer", originationFee: 1395, establishmentFee: 499, ppsr: 6, monthlyAccountFee: 15 },
  TAURUS: { name: "Taurus", originationFee: 1490, establishmentFee: 490, ppsr: 6, monthlyAccountFee: 11 },
  ALLIED: { name: "Allied", originationFee: 1495, establishmentFee: 595, ppsr: 9.95, monthlyAccountFee: 12.95 },
  NFS: { name: "NFS", originationFee: 1490, establishmentFee: 490, ppsr: 6, monthlyAccountFee: 11 }
};

const LOCK_LABELS = {
  purchase: "Purchase price",
  rate: "Interest rate",
  balloon: "Balloon amount",
  term: "Term",
  deposit: "Deposit"
};

const formatCurrency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 2
});

function money(value) {
  return Number.isFinite(value) ? formatCurrency.format(value) : "$0.00";
}

function cleanNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function repayment({ amountFinanced, annualRate, months, balloon }) {
  const monthlyRate = annualRate / 100 / 12;

  if (!months || months <= 0) return 0;
  if (!monthlyRate) return Math.max(amountFinanced - balloon, 0) / months;

  const balloonPresentValue = balloon / Math.pow(1 + monthlyRate, months);
  const adjustedPrincipal = amountFinanced - balloonPresentValue;

  return (adjustedPrincipal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

function loadSavedQuotes() {
  try {
    return JSON.parse(localStorage.getItem("cavaloFinanceQuotes") || "[]");
  } catch {
    return [];
  }
}

export default function App() {
  const [displayMode, setDisplayMode] = useState("auto");

  const [lenderKey, setLenderKey] = useState("VWFS");
  const [lenderFees, setLenderFees] = useState(LENDERS);

  const [activeTab, setActiveTab] = useState("purchase");
  const [activeSheet, setActiveSheet] = useState(null);
  const [showRepaymentStructure, setShowRepaymentStructure] = useState(true);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [stockRef, setStockRef] = useState("");

  const [purchasePrice, setPurchasePrice] = useState("132940");
  const [deposit, setDeposit] = useState("0");
  const [tradeAllowance, setTradeAllowance] = useState("15000");
  const [existingPayout, setExistingPayout] = useState("0");

  const [interestRate, setInterestRate] = useState("7.49");
  const [loanTerm, setLoanTerm] = useState("60");
  const [balloonAmount, setBalloonAmount] = useState("65000");

  const [targetMonthly, setTargetMonthly] = useState("1500");
  const [targetPreference, setTargetPreference] = useState("auto");
  const [targetLocks, setTargetLocks] = useState([]);

  const [savedQuotes, setSavedQuotes] = useState(loadSavedQuotes);

  const lender = lenderFees[lenderKey] || lenderFees.VWFS;

  const calc = useMemo(() => {
    const price = cleanNumber(purchasePrice);
    const cashDeposit = cleanNumber(deposit);
    const trade = cleanNumber(tradeAllowance);
    const payout = cleanNumber(existingPayout);
    const rate = cleanNumber(interestRate);
    const term = cleanNumber(loanTerm);
    const balloon = cleanNumber(balloonAmount);

    const lenderCapitalisedFees =
      cleanNumber(lender.originationFee) +
      cleanNumber(lender.establishmentFee) +
      cleanNumber(lender.ppsr);

    const equity = cashDeposit + trade - payout;
    const subtotal = Math.max(price - equity, 0);
    const amountFinanced = subtotal + lenderCapitalisedFees;

    const monthlyBase = repayment({
      amountFinanced,
      annualRate: rate,
      months: term,
      balloon
    });

    const monthly = monthlyBase + cleanNumber(lender.monthlyAccountFee);
    const totalPayable = monthly * term + balloon;

    return {
      price,
      cashDeposit,
      trade,
      payout,
      rate,
      term,
      balloon,
      lenderCapitalisedFees,
      monthlyAccountFee: cleanNumber(lender.monthlyAccountFee),
      equity,
      subtotal,
      amountFinanced,
      monthly,
      weekly: (monthly * 12) / 52,
      fortnightly: (monthly * 12) / 26,
      totalPayable,
      interest: totalPayable - amountFinanced,
      lvr: price ? (amountFinanced / price) * 100 : 0,
      balloonPercent: price ? (balloon / price) * 100 : 0
    };
  }, [purchasePrice, deposit, tradeAllowance, existingPayout, interestRate, loanTerm, balloonAmount, lender]);

  function monthlyFor(overrides = {}) {
    const price = overrides.purchase ?? cleanNumber(purchasePrice);
    const cashDeposit = overrides.deposit ?? cleanNumber(deposit);
    const trade = overrides.trade ?? cleanNumber(tradeAllowance);
    const payout = overrides.payout ?? cleanNumber(existingPayout);
    const rate = overrides.rate ?? cleanNumber(interestRate);
    const term = overrides.term ?? cleanNumber(loanTerm);
    const balloon = overrides.balloon ?? cleanNumber(balloonAmount);

    const lenderCapitalisedFees =
      cleanNumber(lender.originationFee) +
      cleanNumber(lender.establishmentFee) +
      cleanNumber(lender.ppsr);

    const equity = cashDeposit + trade - payout;
    const subtotal = Math.max(price - equity, 0);
    const amountFinanced = subtotal + lenderCapitalisedFees;

    return repayment({
      amountFinanced,
      annualRate: rate,
      months: term,
      balloon
    }) + cleanNumber(lender.monthlyAccountFee);
  }

  function solveContinuous({ key, low, high, target, higherValueReducesPayment }) {
    let bestValue = low;
    let bestMonthly = monthlyFor({ [key]: low });

    for (let i = 0; i < 72; i += 1) {
      const mid = (low + high) / 2;
      const monthly = monthlyFor({ [key]: mid });

      if (Math.abs(monthly - target) < Math.abs(bestMonthly - target)) {
        bestValue = mid;
        bestMonthly = monthly;
      }

      if (higherValueReducesPayment) {
        if (monthly > target) low = mid;
        else high = mid;
      } else {
        if (monthly > target) high = mid;
        else low = mid;
      }
    }

    return { value: bestValue, monthly: bestMonthly };
  }

  const targetScenarios = useMemo(() => {
    const target = cleanNumber(targetMonthly);
    if (!target || target <= 0) return [];

    const price = cleanNumber(purchasePrice);
    const depositValue = cleanNumber(deposit);
    const currentBalloon = cleanNumber(balloonAmount);
    const currentRate = cleanNumber(interestRate);
    const currentTerm = cleanNumber(loanTerm);

    const scenarios = [];

    if (!targetLocks.includes("balloon")) {
      const solved = solveContinuous({
        key: "balloon",
        low: 0,
        high: Math.max(price * 0.8, currentBalloon, 1),
        target,
        higherValueReducesPayment: true
      });

      scenarios.push({
        key: "balloon",
        label: "Balloon required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setBalloonAmount(String(Math.round(solved.value)))
      });
    }

    if (!targetLocks.includes("deposit")) {
      const solved = solveContinuous({
        key: "deposit",
        low: depositValue,
        high: Math.max(price, depositValue + 1),
        target,
        higherValueReducesPayment: true
      });

      scenarios.push({
        key: "deposit",
        label: "Deposit required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setDeposit(String(Math.round(solved.value)))
      });
    }

    if (!targetLocks.includes("term")) {
      let bestTerm = currentTerm;
      let bestMonthly = monthlyFor({ term: currentTerm });
      let bestDifference = Math.abs(bestMonthly - target);

      for (let term = 12; term <= 84; term += 12) {
        const monthly = monthlyFor({ term });
        const difference = Math.abs(monthly - target);
        if (difference < bestDifference) {
          bestDifference = difference;
          bestTerm = term;
          bestMonthly = monthly;
        }
      }

      scenarios.push({
        key: "term",
        label: "Term required",
        value: `${bestTerm} months`,
        monthly: bestMonthly,
        apply: () => setLoanTerm(String(bestTerm))
      });
    }

    if (!targetLocks.includes("rate")) {
      const solved = solveContinuous({
        key: "rate",
        low: 0.01,
        high: Math.max(currentRate * 2, 30),
        target,
        higherValueReducesPayment: false
      });

      scenarios.push({
        key: "rate",
        label: "Interest rate required",
        value: `${Math.max(0.01, solved.value).toFixed(2)}%`,
        monthly: solved.monthly,
        apply: () => setInterestRate(String(Math.max(0.01, solved.value).toFixed(2)))
      });
    }

    if (!targetLocks.includes("purchase")) {
      const solved = solveContinuous({
        key: "purchase",
        low: 1000,
        high: Math.max(price, 1000),
        target,
        higherValueReducesPayment: false
      });

      scenarios.push({
        key: "purchase",
        label: "Purchase price required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setPurchasePrice(String(Math.round(solved.value)))
      });
    }

    return scenarios.map((scenario) => {
      const difference = scenario.monthly - target;
      return {
        ...scenario,
        difference,
        status:
          Math.abs(difference) < 5
            ? "Close"
            : difference > 0
              ? "Above target"
              : "Below target"
      };
    });
  }, [
    targetMonthly,
    targetLocks,
    purchasePrice,
    deposit,
    tradeAllowance,
    existingPayout,
    interestRate,
    loanTerm,
    balloonAmount,
    lender
  ]);

  const notPossibleWithCurrentLocks = useMemo(() => {
    if (!targetLocks.length) return false;
    if (!targetScenarios.length) return true;
    return targetScenarios.every((scenario) => Math.abs(scenario.difference) > 100);
  }, [targetLocks, targetScenarios]);

  const targetPreview = useMemo(() => {
    const target = cleanNumber(targetMonthly);
    if (!target) return "Enter a target repayment to view options.";
    const difference = calc.monthly - target;
    if (Math.abs(difference) < 1) return "Current repayment is already close to target.";
    return difference > 0
      ? `${money(difference)} above target`
      : `${money(Math.abs(difference))} below target`;
  }, [targetMonthly, calc.monthly]);

  function toggleTargetLock(lockKey) {
    setTargetLocks((current) => {
      if (current.includes(lockKey)) return current.filter((item) => item !== lockKey);
      if (current.length >= 3) return current;
      return [...current, lockKey];
    });
  }

  function applyPreferredTarget() {
    if (!targetScenarios.length) return;

    const preferred =
      targetPreference === "auto"
        ? targetScenarios
        : targetScenarios.filter((scenario) => scenario.key === targetPreference);

    const selected = (preferred.length ? preferred : targetScenarios)
      .slice()
      .sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference))[0];

    selected?.apply();
  }

  function updateLenderFee(field, value) {
    setLenderFees((current) => ({
      ...current,
      [lenderKey]: {
        ...current[lenderKey],
        [field]: value
      }
    }));
  }

  const quoteText = `Cavalo Prestige Finance Estimate
Client: ${clientName || "Client"}
Vehicle: ${vehicle || "Vehicle"}
Lender: ${lender.name}
Purchase Price: ${money(calc.price)}
Amount Financed: ${money(calc.amountFinanced)}
Rate: ${calc.rate.toFixed(2)}%
Term: ${calc.term} months
Balloon: ${money(calc.balloon)} (${calc.balloonPercent.toFixed(2)}%)
Monthly: ${money(calc.monthly)}
Weekly: ${money(calc.weekly)}
Fortnightly: ${money(calc.fortnightly)}
Estimate only. Subject to approval.`;

  function saveQuote() {
    const quote = {
      id: Date.now(),
      created: new Date().toLocaleString(),
      clientName,
      clientPhone,
      vehicle,
      stockRef,
      lenderKey,
      purchasePrice,
      deposit,
      tradeAllowance,
      existingPayout,
      interestRate,
      loanTerm,
      balloonAmount,
      lenderFees
    };

    const next = [quote, ...savedQuotes].slice(0, 50);
    setSavedQuotes(next);
    localStorage.setItem("cavaloFinanceQuotes", JSON.stringify(next));
    setActiveSheet("saved");
  }

  function loadQuote(quote) {
    setClientName(quote.clientName || "");
    setClientPhone(quote.clientPhone || "");
    setVehicle(quote.vehicle || "");
    setStockRef(quote.stockRef || "");
    setLenderKey(quote.lenderKey || "VWFS");
    setPurchasePrice(quote.purchasePrice || "0");
    setDeposit(quote.deposit || "0");
    setTradeAllowance(quote.tradeAllowance || "0");
    setExistingPayout(quote.existingPayout || "0");
    setInterestRate(quote.interestRate || "0");
    setLoanTerm(quote.loanTerm || "60");
    setBalloonAmount(quote.balloonAmount || "0");
    setLenderFees(quote.lenderFees || LENDERS);
    setActiveSheet(null);
  }

  function downloadPdf() {
    const doc = new jsPDF();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 297, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(25);
    doc.text("CAVALO", 105, 22, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("PRESTIGE", 105, 30, { align: "center" });

    doc.setDrawColor(65, 191, 40);
    doc.line(20, 38, 190, 38);

    doc.setFontSize(28);
    doc.text(money(calc.monthly), 105, 58, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);
    doc.text("monthly repayment", 105, 66, { align: "center" });

    const rows = [
      ["Client", clientName || "-"],
      ["Phone", clientPhone || "-"],
      ["Vehicle", vehicle || "-"],
      ["Stock", stockRef || "-"],
      ["Lender", lender.name],
      ["Purchase Price", money(calc.price)],
      ["Deposit", money(calc.cashDeposit)],
      ["Trade", money(calc.trade)],
      ["Payout", money(calc.payout)],
      ["Origination Fee", money(cleanNumber(lender.originationFee))],
      ["Establishment Fee", money(cleanNumber(lender.establishmentFee))],
      ["PPSR", money(cleanNumber(lender.ppsr))],
      ["Monthly Account Fee", money(cleanNumber(lender.monthlyAccountFee))],
      ["Amount Financed", money(calc.amountFinanced)],
      ["Rate", `${calc.rate.toFixed(2)}%`],
      ["Term", `${calc.term} months`],
      ["Balloon", `${money(calc.balloon)} (${calc.balloonPercent.toFixed(2)}%)`],
      ["Monthly Repayment", money(calc.monthly)]
    ];

    let y = 82;
    doc.setFontSize(10);
    rows.forEach(([label, value]) => {
      doc.setTextColor(145, 145, 145);
      doc.text(label, 22, y);
      doc.setTextColor(255, 255, 255);
      doc.text(String(value), 188, y, { align: "right" });
      doc.setDrawColor(35, 35, 35);
      doc.line(22, y + 4, 188, y + 4);
      y += 9;
    });

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text("Estimate only. Subject to lender approval and final contract terms.", 105, 282, {
      align: "center"
    });

    doc.save("cavalo-finance-quote.pdf");
  }

  function shareQuote() {
    if (navigator.share) {
      navigator.share({ title: "Cavalo Finance Quote", text: quoteText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(quoteText);
      alert("Quote copied.");
    }
  }

  const rules = [];
  if (calc.lvr > 115) rules.push("High LVR — review deposit/trade structure.");
  if (calc.balloonPercent > 60) rules.push("Balloon above 60% placeholder policy.");
  if (calc.term > 84) rules.push("Term above 84 months placeholder policy.");
  if (!rules.length) rules.push("Placeholder rules check passed.");

  const sharedProps = {
    displayMode,
    setDisplayMode,
    lenderKey,
    setLenderKey,
    lenderFees,
    lender,
    activeTab,
    setActiveTab,
    activeSheet,
    setActiveSheet,
    showRepaymentStructure,
    setShowRepaymentStructure,
    clientName,
    setClientName,
    clientPhone,
    setClientPhone,
    vehicle,
    setVehicle,
    stockRef,
    setStockRef,
    purchasePrice,
    setPurchasePrice,
    deposit,
    setDeposit,
    tradeAllowance,
    setTradeAllowance,
    existingPayout,
    setExistingPayout,
    interestRate,
    setInterestRate,
    loanTerm,
    setLoanTerm,
    balloonAmount,
    setBalloonAmount,
    calc,
    updateLenderFee,
    quoteText,
    saveQuote,
    loadQuote,
    savedQuotes,
    downloadPdf,
    shareQuote,
    rules,
    targetMonthly,
    setTargetMonthly,
    targetPreference,
    setTargetPreference,
    targetLocks,
    toggleTargetLock,
    targetScenarios,
    targetPreview,
    notPossibleWithCurrentLocks,
    applyPreferredTarget
  };

  return (
    <>
      <MobileLayout {...sharedProps} />
      <DesktopLayout {...sharedProps} />
    </>
  );
}

function MobileLayout(props) {
  return (
    <div className={`mobile-shell mode-${props.displayMode}`}>
      <div className="phone">
        <header className="mobile-header">
          <Brand />
          <ModeToggle {...props} />
        </header>

        <main className="mobile-main">
          <Hero monthly={props.calc.monthly} />

          <button className="client-strip" onClick={() => props.setActiveSheet("client")}>
            <User size={18} />
            <div>
              <b>{props.clientName || "Client Profile"}</b>
              <span>{props.vehicle || "Tap to add client + vehicle"}</span>
            </div>
          </button>

          <LenderDropdown {...props} />
          <Tabs {...props} />
          <MobileContent {...props} />

          <section className="tools">
            <Tool title="Target Repayment" icon={<Calculator />} onClick={() => props.setActiveSheet("target")} />
            <Tool title="Deal Structuring" icon={<BadgeDollarSign />} onClick={() => props.setActiveSheet("structure")} />
            <Tool title="Saved Quotes" icon={<Search />} onClick={() => props.setActiveSheet("quotes")} />
          </section>

          <p className="disclaimer">Estimate only. Subject to approval, lender policy and final contract terms.</p>
        </main>

        <nav className="bottom-nav">
          <button className="selected"><Calculator size={22} /><span>Calc</span></button>
          <button onClick={props.saveQuote}><Save size={22} /><span>Save</span></button>
          <button onClick={() => props.setActiveSheet("client")}><User size={22} /><span>Client</span></button>
          <button onClick={() => props.setActiveSheet("send")}><MoreHorizontal size={22} /><span>Send</span></button>
        </nav>

        {props.activeSheet && <ActionSheet {...props} />}
      </div>
    </div>
  );
}

function DesktopLayout(props) {
  return (
    <div className={`desktop-shell mode-${props.displayMode}`}>
      <header className="desktop-header">
        <Brand />
        <ModeToggle {...props} />
        <div className="desktop-actions">
          <button onClick={props.saveQuote}><Save size={17} />Save Quote</button>
          <button onClick={props.downloadPdf}><Download size={17} />PDF</button>
          <a href={`sms:${props.clientPhone}?&body=${encodeURIComponent(props.quoteText)}`}><MessageCircle size={17} />SMS</a>
          <a href={`mailto:?subject=${encodeURIComponent("Cavalo Finance Quote")}&body=${encodeURIComponent(props.quoteText)}`}><Mail size={17} />Email</a>
        </div>
      </header>

      <main className="desktop-layout">
        <section className="desktop-left">
          <Hero monthly={props.calc.monthly} />
          <div className="summary-grid">
            <Metric label="Monthly" value={money(props.calc.monthly)} />
            <Metric label="Weekly" value={money(props.calc.weekly)} />
            <Metric label="Fortnightly" value={money(props.calc.fortnightly)} />
            <Metric label="Amount Financed" value={money(props.calc.amountFinanced)} />
          </div>

          <Panel title="Saved Quotes" icon={<Save />}>
            <SavedQuotes {...props} />
          </Panel>
        </section>

        <section className="desktop-right">
          <Panel title="Client Profile" icon={<User />}>
            <div className="grid4">
              <Field label="Client Name" value={props.clientName} setValue={props.setClientName} />
              <Field label="Phone" value={props.clientPhone} setValue={props.setClientPhone} />
              <Field label="Vehicle" value={props.vehicle} setValue={props.setVehicle} />
              <Field label="Stock / Ref" value={props.stockRef} setValue={props.setStockRef} />
            </div>
          </Panel>

          <Panel title="Lender Selection" icon={<FileText />}>
            <div className="desktop-lender">
              <label>
                <span>Lender</span>
                <select value={props.lenderKey} onChange={(event) => props.setLenderKey(event.target.value)}>
                  {Object.entries(props.lenderFees).map(([key, lender]) => (
                    <option value={key} key={key}>{lender.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>

          <div className="desktop-two-col">
            <PurchasePanel {...props} />
            <FeesPanel {...props} />
          </div>

          <div className="desktop-two-col">
            <RepaymentPanel {...props} />
            <Panel title="Target Repayment Mode" icon={<Wrench />}>
              <TargetPanel {...props} />
              <div className="rules">
                {props.rules.map((rule) => <p key={rule}>{rule}</p>)}
              </div>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}

function MobileContent(props) {
  if (props.activeTab === "purchase") return <PurchasePanel {...props} />;
  if (props.activeTab === "fees") return <FeesPanel {...props} />;
  return <RepaymentPanel {...props} />;
}

function Brand() {
  return (
    <div className="brand">
      <h1>CAVALO</h1>
      <p><i />PRESTIGE<i /></p>
    </div>
  );
}

function ModeToggle(props) {
  return (
    <div className="mode-toggle">
      <button className={props.displayMode === "auto" ? "active" : ""} onClick={() => props.setDisplayMode("auto")}>Auto</button>
      <button className={props.displayMode === "mobile" ? "active" : ""} onClick={() => props.setDisplayMode("mobile")}>Mobile</button>
      <button className={props.displayMode === "desktop" ? "active" : ""} onClick={() => props.setDisplayMode("desktop")}>Desktop</button>
    </div>
  );
}

function Hero({ monthly }) {
  return (
    <section className="hero">
      <Car size={28} />
      <p>FINANCE CALCULATOR</p>
      <span>MONTHLY</span>
      <h2>{money(monthly)}</h2>
    </section>
  );
}

function LenderDropdown(props) {
  return (
    <section className="lender-card">
      <div>
        <span>LENDER</span>
        <b>{props.lender.name}</b>
      </div>
      <label>
        <select value={props.lenderKey} onChange={(event) => props.setLenderKey(event.target.value)}>
          {Object.entries(props.lenderFees).map(([key, lender]) => (
            <option value={key} key={key}>{lender.name}</option>
          ))}
        </select>
        <ChevronDown size={20} />
      </label>
    </section>
  );
}

function Tabs(props) {
  return (
    <nav className="tabs">
      <button className={props.activeTab === "purchase" ? "active" : ""} onClick={() => props.setActiveTab("purchase")}>Purchase</button>
      <button className={props.activeTab === "fees" ? "active" : ""} onClick={() => props.setActiveTab("fees")}>Fees</button>
      <button className={props.activeTab === "summary" ? "active" : ""} onClick={() => props.setActiveTab("summary")}>Summary</button>
    </nav>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        {React.cloneElement(icon, { size: 20 })}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function PurchasePanel(props) {
  return (
    <Panel title="Purchase Details" icon={<FileText />}>
      <div className="grid2">
        <Field label="Purchase" value={props.purchasePrice} setValue={props.setPurchasePrice} prefix="$" />
        <Field label="Deposit" value={props.deposit} setValue={props.setDeposit} prefix="$" />
        <Field label="Trade" value={props.tradeAllowance} setValue={props.setTradeAllowance} prefix="$" />
        <Field label="Payout" value={props.existingPayout} setValue={props.setExistingPayout} prefix="$" />
      </div>
      <MiniRows rows={[
        ["Equity", money(props.calc.equity)],
        ["Subtotal", money(props.calc.subtotal)],
        ["LVR", `${props.calc.lvr.toFixed(2)}%`]
      ]} />
    </Panel>
  );
}

function FeesPanel(props) {
  return (
    <Panel title="Lender Fees" icon={<Percent />}>
      <div className="grid2">
        <Field label="Origination" value={props.lender.originationFee} setValue={(value) => props.updateLenderFee("originationFee", value)} prefix="$" />
        <Field label="Establishment" value={props.lender.establishmentFee} setValue={(value) => props.updateLenderFee("establishmentFee", value)} prefix="$" />
        <Field label="PPSR" value={props.lender.ppsr} setValue={(value) => props.updateLenderFee("ppsr", value)} prefix="$" />
        <Field label="Monthly Fee" value={props.lender.monthlyAccountFee} setValue={(value) => props.updateLenderFee("monthlyAccountFee", value)} prefix="$" />
      </div>
    </Panel>
  );
}

function RepaymentPanel(props) {
  return (
    <Panel title="Repayment Structure" icon={<Calculator />}>
      <div className="section-toggle">
        <span>Show repayment structure</span>
        <button onClick={() => props.setShowRepaymentStructure(!props.showRepaymentStructure)}>
          {props.showRepaymentStructure ? "Hide" : "Show"}
        </button>
      </div>

      {props.showRepaymentStructure && (
        <>
          <div className="grid2">
            <Field label="Rate" value={props.interestRate} setValue={props.setInterestRate} suffix="%" />
            <Field label="Term" value={props.loanTerm} setValue={props.setLoanTerm} suffix="mths" />
            <Field label="Balloon" value={props.balloonAmount} setValue={props.setBalloonAmount} prefix="$" />
          </div>

          <MiniRows rows={[
            ["Amount financed", money(props.calc.amountFinanced)],
            ["Balloon %", `${props.calc.balloonPercent.toFixed(2)}%`],
            ["Monthly", money(props.calc.monthly)],
            ["Weekly", money(props.calc.weekly)],
            ["Fortnightly", money(props.calc.fortnightly)],
            ["Total payable", money(props.calc.totalPayable)]
          ]} />
        </>
      )}
    </Panel>
  );
}

function TargetPanel(props) {
  return (
    <div className="target-panel">
      <div className="target-top">
        <Field label="Target Monthly" value={props.targetMonthly} setValue={props.setTargetMonthly} prefix="$" />

        <label className="select-field">
          <span>Apply Preference</span>
          <select value={props.targetPreference} onChange={(event) => props.setTargetPreference(event.target.value)}>
            <option value="auto">Best fit</option>
            <option value="purchase">Purchase price</option>
            <option value="rate">Interest rate</option>
            <option value="balloon">Balloon amount</option>
            <option value="term">Term</option>
            <option value="deposit">Deposit</option>
          </select>
        </label>
      </div>

      <div className="multi-lock">
        <span>Lock up to 3</span>
        <div>
          {Object.entries(LOCK_LABELS).map(([key, label]) => {
            const active = props.targetLocks.includes(key);
            const disabled = !active && props.targetLocks.length >= 3;
            return (
              <button
                key={key}
                className={active ? "active" : ""}
                disabled={disabled}
                onClick={() => props.toggleTargetLock(key)}
              >
                {label.replace(" amount", "").replace(" price", "")}
              </button>
            );
          })}
        </div>
        <small>{props.targetLocks.length}/3 locked</small>
      </div>

      {props.targetLocks.length > 0 && (
        <div className="locked-summary">
          <span>Locked</span>
          <div>
            {props.targetLocks.map((lock) => (
              <b key={lock}>🔒 {LOCK_LABELS[lock]}</b>
            ))}
          </div>
        </div>
      )}

      {props.notPossibleWithCurrentLocks && (
        <div className="target-warning">⚠ Not possible with current locks</div>
      )}

      <p className="target-preview">{props.targetPreview}</p>

      <div className="target-results">
        {props.targetScenarios.length ? props.targetScenarios.map((scenario) => (
          <div className="target-result" key={scenario.key}>
            <div>
              <span>{scenario.label}</span>
              <b>{scenario.value}</b>
              <small>{scenario.status}: {money(Math.abs(scenario.difference))}</small>
            </div>
            <button onClick={scenario.apply}>Apply</button>
          </div>
        )) : (
          <p className="target-preview">Enter a target monthly repayment.</p>
        )}
      </div>

      <button className="target-button" onClick={props.applyPreferredTarget}>
        Apply Preferred Option
      </button>
    </div>
  );
}

function ActionSheet(props) {
  const titles = {
    send: "Send Quote",
    client: "Client Profile",
    quotes: "Saved Quotes",
    target: "Target Repayment",
    structure: "Deal Structuring",
    saved: "Saved"
  };

  return (
    <div className="overlay">
      <div className="sheet">
        <div className="sheet-head">
          <h3>{titles[props.activeSheet] || "Menu"}</h3>
          <button onClick={() => props.setActiveSheet(null)}><X size={20} /></button>
        </div>

        {props.activeSheet === "send" && (
          <>
            <button className="sheet-action" onClick={props.downloadPdf}><FileText size={18} />Download PDF Quote</button>
            <a className="sheet-action" href={`sms:${props.clientPhone}?&body=${encodeURIComponent(props.quoteText)}`}><MessageCircle size={18} />Send via SMS</a>
            <a className="sheet-action" href={`mailto:?subject=${encodeURIComponent("Cavalo Finance Quote")}&body=${encodeURIComponent(props.quoteText)}`}><Mail size={18} />Send via Email</a>
            <button className="sheet-action" onClick={props.shareQuote}><MoreHorizontal size={18} />Share / Copy Quote</button>
          </>
        )}

        {props.activeSheet === "client" && (
          <div className="sheet-grid">
            <Field label="Client Name" value={props.clientName} setValue={props.setClientName} />
            <Field label="Phone" value={props.clientPhone} setValue={props.setClientPhone} />
            <Field label="Vehicle" value={props.vehicle} setValue={props.setVehicle} />
            <Field label="Stock / Ref" value={props.stockRef} setValue={props.setStockRef} />
          </div>
        )}

        {props.activeSheet === "quotes" && <SavedQuotes {...props} />}
        {props.activeSheet === "target" && <TargetPanel {...props} />}

        {props.activeSheet === "structure" && (
          <div className="flags">
            <p>Deal structuring placeholder.</p>
            <p>Future options: reduce NAF, adjust deposit, cap balloon, compare lenders, target payment solver.</p>
          </div>
        )}

        {props.activeSheet === "saved" && <p className="ok-box">Quote saved to this device.</p>}
      </div>
    </div>
  );
}

function SavedQuotes(props) {
  return (
    <div className="saved-list">
      {props.savedQuotes.length ? props.savedQuotes.map((quote) => (
        <button key={quote.id} onClick={() => props.loadQuote(quote)}>
          <b>{quote.clientName || "Unnamed Client"}</b>
          <span>{quote.vehicle || quote.created} · {LENDERS[quote.lenderKey]?.name || "Lender"}</span>
        </button>
      )) : <p className="muted">No saved quotes yet.</p>}
    </div>
  );
}

function Field({ label, value, setValue, prefix, suffix }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        {prefix && <em>{prefix}</em>}
        <input value={value} onChange={(event) => setValue(event.target.value)} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function MiniRows({ rows }) {
  return (
    <div className="minirows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Tool({ title, icon, onClick }) {
  return (
    <button className="tool" onClick={onClick}>
      {React.cloneElement(icon, { size: 18 })}
      <span>{title}</span>
    </button>
  );
}
