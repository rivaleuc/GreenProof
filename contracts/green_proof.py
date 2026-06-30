# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
GreenProof — verify a sustainability claim and issue a QUANTIFIED credit, by consensus.

A project claims a carbon offset (a project, an evidence link, claimed tonnes of
CO2). `verify` has every validator independently fetch the evidence and decide
whether the claim is legitimate AND estimate the verified tonnage; the result is
accepted only when validators agree on legitimacy (comparative equivalence on the
boolean). A legitimate claim issues a credit for the verified tonnes (often less
than claimed — the consensus haircut).

The verb is "verify + quantify → issue a credit" — the output is a number of
credited tonnes, not a bare yes/no.
"""
import json
from genlayer import *


def normalize_green(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    legit = raw.get("legitimate")
    legit = bool(legit) if isinstance(legit, bool) else str(legit).strip().lower() in ("true", "yes", "1")
    tonnes = raw.get("verified_tonnes")
    if not isinstance(tonnes, int) or isinstance(tonnes, bool):
        tonnes = 0
    tonnes = max(0, min(10**9, tonnes))
    if not legit:
        tonnes = 0
    reason = raw.get("reason")
    reason = reason[:400] if isinstance(reason, str) and reason.strip() else "no reason"
    return {"legitimate": legit, "verified_tonnes": tonnes, "reason": reason}


def validate_green(data) -> bool:
    if not isinstance(data, dict):
        return False
    if not isinstance(data.get("legitimate"), bool):
        return False
    t = data.get("verified_tonnes")
    if not isinstance(t, int) or isinstance(t, bool) or t < 0:
        return False
    r = data.get("reason")
    return isinstance(r, str) and bool(r.strip())


class GreenProof(gl.Contract):
    claims: TreeMap[str, str]
    claim_count: u256
    verified_count: u256
    total_tonnes: u256

    def __init__(self):
        self.claim_count = u256(0)
        self.verified_count = u256(0)
        self.total_tonnes = u256(0)

    @gl.public.write
    def claim_offset(self, project: str, evidence_url: str, claimed_tonnes: int) -> str:
        project = str(project).strip()
        evidence_url = str(evidence_url).strip()
        if not project or not evidence_url.startswith("http"):
            raise Exception("project and http evidence_url required")
        try:
            claimed = int(claimed_tonnes)
        except Exception:
            claimed = 0
        if claimed <= 0:
            raise Exception("claimed_tonnes must be positive")
        key = str(int(self.claim_count))
        rec = {
            "claimant": str(gl.message.sender_address),
            "project": project[:200],
            "evidence_url": evidence_url[:400],
            "claimed_tonnes": claimed,
            "state": "pending",        # pending -> verified | rejected
            "legitimate": False,
            "verified_tonnes": 0,
            "reason": "",
        }
        self.claims[key] = json.dumps(rec)
        self.claim_count += u256(1)
        return key

    @gl.public.write
    def verify(self, claim_id: str) -> dict:
        claim_id = str(claim_id)
        if claim_id not in self.claims:
            raise Exception("unknown claim")
        c = json.loads(self.claims[claim_id])
        if c["state"] != "pending":
            raise Exception("already verified")
        res = self._verify(c["project"], c["evidence_url"], int(c["claimed_tonnes"]))
        c["legitimate"] = res["legitimate"]
        c["reason"] = res["reason"]
        if res["legitimate"]:
            issued = min(res["verified_tonnes"], int(c["claimed_tonnes"]))
            c["verified_tonnes"] = issued
            c["state"] = "verified"
            self.verified_count += u256(1)
            self.total_tonnes += u256(issued)
        else:
            c["verified_tonnes"] = 0
            c["state"] = "rejected"
        self.claims[claim_id] = json.dumps(c)
        return {"claim": claim_id, "legitimate": res["legitimate"], "verified_tonnes": c["verified_tonnes"]}

    def _verify(self, project: str, evidence_url: str, claimed: int) -> dict:
        def fetch_and_judge() -> str:
            live = "(evidence fetch failed)"
            try:
                live = gl.nondet.web.get(evidence_url).body.decode("utf-8")[:5000]
            except Exception:
                try:
                    live = gl.nondet.web.render(evidence_url, mode="text")[:5000]
                except Exception:
                    live = "(evidence fetch failed)"
            prompt = f"""You are a carbon-offset verifier. Assess the claim against the evidence.

PROJECT: {project}
CLAIMED OFFSET: {claimed} tonnes CO2e

EVIDENCE (fetched now):
{live}

Is the claim legitimate? If so, estimate the VERIFIED tonnes actually supported (<= claimed).
Reply ONLY JSON: {{"legitimate": true/false, "verified_tonnes": <int>, "reason": "<short>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_green(raw))

        result = gl.eq_principle.prompt_comparative(
            fetch_and_judge,
            principle="The 'legitimate' boolean must match across validators; the verified_tonnes may differ slightly. Reason may differ.",
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_green(data):
            data = normalize_green(data if isinstance(data, dict) else {})
        return data

    @gl.public.view
    def get_claim(self, claim_id: str) -> dict:
        claim_id = str(claim_id)
        if claim_id not in self.claims:
            return {"exists": False}
        c = json.loads(self.claims[claim_id])
        c["exists"] = True
        return c

    @gl.public.view
    def stats(self) -> dict:
        return {"total_claims": int(self.claim_count), "verified": int(self.verified_count), "total_tonnes": int(self.total_tonnes)}
