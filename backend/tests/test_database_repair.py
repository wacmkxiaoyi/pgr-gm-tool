from backend.app.services.database_repair import _repair_weapon_overrun_active_suits


def test_repair_weapon_overrun_active_suits_unwraps_legacy_documents() -> None:
    document = {
        "equips": [
            {
                "WeaponOverrunData": {
                    "Level": 3,
                    "ActiveSuits": [{"_id": 1101}],
                    "ChoseSuit": 1101,
                }
            }
        ]
    }

    repaired = _repair_weapon_overrun_active_suits(document)

    assert repaired["equips"][0]["WeaponOverrunData"]["ActiveSuits"] == [1101]
    assert document["equips"][0]["WeaponOverrunData"]["ActiveSuits"] == [{"_id": 1101}]


def test_repair_weapon_overrun_active_suits_preserves_valid_integers() -> None:
    document = {"equips": [{"WeaponOverrunData": {"ActiveSuits": [1101]}}]}

    assert _repair_weapon_overrun_active_suits(document) == document


def test_repair_weapon_overrun_active_suits_recovers_selected_suit_from_zero_placeholder() -> None:
    document = {
        "equips": [
            {
                "WeaponOverrunData": {
                    "ActiveSuits": [{"_id": 0}],
                    "ChoseSuit": 1101,
                }
            }
        ]
    }

    repaired = _repair_weapon_overrun_active_suits(document)

    assert repaired["equips"][0]["WeaponOverrunData"]["ActiveSuits"] == [1101]


def test_repair_weapon_overrun_active_suits_does_not_guess_unknown_documents() -> None:
    document = {"equips": [{"WeaponOverrunData": {"ActiveSuits": [{"Id": 1101}]}}]}

    assert _repair_weapon_overrun_active_suits(document) == document
