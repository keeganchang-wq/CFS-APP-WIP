
import React, { useMemo, useState } from "react";
import {
  BadgeDollarSign, Calculator, Car, ChevronDown, Download, FileText, Mail,
  MessageCircle, MoreHorizontal, Percent, Save, Search, User, Wrench, X
} from "lucide-react";
import { jsPDF } from "jspdf";

const DEFAULT_LENDERS = {
  VWFS: { name: "VWFS", originationFee: 1595, establishmentFee: 590, ppsr: 0, monthlyAccountFee: 0 },
  PEPPER: { name: "Pepper", originationFee: 1990, establishmentFee: 490, ppsr: 8, monthlyAccountFee: 8.90 },
  ANGLE_COMM: { name: "Angle Commercial", originationFee: 1595, establishmentFee: 599, ppsr: 6, monthlyAccountFee: 20 },
  ANGLE_CON: { name: "Angle Consumer", originationFee: 1395, establishmentFee: 499, ppsr: 6, monthlyAccountFee: 15 },
  TAURUS: { name: "Taurus", originationFee: 1490, establishmentFee: 490, ppsr: 6, monthlyAccountFee: 11 },
  ALLIED: { name: "Allied", originationFee: 1495, establishmentFee: 595, ppsr: 9.95, monthlyAccountFee: 12.95 },
  NFS: { name: "NFS", originationFee: 1490, establishmentFee: 490, ppsr: 6, monthlyAccountFee: 11 },
};

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 });
const money = (v) => Number.isFinite(v) ? aud.format(v) : "$0.00";
const num = (v) => Number(String(v).replace(/[^0-9.-]/g, "")) || 0;

function pmt({ amount, ratePA, months, balloon }) {
  const r = ratePA / 100 / 12;
  if (!months) return 0;
  if (!r) return (amount - balloon) / months;
  const balloonPV = balloon / Math.pow(1 + r, months);
  return ((amount - balloonPV) * r) / (1 - Math.pow(1 + r, -months));
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem("cavaloResponsiveQuotes") || "[]"); } catch { return []; }
}

