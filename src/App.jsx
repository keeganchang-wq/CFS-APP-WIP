
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

const DEFAULT_LENDERS = {
  VWFS: { name: "VWFS", originationFee: 1595, establishmentFee: 590, ppsr: 0, monthlyAccountFee: 0 },
  PEPPER: { name: "Pepper", originationFee: 1990, establishmentFee: 490, ppsr: 8, monthlyAccountFee: 8.90 },
  ANGLE_COMM: { name: "Angle Commercial", originationFee: 1595, establishmentFee: 599, ppsr: 6, monthlyAccountFee: 20 },
  ANGLE_CON: { name: "Angle Consumer", originationFee: 1395, establishmentFee: 499, ppsr: 6, monthlyAccountFee: 15 },
  TAURUS: { name: "Taurus", originationFee: 1490, establishmentFee: 490, ppsr: 6, monthlyAccountFee: 11 },
  ALLIED: { name: "Allied", originationFee: 1495, establishmentFee: 595, ppsr: 9.95, monthlyAccountFee: 12.95 },
  NFS: { name: "NFS", originationFee: 1490, establishmentFee: 490, ppsr: 6, monthlyAccountFee: 11 }
};

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 2
});

function money(value) {
  return Number.isFinite(value) ? aud.format(value) : "$0.00";
}

