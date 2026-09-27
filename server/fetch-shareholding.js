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

const pct = v => (v == null ? null : Math.round(v * 10000) / 100);

export async function fetchShareholding(symbol) {
  const rows = await fetchJson(`${NSE_BASE}/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(symbol)}`);
  if (!rows.length) throw new Error(`No shareholding filing for ${symbol}`);
  const latest = [...rows].sort((a, b) => parseQeDate(b.date) - parseQeDate(a.date))[0];
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

  return {
    ...base,
    source: "xbrl",
    totalShares,
    promoterPct: pct(share.ShareholdingOfPromoterAndPromoterGroupMember) ?? base.promoterPct,
    fiiPct: pct(fii),
    diiPct: pct(share.InstitutionsDomesticMember),
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
