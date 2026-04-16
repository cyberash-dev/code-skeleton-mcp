"""Module-level docstring for sample."""
from __future__ import annotations

import os
import sys as system
from typing import Optional, overload
from .helpers import helper_fn as _helper
from collections import defaultdict

MAX_RETRIES = 3
_INTERNAL_FLAG = True


def top_level(x: int, y: int = 0) -> int:
    """Return x + y."""
    return x + y


@overload
def parse(value: int) -> int: ...
@overload
def parse(value: str) -> str: ...
def parse(value):
    """Parse value into int or str."""
    return value


class User:
    """A user record."""

    total_users = 0

    def __init__(self, name: str) -> None:
        """Create a user."""
        self.name = name

    def greet(self) -> str:
        """Return a greeting."""
        return f"hi, {self.name}"

    def _private(self) -> None:
        return None

    class Meta:
        """Nested meta class."""

        table_name = "users"


def _module_private() -> None:
    """Not shown unless include_private."""
    pass
