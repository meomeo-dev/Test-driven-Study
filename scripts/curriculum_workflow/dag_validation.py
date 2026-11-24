"""Course-wide concept DAG, prerequisite group, and cycle validation helpers."""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Sequence, Set, Tuple


def _prereq_ids(node: Mapping[str, Any]) -> List[str]:
    """Extract referenced prerequisite concept IDs from a concept node."""
    ids: List[str] = []
    for entry in node.get("prerequisites") or ():
        if isinstance(entry, str):
            ids.append(entry)
        elif isinstance(entry, Mapping):
            for key in ("all_of", "any_of"):
                for cid in entry.get(key) or ():
                    ids.append(str(cid))
    return ids


def _would_create_cycle(
    concepts_by_id: Mapping[str, Mapping[str, Any]],
    source_cid: str,
    target_prereq: str,
) -> bool:
    """Return True if adding edge source_cid -> target_prereq introduces a cycle."""
    if source_cid == target_prereq:
        return True
    stack = [target_prereq]
    visited: Set[str] = set()
    while stack:
        cur = stack.pop()
        if cur == source_cid:
            return True
        if cur in visited:
            continue
        visited.add(cur)
        node = concepts_by_id.get(cur)
        if node:
            stack.extend(_prereq_ids(node))
    return False


def assert_acyclic_concepts(concepts: Sequence[Mapping[str, Any]]) -> None:
    """Verify concept prerequisite graph has no directed cycles."""
    by_id = {str(c["id"]): c for c in concepts}
    state: Dict[str, int] = {}
    for cid in by_id:
        if state.get(cid, 0) != 0:
            continue
        stack: List[Tuple[str, bool]] = [(cid, False)]
        while stack:
            node_id, exiting = stack.pop()
            if exiting:
                state[node_id] = 2
                continue
            cur_state = state.get(node_id, 0)
            if cur_state == 2:
                continue
            state[node_id] = 1
            stack.append((node_id, True))
            for dep in _prereq_ids(by_id[node_id]):
                if dep not in by_id:
                    continue
                if state.get(dep, 0) == 1:
                    raise ValueError(
                        f"prerequisite cycle detected involving {node_id!r} -> {dep!r}"
                    )
                if state.get(dep, 0) == 0:
                    stack.append((dep, False))


def _validate_manifest_prereqs(all_nodes: Sequence[Mapping[str, Any]]) -> None:
    """Reject unknown/self prerequisites and containing DNF groups across manifest."""
    known = {str(c["id"]) for c in all_nodes}
    for node in all_nodes:
        cid = str(node["id"])
        groups = [
            list(g.get("all_of") or ())
            for g in (node.get("prerequisites") or ())
            if isinstance(g, Mapping)
        ]
        for idx, members in enumerate(groups):
            for dep in members:
                if dep == cid:
                    raise ValueError(
                        f"concept {cid!r}: self-prerequisite in group {idx + 1}"
                    )
                if dep not in known:
                    raise ValueError(
                        f"concept {cid!r}: unknown prerequisite {dep!r}"
                    )
            for other_idx, other in enumerate(groups):
                if other_idx != idx and set(other).issubset(set(members)) and (
                    len(members) > len(other) or other_idx < idx
                ):
                    raise ValueError(
                        f"concept {cid!r}: prerequisite group {idx + 1} "
                        f"contains group {other_idx + 1}"
                    )


def assert_acyclic_manifest(manifest: Mapping[str, Any]) -> None:
    """Validate unique concept IDs, prerequisite references, groups, and global DAG."""
    all_nodes: List[Mapping[str, Any]] = []
    seen: Set[str] = set()
    for unit in manifest.get("units") or ():
        for concept in unit.get("concepts") or ():
            cid = str(concept["id"])
            if cid in seen:
                raise ValueError(f"duplicate concept ID across manifest: {cid!r}")
            seen.add(cid)
            all_nodes.append(concept)
    _validate_manifest_prereqs(all_nodes)
    assert_acyclic_concepts(all_nodes)
