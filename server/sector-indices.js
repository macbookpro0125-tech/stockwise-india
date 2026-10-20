// The NSE index each sector is measured against on the stock page — only
// where NSE has an index named for that sector (Construction, Textiles,
// Utilities and a few others have none, and are measured against the market
// alone rather than against a stand-in). Construction Materials' index is
// cement's, which is most of the sector. Several of these indices started in
// 2024–25: NSE's daily file before then doesn't list them, so their 3- and
// 5-year returns are missing, not guessed.
export const SECTOR_INDEX = {
  "Automobile and Auto Components": "Nifty Auto",
  "Capital Goods": "Nifty Capital Goods",
  "Chemicals": "Nifty Chemicals",
  "Construction Materials": "Nifty Cement",
  "Consumer Durables": "Nifty Consumer Durables",
  "Consumer Services": "Nifty Consumer Services",
  "Fast Moving Consumer Goods": "Nifty FMCG",
  "Financial Services": "Nifty Financial Services",
  "Healthcare": "Nifty Healthcare Index",
  "Information Technology": "Nifty IT",
  "Media Entertainment & Publication": "Nifty Media",
  "Metals & Mining": "Nifty Metal",
  "Oil Gas & Consumable Fuels": "Nifty Oil & Gas",
  "Power": "Nifty Power",
  "Realty": "Nifty Realty",
  "Services": "Nifty Commercial & Transport Services",
  "Telecommunication": "Nifty Telecommunications",
};
