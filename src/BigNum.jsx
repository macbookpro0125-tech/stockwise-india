// A headline number (a share's price, an index's level): the digits that
// matter large, the ₹ sign and the decimals a step smaller, as the best
// finance apps set them (7 Nov 2026, typography step 4). Takes the text
// already formatted ("₹2,530.50", "22,600.00") and only restyles it.
export default function BigNum({ text }) {
  const s = String(text ?? "");
  const m = s.match(/^([^\d−-]*)([−-]?[\d,]+)(\.\d+)?(.*)$/);
  if (!m) return s;
  const [, cur, whole, dec, rest] = m;
  return (
    <span className="bignum" aria-label={s}>
      {cur && <span className="bignum-cur" aria-hidden="true">{cur.trim()}</span>}
      <span aria-hidden="true">{whole}</span>
      {dec && <span className="bignum-dec" aria-hidden="true">{dec}</span>}
      {rest && <span aria-hidden="true">{rest}</span>}
    </span>
  );
}
