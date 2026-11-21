/* Algorithm harness shared by the browser runner (inlined into a Web Worker) and scripts/algo/check.mjs.
   Types use a small language: int, float, bool, string, char, any, ListNode, TreeNode, and arrays as T[] (nested ok).
   Inputs and expected outputs are always plain JSON: lists and trees are written as arrays (trees in level order with null). */
var Harness = (function () {
  function ListNode(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; }
  function TreeNode(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; }
  function toList(a) { var h = null; for (var i = a.length - 1; i >= 0; i--) h = new ListNode(a[i], h); return h; }
  function fromList(h) { var out = [], seen = 0; while (h) { out.push(h.val); h = h.next; if (++seen > 100000) throw new Error("Linked list has a cycle or is too long"); } return out; }
  function toTree(a) {
    if (!a.length || a[0] === null) return null;
    var root = new TreeNode(a[0]), q = [root], i = 1, qi = 0;
    while (qi < q.length && i < a.length) {
      var n = q[qi++];
      if (i < a.length && a[i] !== null) { n.left = new TreeNode(a[i]); q.push(n.left); } i++;
      if (i < a.length && a[i] !== null) { n.right = new TreeNode(a[i]); q.push(n.right); } i++;
    }
    return root;
  }
  function fromTree(r) {
    if (!r) return [];
    var out = [], q = [r], qi = 0;
    while (qi < q.length) { var n = q[qi++]; if (n) { out.push(n.val); q.push(n.left, n.right); } else out.push(null); }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  }
  function base(t) { return t.replace(/(\[\])+$/, ""); }
  function depth(t) { var m = t.match(/(\[\])+$/); return m ? m[0].length / 2 : 0; }
  function conv(t, v, dir) {
    var d = depth(t), b = base(t);
    if (v === null || v === undefined) return dir === "out" && d === 0 && (b === "ListNode" || b === "TreeNode") ? [] : null;
    if (d > 0) { var inner = t.slice(0, -2); return v.map(function (x) { return conv(inner, x, dir); }); }
    if (b === "ListNode") return dir === "in" ? toList(v) : fromList(v);
    if (b === "TreeNode") return dir === "in" ? toTree(v) : fromTree(v);
    return v;
  }
  /* Deep copy through JSON so user code cannot mutate the stored test. */
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function norm(v) {
    if (typeof v === "number" && !Number.isFinite(v)) return String(v);
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = norm(v[k]); }); return o; }
    return v === undefined ? null : v;
  }
  function eq(a, b) { return JSON.stringify(norm(a)) === JSON.stringify(norm(b)); }
  function sortDeep(v, levels) {
    if (!Array.isArray(v) || levels === 0) return v;
    var inner = v.map(function (x) { return sortDeep(x, levels - 1); });
    return inner.map(function (x) { return [JSON.stringify(norm(x)), x]; }).sort(function (p, q) { return p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0; }).map(function (p) { return p[1]; });
  }
  function floatEq(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (x, i) { return floatEq(x, b[i]); });
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b));
    return eq(a, b);
  }
  /* compare: "exact" | "unordered" (outer list order ignored) | "unordered-deep" (every list level) | "float" | {check: "<js function source (args, got, expected) => boolean>"} */
  function compare(mode, expected, got, args) {
    if (!mode || mode === "exact") return eq(expected, got);
    if (mode === "unordered") return eq(sortDeep(expected, 1), sortDeep(got, 1));
    if (mode === "unordered-deep") return eq(sortDeep(expected, 9), sortDeep(got, 9));
    if (mode === "float") return floatEq(got, expected);
    if (mode.check) { var f = (0, eval)("(" + mode.check + ")"); return !!f(clone(args), clone(got), clone(expected)); }
    throw new Error("Unknown compare mode");
  }
  /* Run one test against a user function (kind "function") or a class (kind "design"). */
  function runFunction(P, fn, args) {
    var conv_in = P.fn.params.map(function (p, i) { return conv(p[1], clone(args[i]), "in"); });
    var ret = fn.apply(null, conv_in);
    if (P.fn.mutates !== undefined) return conv(P.fn.params[P.fn.mutates][1], conv_in[P.fn.mutates], "out");
    return conv(P.fn.returns, ret, "out");
  }
  function runDesign(P, Cls, test) {
    var ops = test.ops, args = test.args, out = [], obj = null, M = {};
    P.design.methods.forEach(function (m) { M[m.name] = m; });
    for (var i = 0; i < ops.length; i++) {
      if (i === 0) { obj = new (Function.prototype.bind.apply(Cls, [null].concat((P.design.ctor || []).map(function (p, k) { return conv(p[1], clone(args[0][k]), "in"); }))))(); out.push(null); continue; }
      var m = M[ops[i]]; if (!m) throw new Error("Unknown method " + ops[i]);
      var r = obj[ops[i]].apply(obj, m.params.map(function (p, k) { return conv(p[1], clone(args[i][k]), "in"); }));
      out.push(m.returns === "void" ? null : conv(m.returns, r, "out"));
    }
    return out;
  }
  function rng(seed) {
    var a = seed >>> 0;
    function next() { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var r = {
      next: next,
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      bool: function (p) { return next() < (p === undefined ? 0.5 : p); },
      pick: function (a) { return a[Math.floor(next() * a.length)]; },
      arr: function (n, lo, hi) { var o = []; for (var i = 0; i < n; i++) o.push(r.int(lo, hi)); return o; },
      str: function (n, abc) { abc = abc || "abcdefghijklmnopqrstuvwxyz"; var s = ""; for (var i = 0; i < n; i++) s += abc[Math.floor(next() * abc.length)]; return s; },
      shuffle: function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
      distinct: function (n, lo, hi) { var s = new Set(); while (s.size < n) s.add(r.int(lo, hi)); return r.shuffle(Array.from(s)); },
      matrix: function (rows, cols, lo, hi) { var m = []; for (var i = 0; i < rows; i++) m.push(r.arr(cols, lo, hi)); return m; }
    };
    return r;
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function show(v) { var s = JSON.stringify(norm(v)); return s === undefined ? "undefined" : s.length > 2000 ? s.slice(0, 2000) + "…" : s; }
  return { rng: rng, hash: hash, ListNode: ListNode, TreeNode: TreeNode, conv: conv, compare: compare, runFunction: runFunction, runDesign: runDesign, show: show, clone: clone, norm: norm };
})();
if (typeof module !== "undefined") module.exports = Harness;
