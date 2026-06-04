---
name: anthropic-web-style
description: "Use this skill when creating, redesigning, or critiquing web pages that should closely match Anthropic's official homepage and main website style: AI monogram, warm ivory editorial canvas, oversized black mission headlines with underline emphasis, serif explanatory copy, sparse navigation, large black or editorial visual blocks, newsroom/release sections, Claude product pages, research articles, or docs-like developer pages."
---

# Anthropic Web Style

## Purpose

Create production-quality web pages that feel plausibly native to Anthropic's official homepage and main web ecosystem: warm ivory editorial canvas, AI monogram, huge black sans mission statements with selective underlines, serif explanatory copy, sparse navigation, large black/editorial visual blocks, thin rules, and restrained release/news sections.

This is an enterprise-grade style skill. Use it for implementation, critique, visual QA, and iteration until the result can sit beside an official Anthropic page without obvious mismatch.

## Required Resources

Before implementing, read the relevant references:

- `references/style-system.md`: canonical tokens, page archetypes, components, copy rules, and QA checklist.
- `references/implementation-kit.md`: ready-to-use CSS architecture, HTML patterns, responsive behavior, and docs page template guidance.

Use `scripts/audit_anthropic_style.js` after creating HTML/CSS. It reports token and anti-pattern issues that screenshots can miss.

## Operating Procedure

1. Default to the official homepage/main-site archetype unless the user explicitly asks for Claude product, newsroom/list, article/research, docs/developer, or hybrid.
2. Build from the matching component contract in `references/style-system.md`; do not freestyle a generic SaaS page.
3. Use the implementation kit as the baseline CSS language: tokens, typography scale, nav, cards, code blocks, buttons, sidebars, and responsive rules.
4. Include a first-viewport homepage brand signal: AI monogram, ivory canvas, huge black mission headline, underlined keywords, serif paragraph, sparse hamburger/nav, and a strong black/editorial visual block.
5. Run the audit script, then verify in browser at desktop and mobile widths.
6. Compare against the official reference page for the chosen archetype. Fix differences in background, type weight, spacing, nav density, border treatment, and visual tone.

## Non-Negotiables

Start with a warm paper canvas, not pure white:

```css
:root {
  --anthropic-ivory: #faf9f5;
  --anthropic-ivory-2: #f5f4ed;
  --anthropic-ivory-3: #e8e6dc;
  --anthropic-ink: #141413;
  --anthropic-ink-soft: #30302e;
  --anthropic-muted: #5e5d59;
  --anthropic-faint: #b0aea5;
  --anthropic-line: #dedbd0;
  --anthropic-clay: #c8785b;
  --anthropic-black: #0f0f0e;
}
```

- Use Anthropic Sans/Serif names when available, then strong local fallbacks.
- Keep backgrounds warm ivory unless intentionally using the dark footer or a code/terminal panel.
- Use lines and spacing for hierarchy; avoid shadow-heavy card stacks.
- Use accent clay sparingly. Never use purple/blue gradient AI branding.
- Never ship without at least one official-feeling visual: code block, terminal panel, product screenshot mock, editorial illustration, or article hero panel.

## Acceptance Bar

The output is not done until it passes all of these:

- Screenshots at desktop and mobile preserve the Anthropic first impression.
- The page archetype matches its official counterpart, not just the color palette.
- CSS contains the canonical ivory/ink/clay tokens and no dominant unrelated palette.
- Navigation, buttons, cards, code blocks, and typography match measured proportions from the references.
- The audit script reports no high-severity issues, or every issue has a documented reason.
