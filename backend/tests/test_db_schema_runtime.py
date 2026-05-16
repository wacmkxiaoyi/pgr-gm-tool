from backend.app.services.db_schema_runtime import CompiledCollectionSchema


def test_object_node_prefers_its_own_default_when_missing() -> None:
    schema = CompiledCollectionSchema(
        {
            "WeaponOverrunData": {
                "type": "object",
                "default": {},
                "schema": {
                    "Level": {"type": "number", "default": 0},
                    "ActiveSuits": {
                        "type": "array",
                        "default": [],
                        "schema": {"_id": {"type": "number", "default": 0}},
                    },
                    "ChoseSuit": {"type": "number", "default": 0},
                },
            }
        }
    )

    sanitized = schema.materialize_write({}, "")

    assert sanitized == {"WeaponOverrunData": {}}


def test_existing_object_still_fills_missing_child_defaults() -> None:
    schema = CompiledCollectionSchema(
        {
            "WeaponOverrunData": {
                "type": "object",
                "default": {},
                "schema": {
                    "Level": {"type": "number", "default": 0},
                    "ActiveSuits": {"type": "array", "default": []},
                    "ChoseSuit": {"type": "number", "default": 0},
                },
            }
        }
    )

    sanitized = schema.materialize_write({"WeaponOverrunData": {"Level": 3}}, "")

    assert sanitized == {
        "WeaponOverrunData": {
            "Level": 3,
            "ActiveSuits": [],
            "ChoseSuit": 0,
        }
    }


def test_object_without_own_default_still_builds_from_children() -> None:
    schema = CompiledCollectionSchema(
        {
            "Nested": {
                "type": "object",
                "schema": {
                    "Enabled": {"type": "boolean", "default": False},
                    "Values": {"type": "array", "default": []},
                },
            }
        }
    )

    sanitized = schema.materialize_write({}, "")

    assert sanitized == {"Nested": {"Enabled": False, "Values": []}}


def test_array_node_keeps_using_its_own_default_when_missing() -> None:
    schema = CompiledCollectionSchema(
        {
            "ActiveSuits": {
                "type": "array",
                "default": [],
                "schema": {"_id": {"type": "number", "default": 0}},
            }
        }
    )

    sanitized = schema.materialize_write({}, "")

    assert sanitized == {"ActiveSuits": []}
