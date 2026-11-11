import test from "node:test";
import assert from "node:assert/strict";
import { cellRange } from "../src/domain/grid.js";

test("la limpieza escribe en una raíz controlada dentro del proyecto", async () => {
  const { outputRoot, prepareOutput } = await import("../src/infra/paths.js");
  const directory = process.cwd();
  assert.equal(outputRoot(directory), `${directory}\\out`);
  const dir = await prepareOutput(directory, "co-industrias-delta");
  assert.ok(dir.startsWith(outputRoot(directory)));
});

test("las celdas deben respetar el formato A1", () => {
  assert.equal(cellRange("B3", "C3"), "B3:C3");
  assert.throws(() => cellRange("3B", "C3"));
  assert.throws(() => cellRange("B0", "C3"));
});