export default function App() {
  const [mode, setMode] = useState("auto"); // auto / mobile / desktop
  const [lenderKey, setLenderKey] = useState("VWFS");
  const [lenders, setLenders] = useState(DEFAULT_LENDERS);
  const [tab, setTab] = useState("purchase");
  const [sheet, setSheet] = useState(null);
  const [showRepaymentStructure, setShowRepaymentStructure] = useState(true);
  const [quotes, setQuotes] = useState(loadSaved());

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
  const [targetPreference, setTargetPreference] = useState("auto");
  const [targetLock, setTargetLock] = useState("none");

  const lender = lenders[lenderKey];

  const calc = useMemo(() => {
    const price = num(purchasePrice), dep = num(deposit), tr = num(trade), pay = num(payout);
    const months = num(term), balloonAmt = num(balloon), ratePA = num(rate);
    const fees = num(lender.originationFee) + num(lender.establishmentFee) + num(lender.ppsr);
    const equity = dep + tr - pay;
    const subtotal = Math.max(price - equity, 0);
    const naf = subtotal + fees;
    const baseMonthly = pmt({ amount: naf, ratePA, months, balloon: balloonAmt });
    const monthly = baseMonthly + num(lender.monthlyAccountFee);
    const total = monthly * months + balloonAmt;
    const lvr = price ? (naf / price) * 100 : 0;
    const balloonPct = price ? (balloonAmt / price) * 100 : 0;
    return { price, dep, tr, pay, equity, subtotal, fees, naf, months, balloonAmt, ratePA, monthly, total, interest: total - naf, weekly: monthly * 12 / 52, fortnightly: monthly * 12 / 26, lvr, balloonPct };
  }, [purchasePrice, deposit, trade, payout, term, balloon, rate, lender]);

  const ruleFlags = useMemo(() => {
    const flags = [];
    if (calc.lvr > 115) flags.push("High LVR — review deposit/trade structure.");
    if (calc.balloonPct > 60) flags.push("Balloon above 60% placeholder policy.");
    if (calc.months > 84) flags.push("Term above 84 months placeholder policy.");
    if (!flags.length) flags.push("Placeholder rules check passed.");
    return flags;
  }, [calc]);

  
  function estimateMonthly({
    price = num(purchasePrice),
    dep = num(deposit),
    tr = num(trade),
    pay = num(payout),
    months = num(term),
    balloonAmt = num(balloon),
    ratePA = num(rate)
  }) {
    const fees = num(lender.originationFee) + num(lender.establishmentFee) + num(lender.ppsr);
    const equity = dep + tr - pay;
    const subtotal = Math.max(price - equity, 0);
    const naf = subtotal + fees;
    return pmt({ amount: naf, ratePA, months, balloon: balloonAmt }) + num(lender.monthlyAccountFee);
  }

  function solveBinary(field, low, high, target) {
    let best = low;
    let bestMonthly = estimateMonthly({ [field]: low });

    for (let i = 0; i < 70; i++) {
      const mid = (low + high) / 2;
      const monthly = estimateMonthly({ [field]: mid });

      if (Math.abs(monthly - target) < Math.abs(bestMonthly - target)) {
        best = mid;
        bestMonthly = monthly;
      }

      // Balloon and deposit reduce repayment when increased.
      if (field === "balloonAmt" || field === "dep") {
        if (monthly > target) low = mid;
        else high = mid;
      }

      // Purchase price and rate increase repayment when increased.
      if (field === "price" || field === "ratePA") {
        if (monthly > target) high = mid;
        else low = mid;
      }
    }

    return { value: best, monthly: bestMonthly };
  }

  const targetScenarios = useMemo(() => {
    const target = num(targetMonthly);
    if (!target || target <= 0) return [];

    const price = num(purchasePrice);
    const currentDeposit = num(deposit);
    const currentBalloon = num(balloon);
    const currentRate = num(rate);
    const currentTerm = num(term);

    const options = [];

    if (targetLock !== "balloon") {
      const solved = solveBinary("balloonAmt", 0, Math.max(price * 0.8, currentBalloon, 1), target);
      options.push({
        key: "balloon",
        label: "Balloon required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setBalloon(String(Math.round(solved.value)))
      });
    }

    if (targetLock !== "deposit") {
      const solved = solveBinary("dep", currentDeposit, Math.max(price, currentDeposit + 1), target);
      options.push({
        key: "deposit",
        label: "Deposit required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setDeposit(String(Math.round(solved.value)))
      });
    }

    if (targetLock !== "term") {
      let bestTerm = currentTerm;
      let bestMonthly = estimateMonthly({ months: currentTerm });
      let bestDiff = Math.abs(bestMonthly - target);

      for (let mths = 12; mths <= 84; mths += 12) {
        const monthly = estimateMonthly({ months: mths });
        const diff = Math.abs(monthly - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestTerm = mths;
          bestMonthly = monthly;
        }
      }

      options.push({
        key: "term",
        label: "Term required",
        value: `${bestTerm} months`,
        monthly: bestMonthly,
        apply: () => setTerm(String(bestTerm))
      });
    }

    if (targetLock !== "rate") {
      const solved = solveBinary("ratePA", 0.01, Math.max(currentRate * 2, 30), target);
      options.push({
        key: "rate",
        label: "Interest rate required",
        value: `${Math.max(0, solved.value).toFixed(2)}%`,
        monthly: solved.monthly,
        apply: () => setRate(String(Math.max(0, solved.value).toFixed(2)))
      });
    }

    if (targetLock !== "purchase") {
      const solved = solveBinary("price", 1000, Math.max(price, 1000), target);
      options.push({
        key: "purchase",
        label: "Purchase price required",
        value: money(Math.round(solved.value)),
        monthly: solved.monthly,
        apply: () => setPurchasePrice(String(Math.round(solved.value)))
      });
    }

    return options.map(option => ({
      ...option,
      difference: option.monthly - target,
      status: Math.abs(option.monthly - target) < 5
        ? "Close"
        : option.monthly > target
          ? "Above target"
          : "Below target"
    }));
  }, [targetMonthly, targetLock, purchasePrice, deposit, trade, payout, term, balloon, rate, lender]);

  function applyPreferredTargetScenario() {
    if (!targetScenarios.length) return;

    const preferred = targetPreference === "auto"
      ? targetScenarios
      : targetScenarios.filter(option => option.key === targetPreference);

    const chosen = (preferred.length ? preferred : targetScenarios)
      .slice()
      .sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference))[0];

    chosen?.apply();
  }

  const targetPreview = useMemo(() => {
    const target = num(targetMonthly);
    if (!target) return "Enter a target repayment to view options.";
    const difference = calc.monthly - target;
    if (Math.abs(difference) < 1) return "Current repayment is already close to target.";
    return difference > 0
      ? `${money(difference)} above target`
      : `${money(Math.abs(difference))} below target`;
  }, [targetMonthly, calc.monthly]);


  const quoteText = `Cavalo Prestige Finance Estimate
Client: ${clientName || "Client"}
Vehicle: ${vehicle || "Vehicle"}
Lender: ${lender.name}
Purchase Price: ${money(calc.price)}
Amount Financed: ${money(calc.naf)}
Rate: ${calc.ratePA.toFixed(2)}%
Term: ${calc.months} months
Balloon: ${money(calc.balloonAmt)} (${calc.balloonPct.toFixed(2)}%)
Estimated Monthly: ${money(calc.monthly)}
Weekly: ${money(calc.weekly)}
Fortnightly: ${money(calc.fortnightly)}
Estimate only. Subject to approval.`;

  function updateFee(field, value) {
    setLenders(prev => ({ ...prev, [lenderKey]: { ...prev[lenderKey], [field]: value } }));
  }

  function saveQuote() {
    const quote = { id: Date.now(), created: new Date().toLocaleString(), clientName, clientPhone, vehicle, stockNo, lenderKey, purchasePrice, deposit, trade, payout, rate, term, balloon, lenders };
    const next = [quote, ...quotes].slice(0, 50);
    setQuotes(next);
    localStorage.setItem("cavaloResponsiveQuotes", JSON.stringify(next));
    setSheet("saved");
  }

  function loadQuote(q) {
    setClientName(q.clientName || ""); setClientPhone(q.clientPhone || ""); setVehicle(q.vehicle || ""); setStockNo(q.stockNo || "");
    setLenderKey(q.lenderKey || "VWFS"); setPurchasePrice(q.purchasePrice); setDeposit(q.deposit); setTrade(q.trade); setPayout(q.payout);
    setRate(q.rate); setTerm(q.term); setBalloon(q.balloon); setLenders(q.lenders || DEFAULT_LENDERS);
    setSheet(null);
  }

  function pdf() {
    const doc = new jsPDF();
    doc.setFillColor(0,0,0); doc.rect(0,0,210,297,"F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(25); doc.text("CAVALO",105,22,{align:"center"});
    doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text("PRESTIGE",105,30,{align:"center"});
    doc.setDrawColor(65,191,40); doc.line(20,38,190,38);
    doc.setFontSize(28); doc.text(money(calc.monthly),105,58,{align:"center"});
    doc.setFontSize(10); doc.setTextColor(170,170,170); doc.text("estimated monthly repayment",105,66,{align:"center"});
    const rows = [
      ["Client", clientName || "-"], ["Phone", clientPhone || "-"], ["Vehicle", vehicle || "-"], ["Stock", stockNo || "-"],
      ["Lender", lender.name], ["Purchase Price", money(calc.price)], ["Deposit", money(calc.dep)], ["Trade", money(calc.tr)],
      ["Payout", money(calc.pay)], ["Origination Fee", money(num(lender.originationFee))], ["Establishment Fee", money(num(lender.establishmentFee))],
      ["PPSR", money(num(lender.ppsr))], ["Monthly Account Fee", money(num(lender.monthlyAccountFee))],
      ["Amount Financed", money(calc.naf)], ["Rate", `${calc.ratePA.toFixed(2)}%`], ["Term", `${calc.months} months`],
      ["Balloon", `${money(calc.balloonAmt)} (${calc.balloonPct.toFixed(2)}%)`], ["Monthly Repayment", money(calc.monthly)]
    ];
    let y = 82; doc.setFontSize(10);
    rows.forEach(([a,b]) => { doc.setTextColor(145,145,145); doc.text(a,22,y); doc.setTextColor(255,255,255); doc.text(String(b),188,y,{align:"right"}); doc.setDrawColor(35,35,35); doc.line(22,y+4,188,y+4); y += 9; });
    doc.setTextColor(120,120,120); doc.setFontSize(8); doc.text("Estimate only. Subject to lender approval and final contract terms.",105,282,{align:"center"});
    doc.save("cavalo-finance-quote.pdf");
  }

  function shareQuote() {
    if (navigator.share) navigator.share({ title: "Cavalo Finance Quote", text: quoteText }).catch(()=>{});
    else { navigator.clipboard.writeText(quoteText); alert("Quote copied."); }
  }

  const common = { lenderKey, setLenderKey, lenders, lender, calc, tab, setTab, sheet, setSheet, quotes, loadQuote, clientName, setClientName, clientPhone, setClientPhone, vehicle, setVehicle, stockNo, setStockNo, purchasePrice, setPurchasePrice, deposit, setDeposit, trade, setTrade, payout, setPayout, rate, setRate, term, setTerm, balloon, setBalloon, updateFee, saveQuote, pdf, shareQuote, quoteText, ruleFlags, mode, setMode, showRepaymentStructure, setShowRepaymentStructure };

  return (
    <>
      <MobileApp {...common} />
      <DesktopApp {...common} />
    </>
  );
}

