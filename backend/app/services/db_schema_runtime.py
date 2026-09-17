from __future__ import annotations

import copy
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


SCHEMA_FILE_PATH = Path(__file__).resolve().parents[1] / "db" / "schema.json"
ROOT_COLLECTION_WILDCARD_SUFFIX = "[*]"
ARRAY_WILDCARD_SUFFIX = "[*]"


@dataclass(frozen=True, order=True)
class VersionKey:
    major: int
    minor: int


class CompiledCollectionSchema:
    def __init__(self, schema: dict[str, Any]) -> None:
        self._schema = copy.deepcopy(schema) if isinstance(schema, dict) else {}

    def allows_field(self, path: str) -> bool:
        return self.resolve(path) is not None

    def allows_update_path(self, path: str) -> bool:
        return self.resolve_update_path(path) is not None

    def resolve(self, path: str) -> dict[str, Any] | None:
        normalized_path = _normalize_path(path)
        if not normalized_path:
            return self._schema

        node: Any = self._schema
        for segment in normalized_path:
            if not isinstance(node, dict):
                return None

            next_node = _resolve_child_node(node, segment)
            if next_node is None:
                return None
            node = next_node

        return node if isinstance(node, dict) else None

    def resolve_update_path(self, path: str) -> dict[str, Any] | None:
        return self.resolve(_normalize_update_path(path))

    def sanitize_document(self, value: Any, *, fill_defaults: bool = True) -> Any:
        return _sanitize_value(value, self._schema, fill_defaults=fill_defaults)

    def sanitize_read(self, value: Any, path: str = "") -> Any:
        schema_node = self.resolve(path)
        if schema_node is None:
            return None
        return _sanitize_value(value, schema_node, fill_defaults=True)

    def sanitize_subpath(self, path: str, value: Any, *, fill_defaults: bool = True) -> Any:
        schema_node = self.resolve(path)
        if schema_node is None:
            return None
        return _sanitize_value(value, schema_node, fill_defaults=fill_defaults)

    def materialize_write(self, value: Any, path: str = "") -> Any:
        schema_node = self.resolve(path)
        if schema_node is None:
            return None
        return _sanitize_value(value, schema_node, fill_defaults=True)

    def materialize_document(self, value: Any, *, fill_missing_scalars_with_null: bool = False) -> Any:
        return _sanitize_value(
            value,
            self._schema,
            fill_defaults=True,
            fill_missing_scalars_with_null=fill_missing_scalars_with_null,
        )

    def materialize_subpath(self, path: str, value: Any) -> Any:
        schema_node = self.resolve(path)
        if schema_node is None:
            return None
        return _sanitize_value(value, schema_node, fill_defaults=True)

    def normalize_update_fields(self, update_fields: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(update_fields, dict):
            return {}

        return {
            path: value
            for path, value in update_fields.items()
            if self.allows_update_path(path)
        }

    def materialize_update_fields(self, update_fields: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(update_fields, dict):
            return {}

        materialized: dict[str, Any] = {}
        for path, value in update_fields.items():
            schema_node = self.resolve_update_path(path)
            if schema_node is None:
                continue

            materialized[path] = _sanitize_value(value, schema_node, fill_defaults=True)

        return materialized

    def build_default(self, path: str = "") -> Any:
        schema_node = self.resolve(path)
        if schema_node is None:
            return None
        return _build_default_value(schema_node)


class DatabaseSchemaRuntime:
    def __init__(self, server_version: str) -> None:
        self._server_version = server_version
        self._compiled_schema = _load_compiled_schema(server_version)
        self._collections = {
            _normalize_collection_key(collection_name): CompiledCollectionSchema(collection_schema)
            for collection_name, collection_schema in self._compiled_schema.items()
            if isinstance(collection_schema, dict)
        }

    @property
    def server_version(self) -> str:
        return self._server_version

    def get_collection_schema(self, collection_name: str) -> CompiledCollectionSchema | None:
        return self._collections.get(_normalize_collection_key(collection_name))

    def sanitize_document(self, collection_name: str, value: Any, *, fill_defaults: bool = True) -> Any:
        collection_schema = self.get_collection_schema(collection_name)
        if collection_schema is None:
            return None
        return collection_schema.sanitize_document(value, fill_defaults=fill_defaults)

    def sanitize_subpath(self, collection_name: str, path: str, value: Any, *, fill_defaults: bool = True) -> Any:
        collection_schema = self.get_collection_schema(collection_name)
        if collection_schema is None:
            return None
        return collection_schema.sanitize_subpath(path, value, fill_defaults=fill_defaults)

    def materialize_subpath(self, collection_name: str, path: str, value: Any) -> Any:
        collection_schema = self.get_collection_schema(collection_name)
        if collection_schema is None:
            return None
        return collection_schema.materialize_subpath(path, value)

    def allows_update_path(self, collection_name: str, path: str) -> bool:
        collection_schema = self.get_collection_schema(collection_name)
        if collection_schema is None:
            return False
        return collection_schema.allows_update_path(path)

    def normalize_update_fields(self, collection_name: str, update_fields: dict[str, Any]) -> dict[str, Any]:
        collection_schema = self.get_collection_schema(collection_name)
        if collection_schema is None:
            return {}
        return collection_schema.normalize_update_fields(update_fields)

    def materialize_update_fields(self, collection_name: str, update_fields: dict[str, Any]) -> dict[str, Any]:
        collection_schema = self.get_collection_schema(collection_name)
        if collection_schema is None:
            return {}
        return collection_schema.materialize_update_fields(update_fields)

    def has_collection(self, collection_name: str) -> bool:
        return self.get_collection_schema(collection_name) is not None

    def get_collection_names(self) -> tuple[str, ...]:
        return tuple(sorted(self._collections.keys()))


def init_database_schema_runtime(server_version: str) -> DatabaseSchemaRuntime:
    return get_database_schema_runtime(server_version)


@lru_cache(maxsize=None)
def get_database_schema_runtime(server_version: str) -> DatabaseSchemaRuntime:
    return DatabaseSchemaRuntime(server_version)


@lru_cache(maxsize=1)
def _load_schema_file() -> dict[str, Any]:
    with SCHEMA_FILE_PATH.open("r", encoding="utf-8") as schema_file:
        payload = json.load(schema_file)

    if not isinstance(payload, dict):
        raise ValueError("schema.json root must be an object")

    return payload


@lru_cache(maxsize=None)
def _load_compiled_schema(server_version: str) -> dict[str, Any]:
    raw_schema = _load_schema_file()
    default_section = raw_schema.get("default")
    if not isinstance(default_section, dict):
        raise ValueError("schema.json default section must be an object")

    base_schema = copy.deepcopy(default_section.get("schema") or {})
    active_version = _parse_version_key(server_version)

    for version_name, version_payload in sorted(_iter_version_sections(raw_schema), key=lambda item: item[0]):
        if version_name > active_version:
            continue

        schema_changes = version_payload.get("schema_changes")
        if not isinstance(schema_changes, dict):
            continue

        added = schema_changes.get("added")
        if isinstance(added, dict):
            _merge_schema_nodes(base_schema, added)

        updated = schema_changes.get("updated")
        if isinstance(updated, dict):
            _merge_schema_nodes(base_schema, updated)

        removed = schema_changes.get("removed")
        if isinstance(removed, dict):
            _remove_schema_nodes(base_schema, removed)

    return base_schema


def _iter_version_sections(raw_schema: dict[str, Any]) -> list[tuple[VersionKey, dict[str, Any]]]:
    sections: list[tuple[VersionKey, dict[str, Any]]] = []
    for key, value in raw_schema.items():
        if key == "default" or not isinstance(value, dict):
            continue
        sections.append((_parse_version_key(key), value))
    return sections


def _parse_version_key(raw_version: Any) -> VersionKey:
    parts = str(raw_version or "0.0").strip().split(".")
    major = _safe_int(parts[0] if parts else 0)
    minor = _safe_int(parts[1] if len(parts) > 1 else 0)
    return VersionKey(major=major, minor=minor)


def _safe_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _merge_schema_nodes(target: dict[str, Any], changes: dict[str, Any]) -> None:
    for key, value in changes.items():
        if key not in target:
            target[key] = copy.deepcopy(value)
            continue

        existing = target[key]
        if isinstance(existing, dict) and isinstance(value, dict) and "schema" in existing and "schema" not in value:
            existing_schema = existing.get("schema")
            if isinstance(existing_schema, dict):
                _merge_schema_nodes(existing_schema, value)
                continue

        if isinstance(existing, dict) and isinstance(value, dict):
            _merge_schema_nodes(existing, value)
            continue

        target[key] = copy.deepcopy(value)


def _remove_schema_nodes(target: dict[str, Any], changes: dict[str, Any]) -> None:
    for key, value in changes.items():
        if key not in target:
            continue

        if value in (True, None) or value == {}:
            target.pop(key, None)
            continue

        existing = target.get(key)
        if not isinstance(existing, dict) or not isinstance(value, dict):
            target.pop(key, None)
            continue

        _remove_schema_nodes(existing, value)


def _normalize_collection_key(collection_name: str) -> str:
    text = str(collection_name or "").strip()
    if text.endswith(ROOT_COLLECTION_WILDCARD_SUFFIX):
        return text[:-len(ROOT_COLLECTION_WILDCARD_SUFFIX)]
    return text


def _normalize_path(path: str) -> list[str]:
    return [segment for segment in str(path or "").split(".") if segment]


def _normalize_update_path(path: str) -> str:
    normalized_segments: list[str] = []
    for segment in _normalize_path(path):
        normalized_segments.append(_normalize_update_segment(segment))
    return ".".join(normalized_segments)


def _normalize_update_segment(segment: str) -> str:
    text = str(segment or "").strip()
    if not text:
        return text
    if text == "$" or text == "$[]":
        return "0"
    if text.startswith("$[") and text.endswith("]"):
        return "0"
    return text


def _resolve_child_node(node: dict[str, Any], segment: str) -> dict[str, Any] | None:
    direct = node.get(segment)
    if isinstance(direct, dict):
        return direct

    wildcard = node.get(f"{segment}{ARRAY_WILDCARD_SUFFIX}")
    if isinstance(wildcard, dict):
        return wildcard

    if segment.isdigit() and isinstance(node.get("schema"), dict):
        return node.get("schema")

    if segment.isdigit() and _is_object_schema_definition(node):
        return node

    schema = node.get("schema")
    if isinstance(schema, dict):
        direct = schema.get(segment)
        if isinstance(direct, dict):
            return direct

        wildcard = schema.get(f"{segment}{ARRAY_WILDCARD_SUFFIX}")
        if isinstance(wildcard, dict):
            return wildcard

    return None


def _sanitize_value(value: Any, schema_node: dict[str, Any], *, fill_defaults: bool, fill_missing_scalars_with_null: bool = False) -> Any:
    node_type = schema_node.get("type")

    if node_type == "array":
        item_schema = schema_node.get("schema")
        source = value if isinstance(value, list) else copy.deepcopy(schema_node.get("default", []))
        if not isinstance(source, list):
            source = []

        if not isinstance(item_schema, dict):
            return copy.deepcopy(source)

        sanitized_items: list[Any] = []
        for item in source:
            sanitized_item = _sanitize_value(
                item,
                item_schema,
                fill_defaults=fill_defaults,
                fill_missing_scalars_with_null=fill_missing_scalars_with_null,
            )
            if sanitized_item is not None:
                sanitized_items.append(sanitized_item)
        return sanitized_items

    if node_type == "object" or "schema" in schema_node or _is_object_schema_definition(schema_node):
        if node_type == "object" and "schema" not in schema_node:
            if isinstance(value, dict):
                return copy.deepcopy(value)
            if fill_defaults and "default" in schema_node:
                return copy.deepcopy(schema_node.get("default"))
            return {}

        object_schema = schema_node.get("schema") if "schema" in schema_node else schema_node
        if not isinstance(value, dict):
            if fill_defaults and "default" in schema_node:
                return copy.deepcopy(schema_node.get("default"))
            source = {}
        else:
            source = value
        if not isinstance(object_schema, dict):
            if isinstance(value, dict):
                return copy.deepcopy(value)
            if "default" in schema_node:
                return copy.deepcopy(schema_node.get("default"))
            return {}

        sanitized: dict[str, Any] = {}
        for schema_field_name, field_schema in object_schema.items():
            if not isinstance(field_schema, dict):
                continue

            field_name = _actual_field_name(schema_field_name)

            if field_name in source:
                sanitized_value = _sanitize_value(
                    source.get(field_name),
                    field_schema,
                    fill_defaults=fill_defaults,
                    fill_missing_scalars_with_null=fill_missing_scalars_with_null,
                )
            elif fill_defaults:
                sanitized_value = _build_default_value(field_schema, fill_missing_scalars_with_null=fill_missing_scalars_with_null)
            else:
                continue

            if sanitized_value is not None or field_schema.get("type") == "null" or "default" in field_schema:
                sanitized[field_name] = sanitized_value

        return sanitized

    if value is None:
        if fill_defaults and "default" in schema_node:
            return copy.deepcopy(schema_node.get("default"))
        return None

    return copy.deepcopy(value)


def _build_default_value(schema_node: dict[str, Any], *, fill_missing_scalars_with_null: bool = False) -> Any:
    if "default" in schema_node:
        return copy.deepcopy(schema_node.get("default"))

    node_type = schema_node.get("type")
    if node_type == "array":
        return []

    if node_type == "object" or "schema" in schema_node or _is_object_schema_definition(schema_node):
        object_schema = schema_node.get("schema") if "schema" in schema_node else schema_node
        if not isinstance(object_schema, dict):
            return {}

        return {
            _actual_field_name(field_name): _build_default_value(field_schema, fill_missing_scalars_with_null=fill_missing_scalars_with_null)
            for field_name, field_schema in object_schema.items()
            if isinstance(field_schema, dict)
            and (
                "default" in field_schema
                or field_schema.get("type") in {"object", "array"}
                or "schema" in field_schema
                or fill_missing_scalars_with_null
            )
        }

    if fill_missing_scalars_with_null:
        return None

    return None


def _actual_field_name(schema_field_name: str) -> str:
    if str(schema_field_name).endswith(ARRAY_WILDCARD_SUFFIX):
        return str(schema_field_name)[:-len(ARRAY_WILDCARD_SUFFIX)]
    return str(schema_field_name)


def _is_object_schema_definition(schema_node: Any) -> bool:
    if not isinstance(schema_node, dict) or not schema_node:
        return False

    reserved_keys = {"type", "default", "schema"}
    candidate_keys = [key for key in schema_node.keys() if key not in reserved_keys]
    if not candidate_keys:
        return False

    return all(isinstance(schema_node.get(key), dict) for key in candidate_keys)
