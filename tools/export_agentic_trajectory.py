#!/usr/bin/env python3
import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

csv.field_size_limit(sys.maxsize)

TARGET_MODELS = (
    "gpt-5.5",
    "gpt-5.6",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-fable-5",
)

SENSITIVE_KEY_RE = re.compile(
    r"(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|password|passwd|secret|session[_-]?secret|private[_-]?key)",
    re.I,
)
EMAIL_RE = re.compile(r"(?<![\w.+-])([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})(?![\w.-])")
BEARER_RE = re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{16,}", re.I)
OPENAI_KEY_RE = re.compile(r"\b(sk-[A-Za-z0-9_-]{16,}|sk-proj-[A-Za-z0-9_-]{16,})\b")
ANTHROPIC_KEY_RE = re.compile(r"\b(sk-ant-[A-Za-z0-9_-]{16,})\b")
JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
PRIVATE_KEY_RE = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S)


def run_copy_query():
    models_sql = ",".join("'" + m.replace("'", "''") + "'" for m in TARGET_MODELS)
    query = f"""
COPY (
  SELECT id, user_id, token_id, created_at, use_time, model_name, request_id,
         "group", prompt_tokens, completion_tokens, quota, other
  FROM logs
  WHERE type = 2
    AND model_name IN ({models_sql})
    AND strpos(other, '"request_body"') > 0
    AND strpos(other, '"response_body"') > 0
  ORDER BY id ASC
) TO STDOUT WITH CSV HEADER
"""
    return subprocess.Popen(
        ["docker", "exec", "-i", "postgres", "psql", "-U", "root", "-d", "new-api", "-c", query],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def provider_for(model):
    if model.startswith("claude-"):
        return "anthropic"
    if model.startswith("gpt-"):
        return "openai"
    if model.startswith("gemini-"):
        return "google"
    return "openai_compatible"


def parse_json_maybe(value):
    if not isinstance(value, str) or not value:
        raise ValueError("empty json string")
    return json.loads(value)


def walk_find(obj, key_names):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in key_names and isinstance(v, (str, int, float)) and str(v):
                return str(v)
        for v in obj.values():
            found = walk_find(v, key_names)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = walk_find(v, key_names)
            if found:
                return found
    return ""


def derive_session(row, request):
    candidates = (
        (walk_find(request, {"session_id"}), "request.session_id"),
        (walk_find(request, {"conversation_id"}), "request.conversation_id"),
        (walk_find(request, {"user_id"}), "request.user_id"),
        (walk_find(request, {"prompt_cache_key"}), "request.prompt_cache_key"),
    )
    for value, source in candidates:
        if value:
            return value, source
    raw = f"{row['user_id']}:{row['token_id']}:{row['model_name']}:{row['group']}"
    return "derived_" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32], "derived:user_token_model_group"


def redact_string(value, stats):
    original = value
    value = PRIVATE_KEY_RE.sub("<REDACTED_PRIVATE_KEY>", value)
    value = BEARER_RE.sub("Bearer <REDACTED_TOKEN>", value)
    value = OPENAI_KEY_RE.sub("<REDACTED_API_KEY>", value)
    value = ANTHROPIC_KEY_RE.sub("<REDACTED_API_KEY>", value)
    value = JWT_RE.sub("<REDACTED_TOKEN>", value)
    value = PHONE_RE.sub("<REDACTED_PHONE>", value)

    def email_repl(match):
        return "<REDACTED_EMAIL>@" + match.group(2)

    value = EMAIL_RE.sub(email_repl, value)
    if value != original:
        stats["redacted_string_values"] += 1
    return value


def redact(obj, stats):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if SENSITIVE_KEY_RE.search(str(k)):
                if isinstance(v, str) and v:
                    out[k] = "<REDACTED_SECRET>"
                    stats["redacted_sensitive_fields"] += 1
                else:
                    out[k] = v
                continue
            out[k] = redact(v, stats)
        return out
    if isinstance(obj, list):
        return [redact(v, stats) for v in obj]
    if isinstance(obj, str):
        return redact_string(obj, stats)
    return obj


def has_tool_reference(obj):
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return "tool_calls" in text or "tool_use" in text or '"role":"tool"' in text or "functionCall" in text


