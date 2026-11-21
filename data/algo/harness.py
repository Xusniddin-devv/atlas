# Python side of the algorithm harness. Used by Pyodide in the browser and by scripts/algo/check.mjs (python3).
# The user writes LeetCode-style code: `class Solution:` with a method named like the problem's function,
# or for design problems the class itself. Outputs are converted to plain JSON; comparison happens in harness.js.
import json, sys, io, time, traceback
from typing import List, Optional, Dict, Tuple, Set, Deque
from collections import defaultdict, deque, Counter, OrderedDict
import heapq, bisect, math, itertools, functools, string, re
from functools import lru_cache, cache


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def _to_list(a):
    h = None
    for v in reversed(a):
        h = ListNode(v, h)
    return h


def _from_list(h):
    out, n = [], 0
    while h:
        out.append(h.val)
        h = h.next
        n += 1
        if n > 100000:
            raise RuntimeError("Linked list has a cycle or is too long")
    return out


def _to_tree(a):
    if not a or a[0] is None:
        return None
    root = TreeNode(a[0])
    q, i = deque([root]), 1
    while q and i < len(a):
        n = q.popleft()
        if i < len(a) and a[i] is not None:
            n.left = TreeNode(a[i]); q.append(n.left)
        i += 1
        if i < len(a) and a[i] is not None:
            n.right = TreeNode(a[i]); q.append(n.right)
        i += 1
    return root


def _from_tree(r):
    if not r:
        return []
    out, q = [], deque([r])
    while q:
        n = q.popleft()
        if n:
            out.append(n.val); q.append(n.left); q.append(n.right)
        else:
            out.append(None)
    while out and out[-1] is None:
        out.pop()
    return out


def _conv(t, v, d):
    if v is None:
        return [] if d == "out" and t in ("ListNode", "TreeNode") else None
    if t.endswith("[]"):
        return [_conv(t[:-2], x, d) for x in v]
    if t == "ListNode":
        return _to_list(v) if d == "in" else _from_list(v)
    if t == "TreeNode":
        return _to_tree(v) if d == "in" else _from_tree(v)
    if d == "out" and isinstance(v, (tuple, set, frozenset)):
        return [_conv(t, x, d) for x in v]
    return v


def _plain(v):
    if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
        return str(v)
    if isinstance(v, (list, tuple, set, frozenset, deque)):
        return [_plain(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _plain(x) for k, x in v.items()}
    return v


def _fmt(e):
    """Error text that only shows the user's own lines, never the harness."""
    if isinstance(e, SyntaxError):
        return "".join(traceback.format_exception_only(type(e), e)).replace('File "solution.py", ', "").strip()
    frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "solution.py"]
    where = "".join(f"line {f.lineno}, in {f.name}\n    {(f.line or '').strip()}\n" for f in frames[-3:])
    return (where + f"{type(e).__name__}: {e}").strip()


def _snake(name):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def run_all(meta_json, code, tests_json):
    P, tests = json.loads(meta_json), json.loads(tests_json)
    g = {"__name__": "solution"}
    for k, v in globals().items():
        if not k.startswith("__") and k not in ("run_all",):
            g[k] = v
    results = []
    old = sys.stdout
    try:
        buf = io.StringIO(); sys.stdout = buf
        exec(compile(code, "solution.py", "exec"), g)
    except BaseException as e:
        sys.stdout = old
        return json.dumps([{"error": _fmt(e)}])
    sys.stdout = old
    for t in tests:
        buf = io.StringIO(); sys.stdout = buf
        t0 = time.perf_counter()
        try:
            if P.get("kind") == "design":
                D = P["design"]; Cls = g[D["cls"]]; M = {m["name"]: m for m in D["methods"]}
                out, obj = [], None
                for i, op in enumerate(t["ops"]):
                    if i == 0:
                        obj = Cls(*[_conv(p[1], t["args"][0][k], "in") for k, p in enumerate(D.get("ctor", []))]); out.append(None); continue
                    m = M[op]
                    fn = getattr(obj, op, None) or getattr(obj, _snake(op))
                    r = fn(*[_conv(p[1], t["args"][i][k], "in") for k, p in enumerate(m["params"])])
                    out.append(None if m["returns"] == "void" else _conv(m["returns"], r, "out"))
                got = out
            else:
                F = P["fn"]; S = g["Solution"](); fn = getattr(S, F["name"], None) or getattr(S, _snake(F["name"]))
                args = [_conv(p[1], t["args"][i], "in") for i, p in enumerate(F["params"])]
                r = fn(*args)
                got = _conv(F["params"][F["mutates"]][1], args[F["mutates"]], "out") if F.get("mutates") is not None else _conv(F["returns"], r, "out")
            results.append({"got": _plain(got), "ms": round((time.perf_counter() - t0) * 1000, 2), "stdout": buf.getvalue()[:4000]})
        except BaseException as e:
            if isinstance(e, KeyboardInterrupt):
                raise
            results.append({"error": _fmt(e), "ms": round((time.perf_counter() - t0) * 1000, 2), "stdout": buf.getvalue()[:4000]})
        finally:
            sys.stdout = old
    return json.dumps(results)


if __name__ == "__main__":
    # CLI for the checker: python3 harness.py <meta.json> <code.py> <tests.json>  → prints results JSON
    a = sys.argv[1:]
    print(run_all(open(a[0]).read(), open(a[1]).read(), open(a[2]).read()))
