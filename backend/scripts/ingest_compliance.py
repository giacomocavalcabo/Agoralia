import os
import re
import json
import csv
from datetime import datetime
from typing import Any, Optional

# Optional SQLAlchemy import; skip DB upsert if unavailable
try:  # pragma: no cover
    from sqlalchemy import (
        create_engine, MetaData, Table, Column, String, JSON, Boolean, Date, Text
    )
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.engine import Engine
    HAVE_SQLA = True
except Exception:  # pragma: no cover
    Engine = Any  # type: ignore
    HAVE_SQLA = False


CONTENT_REF_RE = re.compile(r"contentReference\[[^\]]+\]\{index=[^}]+\}")

def remove_content_refs(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    return CONTENT_REF_RE.sub("", str(text)).strip() or None


def norm_bool_enum(value: Optional[str], mapping: dict[str, str]) -> Optional[str]:
    if value is None:
        return None
    v = str(value).strip().lower()
    v = v.replace(" ", "_").replace("-", "_")
    return mapping.get(v, mapping.get("unknown"))


def parse_confidence(value: Optional[str | float | int]) -> tuple[str, Optional[float]]:
    if value is None:
        return ("low", None)
    if isinstance(value, (int, float)):
        score = max(0.0, min(1.0, float(value)))
        label = "high" if score >= 0.8 else "medium" if score >= 0.5 else "low"
        return (label, score)
    v = str(value).strip().lower()
    if v in ("low", "medium", "high"):
        return (v, None)
    # try parse like "high:0.9"
    if ":" in v:
        p, s = v.split(":", 1)
        try:
            return (p, max(0.0, min(1.0, float(s))))
        except Exception:
            return (p, None)
    return ("low", None)


def parse_date_iso(value: Optional[str]) -> Optional[str]:
    if not value or str(value).strip().lower() in ("not specified", "n/a", "na", "none", "null", ""):
        return None
    v = str(value).strip()
    # Try several common formats
    fmts = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%Y.%m.%d"]
    for f in fmts:
        try:
            dt = datetime.strptime(v, f)
            return dt.strftime("%Y-%m-%d")
        except Exception:
            continue
    # ISO passthrough
    try:
        return datetime.fromisoformat(v).date().isoformat()
    except Exception:
        return None


def parse_quiet_hours(value: Optional[str | dict]) -> Optional[dict]:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    s = str(value).strip()
    if not s or s.lower() in ("not specified", "n/a", "none", "null"):
        return None
    # normalize punctuation
    s = s.replace("–", "-").replace("—", "-")
    s = s.replace(" & ", "/")
    # Try JSON first
    if s.startswith("{"):
        try:
            obj = json.loads(s)
            return obj
        except Exception:
            pass
    # Try patterns like "Mon-Fri 10:00-13:00/14:00-20:00; Sat -; Sun -"
    days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    out: dict[str, list[list[str]]] = {d: [] for d in days}
    # Support compact example: "Mon-Fri 10-13/14-20"
    chunks = re.split(r";|\n|,", s)
    for ch in chunks:
        ch = ch.strip()
        if not ch:
            continue
        m = re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:-(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?\s+(.+)$", ch)
        if not m:
            # fallback: a single range assumed Mon-Fri
            rngs = ch
            targets = ("Mon", "Tue", "Wed", "Thu", "Fri")
        else:
            d1, d2, rngs = m.group(1), m.group(2), m.group(3)
            # strip any parenthetical qualifiers before times
            rngs = re.sub(r"\([^)]*\)", " ", rngs)
            if d2:
                seq = days[days.index(d1): days.index(d2)+1]
            else:
                seq = [d1]
            targets = tuple(seq)
        for r in re.split(r"/|,", rngs):
            r = r.strip()
            if not r or r in ("-", "—"):
                continue
            # Accept 10-13 or 10:00-13:00
            mm = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$", r)
            if not mm:
                continue
            sh, sm, eh, em = mm.group(1), (mm.group(2) or "00"), mm.group(3), (mm.group(4) or "00")
            start = f"{int(sh):02d}:{int(sm):02d}"
            end = f"{int(eh):02d}:{int(em):02d}"
            for d in targets:
                out[d].append([start, end])
    # Compact Mon-Fri if contiguous same windows
    def compact(df: dict[str, list[list[str]]]) -> dict:
        # If Mon-Fri identical arrays, move to key "Mon-Fri"
        mf = [df[d] for d in days[:5]]
        if all(x == mf[0] for x in mf):
            return {"Mon-Fri": mf[0], "Sat": df["Sat"], "Sun": df["Sun"]}
        return df
    return compact(out)


def compute_flags(row: dict, dnc_list: list[dict], exceptions: list[dict]) -> dict:
    regime_b2c = (row.get("regime_b2c") or "").lower()
    regime_b2b = (row.get("regime_b2b") or "").lower()
    ai_disclosure = (row.get("ai_disclosure") or "").lower()
    recording_basis = (row.get("recording_basis") or "").lower()
    quiet_hours = row.get("quiet_hours")
    ex_codes = {e.get("code"): e.get("value") for e in exceptions}
    requires_consent_b2c = regime_b2c == "opt-in"
    requires_consent_b2b = regime_b2b == "opt-in"
    # Require DNC scrub only if explicitly mandated by the source (non-restrictive default)
    requires_dnc_scrub = any(bool(d.get("check_required_for_er")) for d in (dnc_list or []))
    automated_banned = bool(ex_codes.get("AUTOMATED_BANNED") is True)
    allows_automated = (ai_disclosure != "required") and (not automated_banned)
    recording_requires_consent = recording_basis == "consent"
    has_quiet_hours = bool(quiet_hours)
    return {
        "requires_consent_b2c": requires_consent_b2c,
        "requires_consent_b2b": requires_consent_b2b,
        "requires_dnc_scrub": requires_dnc_scrub,
        "allows_automated": allows_automated,
        "recording_requires_consent": recording_requires_consent,
        "has_quiet_hours": has_quiet_hours,
    }


def quality_checks(rec: dict) -> list[str]:
    errs: list[str] = []
    iso = rec.get("iso")
    if not iso or not isinstance(iso, str) or len(iso) != 2 or not iso.isalpha():
        errs.append("invalid_iso")
    if not rec.get("regime_b2c") or not rec.get("regime_b2b"):
        errs.append("missing_regime")
    if not rec.get("last_verified"):
        errs.append("missing_last_verified")
    flags = rec.get("flags") or {}
    if flags.get("requires_dnc_scrub") and not rec.get("dnc"):
        errs.append("dnc_required_missing")
    if flags.get("has_quiet_hours") and not rec.get("quiet_hours"):
        errs.append("quiet_hours_missing")
    # invalid urls
    for d in rec.get("dnc", []):
        if CONTENT_REF_RE.search(str(d.get("url") or "")):
            errs.append("bad_url_dnc")
    for s in rec.get("sources", []):
        if CONTENT_REF_RE.search(str(s.get("url") or "")):
            errs.append("bad_url_source")
    return errs


def ensure_db(engine: Engine) -> dict[str, Any]:
    if not HAVE_SQLA:
        return {}
    metadata = MetaData()
    compliance_country = Table(
        "compliance_country", metadata,
        Column("iso", String(2), primary_key=True),
        Column("country", String(80)),
        Column("regime_b2c", String(16), nullable=False),
        Column("regime_b2b", String(16), nullable=False),
        Column("quiet_hours", JSON().with_variant(JSONB, "postgresql"), nullable=True),
        Column("ai_disclosure", String(16), nullable=True),
        Column("recording_basis", String(32), nullable=True),
        Column("callerid_rules", Text, nullable=True),
        Column("recent_changes", Text, nullable=True),
        Column("last_verified", Date, nullable=True),
        Column("confidence", String(8), nullable=True),
        Column("confidence_score", String(16), nullable=True),
        Column("flags", JSON().with_variant(JSONB, "postgresql"), nullable=True),
    )
    dnc_registry = Table(
        "dnc_registry", metadata,
        Column("iso", String(2), index=True),
        Column("name", String(200)),
        Column("url", String(500)),
        Column("access", String(16)),
        Column("check_required_for_er", Boolean, default=False),
    )
    compliance_exception = Table(
        "compliance_exception", metadata,
        Column("iso", String(2), index=True),
        Column("code", String(64)),
        Column("value", String(500)),
    )
    compliance_source = Table(
        "compliance_source", metadata,
        Column("iso", String(2), index=True),
        Column("title", String(300)),
        Column("url", String(500)),
        Column("updated", Date, nullable=True),
    )
    metadata.create_all(engine)
    return {
        "country": compliance_country,
        "dnc": dnc_registry,
        "exception": compliance_exception,
        "source": compliance_source,
    }


def upsert(engine: Engine, tables: dict[str, Any], rec: dict) -> None:
    if not HAVE_SQLA or not tables:
        return
    # country
    with engine.begin() as conn:
        ctbl = tables["country"]
        exists = conn.execute(ctbl.select().where(ctbl.c.iso == rec["iso"]).limit(1)).fetchone()
        payload = {
            "iso": rec["iso"],
            "country": rec.get("country"),
            "regime_b2c": rec.get("regime_b2c"),
            "regime_b2b": rec.get("regime_b2b"),
            "quiet_hours": rec.get("quiet_hours"),
            "ai_disclosure": rec.get("ai_disclosure"),
            "recording_basis": rec.get("recording_basis"),
            "callerid_rules": rec.get("callerid_rules"),
            "recent_changes": rec.get("recent_changes"),
            "last_verified": datetime.fromisoformat(rec["last_verified"]).date() if rec.get("last_verified") else None,
            "confidence": rec.get("confidence"),
            "confidence_score": str(rec.get("confidence_score")) if rec.get("confidence_score") is not None else None,
            "flags": rec.get("flags"),
        }
        if exists:
            conn.execute(ctbl.update().where(ctbl.c.iso == rec["iso"]).values(**payload))
        else:
            conn.execute(ctbl.insert().values(**payload))

        # clear children
        for tbl_key in ("dnc", "exception", "source"):
            tbl = tables[tbl_key]
            conn.execute(tbl.delete().where(tbl.c.iso == rec["iso"]))

        # insert children
        for d in rec.get("dnc", [])[:5]:
            conn.execute(tables["dnc"].insert().values(
                iso=rec["iso"], name=d.get("name"), url=d.get("url"), access=d.get("access"),
                check_required_for_er=bool(d.get("check_required_for_er"))
            ))
        for e in rec.get("exceptions", [])[:20]:
            conn.execute(tables["exception"].insert().values(
                iso=rec["iso"], code=e.get("code"), value=str(e.get("value"))
            ))
        for s in rec.get("sources", [])[:3]:
            conn.execute(tables["source"].insert().values(
                iso=rec["iso"], title=s.get("title"), url=s.get("url"),
                updated=(datetime.fromisoformat(s.get("updated")).date() if s.get("updated") else None)
            ))


def load_raw_records(raw_dir: str) -> list[dict]:
    records: list[dict] = []
    # Prefer JSON files if present, then CSV
    for fname in sorted(os.listdir(raw_dir)):
        path = os.path.join(raw_dir, fname)
        if not os.path.isfile(path):
            continue
        if fname.lower().endswith(".json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    records.extend(data)
                elif isinstance(data, dict) and data.get("items"):
                    records.extend(data["items"]) 
        elif fname.lower().endswith(".csv"):
            with open(path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(row)
    return records


def _parse_regime(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    s = str(val).strip().lower()
    if "opt-in" in s or "opt_in" in s or "opt in" in s:
        return "opt-in"
    if "opt-out" in s or "opt_out" in s or "opt out" in s:
        return "opt-out"
    return None


def transform(raw: dict) -> dict:
    # Column mapping guess; accept flexible inputs
    iso = (raw.get("ISO2") or raw.get("iso2") or raw.get("ISO") or raw.get("iso") or raw.get("country_iso") or "").strip().upper()
    country = (raw.get("Country") or raw.get("country") or raw.get("name") or raw.get("countryName") or "").strip()

    b2c = _parse_regime(
        raw.get("regime_b2c") or raw.get("B2C_Regime") or raw.get("opt_in_or_out_B2C") or raw.get("optInOrOutB2C") or raw.get("regime_b2c_raw")
    ) or "opt-out"
    b2b = _parse_regime(
        raw.get("regime_b2b") or raw.get("B2B_Regime") or raw.get("opt_in_or_out_B2B") or raw.get("optInOrOutB2B") or raw.get("regime_b2b_raw")
    ) or "opt-out"

    ai_map = {"required": "required", "depends": "depends", "no": "no", "unknown": "depends"}
    ai_disclosure = norm_bool_enum(
        raw.get("AIDisclosure_Required")
        or raw.get("AIDisclosure_Required(Y/N/Depends)")
        or raw.get("aiDisclosureRequiredYND")
        or raw.get("aidisclosureRequiredYnDepends")
        or raw.get("ai_disclosure"),
        ai_map,
    ) or "depends"

    rec_map = {"consent": "consent", "legitimate_interest": "legitimate_interest", "contract": "contract", "unknown": "legitimate_interest"}
    recording_basis = norm_bool_enum(
        raw.get("Recording_Basis")
        or raw.get("Recording_Basis(consent/legitimate_interest/contract)")
        or raw.get("recordingBasis")
        or raw.get("recordingBasisConsentLegitimateInterestContract")
        or raw.get("recording_basis"),
        rec_map,
    ) or "legitimate_interest"

    callerid_rules = remove_content_refs(
        raw.get("CallerID_Rules")
        or raw.get("CallerID/Prefix_Rules")
        or raw.get("callerIDPrefixRules")
        or raw.get("calleridPrefixRules")
        or raw.get("callerid_rules")
    )
    recent_changes = remove_content_refs(
        raw.get("Recent_Changes")
        or raw.get("recentChanges2024Plus")
        or raw.get("recentChanges2024")
        or raw.get("recent_changes")
    )
    quiet_hours = parse_quiet_hours(
        raw.get("Quiet_Hours") or raw.get("Quiet_Hours(allowed_window_local)") or raw.get("quietHoursAllowedWindowLocal") or raw.get("quiet_hours")
    )

    last_verified = parse_date_iso(
        raw.get("Last_Verified")
        or raw.get("Last_Verified(ISO date)")
        or raw.get("lastVerifiedIsoDate")
        or raw.get("lastVerified")
        or raw.get("last_verified")
    )
    # DNC registries
    raw_dnc = raw.get("DNC") or raw.get("dnc") or []
    if not raw_dnc and (raw.get("DNC_Registry_Name") or raw.get("DNC_Registry_URL") or raw.get("dncRegistryName") or raw.get("dncRegistryURL") or raw.get("dncRegistryUrl")):
        raw_dnc = [{
            "name": raw.get("DNC_Registry_Name") or raw.get("dncRegistryName"),
            "url": raw.get("DNC_Registry_URL") or raw.get("dncRegistryURL") or raw.get("dncRegistryUrl"),
            "DNC_API_or_Bulk": raw.get("DNC_API_or_Bulk(Y/N/Unknown)") or raw.get("dncAPIOrBulkYNU") or raw.get("dncApiOrBulkYnUnknown"),
            "check_required_for_er": raw.get("DNC_Check_Required_for_ER(Y/N/Depends)") or raw.get("dncCheckRequiredForERYND") or raw.get("dncCheckRequiredForErYnDepends")
        }]
    # Sources (CSV primary)
    raw_sources = raw.get("sources") or raw.get("Sources") or []
    if not raw_sources and (raw.get("Primary_Sources(max3;official)") or raw.get("primarySourcesMax3Official") or raw.get("Primary_Sources")):
        srcs = raw.get("Primary_Sources(max3;official)") or raw.get("primarySourcesMax3Official") or raw.get("Primary_Sources")
        parts = [p.strip() for p in str(srcs).split(";") if p.strip()]
        updated = raw.get("Source_Last_Updated") or raw.get("sourceLastUpdated")
        raw_sources = [{"title": p, "url": None, "updated": updated} for p in parts[:3]]
    # Exceptions free text
    txt_exc = " ".join([
        str(raw.get("Known_Exceptions(notes)") or raw.get("knownExceptionsNotes") or ""),
        str(raw.get("Existing_Relationship_Exemption(plain_text)") or raw.get("existingRelationshipExemptionPlainText") or ""),
        str(callerid_rules or ""),
    ]).lower()
    # Long text fields
    fused = {
        "regime_b2c_text": remove_content_refs(raw.get("Regime_B2C") or raw.get("regimeB2C") or raw.get("regime_b2c_text")),
        "regime_b2b_text": remove_content_refs(raw.get("Regime_B2B") or raw.get("regimeB2B") or raw.get("regime_b2b_text")),
        "notes_for_product": remove_content_refs(raw.get("Notes_for_Product") or raw.get("notesForProduct") or raw.get("notes_for_product")),
    }

    confidence_label, confidence_score = parse_confidence(raw.get("Confidence") or raw.get("confidence"))

    # DNC registries
    dnc_list: list[dict] = []
    if isinstance(raw_dnc, str) and raw_dnc.strip():
        try:
            raw_dnc = json.loads(raw_dnc)
        except Exception:
            raw_dnc = []
    for d in (raw_dnc or []):
        access_map = {"api": "api", "bulk": "bulk", "none": "none", "unknown": "unknown"}
        access_raw = d.get("DNC_API_or_Bulk") or d.get("access") or d.get("DNC_API_or_Bulk(Y/N/Unknown)") or d.get("dncAPIOrBulkYNU") or d.get("dncApiOrBulkYnUnknown")
        access_val = None
        if isinstance(access_raw, str):
            low = access_raw.lower()
            if "api" in low:
                access_val = "api"
            elif "bulk" in low or "download" in low or "purchase" in low:
                access_val = "bulk"
            elif low in ("y", "yes"):
                access_val = "bulk"
            elif low in ("n", "no"):
                access_val = "none"
        access_val = access_val or norm_bool_enum(access_raw, access_map) or "unknown"

        check_er_raw = d.get("check_required_for_er") or d.get("DNC_Check_Required_for_ER(Y/N/Depends)") or d.get("dncCheckRequiredForERYND") or d.get("dncCheckRequiredForErYnDepends")
        check_er = False
        if isinstance(check_er_raw, str):
            low = check_er_raw.strip().lower()
            check_er = low.startswith("y")
        elif isinstance(check_er_raw, bool):
            check_er = bool(check_er_raw)

        dnc_list.append({
            "name": remove_content_refs(d.get("name") or raw.get("DNC_Registry_Name")),
            "url": remove_content_refs(d.get("url") or raw.get("DNC_Registry_URL") or raw.get("dncRegistryUrl")),
            "access": access_val,
            "check_required_for_er": check_er,
        })

    # Sources
    sources: list[dict] = []
    # parse CSV primary sources
    if isinstance(raw_sources, str) and raw_sources.strip():
        try:
            raw_sources = json.loads(raw_sources)
        except Exception:
            raw_sources = []
    for s in (raw_sources or [])[:3]:
        sources.append({
            "title": remove_content_refs(s.get("title")),
            "url": remove_content_refs(s.get("url")),
            "updated": parse_date_iso(s.get("updated"))
        })

    # Exceptions
    exceptions: list[dict] = []
    raw_exc = raw.get("exceptions") or raw.get("Exceptions") or []
    # derive simple machine-readable exceptions from free text
    derived: list[dict] = []
    if "survey" in txt_exc or "market research" in txt_exc:
        derived.append({"code": "SURVEY_EXEMPT", "value": True})
    if "automated" in txt_exc and ("ban" in txt_exc or "prohibit" in txt_exc or "forbid" in txt_exc):
        derived.append({"code": "AUTOMATED_BANNED", "value": True})
    if "anonymous" in txt_exc or "no anonymous" in txt_exc or "cannot be withheld" in txt_exc:
        derived.append({"code": "NO_ANON_CLI", "value": True})
    if isinstance(raw_exc, str) and raw_exc.strip():
        try:
            raw_exc = json.loads(raw_exc)
        except Exception:
            raw_exc = []
    for e in (raw_exc or [])[:20]:
        exceptions.append({"code": e.get("code"), "value": e.get("value")})
    exceptions.extend(derived)

    fused = {
        "country": country,
        "iso": iso,
        "regime_b2c": b2c,
        "regime_b2b": b2b,
        "quiet_hours": quiet_hours,
        "ai_disclosure": ai_disclosure,
        "recording_basis": recording_basis,
        "callerid_rules": callerid_rules,
        "recent_changes": recent_changes,
        "last_verified": last_verified,
        "confidence": confidence_label,
        "confidence_score": confidence_score,
        "regime_b2c_text": remove_content_refs(raw.get("Regime_B2C") or raw.get("regimeB2C") or raw.get("regime_b2c_text")),
        "regime_b2b_text": remove_content_refs(raw.get("Regime_B2B") or raw.get("regimeB2B") or raw.get("regime_b2b_text")),
        "notes_for_product": remove_content_refs(raw.get("Notes_for_Product") or raw.get("notesForProduct") or raw.get("notes_for_product")),
        "dnc": dnc_list,
        "sources": sources,
        "exceptions": exceptions,
    }

    flags = compute_flags(fused, dnc_list, exceptions)
    fused["flags"] = flags
    return fused


def run() -> None:
    root = os.path.dirname(os.path.dirname(__file__))
    raw_dir = os.environ.get("COMPLIANCE_RAW_DIR") or os.path.join(root, "data", "compliance", "raw")
    out_path = os.environ.get("COMPLIANCE_OUT_PATH") or os.path.join(root, "data", "compliance", "rules.v1.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    raw_records = load_raw_records(raw_dir)
    fused_items: list[dict] = []
    for r in raw_records:
        fused = transform(r)
        errs = quality_checks(fused)
        if errs:
            # keep but annotate; a real pipeline could fail-fast
            fused["_errors"] = errs
        fused_items.append(fused)

    # build indices and countries summary
    fused_by_iso: dict[str, dict] = {}
    countries: list[dict] = []
    for it in fused_items:
        iso = it.get("iso")
        if not iso:
            continue
        fused_by_iso[iso] = it
        countries.append({
            "iso": iso,
            "confidence": it.get("confidence"),
            "last_verified": it.get("last_verified"),
        })

    compiled = {"fused_by_iso": fused_by_iso, "countries": countries}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(compiled, f, ensure_ascii=False, indent=2)

    # Optional DB upsert if DATABASE_URL set
    db_url = os.environ.get("DATABASE_URL")
    if db_url and HAVE_SQLA:
        engine = create_engine(db_url)
        tables = ensure_db(engine)
        for it in fused_items:
            if it.get("iso"):
                upsert(engine, tables, it)

    print(json.dumps({
        "raw_count": len(raw_records),
        "compiled_count": len(fused_items),
        "out_path": out_path,
    }))


if __name__ == "__main__":
    run()