function num(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateRepayment({ amount, annualRate, months, balloon }) {
  const r = annualRate / 100 / 12;
  if (!months || months <= 0) return 0;
  if (!r) return Math.max(amount - balloon, 0) / months;

  const balloonPresentValue = balloon / Math.pow(1 + r, months);
  const adjustedPrincipal = amount - balloonPresentValue;
  return (adjustedPrincipal * r) / (1 - Math.pow(1 + r, -months));
}

function loadQuotes() {
  try {
    return JSON.parse(localStorage.getItem("cavaloQuotesV4") || "[]");
  } catch {
    return [];
  }
}

export default function App() {
  const [viewMode, setViewMode] = useState("auto");

  const [lenderKey, setLenderKey] = useState("VWFS");
  const [lenders, setLenders] = useState(DEFAULT_LENDERS);

  const [activeTab, setActiveTab] = useState("purchase");
  const [activeSheet, setActiveSheet] = useState(null);
  const [showRepaymentStructure, setShowRepaymentStructure] = useState(true);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [stockNo, setStockNo] = useState("");

  const [purchasePrice, setPurchasePrice] = useState("132940");
  const [deposit, setDeposit] = useState("0");
  const [trade, setTrade] = useState("15000");
  const [payout, setPayout] = useState("0");

  const [rate, setRate] = useState("7.49");
  const [term, setTerm] = useState("60");
  const [balloon, setBalloon] = useState("65000");

  const [targetMonthly, setTargetMonthly] = useState("1500");
  const [targetLock, setTargetLock] = useState("none");
  const [targetPreference, setTargetPreference] = useState("auto");

  const [savedQuotes, setSavedQuotes] = useState(loadQuotes);

  const lender = lenders[lenderKey] || DEFAULT_LENDERS.VWFS;

  const calc = useMemo(() => {
    const price = num(purchasePrice);
    const dep = num(deposit);
    const trd = num(trade);
    const pay = num(payout);
    const months = num(term);
    const balloonAmount = num(balloon);
    const annualRate = num(rate);

    const capitalisedFees =
      num(lender.originationFee) +
      num(lender.establishmentFee) +
      num(lender.ppsr);

    const equity = dep + trd - pay;
    const subtotal = Math.max(price - equity, 0);
    const amountFinanced = subtotal + capitalisedFees;

    const baseMonthly = calculateRepayment({
      amount: amountFinanced,
      annualRate,
      months,
      balloon: balloonAmount
    });

    const monthly = baseMonthly + num(lender.monthlyAccountFee);
    const totalPayable = monthly * months + balloonAmount;

    return {
      price,
      dep,
      trade: trd,
      payout: pay,
      equity,
      subtotal,
      capitalisedFees,
      amountFinanced,
      months,
      balloonAmount,
      annualRate,
      monthly,
      weekly: (monthly * 12) / 52,
      fortnightly: (monthly * 12) / 26,
      totalPayable,
      interest: totalPayable - amountFinanced,
      lvr: price ? (amountFinanced / price) * 100 : 0,
      balloonPercent: price ? (balloonAmount / price) * 100 : 0
    };
  }, [purchasePrice, deposit, trade, payout, term, balloon, rate, lender]);

  function monthlyForScenario(overrides = {}) {
    const price = overrides.price ?? num(purchasePrice);
    const dep = overrides.deposit ?? num(deposit);
    const trd = overrides.trade ?? num(trade);
    const pay = overrides.payout ?? num(payout);
    const months = overrides.term ?? num(term);
    const balloonAmount = overrides.balloon ?? num(balloon);
    const annualRate = overrides.rate ?? num(rate);

    const capitalisedFees =
      num(lender.originationFee) +
      num(lender.establishmentFee) +
      num(lender.ppsr);

    const equity = dep + trd - pay;
    const subtotal = Math.max(price - equity, 0);
    const amountFinanced = subtotal + capitalisedFees;

    return calculateRepayment({
      amount: amountFinanced,
      annualRate,
      months,
      balloon: balloonAmount
    }) + num(lender.monthlyAccountFee);
  }

  function binarySolve({ key, low, high, target, direction }) {
    let bestValue = low;
    let bestMonthly = monthlyForScenario({ [key]: low });

    for (let i = 0; i < 80; i += 1) {
      const mid = (low + high) / 2;
      const monthly = monthlyForScenario({ [key]: mid });

      if (Math.abs(monthly - target) < Math.abs(bestMonthly - target)) {
        bestValue = mid;
        bestMonthly = monthly;
      }

      if (direction === "higherReduces") {
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
    const target = num(targetMonthly);
    if (!target || target <= 0) return [];

    const price = num(purchasePrice);
    const currentDeposit = num(deposit);
    const currentBalloon = num(balloon);
    const currentRate = num(rate);
    const currentTerm = num(term);

    const scenarios = [];

    if (targetLock !== "balloon") {
      const solved = binarySolve({
        key: "balloon",
        low: 0,
        high: Math.max(price * 0.8, currentBalloon, 1),
        target,
        direction: "higherReduces"
      });
      scenarios.push({
        key: "balloon",
        label: "Balloon required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setBalloon(String(Math.round(solved.value)))
      });
    }

    if (targetLock !== "deposit") {
      const solved = binarySolve({
        key: "deposit",
        low: currentDeposit,
        high: Math.max(price, currentDeposit + 1),
        target,
        direction: "higherReduces"
      });
      scenarios.push({
        key: "deposit",
        label: "Deposit required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setDeposit(String(Math.round(solved.value)))
      });
    }

    if (targetLock !== "term") {
      let bestTerm = currentTerm;
      let bestMonthly = monthlyForScenario({ term: currentTerm });
      let bestDiff = Math.abs(bestMonthly - target);

      for (let months = 12; months <= 84; months += 12) {
        const monthly = monthlyForScenario({ term: months });
        const diff = Math.abs(monthly - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestTerm = months;
          bestMonthly = monthly;
        }
      }

      scenarios.push({
        key: "term",
        label: "Term required",
        value: `${bestTerm} months`,
        monthly: bestMonthly,
        apply: () => setTerm(String(bestTerm))
      });
    }

    if (targetLock !== "rate") {
      const solved = binarySolve({
        key: "rate",
        low: 0.01,
        high: Math.max(currentRate * 2, 30),
        target,
        direction: "higherIncreases"
      });
      scenarios.push({
        key: "rate",
        label: "Interest rate required",
        value: `${Math.max(0.01, solved.value).toFixed(2)}%`,
        monthly: solved.monthly,
        apply: () => setRate(String(Math.max(0.01, solved.value).toFixed(2)))
      });
    }

    if (targetLock !== "purchase") {
      const solved = binarySolve({
        key: "price",
        low: 1000,
        high: Math.max(price, 1000),
        target,
        direction: "higherIncreases"
      });
      scenarios.push({
        key: "purchase",
        label: "Purchase price required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setPurchasePrice(String(Math.round(solved.value)))
      });
    }

    return scenarios.map((scenario) => ({
      ...scenario,
      difference: scenario.monthly - target,
      status:
        Math.abs(scenario.monthly - target) < 5
          ? "Close"
          : scenario.monthly > target
            ? "Above target"
            : "Below target"
    }));
  }, [
    targetMonthly,
    targetLock,
    purchasePrice,
    deposit,
    trade,
    payout,
    term,
    balloon,
    rate,
    lender
  ]);

  const targetPreview = useMemo(() => {
    const target = num(targetMonthly);
    if (!target) return "Enter a target repayment to view options.";
    const difference = calc.monthly - target;
    if (Math.abs(difference) < 1) return "Current repayment is already close to target.";
    return difference > 0
      ? `${money(difference)} above target`
      : `${money(Math.abs(difference))} below target`;
  }, [targetMonthly, calc.monthly]);

  function applyPreferredTarget() {
    if (!targetScenarios.length) return;

    const options =
      targetPreference === "auto"
        ? targetScenarios
        : targetScenarios.filter((scenario) => scenario.key === targetPreference);

    const chosen = (options.length ? options : targetScenarios)
      .slice()
      .sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference))[0];

    if (chosen) chosen.apply();
  }

  function updateFee(field, value) {
    setLenders((prev) => ({
      ...prev,
      [lenderKey]: {
        ...prev[lenderKey],
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
Rate: ${calc.annualRate.toFixed(2)}%
Term: ${calc.months} months
Balloon: ${money(calc.balloonAmount)} (${calc.balloonPercent.toFixed(2)}%)
Estimated Monthly: ${money(calc.monthly)}
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
      stockNo,
      lenderKey,
      purchasePrice,
      deposit,
      trade,
      payout,
      rate,
      term,
      balloon,
      lenders
    };

    const next = [quote, ...savedQuotes].slice(0, 50);
    setSavedQuotes(next);
    localStorage.setItem("cavaloQuotesV4", JSON.stringify(next));
    setActiveSheet("saved");
  }

  function loadQuote(quote) {
    setClientName(quote.clientName || "");
    setClientPhone(quote.clientPhone || "");
    setVehicle(quote.vehicle || "");
    setStockNo(quote.stockNo || "");
    setLenderKey(quote.lenderKey || "VWFS");
    setPurchasePrice(quote.purchasePrice || "0");
    setDeposit(quote.deposit || "0");
    setTrade(quote.trade || "0");
    setPayout(quote.payout || "0");
    setRate(quote.rate || "0");
    setTerm(quote.term || "60");
    setBalloon(quote.balloon || "0");
    setLenders(quote.lenders || DEFAULT_LENDERS);
    setActiveSheet(null);
  }

  function createPdf() {
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
      ["Stock", stockNo || "-"],
      ["Lender", lender.name],
      ["Purchase Price", money(calc.price)],
      ["Deposit", money(calc.dep)],
      ["Trade", money(calc.trade)],
      ["Payout", money(calc.payout)],
      ["Origination Fee", money(num(lender.originationFee))],
      ["Establishment Fee", money(num(lender.establishmentFee))],
      ["PPSR", money(num(lender.ppsr))],
      ["Monthly Account Fee", money(num(lender.monthlyAccountFee))],
      ["Amount Financed", money(calc.amountFinanced)],
      ["Rate", `${calc.annualRate.toFixed(2)}%`],
      ["Term", `${calc.months} months`],
      ["Balloon", `${money(calc.balloonAmount)} (${calc.balloonPercent.toFixed(2)}%)`],
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
  if (calc.months > 84) rules.push("Term above 84 months placeholder policy.");
  if (!rules.length) rules.push("Placeholder rules check passed.");

  const sharedProps = {
    viewMode,
    setViewMode,
    lenderKey,
    setLenderKey,
    lenders,
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
    stockNo,
    setStockNo,
    purchasePrice,
    setPurchasePrice,
    deposit,
    setDeposit,
    trade,
    setTrade,
    payout,
    setPayout,
    rate,
    setRate,
    term,
    setTerm,
    balloon,
    setBalloon,
    calc,
    updateFee,
    saveQuote,
    loadQuote,
    savedQuotes,
    quoteText,
    createPdf,
    shareQuote,
    rules,
    targetMonthly,
    setTargetMonthly,
    targetLock,
    setTargetLock,
    targetPreference,
    setTargetPreference,
    targetScenarios,
    targetPreview,
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
    <div className={`mobile-shell mode-${props.viewMode}`}>
      <div className="phone">
        <header className="mobile-top">
          <Brand />
          <ModeToggle viewMode={props.viewMode} setViewMode={props.setViewMode} />
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

          <LenderSelector {...props} />
          <Tabs activeTab={props.activeTab} setActiveTab={props.setActiveTab} />

          <MobileTabContent {...props} />

          <section className="tools">
            <Tool title="Target Repayment" icon={<Calculator />} onClick={() => props.setActiveSheet("target")} />
            <Tool title="Deal Structuring" icon={<BadgeDollarSign />} onClick={() => props.setActiveSheet("structure")} />
            <Tool title="Saved Quotes" icon={<Search />} onClick={() => props.setActiveSheet("quotes")} />
          </section>

          <p className="disclaimer">
            Estimate only. Subject to approval, lender policy and final contract terms.
          </p>
        </main>

        <nav className="bottom">
          <button className="selected">
            <Calculator size={22} />
            <span>Calc</span>
          </button>
          <button onClick={props.saveQuote}>
            <Save size={22} />
            <span>Save</span>
          </button>
          <button onClick={() => props.setActiveSheet("client")}>
            <User size={22} />
            <span>Client</span>
          </button>
          <button onClick={() => props.setActiveSheet("send")}>
            <MoreHorizontal size={22} />
            <span>Send</span>
          </button>
        </nav>

        {props.activeSheet && <ActionSheet {...props} />}
      </div>
    </div>
  );
}

function DesktopLayout(props) {
  return (
    <div className={`desktop-shell mode-${props.viewMode}`}>
      <header className="desktop-top">
        <Brand />
        <ModeToggle viewMode={props.viewMode} setViewMode={props.setViewMode} />

        <div className="top-actions">
          <button onClick={props.saveQuote}>
            <Save size={17} />
            Save Quote
          </button>
          <button onClick={props.createPdf}>
            <Download size={17} />
            PDF
          </button>
          <a href={`sms:${props.clientPhone}?&body=${encodeURIComponent(props.quoteText)}`}>
            <MessageCircle size={17} />
            SMS
          </a>
          <a href={`mailto:?subject=${encodeURIComponent("Cavalo Finance Quote")}&body=${encodeURIComponent(props.quoteText)}`}>
            <Mail size={17} />
            Email
          </a>
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
              <Field label="Stock / Ref" value={props.stockNo} setValue={props.setStockNo} />
            </div>
          </Panel>

          <Panel title="Lender Selection" icon={<FileText />}>
            <div className="desktop-lender-single">
              <label>
                <span>Lender</span>
                <select value={props.lenderKey} onChange={(e) => props.setLenderKey(e.target.value)}>
                  {Object.entries(props.lenders).map(([key, lender]) => (
                    <option key={key} value={key}>{lender.name}</option>
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
              <div className="rules compact-rules">
                {props.rules.map((rule) => <p key={rule}>{rule}</p>)}
              </div>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}

function MobileTabContent(props) {
  if (props.activeTab === "purchase") return <PurchasePanel {...props} />;
  if (props.activeTab === "fees") return <FeesPanel {...props} />;
  return <RepaymentPanel {...props} />;
}

function PurchasePanel(props) {
  return (
    <Panel title="Purchase Details" icon={<FileText />}>
      <div className="grid2">
        <Field label="Purchase" value={props.purchasePrice} setValue={props.setPurchasePrice} prefix="$" />
        <Field label="Deposit" value={props.deposit} setValue={props.setDeposit} prefix="$" />
        <Field label="Trade" value={props.trade} setValue={props.setTrade} prefix="$" />
        <Field label="Payout" value={props.payout} setValue={props.setPayout} prefix="$" />
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
        <Field label="Origination" value={props.lender.originationFee} setValue={(v) => props.updateFee("originationFee", v)} prefix="$" />
        <Field label="Establishment" value={props.lender.establishmentFee} setValue={(v) => props.updateFee("establishmentFee", v)} prefix="$" />
        <Field label="PPSR" value={props.lender.ppsr} setValue={(v) => props.updateFee("ppsr", v)} prefix="$" />
        <Field label="Monthly Fee" value={props.lender.monthlyAccountFee} setValue={(v) => props.updateFee("monthlyAccountFee", v)} prefix="$" />
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
            <Field label="Rate" value={props.rate} setValue={props.setRate} suffix="%" />
            <Field label="Term" value={props.term} setValue={props.setTerm} suffix="mths" />
            <Field label="Balloon" value={props.balloon} setValue={props.setBalloon} prefix="$" />
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
      <div className="target-top-grid">
        <Field label="Target Monthly" value={props.targetMonthly} setValue={props.setTargetMonthly} prefix="$" />

        <label className="target-select">
          <span>Lock</span>
          <select value={props.targetLock} onChange={(e) => props.setTargetLock(e.target.value)}>
            <option value="none">Nothing locked</option>
            <option value="purchase">Purchase price</option>
            <option value="rate">Interest rate</option>
            <option value="balloon">Balloon amount</option>
            <option value="term">Term</option>
            <option value="deposit">Deposit</option>
          </select>
        </label>

        <label className="target-select">
          <span>Apply Preference</span>
          <select value={props.targetPreference} onChange={(e) => props.setTargetPreference(e.target.value)}>
            <option value="auto">Best fit</option>
            <option value="purchase">Purchase price</option>
            <option value="rate">Interest rate</option>
            <option value="balloon">Balloon amount</option>
            <option value="term">Term</option>
            <option value="deposit">Deposit</option>
          </select>
        </label>
      </div>

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
    rules: "Rules Engine",
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
            <button className="sheet-action" onClick={props.createPdf}><FileText size={18} />Download PDF Quote</button>
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
            <Field label="Stock / Ref" value={props.stockNo} setValue={props.setStockNo} />
          </div>
        )}

        {props.activeSheet === "quotes" && <SavedQuotes {...props} />}
        {props.activeSheet === "target" && <TargetPanel {...props} />}

        {props.activeSheet === "structure" && (
          <div className="flags">
            <p className="note">Placeholder deal structuring module.</p>
            <p className="empty">Future options: reduce NAF, adjust deposit, cap balloon, compare lenders, payment target solver.</p>
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
          <span>{quote.vehicle || quote.created} · {DEFAULT_LENDERS[quote.lenderKey]?.name || "Lender"}</span>
        </button>
      )) : <p className="muted">No saved quotes yet.</p>}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <h1>CAVALO</h1>
      <p><i />PRESTIGE<i /></p>
    </div>
  );
}

function ModeToggle({ viewMode, setViewMode }) {
  return (
    <div className="mode-toggle">
      <button className={viewMode === "auto" ? "active" : ""} onClick={() => setViewMode("auto")}>Auto</button>
      <button className={viewMode === "mobile" ? "active" : ""} onClick={() => setViewMode("mobile")}>Mobile</button>
      <button className={viewMode === "desktop" ? "active" : ""} onClick={() => setViewMode("desktop")}>Desktop</button>
    </div>
  );
}

function Hero({ monthly }) {
  return (
    <section className="hero">
      <Car size={28} />
      <p>FINANCE CALCULATOR</p>
      <span className="hero-metric-label">MONTHLY</span>
      <h2>{money(monthly)}</h2>
    </section>
  );
}

function LenderSelector(props) {
  return (
    <section className="lender-select-card">
      <div className="lender-select-label">
        <span>LENDER</span>
        <b>{props.lender.name}</b>
      </div>

      <div className="select-wrap">
        <select value={props.lenderKey} onChange={(e) => props.setLenderKey(e.target.value)}>
          {Object.entries(props.lenders).map(([key, lender]) => (
            <option key={key} value={key}>{lender.name}</option>
          ))}
        </select>
        <ChevronDown size={20} />
      </div>
    </section>
  );
}

function Tabs({ activeTab, setActiveTab }) {
  return (
    <nav className="tabs">
      <button onClick={() => setActiveTab("purchase")} className={activeTab === "purchase" ? "active" : ""}>Purchase</button>
      <button onClick={() => setActiveTab("fees")} className={activeTab === "fees" ? "active" : ""}>Fees</button>
      <button onClick={() => setActiveTab("summary")} className={activeTab === "summary" ? "active" : ""}>Summary</button>
    </nav>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <div className="card-head">
        {React.cloneElement(icon, { size: 20 })}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, setValue, prefix, suffix }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        {prefix && <em>{prefix}</em>}
        <input value={value} onChange={(e) => setValue(e.target.value)} />
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
