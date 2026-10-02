// Each company's latest quarterly shareholding-pattern filing (XBRL): the
// authoritative share count, plus promoter / FII / DII holdings and pledged
// promoter shares.
//
// The share count is why this exists. Dividing paid-up capital by the face
// value a results filing states goes wrong whenever that face value is stale
// — LTIMindtree's filing says Rs 10 where it's Rs 1, which cut its share count
// to a tenth and made a Rs 1.2 lakh Cr company screen as a Graham net-net.
import { NSE_BASE, fetchJson, fetchXbrl, parseQeDate } from "./fetch-nse.js";

function contextMembers(xml) {
  const out = {};
  for (const m of xml.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g)) {
    out[m[1]] = [...m[2].matchAll(/<xbrldi:explicitMember[^>]*>[^:<]*:([^<]+)<\/xbrldi:explicitMember>/g)].map(x => x[1]);
  }
  return out;
}

// Value of `tag` for a single shareholder category (a context carrying that
// one dimension member and nothing else — sub-category rows carry more).
function byCategory(xml, members, tag) {
  const out = {};
  for (const m of xml.matchAll(new RegExp(`<[a-z-]+:${tag}\\b[^>]*?contextRef="([^"]+)"[^>]*>([^<]*)<`, "g"))) {
    const mem = members[m[1]];
    if (mem?.length === 1 && !(mem[0] in out)) out[mem[0]] = Number(m[2]);
  }
  return out;
}

// Every quarterly shareholding filing NSE lists for the company, newest first
export async function shareholdingFilings(symbol) {
  const rows = await fetchJson(`${NSE_BASE}/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(symbol)}`);
  return [...rows].sort((a, b) => parseQeDate(b.date) - parseQeDate(a.date));
}

export async function fetchShareholding(symbol) {
  const filings = await shareholdingFilings(symbol);
  if (!filings.length) throw new Error(`No shareholding filing for ${symbol}`);
  return { ...(await readShareholdingFiling(filings[0])), promoterHistory: promoterHistory(filings) };
}

// The promoter group's share at each of the last five years' quarter ends,
// newest first — NSE's list of filings carries it, so this costs no extra
// request. For the score's "is promoter ownership stable?" check.
function promoterHistory(filings) {
  return filings.slice(0, 21).flatMap(f => {
    const end = parseQeDate(f.date);
    const pct = Number(f.pr_and_prgrp);
    return end && f.pr_and_prgrp !== "" && Number.isFinite(pct) ? [{ asOfIso: end.toISOString().slice(0, 10), pct }] : [];
  });
}

// One quarter's filing (a row from shareholdingFilings) read in full
export async function readShareholdingFiling(latest) {
  const quarterEnd = parseQeDate(latest.date);
  const base = {
    asOf: latest.date,
    // Share counts are as of this date — splits after it are applied on top
    asOfIso: quarterEnd ? quarterEnd.toISOString().slice(0, 10) : null,
    promoterPct: Number(latest.pr_and_prgrp),
    source: "summary",
  };
  if (!latest.xbrl || !/\.xml$/i.test(latest.xbrl)) return base;

  const xml = await fetchXbrl(latest.xbrl);
  const members = contextMembers(xml);
  const shares = byCategory(xml, members, "NumberOfShares");
  const share = byCategory(xml, members, "ShareholdingAsAPercentageOfTotalNumberOfShares");
  const pledged = byCategory(xml, members, "EncumberedShareUnderPledgedAsPercentageOfTotalNumberOfShares");

  // The filing's own grand total where present. Otherwise add the parts — and
  // the non-promoter/non-public part matters: HDFC Bank's 2.05 bn shares held
  // for ADRs sit there, and leaving it out undercounted it by 13%. Widely held
  // companies (HDFC Bank, ITC) file no promoter row at all.
  const promoter = shares.ShareholdingOfPromoterAndPromoterGroupMember ?? (base.promoterPct === 0 ? 0 : null);
  const publicHolders = shares.PublicShareholdingMember;
  const nonPublic = shares.SharesHeldByNonPromoterNonPublicShareholdersMember ?? shares.NonPromoterNonPublicShareholdingMember ?? 0;
  const totalShares = shares.ShareholdingPatternMember ??
    (promoter != null && publicHolders != null ? promoter + publicHolders + nonPublic : null);

  // Foreign institutions: the category total where filed, else its parts
  const fii = share.InstitutionsForeignMember ??
    (["InstitutionsForeignPortfolioInvestorCategoryOneMember", "InstitutionsForeignPortfolioInvestorCategoryTwoMember", "OtherInstitutionsForeignMember"]
      .some(k => k in share)
      ? (share.InstitutionsForeignPortfolioInvestorCategoryOneMember ?? 0) + (share.InstitutionsForeignPortfolioInvestorCategoryTwoMember ?? 0) + (share.OtherInstitutionsForeignMember ?? 0)
      : null);

  // Filings give each category's share as a fraction (0.4289), older ones
  // already as a percent (42.89) — the filing's own total says which. Reading
  // one as the other put a promoter at 4,289% in the history panel.
  const total = share.ShareholdingPatternMember ??
    ((share.ShareholdingOfPromoterAndPromoterGroupMember ?? 0) + (share.PublicShareholdingMember ?? 0));
  const scale = total > 1.5 ? 1 : 100;
  const pct = v => (v == null ? null : Math.round(v * scale * 100) / 100);

  // A filing only lists the categories that have holders: one that parsed
  // but has no foreign (or domestic) institutions category has none — 0, not
  // unknown. Seen on ~400 small companies, some with domestic institutions
  // and no foreign ones.
  const parsed = Object.keys(share).length > 0;
  return {
    ...base,
    source: "xbrl",
    totalShares,
    promoterPct: pct(share.ShareholdingOfPromoterAndPromoterGroupMember) ?? base.promoterPct,
    fiiPct: pct(fii) ?? (parsed ? 0 : null),
    diiPct: pct(share.InstitutionsDomesticMember) ?? (parsed ? 0 : null),
    publicPct: pct(share.PublicShareholdingMember),
    // As a % of the promoters' own holding — the same measure as Screener's
    // "Pledged percentage". No pledge filed means none pledged.
    pledgedPct: pct(pledged.ShareholdingOfPromoterAndPromoterGroupMember) ?? 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const symbol of process.argv.slice(2).length ? process.argv.slice(2) : ["LTM"]) {
    console.log(symbol, JSON.stringify(await fetchShareholding(symbol)));
  }
}
