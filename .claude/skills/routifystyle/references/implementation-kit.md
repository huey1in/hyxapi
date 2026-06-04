# Anthropic Web Implementation Kit

Use this kit as the starting point for HTML/CSS/React implementations.

## CSS Baseline

```css
:root {
  --ivory: #faf9f5;
  --ivory-wrap: #f0eee6;
  --ivory-2: #f5f4ed;
  --ivory-3: #e8e6dc;
  --line: #dedbd0;
  --line-strong: #cfcbbf;
  --ink: #141413;
  --ink-docs: #0b0b0b;
  --ink-2: #30302e;
  --muted: #5e5d59;
  --muted-docs: #73726c;
  --faint: #b0aea5;
  --black: #0f0f0e;
  --clay: #c8785b;
  --clay-docs: #c6613f;
  --white: #fff;
}

* { box-sizing: border-box; }
html { background: var(--ivory); }
body {
  margin: 0;
  background: var(--ivory);
  color: var(--ink);
  font-family: anthropicSans, "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.5;
}

.serif {
  font-family: anthropicSerif, Georgia, "Times New Roman", "Iowan Old Style", serif;
  font-weight: 500;
  letter-spacing: 0;
}

.mono {
  font-family: anthropicMono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

a { color: inherit; text-decoration-thickness: .06em; text-underline-offset: .16em; }
button, input { font: inherit; }
```

## Docs Home Pattern

Use this when matching `platform.claude.com/docs/en/home`.

Structure:

```html
<header class="docs-topbar">
  <a class="docs-brand"><span class="sunburst"></span><span class="brand-serif">Claude</span><span>API Docs</span></a>
  <nav class="docs-actions">...</nav>
</header>
<div class="browse-row">Browse <span>⌄</span></div>
<main class="docs-shell">
  <section class="docs-hero">
    <div class="hero-copy">...</div>
    <div class="code-card">...</div>
  </section>
  <section class="docs-section">...</section>
</main>
<button class="ask-docs">Ask Docs</button>
```

## Official Homepage Pattern

Use this as the default when the user asks for "Anthropic homepage", "official homepage style", or simply "Anthropic official site style".

Structure:

```html
<main class="home-page">
  <header class="home-nav">
    <a class="ai-mark">AI</a>
    <button class="hamburger">...</button>
  </header>
  <section class="home-hero">
    <h1>AI <span>research</span> and <span>products</span> that put safety at the frontier</h1>
    <p>AI will have a vast impact...</p>
  </section>
  <section class="hero-visual">...</section>
  <section class="latest-releases">...</section>
</main>
```

Key CSS:

```css
body { background: var(--ivory-wrap); }
.home-page {
  min-height: 100vh;
  background: var(--ivory);
  color: var(--ink);
}
.home-nav {
  height: 72px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 56px 0;
}
.ai-mark {
  color: var(--ink);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 30px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -.08em;
  text-decoration: none;
}
.hamburger {
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  color: var(--ink);
}
.home-hero {
  padding: 96px 56px 0;
}
.home-hero h1 {
  max-width: 870px;
  margin: 0;
  font-family: anthropicSans, Arial, ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(48px, 5.35vw, 70px);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0;
}
.home-hero h1 span {
  text-decoration-line: underline;
  text-decoration-thickness: .08em;
  text-underline-offset: .05em;
}
.home-hero p {
  max-width: 600px;
  margin: 10px 0 0;
  font-family: anthropicSerif, Georgia, "Times New Roman", serif;
  font-size: 24px;
  line-height: 33.6px;
  font-weight: 400;
}
.hero-visual {
  margin: 100px 56px 0;
  min-height: 360px;
  border-radius: 24px 24px 0 0;
  background: #0f0f0e;
}
```

Responsive:

```css
@media (max-width: 760px) {
  .home-nav { padding-inline: 24px; }
  .home-hero { padding: 72px 24px 0; }
  .home-hero h1 { font-size: 42px; line-height: 1.05; }
  .home-hero p { font-size: 21px; line-height: 30px; }
  .hero-visual { margin: 72px 24px 0; min-height: 280px; }
}
```

