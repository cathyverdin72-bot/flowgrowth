def test_claim_checker_flags_price_written_as_cfa_after_amount():
    findings = main.find_unsupported_claims(
        "Our service costs 5000 CFA.",
        "Write a car wash social post. No price was provided.",
    )
    assert "specific price or discount" in findings
def test_claim_checker_does_not_treat_prohibited_weekday_as_verified():
    findings = main.find_unsupported_claims(
        "We open on Monday.",
        "Do not mention Monday. No opening date was provided.",
    )
    assert "opening date or weekday" in findings
def test_claim_checker_allows_weekday_confirmed_in_brief():
    findings = main.find_unsupported_claims(
        "We open on Monday.",
        "The business confirms: We open on Monday.",
    )
    assert findings == []
