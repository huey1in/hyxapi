# Anthropic Web Style System Reference

This reference distills observed patterns from Anthropic's official home page, newsroom, article pages, Claude Code product page, and Claude API Docs surfaces as of May 29, 2026.

## Color Tokens

Use a warm ivory paper system:

```css
:root {
  --ivory: #faf9f5;       /* body canvas */
  --ivory-wrap: #f0eee6;  /* homepage outer page wrap */
  --ivory-2: #f5f4ed;     /* section panels */
  --ivory-3: #e8e6dc;     /* muted cards, media backgrounds */
  --line: #dedbd0;
  --line-strong: #cfcbbf;
  --ink: #141413;
  --ink-2: #30302e;
  --muted: #5e5d59;
  --muted-2: #73726c;
  --faint: #b0aea5;
  --black: #0f0f0e;
  --clay: #c8785b;
  --clay-dark: #a65f49;
  --pale-blue: #d7e0e7;
}
```

Avoid pure white except tiny UI surfaces. Avoid saturated blue/purple gradients. The default impression should be paper, ink, rules, and one warm accent.

## Typography

Anthropic uses custom Anthropic Sans and Anthropic Serif. Approximate them:

```css
body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
}

.serif {
  font-family: "Times New Roman", Georgia, "Iowan Old Style", serif;
  font-weight: 500;
}
```

Scale:

- Product hero serif: `clamp(48px, 7vw, 74px)`, line-height `.98-1.08`, weight `500`.
- Homepage mission sans: `clamp(44px, 6vw, 70px)`, line-height `.95-1.05`, weight `750-800`.
- Current homepage at `~977px` viewport: H1 about `52px`, line-height `57px`, weight `700`, max width `866px`, x offset `56px`, y offset `181px`.
- Homepage lead paragraph: `24px` serif, line-height `33.6px`, max width `590-600px`, x offset `56px`.
- Section heading serif: `44-54px`, line-height `1.1-1.2`, weight `500`.
- News/article H1 sans: `32px`, line-height `1.1`, weight `700`.
- Article H2 sans: `23px`, line-height `1.2`, weight `600`.
- Article body serif: `17px`, line-height `26-27px`, weight `400`, width `640px`.
- Product body sans: `18-22px`, line-height `1.45-1.55`, muted.
- Metadata/captions: `12px`, line-height `16-20px`, weight `600-700`.
- Docs home H1: `52px`, line-height `57px`, serif, weight `300`.
- Docs section heading: `28px`, line-height `36px`, serif, weight `500`.
- Docs card heading: `18px` sans weight `600` or `24px` serif weight `500`.
- Docs body: `14-16px` sans, muted `#73726c`, line-height `22.75-26px`.
- Docs code: `14px` mono, line-height `20px`.

Do not use negative letter spacing. Do not use giant display type inside compact cards.

## Navigation

Official Anthropic pages:

- Homepage mobile/tablet-ish header is very sparse: AI monogram at `56px` from left, hamburger at right, no visible nav links in the first viewport.
- Desktop/full nav height around `72px`.
- Left black "AI" monogram or simple wordmark.
- Links: `Research`, `Economic Futures`, `Commitments`, `Learn`, `News`.
- Right CTA: black `Try Claude`, sometimes split with chevron.
- Background is the same ivory as the page.
- Border-bottom is subtle or absent on home hero, present on product subnavs.

Claude product pages:

- Claude sunburst/wordmark at left.
- Right `Contact sales` secondary button and black `Try Claude` button.
- Secondary subnav row with product name left and `Explore here` right.
- Mobile uses a simple hamburger icon.

Claude API Docs:

- Header height about `56px`, ivory background, bottom border `#dedbd0`.
- Left wordmark reads like "Claude API Docs": small clay sunburst, black serif Claude, sans/API Docs continuation.
- Top right actions are icons first: search, overflow/menu; desktop may include API reference, Console, Log in.
- A second browse row can sit under the header: `Browse` with chevron, height about `40px`, border-bottom.
- The page may omit the full marketing nav; docs prioritize search and wayfinding.

## Buttons

```css
.btn-primary {
  background: var(--black);
  color: var(--ivory);
  border: 1px solid var(--black);
  border-radius: 8px;
  min-height: 40px;
  padding: 0 18px;
  font-size: 15px;
}

.btn-secondary {
  background: rgba(250,249,245,.7);
  color: var(--ink-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-height: 40px;
  padding: 0 18px;
}
```

Use small chevrons for dropdowns. Do not make every inline link look like a button.

Docs buttons:

- Quick action pills are white or ivory with `0.5px` gray border, `6-8px` radius, `37px` height, `14px` sans.
- Primary login/console buttons are compact, not marketing-sized.
- Floating `Ask Docs` uses black fill, white text, `999px` radius, and a book/chat icon.