def has_thinking_reference(obj):
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return "thinking" in text or "reasoning" in text or "signature" in text


def build_record(row, other, request, response, redaction_stats):
    created_at = int(row["created_at"])
    use_time = int(row["use_time"] or 0)
    model = row["model_name"]
    session_id, session_source = derive_session(row, request)
    request_time = created_at * 1000
    response_time = request_time + max(use_time, 0)
    ts = datetime.fromtimestamp(created_at, timezone.utc).isoformat().replace("+00:00", "Z")
    request_redacted = redact(request, redaction_stats)
    response_redacted = redact(response, redaction_stats)
    return {
        "session_id": session_id,
        "request_id": row["request_id"],
        "provider": provider_for(model),
        "model": model,
        "timestamp": ts,
        "request_time": request_time,
        "response_time": response_time,
        "thinking_effort": other.get("reasoning_effort") or walk_find(request, {"thinking_effort", "reasoning_effort"}),
        "request": request_redacted,
        "response": response_redacted,
        "meta": {
            "source": "hyxapi.logs",
            "source_log_id": int(row["id"]),
            "user_id_hash": hashlib.sha256(str(row["user_id"]).encode()).hexdigest()[:16],
            "token_id_hash": hashlib.sha256(str(row["token_id"]).encode()).hexdigest()[:16],
            "group": row["group"],
            "session_id_source": session_source,
            "prompt_tokens": int(row["prompt_tokens"] or 0),
            "completion_tokens": int(row["completion_tokens"] or 0),
            "quota": int(row["quota"] or 0),
            "cache_tokens": other.get("cache_tokens"),
            "cache_ratio": other.get("cache_ratio"),
            "has_tools": has_tool_reference(request) or has_tool_reference(response),
            "has_thinking_or_signature": has_thinking_reference(request) or has_thinking_reference(response),
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="exports/agentic_trajectory_20260728")
    args = parser.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)

    data_path = os.path.join(args.out_dir, "agentic_trajectory.jsonl.gz")
    reject_path = os.path.join(args.out_dir, "reject_samples.jsonl")
    proc = run_copy_query()
    text = io.TextIOWrapper(proc.stdout, encoding="utf-8", newline="")
    reader = csv.DictReader(text)

    stats = Counter()
    by_model = defaultdict(Counter)
    by_group = defaultdict(Counter)
    sessions = set()
    request_ids = set()
    duplicate_ids = set()
    session_sources = Counter()
    redaction_stats = Counter()
    reject_samples_written = 0
    min_ts = None
    max_ts = None

    with gzip.open(data_path, "wt", encoding="utf-8", compresslevel=6) as out, open(reject_path, "w", encoding="utf-8") as rej:
        for row in reader:
            stats["scanned_candidates"] += 1
            model = row["model_name"]
            group = row["group"]
            rid = row["request_id"]
            if not rid:
                stats["reject_missing_request_id"] += 1
                continue
            if rid in request_ids:
                duplicate_ids.add(rid)
                stats["reject_duplicate_request_id"] += 1
                continue
            request_ids.add(rid)

            try:
                other = parse_json_maybe(row["other"])
            except Exception as exc:
                stats["reject_other_json_parse"] += 1
                reason = f"other_json_parse:{exc}"
                if reject_samples_written < 200:
                    rej.write(json.dumps({"id": row["id"], "request_id": rid, "reason": reason}, ensure_ascii=False) + "\n")
                    reject_samples_written += 1
                continue

            try:
                request = parse_json_maybe(other.get("request_body", ""))
            except Exception as exc:
                stats["reject_request_json_parse"] += 1
                if reject_samples_written < 200:
                    rej.write(json.dumps({"id": row["id"], "request_id": rid, "reason": f"request_json_parse:{exc}"}, ensure_ascii=False) + "\n")
                    reject_samples_written += 1
                continue

            try:
                response = parse_json_maybe(other.get("response_body", ""))
            except Exception as exc:
                stats["reject_response_json_parse"] += 1
                if reject_samples_written < 200:
                    rej.write(json.dumps({"id": row["id"], "request_id": rid, "reason": f"response_json_parse:{exc}"}, ensure_ascii=False) + "\n")
                    reject_samples_written += 1
                continue

            if "model" not in request:
                stats["reject_request_missing_model"] += 1
                continue

            record = build_record(row, other, request, response, redaction_stats)
            sessions.add(record["session_id"])
            session_sources[record["meta"]["session_id_source"]] += 1
            by_model[model]["accepted"] += 1
            by_group[group]["accepted"] += 1
            if record["meta"]["has_tools"]:
                stats["accepted_has_tools"] += 1
                by_model[model]["has_tools"] += 1
            if record["meta"]["has_thinking_or_signature"]:
                stats["accepted_has_thinking_or_signature"] += 1
                by_model[model]["has_thinking_or_signature"] += 1
            created_at = int(row["created_at"])
            min_ts = created_at if min_ts is None else min(min_ts, created_at)
            max_ts = created_at if max_ts is None else max(max_ts, created_at)
            stats["accepted"] += 1
            out.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")

    stderr = proc.stderr.read().decode("utf-8", "replace")
    rc = proc.wait()
    if rc != 0:
        print(stderr, file=sys.stderr)
        return rc

    total = stats["scanned_candidates"]
    accepted = stats["accepted"]
    manifest = {
        "batch_id": "hyxapi_agentic_trajectory_20260728",
        "supplier": "hyxapi",
        "delivery_date": "2026-07-28",
        "format": "jsonl.gz",
        "encoding": "UTF-8",
        "models": list(TARGET_MODELS),
        "providers": ["openai", "anthropic"],
        "time_range": {
            "start": datetime.fromtimestamp(min_ts, timezone.utc).isoformat().replace("+00:00", "Z") if min_ts else None,
            "end": datetime.fromtimestamp(max_ts, timezone.utc).isoformat().replace("+00:00", "Z") if max_ts else None,
        },
        "total_records": accepted,
        "total_sessions": len(sessions),
        "pii_redacted": True,
        "files": {
            "data": os.path.basename(data_path),
            "self_check": "self_check_report.json",
            "reject_samples": os.path.basename(reject_path),
        },
    }
    self_check = {
        "input_candidates": total,
        "accepted_records": accepted,
        "rejected_records": total - accepted,
        "accept_rate": accepted / total if total else 0,
        "request_response_complete_rate": accepted / total if total else 0,
        "request_id_unique_rate_after_filter": accepted / (accepted + stats["reject_duplicate_request_id"]) if accepted else 0,
        "total_sessions": len(sessions),
        "session_sources": dict(session_sources),
        "duplicate_request_ids": len(duplicate_ids),
        "stats": dict(stats),
        "redaction": dict(redaction_stats),
        "by_model": {k: dict(v) for k, v in sorted(by_model.items())},
        "by_group": {k: dict(v) for k, v in sorted(by_group.items())},
        "standard_assessment": {
            "errors_filtered": True,
            "json_parse_required": True,
            "request_response_required": True,
            "request_id_deduped": True,
            "strict_batch_pass": False,
            "strict_batch_pass_reason": "session_id mostly derived and full batch request/response completeness was below 99% before filtering; this package is a best-effort accepted subset, not a strict pass certificate.",
        },
    }
    with open(os.path.join(args.out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    with open(os.path.join(args.out_dir, "self_check_report.json"), "w", encoding="utf-8") as f:
        json.dump(self_check, f, ensure_ascii=False, indent=2)
    with open(os.path.join(args.out_dir, "README.md"), "w", encoding="utf-8") as f:
        f.write("# HyxAPI Agentic Trajectory Export\n\n")
        f.write("This package filters `logs.type = 2` successful consumption records only.\n\n")
        f.write(f"- accepted records: {accepted}\n")
        f.write(f"- sessions: {len(sessions)}\n")
        f.write(f"- input candidates with request/response fields: {total}\n")
        f.write("- strict batch pass: false\n")
        f.write("- reason: many records require derived session_id; full target batch response coverage was below the 99% standard before subset filtering.\n")

    print(json.dumps({"out_dir": args.out_dir, "accepted": accepted, "sessions": len(sessions), "input_candidates": total}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
