"use client";

import { useMemo, useState } from "react";
import { Calculator, DollarSign, TrendingUp } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

type Inputs = {
  adSpend: string;
  revenue: string;
  cogs: string;
  extraCosts: string;
  orders: string;
};

const DEFAULT_INPUTS: Inputs = {
  adSpend: "1200",
  revenue: "4800",
  cogs: "1800",
  extraCosts: "420",
  orders: "96",
};

const CURRENCIES = [
  { code: "USD", label: "🇺🇸 US Dollar (USD)" },
  { code: "EUR", label: "🇪🇺 Euro (EUR)" },
  { code: "GBP", label: "🇬🇧 British Pound (GBP)" },
  { code: "CAD", label: "🇨🇦 Canadian Dollar (CAD)" },
  { code: "AUD", label: "🇦🇺 Australian Dollar (AUD)" },
  { code: "JPY", label: "🇯🇵 Japanese Yen (JPY)" },
  { code: "CNY", label: "🇨🇳 Chinese Yuan (CNY)" },
  { code: "HKD", label: "🇭🇰 Hong Kong Dollar (HKD)" },
  { code: "SGD", label: "🇸🇬 Singapore Dollar (SGD)" },
  { code: "INR", label: "🇮🇳 Indian Rupee (INR)" },
  { code: "KRW", label: "🇰🇷 South Korean Won (KRW)" },
  { code: "BRL", label: "🇧🇷 Brazilian Real (BRL)" },
  { code: "MXN", label: "🇲🇽 Mexican Peso (MXN)" },
  { code: "AED", label: "🇦🇪 UAE Dirham (AED)" },
] as const;

function toNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRatio(value: number) {
  return `${value.toFixed(2)}x`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function NumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm leading-5">
        <span className="font-medium text-black">{label}</span>
        <span className="text-[#666666]">({hint})</span>
      </div>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black focus:bg-white"
      />
    </label>
  );
}

export default function RoasCalculatorPage() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [currency, setCurrency] = useState<string>("USD");

  const metrics = useMemo(() => {
    const adSpend = toNumber(inputs.adSpend);
    const revenue = toNumber(inputs.revenue);
    const cogs = toNumber(inputs.cogs);
    const extraCosts = toNumber(inputs.extraCosts);
    const orders = toNumber(inputs.orders);

    const grossProfitBeforeAds = revenue - cogs - extraCosts;
    const netProfit = grossProfitBeforeAds - adSpend;
    const roas = adSpend > 0 ? revenue / adSpend : 0;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const adCostRate = revenue > 0 ? (adSpend / revenue) * 100 : 0;
    const contributionRate = revenue > 0 ? grossProfitBeforeAds / revenue : 0;
    const breakEvenRoas = contributionRate > 0 ? 1 / contributionRate : 0;
    const cpa = orders > 0 ? adSpend / orders : 0;
    const breakEvenCpa = orders > 0 ? grossProfitBeforeAds / orders : 0;

    return {
      adSpend,
      revenue,
      cogs,
      extraCosts,
      orders,
      grossProfitBeforeAds,
      netProfit,
      roas,
      margin,
      adCostRate,
      breakEvenRoas,
      cpa,
      breakEvenCpa,
    };
  }, [inputs]);

  const setField = (field: keyof Inputs, value: string) => {
    setInputs((previous) => ({ ...previous, [field]: value }));
  };

  const targetStatus =
    metrics.roas >= metrics.breakEvenRoas && metrics.breakEvenRoas > 0
      ? "profitable"
      : "below break-even";

  return (
    <>
      <Header />
      <main className="bg-white">
        <section className="mx-auto max-w-[1040px] px-6 py-20">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">Tools</p>
            <h1 className="text-4xl sm:text-5xl font-semibold text-black tracking-tight">ROAS Calculator</h1>
            <p className="max-w-2xl text-base text-[#666666]">
              Model campaign performance with ad spend, sales, and costs. Instantly see ROAS,
              break-even targets, and net profit.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
            <section className="rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-[0_10px_26px_rgba(0,0,0,0.05)]">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#DCDCDC] bg-[#F5F5F5]">
                  <Calculator className="h-5 w-5 text-black" />
                </div>
                <h2 className="text-lg font-semibold text-black">Input Assumptions</h2>
              </div>

              <div className="space-y-7">
                <label className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm leading-5">
                    <span className="font-medium text-black">Currency</span>
                    <span className="text-[#666666]">(for all money metrics)</span>
                  </div>
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black focus:bg-white"
                  >
                    {CURRENCIES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label="Ad Spend"
                  hint="Total paid media spend"
                  value={inputs.adSpend}
                  onChange={(value) => setField("adSpend", value)}
                />
                <NumberField
                  label="Revenue"
                  hint="Attributed sales"
                  value={inputs.revenue}
                  onChange={(value) => setField("revenue", value)}
                />
                <NumberField
                  label="COGS"
                  hint="Product and manufacturing cost"
                  value={inputs.cogs}
                  onChange={(value) => setField("cogs", value)}
                />
                <NumberField
                  label="Extra Costs"
                  hint="Shipping, payment, operations"
                  value={inputs.extraCosts}
                  onChange={(value) => setField("extraCosts", value)}
                />
                <NumberField
                  label="Orders"
                  hint="Attributed conversions"
                  value={inputs.orders}
                  onChange={(value) => setField("orders", value)}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
                <p className="text-sm uppercase tracking-[0.2em] text-[#666666]">Core Result</p>
                <div className="mt-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-black" />
                  <p className="text-4xl font-semibold tracking-tight text-black">{formatRatio(metrics.roas)}</p>
                </div>
                <p className="mt-2 text-sm text-[#666666]">Current ROAS ({targetStatus})</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MetricCard label="Net Profit" value={formatMoney(metrics.netProfit, currency)} />
                <MetricCard label="Profit Margin" value={formatPercent(metrics.margin)} />
                <MetricCard label="Break-even ROAS" value={formatRatio(metrics.breakEvenRoas)} />
                <MetricCard label="Ad Cost Rate" value={formatPercent(metrics.adCostRate)} />
                <MetricCard label="Actual CPA" value={formatMoney(metrics.cpa, currency)} />
                <MetricCard label="Break-even CPA" value={formatMoney(metrics.breakEvenCpa, currency)} />
              </div>

              <div className="rounded-2xl border border-[#E5E5E5] bg-[#F7F7F7] p-5">
                <p className="text-sm font-medium text-black">Quick read</p>
                <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                  Gross profit before ads is {formatMoney(metrics.grossProfitBeforeAds, currency)}. To break even, keep
                  ROAS above {formatRatio(metrics.breakEvenRoas)} or CPA below {formatMoney(metrics.breakEvenCpa, currency)}.
                </p>
              </div>
            </section>
          </div>

          <div className="mt-8 rounded-2xl border border-[#E5E5E5] bg-white p-5 text-sm text-[#666666]">
            <div className="inline-flex items-center gap-2 font-medium text-black">
              <DollarSign className="h-4 w-4" />
              Formula
            </div>
            <p className="mt-2">ROAS = Revenue / Ad Spend</p>
            <p>Break-even ROAS = Revenue / (Revenue - COGS - Extra Costs)</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_14px_34px_rgba(0,0,0,0.05)]">
      <p className="text-xs uppercase tracking-[0.18em] text-[#666666]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-black">{value}</p>
    </article>
  );
}
