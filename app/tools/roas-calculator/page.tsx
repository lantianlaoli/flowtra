"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Calculator, CircleDollarSign, DollarSign, Package, ShoppingBag, TrendingUp } from "lucide-react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import { getToolCreditBalanceHeroState, useToolCreditBalance } from "@/lib/tools/use-tool-credit-balance";

type Inputs = {
  adSpend: string;
  revenue: string;
  conversions: string;
  avgCostPerProduct: string;
  extraCosts: string;
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
] as const;

const DEFAULT_INPUTS: Inputs = {
  adSpend: "1000",
  revenue: "5000",
  conversions: "50",
  avgCostPerProduct: "15",
  extraCosts: "120",
};

const DROPSHIP_TARGET_ROAS_MIN = 4;
const DROPSHIP_TARGET_ROAS_MAX = 6;

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

function InputField({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <div className="flex items-center gap-2 text-sm leading-5">
        <span className="text-[#666666]">{icon}</span>
        <span className="font-medium text-black">{label}</span>
        <span className="text-[#666666]">({hint})</span>
      </div>
      {children}
    </label>
  );
}

export default function RoasCalculatorPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const creditBalance = useToolCreditBalance();
  const heroCreditState = getToolCreditBalanceHeroState(creditBalance);
  const [currency, setCurrency] = useState<string>("USD");
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);

  const metrics = useMemo(() => {
    const adSpend = toNumber(inputs.adSpend);
    const revenue = toNumber(inputs.revenue);
    const conversions = toNumber(inputs.conversions);
    const avgCostPerProduct = toNumber(inputs.avgCostPerProduct);
    const extraCosts = toNumber(inputs.extraCosts);

    const cogs = conversions * avgCostPerProduct;
    const grossProfitBeforeAds = revenue - cogs - extraCosts;
    const netProfit = grossProfitBeforeAds - adSpend;
    const roas = adSpend > 0 ? revenue / adSpend : 0;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const returnRate = adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : 0;
    const cpa = conversions > 0 ? adSpend / conversions : 0;
    const revenuePerConversion = conversions > 0 ? revenue / conversions : 0;

    return {
      adSpend,
      revenue,
      conversions,
      cogs,
      grossProfitBeforeAds,
      netProfit,
      roas,
      margin,
      returnRate,
      cpa,
      revenuePerConversion,
    };
  }, [inputs]);

  const benchmarkStatus =
    metrics.roas >= DROPSHIP_TARGET_ROAS_MIN && metrics.roas <= DROPSHIP_TARGET_ROAS_MAX
      ? "On target"
      : metrics.roas < DROPSHIP_TARGET_ROAS_MIN
        ? "Below target"
        : "Above target";

  const setField = (field: keyof Inputs, value: string) => {
    setInputs((previous) => ({ ...previous, [field]: value }));
  };

  return (
    <ToolPageShell
      title="TikTok Dropshipping ROAS Calculator"
      titleBadge="Free"
      description="This calculator is optimized for TikTok dropshipping campaigns only. Enter your spend, sales, and order economics to evaluate profitability quickly."
      statusLabel={heroCreditState.label}
      statusTone={heroCreditState.tone}
    >

          {isLoaded && !isSignedIn ? (
            <section className="mt-8 rounded-2xl border border-[#E5E5E5] bg-white p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.08)] sm:p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7] text-black">
                <Calculator className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-black">Sign in to use this calculator</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#666666]">
                ROAS Calculator is available to signed-in users. It does not consume credits.
              </p>
              <button
                type="button"
                onClick={() => openSignIn({ fallbackRedirectUrl: "/tools/roas-calculator" })}
                className="landing-press-button landing-press-button--compact mt-6 justify-center text-sm font-medium"
              >
                Sign In
              </button>
            </section>
          ) : (
          <div className="mt-8 sm:mt-10 grid gap-5 sm:gap-6 lg:grid-cols-[1.05fr_1fr]">
            <section className="rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
                  <ShoppingBag className="h-5 w-5 text-black" />
                </div>
                <h2 className="text-lg font-semibold text-black">Input Assumptions</h2>
              </div>

              <div className="space-y-7">
                <InputField label="Currency" hint="for all money metrics" icon={<DollarSign className="h-4 w-4" />}>
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-[#D7D7D7] focus:bg-white"
                  >
                    {CURRENCIES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </InputField>

                <InputField label="Total Ad Spend" hint="TikTok paid media spend" icon={<CircleDollarSign className="h-4 w-4" />}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={inputs.adSpend}
                    onChange={(event) => setField("adSpend", event.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-[#D7D7D7] focus:bg-white"
                  />
                </InputField>

                <InputField label="Total Revenue" hint="attributed order revenue" icon={<TrendingUp className="h-4 w-4" />}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={inputs.revenue}
                    onChange={(event) => setField("revenue", event.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-[#D7D7D7] focus:bg-white"
                  />
                </InputField>

                <InputField label="Total Conversions" hint="orders from ads" icon={<ShoppingBag className="h-4 w-4" />}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={inputs.conversions}
                    onChange={(event) => setField("conversions", event.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-[#D7D7D7] focus:bg-white"
                  />
                </InputField>

                <InputField label="Average Cost Per Product" hint="supplier cost per order" icon={<Package className="h-4 w-4" />}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={inputs.avgCostPerProduct}
                    onChange={(event) => setField("avgCostPerProduct", event.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-[#D7D7D7] focus:bg-white"
                  />
                </InputField>

                <InputField label="Extra Costs" hint="shipping, payment, and ops fees" icon={<DollarSign className="h-4 w-4" />}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={inputs.extraCosts}
                    onChange={(event) => setField("extraCosts", event.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-sm text-black outline-none transition-colors focus:border-[#D7D7D7] focus:bg-white"
                  />
                </InputField>
              </div>
            </section>

            <section className="space-y-4">
              <article className="rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
                <p className="text-sm uppercase tracking-[0.2em] text-[#666666]">Core Result</p>
                <div className="mt-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-black" />
                  <p className="text-4xl font-semibold tracking-tight text-black">{formatRatio(metrics.roas)}</p>
                </div>
                <p className="mt-2 text-sm text-[#666666]">{formatPercent(metrics.returnRate)} return on ad spend</p>
                <p className="mt-4 text-sm text-[#666666]">
                  For every {formatMoney(1, currency)} spent, you generate {formatMoney(metrics.roas, currency)} in revenue.
                </p>
              </article>

              <div className="grid gap-4 sm:grid-cols-2">
                <MetricCard label="Net Profit" value={formatMoney(metrics.netProfit, currency)} accent={metrics.netProfit >= 0} />
                <MetricCard label="Profit Margin" value={formatPercent(metrics.margin)} accent={metrics.margin >= 0} />
                <MetricCard label="Cost Per Conversion" value={formatMoney(metrics.cpa, currency)} />
                <MetricCard label="Revenue Per Conversion" value={formatMoney(metrics.revenuePerConversion, currency)} />
              </div>

              <article className="rounded-2xl border border-[#E5E5E5] bg-[#F7F7F7] p-5">
                <div className="inline-flex items-center gap-2 font-medium text-black">
                  <Calculator className="h-4 w-4" />
                  Dropshipping Benchmark
                </div>
                <p className="mt-2 text-sm text-[#666666]">
                  Target ROAS range: {formatRatio(DROPSHIP_TARGET_ROAS_MIN)} - {formatRatio(DROPSHIP_TARGET_ROAS_MAX)}
                </p>
                <p className="mt-1 text-sm text-[#666666]">Status: {benchmarkStatus}</p>
                <p className="mt-3 text-xs text-[#666666]">
                  Estimated COGS: {formatMoney(metrics.cogs, currency)} · Gross profit before ads: {formatMoney(metrics.grossProfitBeforeAds, currency)}
                </p>
              </article>

              <article className="rounded-2xl border border-[#E5E5E5] bg-white p-5 text-sm text-[#666666]">
                <div className="inline-flex items-center gap-2 font-medium text-black">
                  <DollarSign className="h-4 w-4" />
                  Formula
                </div>
                <p className="mt-2">ROAS = Revenue / Ad Spend</p>
                <p>Net Profit = Revenue - Ad Spend - (Conversions × Cost Per Product) - Extra Costs</p>
              </article>
            </section>
          </div>
          )}
    </ToolPageShell>
  );
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-[0_14px_34px_rgba(0,0,0,0.05)]">
      <p className="text-xs uppercase tracking-[0.18em] text-[#666666]">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${accent ? "text-[#0E8A39]" : "text-black"}`}>{value}</p>
    </article>
  );
}
