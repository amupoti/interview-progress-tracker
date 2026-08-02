import json
import os
import sqlite3


def _connect(database_file):
    directory = os.path.dirname(database_file)
    if directory:
        os.makedirs(directory, exist_ok=True)
    connection = sqlite3.connect(database_file)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )
    return connection


def load_state(database_file, key, default, legacy_file=None):
    with _connect(database_file) as connection:
        row = connection.execute(
            "SELECT value FROM app_state WHERE key = ?", (key,)
        ).fetchone()
        if row is not None:
            return json.loads(row[0])

        value = default
        if legacy_file and os.path.exists(legacy_file):
            with open(legacy_file) as file:
                value = json.load(file)

        connection.execute(
            "INSERT INTO app_state (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )
        return value


def save_state(database_file, key, value):
    with _connect(database_file) as connection:
        connection.execute(
            "INSERT INTO app_state (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, json.dumps(value)),
        )
