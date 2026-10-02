/**
 * Regression checks for clipboard → ContentTable parsing.
 * Run: npx --yes tsx tools/verify_clipboard_table.ts
 */

import assert from "node:assert/strict";
import {
  buildContentTableFromRows,
  parseClipboardTable,
  parseTsvTableRows,
} from "../src/lib/parseClipboardTable";
import { normalizeTableCell } from "../src/lib/structureUtils";

function cellText(value: unknown): string {
  return normalizeTableCell(value as never).text;
}

function assertPlainPasteIgnored() {
  assert.equal(parseClipboardTable("", "Hello world"), null);
  assert.equal(parseClipboardTable("", "line one\nline two"), null);
  assert.equal(parseClipboardTable("<p>Hi</p>", "Hi"), null);
  assert.equal(parseClipboardTable("", "only\tone tab line"), null);
  console.log("PASS plain-text paste ignored");
}

function assertTsvPaste() {
  const tsv = "Name\tAge\tCity\nAlice\t20\tKarachi\nBob\t21\tLahore";
  const rows = parseTsvTableRows(tsv);
  assert.ok(rows);
  assert.equal(rows!.length, 3);
  assert.equal(rows![0].length, 3);

  const table = parseClipboardTable("", tsv);
  assert.ok(table);
  assert.equal(table!.caption, "");
  assert.equal(table!.columns.map(cellText).join("|"), "Name|Age|City");
  assert.equal(table!.data.length, 2);
  assert.equal(table!.data[0].map(cellText).join("|"), "Alice|20|Karachi");
  assert.equal(table!.data[1].map(cellText).join("|"), "Bob|21|Lahore");
  console.log("PASS TSV / Excel-style paste");
}

function assertHtmlWordLike() {
  const html = `
    <html><body>
    <table border="1">
      <tr>
        <th style="font-weight:bold; text-align:center; background:#D9E2F3">Module</th>
        <th style="font-weight:bold">Status</th>
      </tr>
      <tr>
        <td>Auth</td>
        <td style="color:#C00000"><b>Done</b></td>
      </tr>
      <tr>
        <td colspan="2" style="text-align:center; background-color:rgb(255, 242, 204)">Notes span</td>
      </tr>
    </table>
    </body></html>`;

  const table = parseClipboardTable(html, "Module\tStatus\nAuth\tDone\nNotes span");
  assert.ok(table);
  assert.equal(table!.caption, "");
  assert.equal(table!.columns.length, 2);
  assert.equal(cellText(table!.columns[0]), "Module");
  assert.equal(normalizeTableCell(table!.columns[0]).bold, true);
  assert.equal(normalizeTableCell(table!.columns[0]).align, "center");
  assert.equal(normalizeTableCell(table!.columns[0]).background, "#d9e2f3");

  assert.equal(table!.data.length, 2);
  assert.equal(cellText(table!.data[0][0]), "Auth");
  assert.equal(cellText(table!.data[0][1]), "Done");
  assert.equal(normalizeTableCell(table!.data[0][1]).bold, true);
  assert.equal(normalizeTableCell(table!.data[0][1]).textColor, "#c00000");

  const span = normalizeTableCell(table!.data[1][0]);
  assert.equal(span.text, "Notes span");
  assert.equal(span.colspan, 2);
  assert.equal(span.align, "center");
  assert.equal(span.background, "#fff2cc");
  assert.equal(normalizeTableCell(table!.data[1][1]).hidden, true);
  console.log("PASS Word/HTML table with colspan + formatting");
}

function assertRowspan() {
  const html = `
    <table>
      <tr><th>A</th><th>B</th></tr>
      <tr><td rowspan="2">Merged</td><td>R1</td></tr>
      <tr><td>R2</td></tr>
    </table>`;
  const table = parseClipboardTable(html, "");
  assert.ok(table);
  assert.equal(normalizeTableCell(table!.data[0][0]).rowspan, 2);
  assert.equal(cellText(table!.data[0][0]), "Merged");
  assert.equal(normalizeTableCell(table!.data[1][0]).hidden, true);
  assert.equal(cellText(table!.data[1][1]), "R2");
  console.log("PASS rowspan mapping");
}

function assertSheetsLikeHtml() {
  const html = `<meta charset="utf-8"><table><tbody>
    <tr><td>Q1</td><td>10</td></tr>
    <tr><td>Q2</td><td>20</td></tr>
  </tbody></table>`;
  const table = parseClipboardTable(html, "Q1\t10\nQ2\t20");
  assert.ok(table);
  assert.equal(table!.columns.map(cellText).join("|"), "Q1|10");
  assert.equal(table!.data[0].map(cellText).join("|"), "Q2|20");
  console.log("PASS Google Sheets / browser HTML table");
}

function assertManualGridStillBuilds() {
  const table = buildContentTableFromRows([
    [{ text: "H1" }, { text: "H2" }],
    [{ text: "A" }, { text: "B" }],
  ]);
  assert.ok(table);
  assert.equal(table!.id.startsWith("tbl-"), true);
  assert.equal(table!.caption, "");
  assert.equal(table!.columns.length, 2);
  assert.equal(table!.data.length, 1);
  console.log("PASS manual table shape unchanged");
}

function main() {
  assertPlainPasteIgnored();
  assertTsvPaste();
  assertHtmlWordLike();
  assertRowspan();
  assertSheetsLikeHtml();
  assertManualGridStillBuilds();
  console.log("ALL clipboard table checks passed");
}

main();
