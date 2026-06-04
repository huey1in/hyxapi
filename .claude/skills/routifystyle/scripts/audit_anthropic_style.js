#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
if (!file) {
  console.error("Usage: audit_anthropic_style.js <html-or-css-file>");
  process.exit(2);
}

const text = fs.readFileSync(file, "utf8");
const lower = text.toLowerCase();
const findings = [];

function requireToken(token, label) {
  if (!lower.includes(token.toLowerCase())) {
    findings.push({ severity: "high", message: `Missing ${label} token (${token}).` });
  }
}

function warnIf(pattern, message, severity = "medium") {
  if (pattern.test(lower)) findings.push({ severity, message });
}

requireToken("#faf9f5", "ivory background");
requireToken("#141413", "ink");
requireToken("#dedbd0", "subtle rule");

if (!/(anthropicserif|georgia|times new roman)/i.test(text)) {
  findings.push({ severity: "high", message: "Missing serif stack for Anthropic display/editorial type." });
}
if (!/(anthropicsans|system-ui|inter)/i.test(text)) {
  findings.push({ severity: "high", message: "Missing sans stack for Anthropic UI/body type." });
}
if (!/(anthropicmono|ui-monospace|sfmono|menlo)/i.test(text)) {
  findings.push({ severity: "low", message: "Missing mono stack; required for docs/code surfaces." });
}

warnIf(/linear-gradient|radial-gradient/, "Gradients detected. Anthropic style rarely uses decorative gradients.", "medium");
warnIf(/box-shadow:\s*[^;]*(\d{2,}px|rgba\([^)]*,\s*0\.[2-9])/, "Heavy shadow detected; prefer rules and spacing.", "medium");
const brightColorMatches = lower.match(/#[6-9a-f][0-9a-f]{5}/g) || [];
if (new Set(brightColorMatches).size > 3) {
  findings.push({ severity: "low", message: "Many bright colors detected; keep palette restrained." });
}
warnIf(/letter-spacing:\s*-\d/i, "Negative letter spacing detected; Anthropic pages keep letter spacing at 0 or positive metadata tracking.", "medium");
warnIf(/border-radius:\s*(2[0-9]|[3-9][0-9])px/i, "Large rounded rectangles detected; keep most radii 6-12px except floating Ask Docs.", "medium");

const hasVisual = /(code-card|terminal|hero-image|illustration|visual|pre\s*\{|<pre|<img|svg)/i.test(text);
if (!hasVisual) {
  findings.push({ severity: "high", message: "No credible primary visual found; add code card, terminal, product mock, image, or editorial illustration." });
}

const severityOrder = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

console.log(`Anthropic style audit for ${path.basename(file)}`);
if (!findings.length) {
  console.log("PASS: no issues found.");
  process.exit(0);
}
for (const item of findings) {
  console.log(`${item.severity.toUpperCase()}: ${item.message}`);
}
process.exit(findings.some(f => f.severity === "high") ? 1 : 0);
