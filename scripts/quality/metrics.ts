import ts from "typescript";
import type { FileCoverageData } from "istanbul-lib-coverage";

type ConcreteFunction = (ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration
  | ts.ConstructorDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration) & { body: ts.ConciseBody };
function isFunction(node: ts.Node): node is ConcreteFunction {
  return (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)) && !!node.body;
}
function callName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return `${callName(expression.expression)}.${expression.name.text}`;
  if (ts.isCallExpression(expression)) return `${callName(expression.expression)}()`;
  if (ts.isParenthesizedExpression(expression)) return callName(expression.expression);
  return "IIFE";
}
function label(node: ConcreteFunction, source: ts.SourceFile): string {
  if (node.name) return node.name.getText(source);
  if (ts.isConstructorDeclaration(node)) return "constructor";
  let property = ""; let call = "";
  for (let parent = node.parent; parent && !isFunction(parent); parent = parent.parent) {
    if (ts.isVariableDeclaration(parent)) return parent.name.getText(source) + (property ? `.${property}` : "");
    if (!property && ts.isPropertyAssignment(parent)) property = parent.name.getText(source);
    if (!call && ts.isCallExpression(parent)) call = callName(parent.expression);
  }
  return property || (call ? `${call} callback` : "anonymous");
}
export function complexity(body: ts.Node): number {
  let value = 1;
  function visit(node: ts.Node) {
    if (isFunction(node)) return;
    if (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isForStatement(node)
      || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node)
      || ts.isDoStatement(node) || ts.isCaseClause(node) || ts.isCatchClause(node)) value++;
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken,
      ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(node.operatorToken.kind)) value++;
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node)) && node.questionDotToken) value++;
    ts.forEachChild(node, visit);
  }
  visit(body); return value;
}
export function crap(value: number, coverage: number): number { return value ** 2 * (1 - coverage) ** 3 + value; }
export interface FunctionRisk {
  id: string; file: string; name: string; line: number; complexity: number; entered: boolean;
  coverageBasis: "branch" | "function-entry"; covered: number; total: number; coverage: number; crap: number;
}
export function measureFunctions(file: string, text: string, data: FileCoverageData): FunctionRisk[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: { node: ConcreteFunction; id: string; name: string; hits: number; covered: number; total: number; mapped: boolean }[] = [];
  const occurrences = new Map<string, number>();
  function visit(node: ts.Node, parent: string) {
    let owner = parent;
    if (isFunction(node)) {
      const name = label(node, source).replace(/\s+/g, " "); const key = `${parent}/${name}`;
      const count = (occurrences.get(key) ?? 0) + 1; occurrences.set(key, count);
      owner = `${key}#${count}`;
      found.push({ node, id: `${file}::${owner}`, name, hits: 0, covered: 0, total: 0, mapped: false });
    }
    ts.forEachChild(node, (child) => visit(child, owner));
  }
  visit(source, "");
  function ownerAt(line: number, column: number) {
    const position = source.getPositionOfLineAndCharacter(line - 1, column);
    return found.filter(({ node }) => node.getStart(source) <= position && position < node.end)
      .sort((a, b) => (a.node.end - a.node.pos) - (b.node.end - b.node.pos))[0];
  }
  for (const [id, fn] of Object.entries(data.fnMap)) {
    const location = fn.decl?.start ?? fn.loc.start;
    const owner = ownerAt(location.line, location.column);
    if (!owner || owner.mapped) throw new Error(`Cannot map Istanbul function ${file}:${location.line}:${location.column}`);
    owner.hits = data.f[id]; owner.mapped = true;
  }
  for (const [id, branch] of Object.entries(data.branchMap)) {
    const owner = ownerAt(branch.loc.start.line, branch.loc.start.column);
    if (owner) { owner.total += data.b[id].length; owner.covered += data.b[id].filter((hits) => hits > 0).length; }
  }
  return found.map(({ node, id, name, hits, covered, total, mapped }) => {
    if (!mapped) throw new Error(`Production function is missing coverage metadata: ${id}`);
    const coverageBasis = total ? "branch" as const : "function-entry" as const;
    if (!total) { total = 1; covered = hits > 0 ? 1 : 0; }
    const coverage = covered / total;
    const value = complexity(node.body) + node.parameters.reduce((sum, parameter) => sum + (parameter.initializer ? complexity(parameter.initializer) : 0), 0);
    return { id, file, name, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      complexity: value, entered: hits > 0, coverageBasis, covered, total, coverage, crap: crap(value, coverage) };
  });
}
export interface RiskBudget { maxCrap: number; reason: string }
export function regressions(functions: FunctionRisk[], legacy: Record<string, RiskBudget>): string[] {
  const errors: string[] = [];
  for (const fn of functions) {
    const budget = legacy[fn.id];
    if (budget && (!budget.reason.trim() || !Number.isFinite(budget.maxCrap) || budget.maxCrap <= 30)) {
      errors.push(`Invalid legacy budget: ${fn.id}`); continue;
    }
    if (fn.crap > (budget?.maxCrap ?? 30) + 1e-9) errors.push(`${fn.id}: CRAP ${fn.crap.toFixed(4)} exceeds ${budget?.maxCrap ?? 30}`);
  }
  for (const id of Object.keys(legacy)) {
    const fn = functions.find((entry) => entry.id === id);
    if (!fn || fn.crap <= 30 || fn.crap < legacy[id].maxCrap - 1e-9) errors.push(`Remove or lower obsolete legacy budget: ${id}`);
  }
  return errors;
}
