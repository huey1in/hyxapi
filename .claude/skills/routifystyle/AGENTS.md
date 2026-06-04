# Anthropic Web Style Agent Instructions

Use this package when creating, redesigning, or reviewing web pages that should match Anthropic's official homepage/main-site visual language.

## How To Use

1. Read `SKILL.md` for the operating procedure and acceptance bar.
2. Read `references/style-system.md` for visual tokens, typography, page archetypes, and QA.
3. Read `references/implementation-kit.md` before writing HTML/CSS/React/Tailwind.
4. Run `node scripts/audit_anthropic_style.js <html-or-css-file>` after implementation.
5. Verify screenshots against the relevant official Anthropic page. Default target is the homepage style unless the user asks for product/docs/news/article pages.

## Default Outcome

Build pages that resemble Anthropic's official homepage: warm ivory canvas, AI monogram, sparse nav or hamburger, oversized black mission headline with selective underlines, serif explanatory copy, large black/editorial hero block, restrained release/news sections, and no generic SaaS gloss.

## Important

Do not depend on Codex-specific or Claude-specific behavior. This folder is a portable style/implementation package. Any capable coding agent can follow the files inside it.
