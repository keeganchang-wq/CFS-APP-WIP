
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


const VWFS_VEHICLE_TYPES = {
  all: "All vehicles",
  branded: "VWFS branded",
  whiteLabel: "White label",
  other: "Other / non policy"
};

const VWFS_POLICY_TIERS = [
  { key:"waiverUnder120", label:"Waiver of Financials <$120k", min:0, max:120000, req:{ assetBacked:true, abnYears:2, creditFileYears:2, vehicle:"all", channel:"both", maxLvr:null } },
  { key:"waiverUnder130", label:"Waiver of Financials <$130k", min:0, max:130000, req:{ assetBacked:true, abnYears:2, creditFileYears:2, vehicle:"brandedOrWhiteLabel", channel:"both", maxLvr:null } },
  { key:"waiver130to200", label:"Waiver of Financials >$130k - <$200k", min:130000, max:200000, req:{ assetBacked:true, abnYears:2, gstYears:2, creditFileYears:2, creditRating:"good", vehicle:"all", channel:"both", maxLvr:100 } },
  { key:"waiver200to300", label:"Waiver of Financials >$200k - <$300k", min:200000, max:300000, req:{ assetBacked:true, abnYears:2, gstYears:2, creditFileYears:2, creditRating:"good", vehicle:"brandedOrWhiteLabel", channel:"posOnly", maxLvr:100, repaymentIncreaseCap:40 } },
  { key:"replacement200to300", label:"Replacement Policy >$200k - <$300k", min:200000, max:300000, replacementOnly:true, req:{ abnYears:2, gstYears:2, creditFileYears:2, creditRating:"good", vehicle:"brandedOrWhiteLabel", channel:"posOnly", maxLvr:100, repaymentIncreaseCap:40 } },
  { key:"startupUnder100", label:"Start Up Business Policy <$100k", min:0, max:100000, startupOnly:true, req:{ depositPercent:20, creditFileYears:2, vehicle:"all", channel:"both", gstRegistered:true } }
];

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
  const [appPage, setAppPage] = useState("calculator");

  const [lenderKey, setLenderKey] = useState("VWFS");
  const [lenderFees, setLenderFees] = useState(LENDERS);

  const [activeTab, setActiveTab] = useState("purchase");
  const [activeSheet, setActiveSheet] = useState(null);
  const [showRepaymentStructure, setShowRepaymentStructure] = useState(true);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [stockRef, setStockRef] = useState("");

  const [vwfsEntityType, setVwfsEntityType] = useState("company");
  const [vwfsLoanPurpose, setVwfsLoanPurpose] = useState("commercial");
  const [vwfsAbnYears, setVwfsAbnYears] = useState("2");
  const [vwfsGstYears, setVwfsGstYears] = useState("2");
  const [vwfsAssetBacked, setVwfsAssetBacked] = useState("yes");
  const [vwfsCreditRating, setVwfsCreditRating] = useState("good");
  const [vwfsCreditFileYears, setVwfsCreditFileYears] = useState("2");
  const [vwfsVehicleType, setVwfsVehicleType] = useState("branded");
  const [vwfsDealerChannel, setVwfsDealerChannel] = useState("pos");
  const [vwfsReplacementDeal, setVwfsReplacementDeal] = useState("no");
  const [vwfsRepaymentIncrease, setVwfsRepaymentIncrease] = useState("0");
  const [vwfsStartupBusiness, setVwfsStartupBusiness] = useState("no");

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


  function evaluateVwfsTier(tier) {
    const req = tier.req;
    const checks = [];
    const amount = calc.amountFinanced;
    const depositPercent = calc.price ? (calc.cashDeposit / calc.price) * 100 : 0;
    const brandedOrWhite = ["branded", "whiteLabel"].includes(vwfsVehicleType);
    const add = (label, pass, detail) => checks.push({ label, pass, detail });

    add("Loan amount band", amount >= tier.min && amount < tier.max, `${money(amount)} vs ${tier.label}`);

    if (tier.replacementOnly) add("Replacement deal", vwfsReplacementDeal === "yes", "Replacement policy applies only to replacement deals.");
    if (tier.startupOnly) add("Start up business", vwfsStartupBusiness === "yes", "Start up policy applies only to start up business applications.");

    if (req.assetBacked) add("Asset backed", vwfsAssetBacked === "yes", vwfsAssetBacked === "yes" ? "Real property ownership confirmed." : "Applicant is not asset backed.");
    if (req.abnYears) add("ABN established", cleanNumber(vwfsAbnYears) > req.abnYears, `ABN age ${vwfsAbnYears || 0} years. Required > ${req.abnYears}.`);
    if (req.gstYears) add("GST registration", cleanNumber(vwfsGstYears) > req.gstYears, `GST age ${vwfsGstYears || 0} years. Required > ${req.gstYears}.`);
    if (req.gstRegistered) add("GST registered", cleanNumber(vwfsGstYears) > 0, "New/start up entities must be GST registered.");
    if (req.creditFileYears) add("Clear credit file", cleanNumber(vwfsCreditFileYears) > req.creditFileYears && vwfsCreditRating !== "poor", `Credit file ${vwfsCreditFileYears || 0} years, rating ${vwfsCreditRating}.`);
    if (req.creditRating === "good") add("Good / A-rated credit", vwfsCreditRating === "good", "Higher exposure waiver tiers require strong credit.");
    if (req.vehicle === "brandedOrWhiteLabel") add("Vehicle type", brandedOrWhite, "This tier is branded / white label only.");
    if (req.vehicle === "all") add("Vehicle type", vwfsVehicleType !== "other", "This tier allows all vehicles, subject to normal policy.");
    if (req.channel === "posOnly") add("Dealer channel", vwfsDealerChannel === "pos", "This tier is POS dealers only.");
    if (req.depositPercent) add("Minimum deposit", depositPercent >= req.depositPercent, `Deposit ${depositPercent.toFixed(2)}%. Required ${req.depositPercent}%.`);
    if (req.maxLvr) add("Max LVR", calc.lvr <= req.maxLvr, `LVR ${calc.lvr.toFixed(2)}%. Required <= ${req.maxLvr}%.`);
    if (req.repaymentIncreaseCap && vwfsReplacementDeal === "yes") add("Repayment increase", cleanNumber(vwfsRepaymentIncrease) <= req.repaymentIncreaseCap, `Increase ${vwfsRepaymentIncrease || 0}%. Required <= ${req.repaymentIncreaseCap}%.`);

    const failed = checks.filter(c => !c.pass);
    return {
      ...tier,
      checks,
      failed,
      score: checks.length - failed.length,
      status: failed.length === 0 ? "Eligible" : failed.length <= 2 ? "Conditional" : "Not Eligible"
    };
  }

  const vwfsSecondBrain = useMemo(() => {
    const tierResults = VWFS_POLICY_TIERS.map((tier) => evaluateVwfsTier(tier));
    const eligible = tierResults.filter((tier) => tier.status === "Eligible");
    const conditional = tierResults.filter((tier) => tier.status === "Conditional");
    const bestTier = eligible[0] || conditional.sort((a,b)=>b.score-a.score)[0] || tierResults.sort((a,b)=>b.score-a.score)[0];

    const strengths = [];
    const risks = [];
    const recommendations = [];

    if (vwfsAssetBacked === "yes") strengths.push("Asset backed applicant.");
    else risks.push("Not asset backed.");
    if (cleanNumber(vwfsAbnYears) > 2) strengths.push("ABN established for more than 2 years.");
    else risks.push("ABN history may restrict waiver eligibility.");
    if (cleanNumber(vwfsGstYears) > 2) strengths.push("GST registered for more than 2 years.");
    else risks.push("GST history may restrict higher exposure tiers.");
    if (vwfsCreditRating === "good") strengths.push("Credit profile marked Good.");
    if (vwfsCreditRating === "average") risks.push("Average credit may require stronger compensating factors.");
    if (vwfsCreditRating === "poor") risks.push("Poor credit is unlikely to fit waiver policy.");

    if (calc.lvr > 100) recommendations.push(`Reduce LVR to 100% or below. Current LVR is ${calc.lvr.toFixed(2)}%.`);
    if (calc.balloonPercent > 60) recommendations.push(`Review balloon. Current balloon is ${calc.balloonPercent.toFixed(2)}%.`);
    if (bestTier?.failed?.length) bestTier.failed.slice(0,3).forEach(item => recommendations.push(item.detail));
    if (!recommendations.length) recommendations.push("Application appears to fit the selected VWFS waiver pathway. Prepare submission notes around strengths.");

    return {
      decision: eligible.length ? "Eligible" : conditional.length ? "Conditional" : "Not Eligible",
      bestTier,
      tierResults,
      strengths,
      risks,
      recommendations
    };
  }, [
    calc, vwfsEntityType, vwfsLoanPurpose, vwfsAbnYears, vwfsGstYears, vwfsAssetBacked,
    vwfsCreditRating, vwfsCreditFileYears, vwfsVehicleType, vwfsDealerChannel,
    vwfsReplacementDeal, vwfsRepaymentIncrease, vwfsStartupBusiness
  ]);


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
    appPage,
    setAppPage,
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
    vwfsEntityType, setVwfsEntityType,
    vwfsLoanPurpose, setVwfsLoanPurpose,
    vwfsAbnYears, setVwfsAbnYears,
    vwfsGstYears, setVwfsGstYears,
    vwfsAssetBacked, setVwfsAssetBacked,
    vwfsCreditRating, setVwfsCreditRating,
    vwfsCreditFileYears, setVwfsCreditFileYears,
    vwfsVehicleType, setVwfsVehicleType,
    vwfsDealerChannel, setVwfsDealerChannel,
    vwfsReplacementDeal, setVwfsReplacementDeal,
    vwfsRepaymentIncrease, setVwfsRepaymentIncrease,
    vwfsStartupBusiness, setVwfsStartupBusiness,
    vwfsSecondBrain,
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
          <div className="header-controls">
            <PageToggle {...props} />
            <ModeToggle {...props} />
          </div>
        </header>

        <main className="mobile-main">
          {props.appPage === "calculator" ? (
            <>
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
                <Tool title="Saved Quotes" icon={<Search />} onClick={() => props.setActiveSheet("quotes")} />
                <Tool title="Client Profile" icon={<User />} onClick={() => props.setActiveSheet("client")} />
              </section>

              <p className="disclaimer">Estimate only. Subject to approval, lender policy and final contract terms.</p>
            </>
          ) : (
            <PagePanel title="VWFS Customer Profile + Waiver Engine" icon={<Wrench />}>
              <VwfsBrainPanel {...props} />
            </PagePanel>
          )}
        </main>

        {props.appPage === "calculator" && (
          <nav className="bottom-nav">
            <button className="selected"><Calculator size={22} /><span>Calc</span></button>
            <button onClick={props.saveQuote}><Save size={22} /><span>Save</span></button>
            <button onClick={() => props.setActiveSheet("client")}><User size={22} /><span>Client</span></button>
            <button onClick={() => props.setActiveSheet("send")}><MoreHorizontal size={22} /><span>Send</span></button>
          </nav>
        )}

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

      {props.appPage === "calculator" ? (
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
      ) : (
        <main className="desktop-policy-page">
          <PagePanel title="VWFS Customer Profile + Waiver Engine" icon={<Wrench />}>
            <VwfsBrainPanel {...props} />
          </PagePanel>
        </main>
      )}
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


