// NSE's archive answers a day without a file with a web page and a 200
// (market-data.js looksLikeBhavcopy): only a real price file counts
import assert from "node:assert/strict";
import { looksLikeBhavcopy } from "./market-data.js";

assert.equal(looksLikeBhavcopy("SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE\nTCS, EQ, 18-Nov-2021, 3500, 3490, 3510, 3460, 3475, 3475.7"), true, "a price file");
assert.equal(looksLikeBhavcopy("﻿SYMBOL,SERIES,DATE1,CLOSE_PRICE\n"), true, "with a byte-order mark");
assert.equal(looksLikeBhavcopy("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<title>Service Temporarily Unavailable</title>"), false, "NSE's page for a day without a file");
assert.equal(looksLikeBhavcopy(""), false);
assert.equal(looksLikeBhavcopy(null), false);
console.log("ok: only NSE's real price files count as a day's prices");
