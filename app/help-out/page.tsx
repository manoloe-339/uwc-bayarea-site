import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { HelpOutForm } from "./HelpOutForm";

export const metadata = {
  title: "Help Out · UWC Bay Area",
  description:
    "We're run by volunteers, and we're always looking for dedicated supporters. Tell us a bit about yourself and where you'd like to help.",
};

export default function HelpOutPage() {
  return (
    <>
      <SiteHeader active="help" />
      <HelpOutStyles />
      <main className="bg-ivory min-h-screen">
        <section
          className="page-wrap"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <div className="hero-grid">
            <div>
              <div
                className="font-bold uppercase mb-4"
                style={{
                  fontSize: 11,
                  letterSpacing: ".32em",
                  color: "var(--navy)",
                }}
              >
                Volunteer with us
              </div>
              <h1
                className="font-display font-bold text-[color:var(--navy-ink)] m-0"
                style={{
                  fontSize: "clamp(34px, 8vw, 76px)",
                  lineHeight: 1.04,
                  letterSpacing: "-.025em",
                  textWrap: "balance",
                }}
              >
                We&rsquo;re run by volunteers, and we&rsquo;re always looking
                for{" "}
                <em
                  className="text-navy font-semibold"
                  style={{ fontStyle: "italic" }}
                >
                  dedicated supporters
                </em>
                .
              </h1>
            </div>
            <div>
              <p
                className="font-sans m-0"
                style={{
                  fontSize: "clamp(16px, 1.3vw, 18px)",
                  lineHeight: 1.5,
                  color: "var(--muted)",
                  maxWidth: 460,
                }}
              >
                Tell us a bit about yourself and where you&rsquo;d like to help.
              </p>
            </div>
          </div>
        </section>

        <section className="form-wrap">
          <HelpOutForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/** Page-scoped CSS that mirrors the design system tokens. Kept inline as
 * a styled-jsx-style block so the page is self-contained and doesn't
 * pollute global CSS. */
function HelpOutStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
.field-label {
  font-family: 'Inter';
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .28em;
  text-transform: uppercase;
  color: var(--navy-ink);
  display: block;
  margin-bottom: 8px;
}
.field-help {
  font-family: 'Inter';
  font-size: 13px;
  color: var(--muted);
  margin-top: 10px;
  line-height: 1.45;
}
.text-input {
  width: 100%;
  background: #fff;
  border: 1.5px solid var(--rule);
  border-bottom: 1.5px solid var(--navy-ink);
  padding: 14px 16px;
  font-family: 'Inter';
  font-size: 17px;
  color: var(--navy-ink);
  border-radius: 0;
  outline: none;
  transition: border-color .15s, background .15s;
}
.text-input::placeholder { color: rgba(11,37,69,.35); }
.text-input:focus {
  border-color: var(--navy);
  background: #fff;
}
.lookup-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  font-family: 'Inter';
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .22em;
  text-transform: uppercase;
  margin-top: 10px;
}
.lookup-pill.checking {
  background: var(--ivory-2);
  color: var(--muted);
  border: 1px solid var(--rule);
}
.lookup-dot {
  width: 8px; height: 8px; border-radius: 999px;
  background: currentColor;
}
.lookup-pill.checking .lookup-dot {
  animation: helpout-pulse 1.2s ease-in-out infinite;
}
@keyframes helpout-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }

.check-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 18px 20px;
  background: #fff;
  border: 1.5px solid var(--rule);
  cursor: pointer;
  transition: border-color .15s, background .15s, box-shadow .15s;
  width: 100%;
  text-align: left;
}
.check-card:hover {
  border-color: rgba(2,101,168,.4);
  background: #fffefb;
}
.check-card.checked {
  border-color: var(--navy);
  background: rgba(2,101,168,.04);
  box-shadow: inset 4px 0 0 0 var(--navy);
}
.check-card .box {
  width: 22px; height: 22px;
  border: 1.5px solid var(--navy-ink);
  background: #fff;
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .15s, border-color .15s;
}
.check-card.checked .box {
  background: var(--navy);
  border-color: var(--navy);
}
.check-card .label {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: 19px;
  color: var(--navy-ink);
  line-height: 1.2;
  letter-spacing: -.005em;
}
.check-card .desc {
  font-family: 'Inter';
  font-size: 13px;
  color: var(--muted);
  margin-top: 6px;
  line-height: 1.45;
}
.submit-btn {
  background: var(--navy);
  color: #fff;
  border: 0;
  padding: 18px 36px;
  font-family: 'Inter';
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .26em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 0;
  transition: background .15s, transform .1s;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.submit-btn:hover { background: var(--navy-2); }
.submit-btn:active { transform: translateY(1px); }
.submit-btn:disabled { background: var(--ivory-3); color: var(--muted); cursor: not-allowed; }

.page-wrap { padding: 28px 20px 32px; }
.form-wrap { padding: 36px 20px 56px; }
.hero-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  align-items: end;
}
.form-inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 44px;
}
.step-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: start;
}
.step-num {
  font-family: 'Fraunces', Georgia, serif;
  font-style: italic;
  font-weight: 600;
  font-size: 28px;
  color: var(--navy);
  letter-spacing: -.01em;
  line-height: 1;
}
.name-email-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
.submit-row { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; border-top: 1px solid var(--rule); }
.submit-btn { width: 100%; justify-content: center; padding: 18px 28px; }

@media (min-width: 720px) {
  .page-wrap { padding: 60px 28px 44px; }
  .form-wrap { padding: 56px 28px 80px; }
  .hero-grid { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 56px; }
  .form-inner { gap: 56px; }
  .step-grid { grid-template-columns: 60px 1fr; gap: 28px; }
  .step-num { font-size: 36px; padding-top: 4px; }
  .name-email-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
  .submit-row { flex-direction: row; align-items: center; justify-content: space-between; padding-top: 8px; flex-wrap: wrap; gap: 24px; }
  .submit-btn { width: auto; }
}

@media (max-width: 480px) {
  .text-input { font-size: 16px; padding: 13px 14px; }
  .check-card { padding: 16px; gap: 14px; }
  .check-card .label { font-size: 17px; }
  .check-card .desc { font-size: 13px; }
}
        `,
      }}
    />
  );
}