function PageToggle(props) {
  return (
    <div className="page-toggle">
      <button
        className={props.appPage === "calculator" ? "active" : ""}
        onClick={() => props.setAppPage("calculator")}
      >
        Calculator
      </button>
      <button
        className={props.appPage === "vwfs" ? "active" : ""}
        onClick={() => props.setAppPage("vwfs")}
      >
        VWFS Brain
      </button>
    </div>
  );
}

function PagePanel({ title, icon, children }) {
  return (
    <section className="page-panel">
      <div className="panel-head">
        {React.cloneElement(icon, { size: 20 })}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
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


function VwfsBrainPanel(props) {
  const brain = props.vwfsSecondBrain;
  const decisionClass = brain.decision.toLowerCase().replace(" ", "-");

  return (
    <div className="vwfs-brain">
      <div className={`vwfs-decision ${decisionClass}`}>
        <span>VWFS Waiver Result</span>
        <b>{brain.decision}</b>
        <small>{brain.bestTier?.label || "No matching tier"}</small>
      </div>

      <div className="vwfs-profile-grid">
        <SelectField label="Loan Type" value={props.vwfsLoanPurpose} setValue={props.setVwfsLoanPurpose} options={[["commercial","Commercial"],["consumer","Consumer"]]} />
        <SelectField label="Entity Type" value={props.vwfsEntityType} setValue={props.setVwfsEntityType} options={[["soleTrader","Sole Trader"],["company","Company"],["trust","Trust"],["individual","Individual"]]} />
        <Field label="ABN Age" value={props.vwfsAbnYears} setValue={props.setVwfsAbnYears} suffix="yrs" />
        <Field label="GST Age" value={props.vwfsGstYears} setValue={props.setVwfsGstYears} suffix="yrs" />
        <SelectField label="Asset Backed" value={props.vwfsAssetBacked} setValue={props.setVwfsAssetBacked} options={[["yes","Yes"],["no","No"]]} />
        <SelectField label="Credit Rating" value={props.vwfsCreditRating} setValue={props.setVwfsCreditRating} options={[["good","Good"],["average","Average"],["poor","Poor"]]} />
        <Field label="Credit File Age" value={props.vwfsCreditFileYears} setValue={props.setVwfsCreditFileYears} suffix="yrs" />
        <SelectField label="Vehicle Type" value={props.vwfsVehicleType} setValue={props.setVwfsVehicleType} options={[["branded","VWFS branded"],["whiteLabel","White label"],["all","All vehicles"],["other","Other"]]} />
        <SelectField label="Channel" value={props.vwfsDealerChannel} setValue={props.setVwfsDealerChannel} options={[["pos","POS dealer"],["broker","Broker"]]} />
        <SelectField label="Replacement" value={props.vwfsReplacementDeal} setValue={props.setVwfsReplacementDeal} options={[["no","No"],["yes","Yes"]]} />
        <Field label="Repayment Increase" value={props.vwfsRepaymentIncrease} setValue={props.setVwfsRepaymentIncrease} suffix="%" />
        <SelectField label="Start Up" value={props.vwfsStartupBusiness} setValue={props.setVwfsStartupBusiness} options={[["no","No"],["yes","Yes"]]} />
      </div>

      <div className="vwfs-columns">
        <div className="vwfs-list"><span>Strengths</span>{brain.strengths.length ? brain.strengths.map((item)=><p key={item}>✓ {item}</p>) : <p>No major strengths captured yet.</p>}</div>
        <div className="vwfs-list"><span>Risks</span>{brain.risks.length ? brain.risks.map((item)=><p key={item}>⚠ {item}</p>) : <p>No major risks captured.</p>}</div>
      </div>

      <div className="vwfs-list recommendations"><span>Finance Manager Notes</span>{brain.recommendations.map((item)=><p key={item}>→ {item}</p>)}</div>

      <div className="vwfs-tier-list">
        <span>Policy Tier Checks</span>
        {brain.tierResults.map((tier)=>(
          <details key={tier.key}>
            <summary><b>{tier.label}</b><em className={tier.status.toLowerCase().replace(" ","-")}>{tier.status}</em></summary>
            <div>{tier.checks.map((check)=><p key={`${tier.key}-${check.label}`} className={check.pass ? "pass" : "fail"}>{check.pass ? "✓" : "✕"} {check.label}: {check.detail}</p>)}</div>
          </details>
        ))}
      </div>
    </div>
  );
}

function SelectField({ label, value, setValue, options }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => setValue(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option value={optionValue} key={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}


function ActionSheet(props) {
  const titles = {
    send: "Send Quote",
    client: "Client Profile",
    quotes: "Saved Quotes",
    target: "Target Repayment",
    vwfs: "VWFS Second Brain",
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
        {props.activeSheet === "vwfs" && <VwfsBrainPanel {...props} />}

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
