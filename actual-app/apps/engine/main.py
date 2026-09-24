"""Compatibility entry point. Prefer generate.py for CLI, api:app for HTTP."""
from api import app
from generate import generate_report, main as cli_main

if __name__ == "__main__":
    raise SystemExit(cli_main())
