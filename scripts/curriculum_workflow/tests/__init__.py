"""Offline unittest package for curriculum_workflow with automatic sys.path setup."""

from __future__ import annotations

import os
import sys

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PACKAGE_DIR = os.path.dirname(TESTS_DIR)
SCRIPTS_DIR = os.path.dirname(PACKAGE_DIR)
REPO_ROOT = os.path.dirname(SCRIPTS_DIR)
STUB_CLI_PATH = os.path.join(TESTS_DIR, "stub_agy_cli.py")

if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)
