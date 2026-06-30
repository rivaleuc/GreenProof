"""GreenProof tests: verification guards + claim→verify flow incl. legitimacy + tonnage haircut."""


def test_normalize_green(contract):
    n = contract.normalize_green
    assert n({"legitimate": True, "verified_tonnes": 100, "reason": "ok"})["verified_tonnes"] == 100
    assert n({"legitimate": False, "verified_tonnes": 100, "reason": "x"})["verified_tonnes"] == 0  # illegit -> 0
    assert n({"legitimate": "yes", "verified_tonnes": -5, "reason": "x"})["verified_tonnes"] == 0
    assert n({})["legitimate"] is False

def test_validate_green(contract):
    v = contract.validate_green
    assert v({"legitimate": True, "verified_tonnes": 50, "reason": "registry match"})
    assert not v({"legitimate": "true", "verified_tonnes": 1, "reason": "x"})
    assert not v({"legitimate": True, "verified_tonnes": -1, "reason": "x"})
    assert not v({"legitimate": True, "verified_tonnes": 1, "reason": "  "})


def _new(contract):
    return contract, contract.GreenProof()

def test_claim_guards(contract):
    mod, c = _new(contract)
    try:
        c.claim_offset("Reforestation", "https://e.example", 0); assert False, "zero tonnes should fail"
    except Exception:
        pass
    try:
        c.claim_offset("Reforestation", "noturl", 100); assert False, "non-http should fail"
    except Exception:
        pass

def test_verify_flow_with_haircut(contract):
    mod, c = _new(contract)
    cid = c.claim_offset("Mangrove restoration", "https://registry.example/proj", 500)
    # offline default -> illegitimate -> rejected
    c.verify(cid)
    assert c.get_claim(cid)["state"] == "rejected" and c.get_claim(cid)["verified_tonnes"] == 0
    # legitimate but validators verify MORE than claimed -> capped at claimed (haircut)
    cid2 = c.claim_offset("Solar farm", "https://registry.example/solar", 500)
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {"legitimate": True, "verified_tonnes": 1000, "reason": "verified in registry"})
    c.verify(cid2)
    cl = c.get_claim(cid2)
    assert cl["state"] == "verified" and cl["verified_tonnes"] == 500    # capped at claimed
    st = c.stats()
    assert st["verified"] == 1 and st["total_tonnes"] == 500
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {})
