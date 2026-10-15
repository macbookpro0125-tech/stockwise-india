# Build log

- S-STOCK · 2026-10-15 · done · Stock page in two columns (StockSide.jsx, StockSnapshot.jsx, StockDetail.jsx). Missing by design: forecasts, analyst ratings, sentiment (no data for them). Harder than expected: pinning the tab bar on both layouts — a grid area limits a sticky bar to its own row, so the phone layout uses `display: contents` and flex order instead. Tests: F03, F04, F05, phone, sweep (no axe violations).
