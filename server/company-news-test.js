// Company news (16 Nov 2026): quote pages, forecasts, tips and brokers' calls
// are kept out; the rest of the coverage stays
import assert from "node:assert";
import { isJunkHeadline } from "./company-extras.js";
const junk = [
  "Tata Consultancy Services Limited (TCS.NS) stock price, news, quote and history",
  "Tata Consultancy Services (TCS) Share Price Today (NSE), Market News",
  "Solar Industries India (NSEI:SOLARINDS) Stock Forecast & Analyst Predictions",
  "TCS Outlook for the Week",
  "STOCK OF THE DAY Buy TCS Futures: SL 2475 Tgt 2535, 2545, 2575",
  "Tata Consultancy Services (TCS) Share Price Falls 3.14% Today: Price Action",
  "TCS share price target: Nomura retains 'Buy' after management meet",
];
for (const t of junk) assert(isJunkHeadline(t), `kept out: ${t}`);
const real = [
  "Solar Industries Q2 Results: Profit jumps 80%, order book stands at ₹20,178 crore",
  "TCS share price surges 28% in October, hits over 7-month high; here's why",
  "Earnings call transcript: Solar Industries India posts strong Q2 2027 growth",
];
for (const t of real) assert(!isJunkHeadline(t), `kept: ${t}`);
console.log("ok: company news without quote pages, forecasts, tips or broker calls");