function ModeToggle({ mode, setMode }) {
  return (
    <div className="mode-toggle">
      <button className={mode === "auto" ? "active" : ""} onClick={() => setMode("auto")}>Auto</button>
      <button className={mode === "mobile" ? "active" : ""} onClick={() => setMode("mobile")}>Mobile</button>
      <button className={mode === "desktop" ? "active" : ""} onClick={() => setMode("desktop")}>Desktop</button>
    </div>
  );
}

function MobileApp(props) {
  const { mode, setMode, showRepaymentStructure, setShowRepaymentStructure, lenderKey, setLenderKey, lenders, lender, calc, tab, setTab, sheet, setSheet, clientName, setClientName, clientPhone, setClientPhone, vehicle, setVehicle, stockNo, setStockNo, purchasePrice, setPurchasePrice, deposit, setDeposit, trade, setTrade, payout, setPayout, rate, setRate, term, setTerm, balloon, setBalloon, updateFee, saveQuote, pdf, shareQuote, quoteText, ruleFlags, quotes, loadQuote } = props;
  return (
    <div className={`mobile-shell mode-${mode}`}>
      <div className="phone">
        <header className="top mobile-top"><Brand /><ModeToggle mode={mode} setMode={setMode}/></header>
        <main className="mobile-main">
          <Hero monthly={calc.monthly} />
          <section className="client-strip" onClick={() => setSheet("client")}><User size={18}/><div><b>{clientName || "Client Profile"}</b><span>{vehicle || "Tap to add client + vehicle"}</span></div></section>
          <LenderDropdown lenderKey={lenderKey} setLenderKey={setLenderKey} lenders={lenders} lender={lender}/>
          <Tabs tab={tab} setTab={setTab}/>
          {tab === "purchase" && <Card title="Purchase Details" icon={<FileText/>}><div className="grid2"><Field label="Purchase" value={purchasePrice} setValue={setPurchasePrice} prefix="$"/><Field label="Deposit" value={deposit} setValue={setDeposit} prefix="$"/><Field label="Trade" value={trade} setValue={setTrade} prefix="$"/><Field label="Payout" value={payout} setValue={setPayout} prefix="$"/></div><MiniRows rows={[["Equity", money(calc.equity)], ["Subtotal", money(calc.subtotal)], ["LVR", `${calc.lvr.toFixed(2)}%`]]}/></Card>}
          {tab === "fees" && <Card title="Lender Fees" icon={<Percent/>}><div className="grid2"><Field label="Origination" value={lender.originationFee} setValue={(v)=>updateFee("originationFee", v)} prefix="$"/><Field label="Establishment" value={lender.establishmentFee} setValue={(v)=>updateFee("establishmentFee", v)} prefix="$"/><Field label="PPSR" value={lender.ppsr} setValue={(v)=>updateFee("ppsr", v)} prefix="$"/><Field label="Monthly Fee" value={lender.monthlyAccountFee} setValue={(v)=>updateFee("monthlyAccountFee", v)} prefix="$"/></div><MiniRows rows={[["Total capitalised fees", money(calc.fees)], ["Monthly fee added", money(num(lender.monthlyAccountFee))]]}/></Card>}
          {tab === "summary" && <Card title="Repayment Structure" icon={<Calculator/>}>
            <div className="section-toggle">
              <span>Show repayment structure</span>
              <button onClick={() => setShowRepaymentStructure(!showRepaymentStructure)}>{showRepaymentStructure ? "Hide" : "Show"}</button>
            </div>
            {showRepaymentStructure && <>
              <div className="grid2"><Field label="Rate" value={rate} setValue={setRate} suffix="%"/><Field label="Term" value={term} setValue={setTerm} suffix="mths"/><Field label="Balloon" value={balloon} setValue={setBalloon} prefix="$"/></div>
              <MiniRows rows={[["Amount financed", money(calc.naf)], ["Balloon %", `${calc.balloonPct.toFixed(2)}%`], ["Weekly", money(calc.weekly)], ["Fortnightly", money(calc.fortnightly)], ["Total payable", money(calc.total)]]}/>
            </>}
          </Card>}
          <section className="tools"><Tool title="Target Repayment" icon={<Calculator/>} onClick={()=>setSheet("target")} /><Tool title="Deal Structuring" icon={<BadgeDollarSign/>} onClick={()=>setSheet("structure")} /><Tool title="Saved Quotes" icon={<Search/>} onClick={()=>setSheet("quotes")} /></section>
          <p className="disclaimer">Estimate only. Subject to approval, lender policy and final contract terms.</p>
        </main>
        <nav className="bottom"><button className="selected"><Calculator size={22}/><span>Calc</span></button><button onClick={saveQuote}><Save size={22}/><span>Save</span></button><button onClick={()=>setSheet("client")}><User size={22}/><span>Client</span></button><button onClick={()=>setSheet("send")}><MoreHorizontal size={22}/><span>Send</span></button></nav>
        {sheet && <Sheets {...props}/>}
      </div>
    </div>
  );
}

