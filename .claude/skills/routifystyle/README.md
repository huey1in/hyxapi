# Anthropic Web Style Portable Skill

Portable style and implementation package for creating web pages that closely match Anthropic's official homepage and main website visual language.

## Works With

- Codex and other coding agents: read `AGENTS.md` or `SKILL.md`
- Claude Code: read `CLAUDE.md`
- General manual use: read `SKILL.md`, then the files in `references/`

## Files

- `SKILL.md` - core skill instructions and acceptance bar
- `AGENTS.md` - generic coding-agent entrypoint
- `CLAUDE.md` - Claude Code entrypoint
- `references/style-system.md` - visual system, archetypes, QA checklist
- `references/implementation-kit.md` - implementation-ready CSS and page patterns
- `scripts/audit_anthropic_style.js` - local audit script for generated HTML/CSS
- `agents/openai.yaml` - optional Codex/OpenAI UI metadata

## Quick Use

```bash
node scripts/audit_anthropic_style.js path/to/page.html
```

Default target is Anthropic's official homepage style: ivory canvas, AI monogram, oversized black mission headline, serif explanation, sparse navigation, and a large black/editorial hero block.
