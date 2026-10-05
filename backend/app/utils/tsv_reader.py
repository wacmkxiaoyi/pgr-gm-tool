import ast
import csv
import json
import re
from pathlib import Path
from backend.app.utils.resource_language import resolve_resource_path


TOKEN_REGEX = re.compile(
    r"\s*(?:"
    r"(?P<STRING>'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\")|"
    r"(?P<NUMBER>-?\d+(?:\.\d+)?)|"
    r"(?P<OPERATOR><=|>=|!=|=|<|>)|"
    r"(?P<LPAREN>\()|"
    r"(?P<RPAREN>\))|"
    r"(?P<COMMA>,)|"
    r"(?P<IDENTIFIER>[A-Za-z_][A-Za-z0-9_]*)|"
    r"(?P<MISMATCH>.)"
    r")"
)

KEYWORDS = {"AND", "OR", "NOT", "IN", "LIKE"}
NUMERIC_OPERATORS = {"=", "!=", ">", ">=", "<", "<="}


class _QueryParser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.position = 0

    def parse(self):
        if not self.tokens:
            return None

        expression = self._parse_or()
        if self._peek() is not None:
            raise ValueError(f"Unexpected token: {self._peek()['value']}")
        return expression

    def _parse_or(self):
        node = self._parse_and()
        while self._match_keyword("OR"):
            node = {
                "type": "logical",
                "operator": "OR",
                "left": node,
                "right": self._parse_and(),
            }
        return node

    def _parse_and(self):
        node = self._parse_not()
        while self._match_keyword("AND"):
            node = {
                "type": "logical",
                "operator": "AND",
                "left": node,
                "right": self._parse_not(),
            }
        return node

    def _parse_not(self):
        if self._match_keyword("NOT"):
            return {
                "type": "unary",
                "operator": "NOT",
                "operand": self._parse_not(),
            }
        return self._parse_primary()

    def _parse_primary(self):
        if self._match("LPAREN"):
            expression = self._parse_or()
            self._expect("RPAREN")
            return expression

        return self._parse_condition()

    def _parse_condition(self):
        column_token = self._expect("IDENTIFIER")
        column = column_token["value"]

        negated = self._match_keyword("NOT")

        if self._match_keyword("IN"):
            return {
                "type": "condition",
                "operator": "NOT IN" if negated else "IN",
                "column": column,
                "value": self._parse_value_list(),
            }

        if self._match_keyword("LIKE"):
            return {
                "type": "condition",
                "operator": "NOT LIKE" if negated else "LIKE",
                "column": column,
                "value": self._parse_scalar(),
            }

        if negated:
            raise ValueError(f"Unexpected token after NOT: {self._peek_value()}")

        operator_token = self._expect("OPERATOR")
        operator = operator_token["value"]
        return {
            "type": "condition",
            "operator": operator,
            "column": column,
            "value": self._parse_scalar(),
        }

    def _parse_value_list(self):
        self._expect("LPAREN")
        values = [self._parse_scalar()]
        while self._match("COMMA"):
            values.append(self._parse_scalar())
        self._expect("RPAREN")
        return values

    def _parse_scalar(self):
        token = self._peek()
        if token is None:
            raise ValueError("Expected value, got end of query")

        if token["type"] == "STRING":
            self.position += 1
            return _parse_string_literal(token["value"])

        if token["type"] == "NUMBER":
            self.position += 1
            return _parse_numeric_literal(token["value"])

        if token["type"] == "IDENTIFIER":
            self.position += 1
            return token["value"]

        raise ValueError(f"Expected value, got: {token['value']}")

    def _match(self, token_type):
        token = self._peek()
        if token is None or token["type"] != token_type:
            return False
        self.position += 1
        return True

    def _match_keyword(self, keyword):
        token = self._peek()
        if token is None:
            return False
        if token["type"] != "KEYWORD" or token["value"] != keyword:
            return False
        self.position += 1
        return True

    def _expect(self, token_type):
        token = self._peek()
        if token is None:
            raise ValueError(f"Expected {token_type}, got end of query")
        if token["type"] != token_type:
            raise ValueError(f"Expected {token_type}, got {token['value']}")
        self.position += 1
        return token

    def _peek(self):
        if self.position >= len(self.tokens):
            return None
        return self.tokens[self.position]

    def _peek_value(self):
        token = self._peek()
        return None if token is None else token["value"]


def _parse_string_literal(value):
    quote = value[0]
    content = value[1:-1]
    doubled_quote = quote * 2
    return content.replace(doubled_quote, quote)


def _parse_numeric_literal(value):
    return float(value) if "." in value else int(value)


def _tokenize(query):
    tokens = []
    position = 0

    while position < len(query):
        match = TOKEN_REGEX.match(query, position)
        if match is None:
            raise ValueError(f"Invalid query near: {query[position:]}")

        position = match.end()
        token_type = match.lastgroup
        token_value = match.group(token_type)

        if token_type is None:
            continue

        if token_type == "MISMATCH":
            raise ValueError(f"Unexpected token: {token_value}")

        if token_type == "IDENTIFIER":
            upper_value = token_value.upper()
            if upper_value in KEYWORDS:
                tokens.append({"type": "KEYWORD", "value": upper_value})
            else:
                tokens.append({"type": token_type, "value": token_value})
            continue

        tokens.append({"type": token_type, "value": token_value})

    return tokens


def _coerce_numeric(value):
    if isinstance(value, (int, float)):
        return value

    if not isinstance(value, str):
        return None

    stripped = value.strip()
    if not stripped:
        return None

    try:
        return float(stripped) if "." in stripped else int(stripped)
    except ValueError:
        return None


