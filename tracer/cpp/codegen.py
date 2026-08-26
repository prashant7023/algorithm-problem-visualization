"""Generate a compilable harness from the user's solution + the input specs.

Returns (source, user_line_start, user_line_end) so the driver can both restrict
tracing to user lines and map generated line numbers back to the user's editor.
"""

PREAMBLE = """#include <bits/stdc++.h>
using namespace std;
"""

LIST_DEF = """struct ListNode {
  int val; ListNode *next;
  ListNode():val(0),next(nullptr){}
  ListNode(int x):val(x),next(nullptr){}
  ListNode(int x, ListNode *n):val(x),next(n){}
};
"""
TREE_DEF = """struct TreeNode {
  int val; TreeNode *left; TreeNode *right;
  TreeNode():val(0),left(nullptr),right(nullptr){}
  TreeNode(int x):val(x),left(nullptr),right(nullptr){}
  TreeNode(int x, TreeNode *l, TreeNode *r):val(x),left(l),right(r){}
};
"""

LIST_HELPER = """static ListNode* __algotrace_build_list(vector<int> v,int pos){
  vector<ListNode*> ns; ListNode* head=nullptr; ListNode* tail=nullptr;
  for(size_t i=0;i<v.size();++i){ ListNode* n=new ListNode(v[i]); ns.push_back(n);
    if(!head) head=n; else tail->next=n; tail=n; }
  if(pos>=0 && tail) tail->next=ns[pos];
  return head;
}
"""

TREE_HELPER = """static TreeNode* __algotrace_build_tree(vector<int> v,vector<int> present){
  if(v.empty()||!present[0]) return nullptr;
  vector<TreeNode*> ns(v.size(),nullptr);
  for(size_t i=0;i<v.size();++i) if(present[i]) ns[i]=new TreeNode(v[i]);
  for(size_t i=0,c=1;i<v.size()&&c<v.size();++i){ if(!ns[i]) continue;
    if(c<v.size()) ns[i]->left=ns[c++];
    if(c<v.size()) ns[i]->right=ns[c++]; }
  return ns[0];
}
"""


def _cpp_int_list(vals):
    return "{" + ",".join(str(int(x)) for x in vals) + "}"


def _arg_decl(i, spec):
    """Return (declaration_lines, expr_to_pass)."""
    t = spec["type"]
    var = f"a{i}"
    if t == "int":
        return [f"  int {var} = {int(spec['value'])};"], var
    if t == "float":
        return [f"  double {var} = {float(spec['value'])};"], var
    if t == "bool":
        return [f"  bool {var} = {'true' if spec['value'] else 'false'};"], var
    if t == "string":
        s = str(spec["value"]).replace("\\", "\\\\").replace('"', '\\"')
        return [f'  string {var} = "{s}";'], var
    if t == "array":
        vals = spec["value"]
        if all(isinstance(x, str) for x in vals):
            items = ",".join('"' + str(x).replace('"', '\\"') + '"' for x in vals)
            return [f"  vector<string> {var} = {{{items}}};"], var
        return [f"  vector<int> {var} = {_cpp_int_list(vals)};"], var
    if t == "matrix":
        rows = ",".join(_cpp_int_list(r) for r in spec["value"])
        return [f"  vector<vector<int>> {var} = {{{rows}}};"], var
    if t == "linkedlist":
        pos = spec.get("pos", -1)
        return [f"  ListNode* {var} = __algotrace_build_list({_cpp_int_list(spec['values'])},{pos});"], var
    if t in ("tree", "binarytree"):
        vals = spec["values"]
        present = [0 if v is None else 1 for v in vals]
        clean = [0 if v is None else int(v) for v in vals]
        return [
            f"  TreeNode* {var} = __algotrace_build_tree({_cpp_int_list(clean)},{_cpp_int_list(present)});"
        ], var
    raise ValueError(f"unsupported C++ arg type: {t}")


def generate(code: str, entry: str, args: list):
    needs_list = any(a["type"] == "linkedlist" for a in args)
    needs_tree = any(a["type"] in ("tree", "binarytree") for a in args)
    uses_solution = "class Solution" in code or "struct Solution" in code

    defines = lambda name: f"struct {name}" in code or f"class {name}" in code
    pre = [PREAMBLE]
    if needs_list and not defines("ListNode"):
        pre.append(LIST_DEF)
    if needs_tree and not defines("TreeNode"):
        pre.append(TREE_DEF)
    pre_text = "".join(pre)

    helpers = (LIST_HELPER if needs_list else "") + (TREE_HELPER if needs_tree else "")

    header = pre_text + helpers
    user_line_start = header.count("\n") + 1
    body = header + code
    if not body.endswith("\n"):
        body += "\n"
    user_line_end = body.count("\n")

    decls, exprs = [], []
    for i, spec in enumerate(args):
        d, e = _arg_decl(i, spec)
        decls += d
        exprs.append(e)

    call = f"{entry}(" + ", ".join(exprs) + ")"
    invoke = f"  Solution __sol; __sol.{call};" if uses_solution else f"  {call};"

    main = ["int main(){"] + decls + [invoke, "  return 0;", "}", ""]
    source = body + "\n".join(main)
    return source, user_line_start, user_line_end
