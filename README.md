# GreenProof

**Verify a sustainability claim and issue a QUANTIFIED credit, by GenLayer consensus.**

A project claims a carbon offset (a project, an evidence link, claimed tonnes of CO2e). `verify` has
every validator independently fetch the evidence and decide whether the claim is legitimate **and**
estimate the verified tonnage; the result is accepted only when validators agree on legitimacy
(comparative equivalence on the boolean). A legitimate claim issues a credit for the verified tonnes —
often **less than claimed** (the consensus haircut), capped at the claimed amount.

The verb is **"verify + quantify → issue a credit"** — the output is a number of credited tonnes, not a
bare yes/no.

- **Live demo:** https://greenproof.pages.dev
- **Contract (Bradbury, chain 4221):** `0x60240a16F874DE0156e04d6abe7084D3357B382C`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0x60240a16F874DE0156e04d6abe7084D3357B382C

---

## Why GenLayer is essential

Carbon-credit fraud thrives on unverifiable claims. GenLayer has validators independently read the
project evidence and agree on both legitimacy and a defensible tonnage before any credit is issued —
on-chain verification of off-chain reality a bare EVM can't do.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Claim | `claim_offset(project, evidence_url, claimed_tonnes)` | Files an offset claim. |
| Verify | `verify(id)` | Consensus legitimacy + verified tonnage → credit (≤ claimed). |
| Read | `get_claim(id)` / `stats()` | State, verified vs claimed tonnes, total credited. |

### Correctness check

`_verify` wraps the judgment in **`gl.eq_principle.prompt_comparative`** — principle: *"the `legitimate`
boolean must match across validators."* `validate_green` enforces a real boolean + non-negative integer
tonnes + reason; `normalize_green` forces `verified_tonnes=0` when illegitimate. The issued credit is
`min(verified_tonnes, claimed_tonnes)` — consensus can haircut but never inflate. Unit-tested incl. the
reject path and a verified-with-haircut run.

## Architecture

```
GreenProof/
├── contracts/green_proof.py  ← GenLayer Intelligent Contract (consensus legitimacy + quantified credit)
├── tests/                    ← pytest: green guards, claim guards, verify flow + haircut cap
└── app/                      ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                                lime sustainability theme, credit cards with verified-vs-claimed tonnage
```

## Tests

```bash
cd GreenProof
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `normalize_green` / `validate_green`, claim guards, the reject path, and a **verified-with-haircut**
run (verified tonnage capped at claimed) (shim auto-inits `TreeMap`). **On-chain smoke-tested:**
`claim_offset` write + `get_claim` read verified live on Bradbury.

## Deploy

```bash
genlayer deploy --contract contracts/green_proof.py
```
