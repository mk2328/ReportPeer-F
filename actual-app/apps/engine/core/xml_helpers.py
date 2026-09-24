"""Compatibility shim. Prefer core.fields."""
from .fields import (  # noqa: F401
    insert_field,
    insert_seq,
    insert_page,
    insert_num_pages,
    insert_style_ref,
)
