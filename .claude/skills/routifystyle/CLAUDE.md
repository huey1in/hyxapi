# Anthropic Web Style

Claude Code: use this folder as a portable project instruction package for building Anthropic-like web pages.

## Workflow

- Start with `SKILL.md`.
- Load `references/style-system.md` for the design system.
- Load `references/implementation-kit.md` for implementation-ready CSS and layout patterns.
- After creating or modifying a page, run:

```bash
node scripts/audit_anthropic_style.js <html-or-css-file>
```

## Default Style Target

Prefer Anthropic's official homepage/main-site style unless the task names a different archetype:

- AI monogram
- warm ivory editorial canvas
- huge black sans mission headline
- underlined semantic keywords
- 24px serif explanatory paragraph
- sparse navigation or hamburger
- large black/editorial visual block
- restrained release/news sections

## Acceptance

The result should feel like it could sit beside the official Anthropic homepage. Compare screenshots and iterate on background color, H1 size/weight/wrap, paragraph scale, nav density, hero visual position, borders, spacing, and palette restraint.
