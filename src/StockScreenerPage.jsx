import { useEffect } from "react";
import { PublicPage } from "./LegalPages.jsx";
import { SiteLink } from "./site.jsx";
import {
  SCREENER_PAGE_DESCRIPTION,
  SCREENER_PAGE_FAQS,
  SCREENER_PAGE_TITLE,
  SCREENER_PAGE_SECTIONS,
} from "./screener-page-content.js";

const heading = { fontSize: 17, fontWeight: 450, color: "var(--t1)", margin: "30px 0 8px", letterSpacing: "-0.01em" };
const paragraph = { fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", margin: "0 0 12px" };

export default function StockScreenerPage({ signedIn }) {
  useEffect(() => { document.title = `${SCREENER_PAGE_TITLE} | Jocular Insights`; }, []);
  return (
    <PublicPage title={SCREENER_PAGE_TITLE} signedIn={signedIn} updated="23 October 2026">
      <p style={paragraph}>{SCREENER_PAGE_DESCRIPTION}</p>
      {SCREENER_PAGE_SECTIONS.map(section => (
        <section key={section.title}>
          <h2 style={heading}>{section.title}</h2>
          {section.paragraphs.map((text, i) => <p key={i} style={paragraph}>{text}</p>)}
          {section.bullets && <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
            {section.bullets.map(text => <li key={text} style={{ ...paragraph, marginBottom: 8 }}>{text}</li>)}
          </ul>}
        </section>
      ))}
      <section>
        <h2 style={heading}>Frequently asked questions</h2>
        {SCREENER_PAGE_FAQS.map(item => <div key={item.question}>
          <h3 style={{ ...heading, margin: "18px 0 6px", fontSize: 15 }}>{item.question}</h3>
          <p style={paragraph}>{item.answer}</p>
        </div>)}
      </section>
      <section>
        <h2 style={heading}>See worked examples</h2>
        <p style={paragraph}>
          <SiteLink to="/stock/TCS">TCS results analysis</SiteLink> ·{" "}
          <SiteLink to="/stock/RELIANCE">Reliance Industries results analysis</SiteLink> ·{" "}
          <SiteLink to="/stock/HDFCBANK">HDFC Bank results analysis</SiteLink> ·{" "}
          <SiteLink to="/methodology">Scoring and valuation methodology</SiteLink>.
        </p>
      </section>
    </PublicPage>
  );
}
