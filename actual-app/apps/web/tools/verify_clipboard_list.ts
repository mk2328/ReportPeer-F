/**
 * Regression checks for clipboard → list ContentBlock parsing.
 * Run: npx --yes tsx tools/verify_clipboard_list.ts
 */

import assert from "node:assert/strict";
import { parseClipboardList, parsePlainTextList } from "../src/lib/parseClipboardList";
import { parseClipboardTable } from "../src/lib/parseClipboardTable";

function assertPlainTextIgnored() {
  assert.equal(parseClipboardList("", "Hello world"), null);
  assert.equal(parseClipboardList("<p>Hi</p>", "Hi"), null);
  assert.equal(parseClipboardList("", "line one\nline two"), null);
  assert.equal(parseClipboardList("", "- only one bullet"), null);
  console.log("PASS plain paragraph paste ignored");
}

function assertHtmlBulletList() {
  const html = `
    <html><body>
      <ul>
        <li>Alpha</li>
        <li>Beta</li>
        <li>Gamma</li>
      </ul>
    </body></html>`;
  const list = parseClipboardList(html, "- Alpha\n- Beta\n- Gamma");
  assert.ok(list);
  assert.equal(list!.type, "list");
  assert.equal(list!.listType, "bullet");
  assert.equal(list!.items.length, 3);
  assert.equal(list!.items[0].text, "Alpha");
  assert.equal(list!.items[0].level, 1);
  assert.equal(list!.items[1].text, "Beta");
  assert.equal(list!.items[2].text, "Gamma");
  assert.ok(list!.id.startsWith("list-"));
  assert.ok(list!.items[0].id.startsWith("li-"));
  console.log("PASS Word/HTML bullet list");
}

function assertHtmlNumberedList() {
  const html = `<ol><li>First</li><li>Second</li><li>Third</li></ol>`;
  const list = parseClipboardList(html, "1. First\n2. Second\n3. Third");
  assert.ok(list);
  assert.equal(list!.listType, "number");
  assert.equal(list!.items.map((item) => item.text).join("|"), "First|Second|Third");
  console.log("PASS HTML numbered list");
}

function assertNestedList() {
  const html = `
    <ul>
      <li>Parent
        <ul>
          <li>Child A</li>
          <li>Child B</li>
        </ul>
      </li>
      <li>Sibling</li>
    </ul>`;
  const list = parseClipboardList(html, "");
  assert.ok(list);
  assert.equal(list!.listType, "bullet");
  assert.equal(list!.items.length, 4);
  assert.equal(list!.items[0].text, "Parent");
  assert.equal(list!.items[0].level, 1);
  assert.equal(list!.items[1].text, "Child A");
  assert.equal(list!.items[1].level, 2);
  assert.equal(list!.items[2].text, "Child B");
  assert.equal(list!.items[2].level, 2);
  assert.equal(list!.items[3].text, "Sibling");
  assert.equal(list!.items[3].level, 1);
  console.log("PASS nested list → item.level");
}

function assertPlainBulletFallback() {
  const plain = "• One\n• Two\n• Three";
  const parsed = parsePlainTextList(plain);
  assert.ok(parsed);
  assert.equal(parsed!.listType, "bullet");
  assert.equal(parsed!.items.length, 3);

  const list = parseClipboardList("", plain);
  assert.ok(list);
  assert.equal(list!.items.map((item) => item.text).join("|"), "One|Two|Three");
  console.log("PASS plain-text bullet fallback");
}

function assertPlainNumberFallback() {
  const plain = "1. Red\n2. Green\n3. Blue";
  const list = parseClipboardList("", plain);
  assert.ok(list);
  assert.equal(list!.listType, "number");
  assert.equal(list!.items.map((item) => item.text).join("|"), "Red|Green|Blue");
  console.log("PASS plain-text numbered fallback");
}

function assertWordMsoList() {
  const html = `
    <p class=MsoListParagraph style='mso-list:l0 level1 lfo1'>
      <span style='mso-list:Ignore'>·</span>First item
    </p>
    <p class=MsoListParagraph style='mso-list:l0 level1 lfo1'>
      <span style='mso-list:Ignore'>·</span>Second item
    </p>`;
  const list = parseClipboardList(html, "First item\nSecond item");
  assert.ok(list);
  assert.equal(list!.listType, "bullet");
  assert.equal(list!.items.length, 2);
  assert.equal(list!.items[0].text, "First item");
  assert.equal(list!.items[1].text, "Second item");
  console.log("PASS Word MsoListParagraph paste");
}

function assertTablePasteStillWins() {
  const html = `
    <table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>
    <ul><li>Should not become a list when table is present first in paste handler</li></ul>`;
  const table = parseClipboardTable(html, "A\tB\n1\t2");
  assert.ok(table);
  assert.equal(table!.columns.length, 2);
  // List parser may still see the ul, but ParagraphBlock tries table first.
  const list = parseClipboardList(html, "");
  assert.ok(list);
  console.log("PASS table parser still works (table tried first in paste handler)");
}

function main() {
  assertPlainTextIgnored();
  assertHtmlBulletList();
  assertHtmlNumberedList();
  assertNestedList();
  assertPlainBulletFallback();
  assertPlainNumberFallback();
  assertWordMsoList();
  assertTablePasteStillWins();
  console.log("ALL clipboard list checks passed");
}

main();