function DesktopApp(props) {
  const { mode, setMode, showRepaymentStructure, setShowRepaymentStructure, lenderKey, setLenderKey, lenders, lender, calc, clientName, setClientName, clientPhone, setClientPhone, vehicle, setVehicle, stockNo, setStockNo, purchasePrice, setPurchasePrice, deposit, setDeposit, trade, setTrade, payout, setPayout, rate, setRate, term, setTerm, balloon, setBalloon, updateFee, saveQuote, pdf, quoteText, ruleFlags, quotes, loadQuote } = props;
  return (
    <div className={`desktop-shell mode-${mode}`}>
      <header className="desktop-top">
        <Brand />
        <ModeToggle mode={mode} setMode={setMode}/>
        <div className="top-actions"><button onClick={saveQuote}><Save size={17}/>Save Quote</button><button onClick={pdf}><Download size={17}/>PDF</button><a href={`sms:${clientPhone}?&body=${encodeURIComponent(quoteText)}`}><MessageCircle size={17}/>SMS</a><a href={`mailto:?subject=${encodeURIComponent("Cavalo Finance Quote")}&body=${encodeURIComponent(quoteText)}`}><Mail size={17}/>Email</a></div>
      </header>
      <main className="desktop-layout">
        <section className="desktop-left">
          <Hero monthly={calc.monthly} />
          <div className="summary-grid"><Metric label="Weekly" value={money(calc.weekly)} /><Metric label="Fortnightly" value={money(calc.fortnightly)} /><Metric label="Amount Financed" value={money(calc.naf)} /></div>
          <Panel title="Saved Quotes" icon={<Save />}><div className="saved-list">{quotes.length ? quotes.map(q => <button key={q.id} onClick={()=>loadQuote(q)}><b>{q.clientName || "Unnamed Client"}</b><span>{q.vehicle || q.created} · {DEFAULT_LENDERS[q.lenderKey]?.name}</span></button>) : <p className="muted">No saved quotes yet.</p>}</div></Panel>
        </section>
        <section className="desktop-right">
          <Panel title="Client Profile" icon={<User />}><div className="grid4"><Field label="Client Name" value={clientName} setValue={setClientName}/><Field label="Phone" value={clientPhone} setValue={setClientPhone}/><Field label="Vehicle" value={vehicle} setValue={setVehicle}/><Field label="Stock / Ref" value={stockNo} setValue={setStockNo}/></div></Panel>
          <Panel title="Lender Selection" icon={<FileText />}><div className="desktop-lender-row lender-row-single"><label><span>Lender</span><select value={lenderKey} onChange={(e)=>setLenderKey(e.target.value)}>{Object.entries(lenders).map(([key, val]) => <option key={key} value={key}>{val.name}</option>)}</select></label></div></Panel>
          <div className="desktop-two-col">
            <Panel title="Purchase Details" icon={<FileText />}><div className="grid2"><Field label="Purchase Price" value={purchasePrice} setValue={setPurchasePrice} prefix="$"/><Field label="Cash Deposit" value={deposit} setValue={setDeposit} prefix="$"/><Field label="Trade Allowance" value={trade} setValue={setTrade} prefix="$"/><Field label="Existing Payout" value={payout} setValue={setPayout} prefix="$"/></div><MiniRows rows={[["Total Equity", money(calc.equity)], ["Subtotal", money(calc.subtotal)], ["LVR", `${calc.lvr.toFixed(2)}%`]]}/></Panel>
            <Panel title="Lender Fees" icon={<Percent />}><div className="grid2"><Field label="Origination" value={lender.originationFee} setValue={(v)=>updateFee("originationFee", v)} prefix="$"/><Field label="Establishment" value={lender.establishmentFee} setValue={(v)=>updateFee("establishmentFee", v)} prefix="$"/><Field label="PPSR" value={lender.ppsr} setValue={(v)=>updateFee("ppsr", v)} prefix="$"/><Field label="Monthly Fee" value={lender.monthlyAccountFee} setValue={(v)=>updateFee("monthlyAccountFee", v)} prefix="$"/></div></Panel>
          </div>
          <div className="desktop-two-col">
            <Panel title="Repayment Structure" icon={<Calculator />}>
              <div className="section-toggle">
                <span>Show repayment structure</span>
                <button onClick={() => setShowRepaymentStructure(!showRepaymentStructure)}>{showRepaymentStructure ? "Hide" : "Show"}</button>
              </div>
              {showRepaymentStructure && <>
                <div className="grid2"><Field label="Rate" value={rate} setValue={setRate} suffix="%"/><Field label="Term" value={term} setValue={setTerm} suffix="months"/><Field label="Balloon" value={balloon} setValue={setBalloon} prefix="$"/></div>
                <MiniRows rows={[["Balloon %", `${calc.balloonPct.toFixed(2)}%`], ["Total Payable", money(calc.total)], ["Interest Component", money(calc.interest)]]}/>
              </>}
            </Panel>
            <Panel title="Target Repayment Mode" icon={<Wrench />}>
              <TargetRepaymentPanel
                targetMonthly={targetMonthly}
                setTargetMonthly={setTargetMonthly}
                targetPreference={targetPreference}
                setTargetPreference={setTargetPreference}
                targetLock={targetLock}
                setTargetLock={setTargetLock}
                targetScenarios={targetScenarios}
                applyPreferredTargetScenario={applyPreferredTargetScenario}
                targetPreview={targetPreview}
              />
              <div className="rules compact-rules">{ruleFlags.map((r, i) => <p key={i}>{r}</p>)}</div>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}

function Sheets(props) {
  const { sheet, setSheet, clientName, setClientName, clientPhone, setClientPhone, vehicle, setVehicle, stockNo, setStockNo, quoteText, pdf, shareQuote, quotes, loadQuote, ruleFlags } = props;
  return <Sheet title={({send:"Send Quote",client:"Client Profile",quotes:"Saved Quotes",rules:"Rules Engine",structure:"Deal Structuring",target:"Target Repayment",saved:"Saved"})[sheet] || "Menu"} onClose={()=>setSheet(null)}>
    {sheet === "send" && <><button className="sheet-action" onClick={pdf}><FileText size={18}/>Download PDF Quote</button><a className="sheet-action" href={`sms:${clientPhone}?&body=${encodeURIComponent(quoteText)}`}><MessageCircle size={18}/>Send via SMS</a><a className="sheet-action" href={`mailto:?subject=${encodeURIComponent("Cavalo Finance Quote")}&body=${encodeURIComponent(quoteText)}`}><Mail size={18}/>Send via Email</a><button className="sheet-action" onClick={shareQuote}><MoreHorizontal size={18}/>Share / Copy Quote</button></>}
    {sheet === "client" && <div className="sheet-grid"><Field label="Client Name" value={clientName} setValue={setClientName}/><Field label="Phone" value={clientPhone} setValue={setClientPhone}/><Field label="Vehicle" value={vehicle} setValue={setVehicle}/><Field label="Stock / Ref" value={stockNo} setValue={setStockNo}/></div>}
    {sheet === "quotes" && <div className="quote-list">{quotes.length ? quotes.map(q => <button key={q.id} onClick={()=>loadQuote(q)}><b>{q.clientName || "Unnamed Client"}</b><span>{q.vehicle || q.created} · {DEFAULT_LENDERS[q.lenderKey]?.name}</span></button>) : <p className="empty">No saved quotes yet.</p>}</div>}
    {sheet === "rules" && <div className="flags">{ruleFlags.map((f,i)=><p key={i} className="note">{f}</p>)}<p className="empty">Placeholder only — real lender approval logic can be added when you provide policy rules.</p></div>}
    {sheet === "target" && <TargetRepaymentPanel {...props} />}
    {sheet === "structure" && <div className="flags"><p className="note">Placeholder deal structuring module.</p><p className="empty">Future options: reduce NAF, adjust deposit, cap balloon, compare lenders, payment target solver.</p></div>}
    {sheet === "saved" && <p className="ok-box">Quote saved to this device.</p>}
  </Sheet>
}


function TargetRepaymentPanel({
  targetMonthly,
  setTargetMonthly,
  targetPreference,
  setTargetPreference,
  targetLock,
  setTargetLock,
  targetScenarios,
  applyPreferredTargetScenario,
  targetPreview
}) {
  return (
    <div className="target-panel">
      <div className="target-top-grid">
        <Field label="Target Monthly" value={targetMonthly} setValue={setTargetMonthly} prefix="$" />

        <label className="target-select">
          <span>Lock</span>
          <select value={targetLock} onChange={(e) => setTargetLock(e.target.value)}>
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
          <select value={targetPreference} onChange={(e) => setTargetPreference(e.target.value)}>
            <option value="auto">Best fit</option>
            <option value="purchase">Purchase price</option>
            <option value="rate">Interest rate</option>
            <option value="balloon">Balloon amount</option>
            <option value="term">Term</option>
            <option value="deposit">Deposit</option>
          </select>
        </label>
      </div>

      <p className="target-preview">{targetPreview}</p>

      <div className="target-results">
        {targetScenarios.length ? targetScenarios.map((scenario) => (
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

      <button className="target-button" onClick={applyPreferredTargetScenario}>
        Apply Preferred Option
      </button>
    </div>
  );
}

function Brand(){ return <div><h1>CAVALO</h1><p><i/>PRESTIGE<i/></p></div>; }
function Hero({ monthly }) { return <section className="hero"><Car size={28}/><p>FINANCE CALCULATOR</p><span className="hero-metric-label">MONTHLY</span><h2>{money(monthly)}</h2></section>; }
function LenderDropdown({ lenderKey, setLenderKey, lenders, lender }) { return <section className="lender-select-card"><div className="lender-select-label"><span>LENDER</span><b>{lender.name}</b></div><div className="select-wrap"><select value={lenderKey} onChange={(e)=>setLenderKey(e.target.value)}>{Object.entries(lenders).map(([key, val]) => <option key={key} value={key}>{val.name}</option>)}</select><ChevronDown size={20}/></div></section>; }
function Tabs({ tab, setTab }) { return <nav className="tabs"><button onClick={()=>setTab("purchase")} className={tab==="purchase"?"active":""}>Purchase</button><button onClick={()=>setTab("fees")} className={tab==="fees"?"active":""}>Fees</button><button onClick={()=>setTab("summary")} className={tab==="summary"?"active":""}>Summary</button></nav>; }
function Card({title, icon, children}) { return <section className="card"><div className="card-head">{React.cloneElement(icon,{size:20})}<h3>{title}</h3></div>{children}</section>; }
function Panel({ title, icon, children }) { return <section className="panel"><div className="card-head">{React.cloneElement(icon,{size:20})}<h3>{title}</h3></div>{children}</section>; }
function Field({label,value,setValue,prefix,suffix}) { return <label className="field"><span>{label}</span><div>{prefix && <em>{prefix}</em>}<input value={value} onChange={e=>setValue(e.target.value)} />{suffix && <em>{suffix}</em>}</div></label>; }
function MiniRows({rows}) { return <div className="minirows">{rows.map(([a,b])=><div key={a}><span>{a}</span><b>{b}</b></div>)}</div>; }
function Metric({ label, value }) { return <div className="metric"><span>{label}</span><b>{value}</b></div>; }
function Tool({title, icon, onClick}) { return <button className="tool" onClick={onClick}>{React.cloneElement(icon,{size:18})}<span>{title}</span></button>; }
function Sheet({title,onClose,children}) { return <div className="overlay"><div className="sheet"><div className="sheet-head"><h3>{title}</h3><button onClick={onClose}><X size={20}/></button></div>{children}</div></div>; }
