import { useEffect } from "react";
import { METHODOLOGY_SECTIONS, METHODOLOGY_TITLE } from "./methodology-content.js";
import { PublicPage } from "./LegalPages.jsx";
import { SiteLink } from "./site.jsx";
import { ANALYSIS_EXAMPLES } from "./company-analysis.js";

export default function MethodologyPage({ signedIn }) {
  useEffect(() => {
    document.title = `${METHODOLOGY_TITLE} | Jocular Insights`;
  }, []);
  return (
    <PublicPage title={METHODOLOGY_TITLE} signedIn={signedIn} updated="23 October 2026">
      {METHODOLOGY_SECTIONS.map(section => (
        <section key={section.title}>
          <h2 style={{ fontSize: 17, fontWeight: 450, color: "var(--t1)", margin: "30px 0 8px", letterSpacing: "-0.01em" }}>{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", margin: "0 0 12px" }}>{paragraph}</p>
          ))}
          {section.bullets && (
            <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
              {section.bullets.map(item => <li key={item} style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", marginBottom: 8 }}>{item}</li>)}
            </ul>
          )}
        </section>
      ))}
      <section>
        <h2 style={{ fontSize: 17, fontWeight: 450, color: "var(--t1)", margin: "30px 0 8px", letterSpacing: "-0.01em" }}>Worked company examples</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", margin: "0 0 12px" }}>See how recent reported figures can be read in company-specific context:</p>
        <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>{ANALYSIS_EXAMPLES.map(item => <li key={item.symbol} style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", marginBottom: 8 }}><SiteLink to={`/stock/${item.symbol}`}>{item.name}</SiteLink></li>)}</ul>
      </section>
      <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", margin: "24px 0 12px" }}>
        Read the full <SiteLink to="/disclaimer">disclaimer</SiteLink> or see <SiteLink to="/help">how the figures are updated</SiteLink>.
      </p>
    </PublicPage>
  );
}