def _compare_values(left, operator, right):
    left_numeric = _coerce_numeric(left)
    right_numeric = _coerce_numeric(right)

    if left_numeric is not None and right_numeric is not None:
        left_value = left_numeric
        right_value = right_numeric
    else:
        left_value = "" if left is None else str(left)
        right_value = "" if right is None else str(right)

    if operator == "=":
        return left_value == right_value
    if operator == "!=":
        return left_value != right_value
    if operator == ">":
        return left_value > right_value
    if operator == ">=":
        return left_value >= right_value
    if operator == "<":
        return left_value < right_value
    if operator == "<=":
        return left_value <= right_value

    raise ValueError(f"Unsupported operator: {operator}")


def _like_match(value, pattern):
    escaped_pattern = re.escape("" if pattern is None else str(pattern))
    regex = escaped_pattern.replace(r"%", ".*").replace(r"_", ".")
    return re.fullmatch(regex, "" if value is None else str(value)) is not None


def _evaluate(node, row, available_columns):
    if node is None:
        return True

    node_type = node["type"]

    if node_type == "logical":
        if node["operator"] == "AND":
            return _evaluate(node["left"], row, available_columns) and _evaluate(node["right"], row, available_columns)
        return _evaluate(node["left"], row, available_columns) or _evaluate(node["right"], row, available_columns)

    if node_type == "unary":
        return not _evaluate(node["operand"], row, available_columns)

    column = node["column"]
    if column not in available_columns:
        raise ValueError(f"Unknown column: {column}")

    row_value = row.get(column, "")
    operator = node["operator"]
    target_value = node["value"]

    if operator in NUMERIC_OPERATORS:
        return _compare_values(row_value, operator, target_value)

    if operator == "IN":
        return any(_compare_values(row_value, "=", value) for value in target_value)

    if operator == "NOT IN":
        return all(_compare_values(row_value, "!=", value) for value in target_value)

    if operator == "LIKE":
        return _like_match(row_value, target_value)

    if operator == "NOT LIKE":
        return not _like_match(row_value, target_value)

    raise ValueError(f"Unsupported operator: {operator}")


class TSVReader:
    def __init__(self, path, typed=False):
        file_path = resolve_resource_path(Path(path))

        with file_path.open("r", encoding="utf-8-sig", newline="") as file:
            rows = list(csv.DictReader(file, delimiter="\t"))

        self.path = file_path
        self.typed = bool(typed)
        self.data = [self._coerce_row(row) for row in rows] if self.typed else rows

    def _validate_columns(self, columns):
        if not self.data:
            return

        available_columns = set(self.data[0])
        invalid_columns = [column for column in columns if column not in available_columns]
        if invalid_columns:
            raise ValueError(
                f"Unknown columns in {self.path}: {', '.join(invalid_columns)}"
            )

    def _coerce_row(self, row):
        return {column: self._coerce_value(value) for column, value in row.items()}

    def _coerce_value(self, value):
        if not isinstance(value, str):
            return value

        if value == "":
            return ""

        stripped = value.strip()
        if not stripped:
            return value

        lowered = stripped.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False

        numeric = _coerce_numeric(stripped)
        if numeric is not None:
            return numeric

        if stripped.startswith("[") and stripped.endswith("]"):
            try:
                parsed = json.loads(stripped)
            except (ValueError, SyntaxError):
                try:
                    parsed = ast.literal_eval(stripped)
                except (ValueError, SyntaxError):
                    return value
            if isinstance(parsed, list):
                return parsed

        if stripped.startswith("{") and stripped.endswith("}"):
            try:
                parsed = json.loads(stripped)
            except (ValueError, SyntaxError):
                try:
                    parsed = ast.literal_eval(stripped)
                except (ValueError, SyntaxError):
                    return value
            if isinstance(parsed, dict):
                return parsed

        return value

    def select(self, columns, query=""):
        if not self.data:
            return []

        available_columns = list(self.data[0].keys())
        available_column_set = set(available_columns)

        if columns == "*":
            selected_columns = available_columns
        else:
            selected_columns = list(columns)
            self._validate_columns(selected_columns)

        query = query.strip()
        expression = _QueryParser(_tokenize(query)).parse() if query else None

        return [
            {column: row.get(column, "") for column in selected_columns}
            for row in self.data
            if _evaluate(expression, row, available_column_set)
        ]

    def get_maps(self, key_columns, value_columns, query=""):
        """
        a map = {key: value}
        returns map1 {key_column1: value_column1}, map2 {key_column2: value_column2},...
        """
        if not isinstance(key_columns, list):
            key_columns = [key_columns]
        if not isinstance(value_columns, list):
            value_columns = [value_columns]

        if len(key_columns) != len(value_columns):
            raise ValueError("key_columns and value_columns must have the same length")

        self._validate_columns([*key_columns, *value_columns])

        query = query.strip()
        if query:
            selected_columns = []
            for column in [*key_columns, *value_columns]:
                if column not in selected_columns:
                    selected_columns.append(column)
            rows = self.select(selected_columns, query)
        else:
            rows = self.data

        maps = []
        for key_column, value_column in zip(key_columns, value_columns):
            current_map = {}
            for row in rows:
                current_map[row.get(key_column, "")] = row.get(value_column, "")
            maps.append(current_map)

        return maps

    def get_sub_table(self, key_column, value_columns, query=""):
        if not isinstance(value_columns, list):
            value_columns = [value_columns]

        self._validate_columns([key_column, *value_columns])

        query = query.strip()
        if query:
            selected_columns = [key_column]
            for column in value_columns:
                if column not in selected_columns:
                    selected_columns.append(column)
            rows = self.select(selected_columns, query)
        else:
            rows = self.data

        sub_table = {}
        for row in rows:
            key = row.get(key_column, "")
            sub_table[key] = {column: row.get(column, "") for column in value_columns}

        return sub_table