Key CSS:

```css
.docs-topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--line);
  background: var(--ivory);
}
.docs-brand {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  color: var(--ink-docs);
  font-size: 26px;
}
.brand-serif {
  font-family: anthropicSerif, Georgia, "Times New Roman", serif;
  font-weight: 500;
}
.sunburst {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, var(--clay-docs) 0 9deg, transparent 9deg 18deg);
  position: relative;
}
.sunburst::after {
  content: "";
  position: absolute;
  inset: 7px;
  border-radius: 50%;
  background: var(--ivory);
}
.browse-row {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--line);
  color: var(--muted-docs);
  font-size: 14px;
}
.docs-shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 64px 20px 120px;
}
.docs-hero {
  display: grid;
  grid-template-columns: minmax(320px, 438px) minmax(420px, 1fr);
  gap: 64px;
  align-items: center;
}
.docs-hero h1 {
  margin: 24px 0 20px;
  font-family: anthropicSerif, Georgia, "Times New Roman", serif;
  font-size: 52px;
  line-height: 57px;
  font-weight: 300;
}
.docs-hero .lead {
  color: var(--muted-docs);
  font-family: anthropicSerif, Georgia, "Times New Roman", serif;
  font-size: 18px;
  line-height: 29px;
}
.docs-search {
  height: 39px;
  border: .5px solid rgba(31,30,29,.3);
  border-radius: 8px;
  background: var(--white);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  color: var(--muted-docs);
}
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.quick-action {
  height: 37px;
  border: .5px solid rgba(31,30,29,.3);
  border-radius: 8px;
  background: var(--white);
  padding: 0 16px;
  color: var(--ink-2);
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}
.code-card {
  background: var(--white);
  border: .5px solid rgba(31,30,29,.3);
  border-radius: 8px;
  overflow: hidden;
}
.code-tabs {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  color: var(--muted-docs);
  font-size: 12px;
}
.code-tabs span:first-child {
  color: var(--ink);
  background: var(--ivory-3);
  border-radius: 6px;
  padding: 4px 10px;
}
.code-card pre {
  margin: 0;
  padding: 22px 18px;
  color: var(--ink-docs);
  font-size: 14px;
  line-height: 20px;
  overflow: auto;
}
.eyebrow {
  color: var(--clay-docs);
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.ask-docs {
  position: fixed;
  right: 24px;
  bottom: 24px;
  height: 48px;
  border: 0;
  border-radius: 999px;
  background: var(--black);
  color: var(--white);
  padding: 0 18px;
  font-size: 16px;
}
```

Responsive:

```css
@media (max-width: 820px) {
  .docs-actions .hide-mobile { display: none; }
  .docs-brand { font-size: 22px; }
  .docs-shell { padding-top: 40px; }
  .docs-hero { grid-template-columns: 1fr; gap: 36px; }
  .docs-hero h1 { font-size: 44px; line-height: 48px; }
  .code-card { min-width: 0; }
}
```

## Main Site / Product Shared Components

- Marketing shell: `max-width: 1160px`, gutters `32px`, mobile `20px`.
- Product hero: centered, max text width `900px`, `padding: 88px 0 96px`.
- Article shell: hero max width `900px`, body max width `640px`.
- Newsroom: list rows use `border-top: 1px solid var(--line)`, featured cards use media with `12px` radius.

## Visual QA Method

Use side-by-side comparison:

1. Open official reference and generated page at the same viewport.
2. Compare first viewport only before scrolling.
3. Fix in this order: canvas color, nav/header height, H1 family/weight/size, section width, visual asset size, border/radius treatment, muted text color.
4. Then scroll and check section rhythm, footer, mobile behavior.

## Enterprise Deliverable Expectations

An implementation using this skill should include:

- Componentized CSS classes or design tokens, not one-off inline styling.
- Responsive states for desktop and mobile.
- A credible primary visual.
- Accessible labels for icon-only controls.
- No external brand assets copied from Anthropic unless the user has supplied or authorized them; recreate approximate wordmarks and illustrations with CSS/text when needed.