## Hero Patterns

Homepage:

- Left/top aligned, max width about `900px`.
- Huge sans heading, black, with selective underline on important words.
- Short serif paragraph under it.
- Large dark or illustrated rectangular panel below the fold hint.
- Canvas: outer `#f0eee6`, inner/main `#faf9f5`.
- First viewport spacing at `~977px`: logo top `20px`, H1 top `175-185px`, lead top `305px`, visual block top `500px`.
- H1 underline is thick and close to the baseline, only on semantic words such as `research` and `products`.
- Primary visual block can be a near-black rectangle with `24px` top radius, width roughly calc(100% - 112px), left aligned at `56px`.

Product:

- Centered.
- Small status pill above: ivory/white-ish surface, border, maybe clay star/spark.
- Serif H1 with one clay-accented word or symbol.
- Muted sans subheadline max width `850-900px`.
- Command/CTA bar beneath: black CTA plus monospace command.
- Logo row under hero.

Article:

- Centered category, title, date.
- Large rounded hero image/panel width `~90%`, radius `12px`.
- Body begins below in a narrow column.

Docs home:

- Two-column first viewport.
- Left: product eyebrow, light serif H1, serif or sans muted lead paragraph, search bar, quick action buttons.
- Right: code card with tab strip and syntax-colored code.
- Below: small uppercase clay eyebrow, serif section headings, developer-surface cards and lifecycle lists.
- A floating Ask Docs bubble appears bottom-right on desktop.

## Cards, Grids, And Lists

Cards:

- Background `#faf9f5`, `#f5f4ed`, or `#e8e6dc`.
- Border `1px solid var(--line)`.
- Radius `8px` for cards, `12px` for large media.
- Minimal or no shadow. If needed: `0 1px 2px rgba(20,20,19,.06)`.
- Pricing cards are narrow columns with serif plan names, muted body, bold price.

Docs cards and code:

- Cards can use white surfaces on ivory, `0.5-1px` border, `8px` radius.
- Code card uses white background, border `rgba(31,30,29,.3)`, radius `8px`.
- Tab strip is compact; active tab has a beige chip background.
- Code syntax colors remain restrained: ink, muted clay/brown, muted blue-gray.
- Sidebar and TOC links are `14px`, muted until active, with active white chip or subtle left rule.

Newsroom:

- Use horizontal rules between contact rows and article list items.
- Featured articles can be a two-column image grid, with large rounded media.
- Metadata category/date is small and sans.
- Article excerpts often use serif.

Article body:

- `max-width: 640px`.
- Body paragraphs serif, generous vertical rhythm.
- Section headings sans and compact.
- Links underlined, ink color.

## Imagery

To mimic official pages, include at least one visual:

- Editorial abstract panels: clay, beige, pale blue, black hand-drawn strokes, paper-grid texture.
- Product panels: terminal mockups, code command bars, UI screenshots, partner logos.
- Avoid glossy 3D, stock photos, neon AI brain art, dark cyberpunk motifs, and decorative gradient blobs.

For built-in CSS illustration, use simple shapes:

- `background: #ded7ca` or `#cf795f`.
- black `2-4px` line strokes.
- off-white geometric cutouts.
- radius `12px`.

For docs pages, a code card is a valid primary visual. It must be visually substantial and sit in the first viewport.

## Footer

Footer is often dark:

- Background `#0f0f0e`.
- Text `#faf9f5`, muted labels `#b0aea5`.
- Multi-column link lists.
- Category labels small and bold.
- Links compact, no heavy decoration.

## Anti-Patterns

- White SaaS dashboard aesthetic.
- Purple/blue gradient hero.
- Oversized rounded cards nested in larger rounded cards.
- Heavy drop shadows, glassmorphism, floating orb backgrounds.
- Marketing-copy overload, exclamation marks, emoji, or gamified motion.
- Too many accent colors. Clay should be rare.
- Purely text-only pages. Anthropic pages usually have a strong editorial or product visual.
- Docs pages that look like generic Tailwind docs: pure white body, blue links everywhere, oversized sidebars, or dense gray chrome.

## QA Checklist

- First viewport reads as Anthropic or Claude without needing the URL.
- For homepage work, first viewport must match the official homepage composition: AI monogram, hamburger/sparse nav, huge underlined H1, 24px serif paragraph, and a large black/editorial block starting around the lower third.
- Background is warm ivory, not white.
- Typography pairs a strong serif or compact black sans headline with restrained body text.
- Nav is sparse and official.
- Buttons are black/ivory with 8px radius.
- Rules and spacing create structure; shadows do not.
- Mobile keeps generous whitespace and does not crowd nav or hero text.
- There is at least one credible editorial/product visual.
- Docs pages include docs-specific wayfinding: Browse row, search, quick actions, code card, and Ask Docs affordance when appropriate.
