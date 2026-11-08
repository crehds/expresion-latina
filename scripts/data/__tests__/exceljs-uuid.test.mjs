import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import ExcelJS from 'exceljs';

// exceljs calls uuid only to id an x14 conditional-formatting extension, and the
// uuid it gets is forced by the package.json overrides (README, "Dependency overrides").
const UPPERCASE_V4_GUID = /^\{[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\}$/;

describe('exceljs with the overridden uuid', () => {
  it('round-trips a data bar, whose x14 extension needs a generated id', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.getCell('A1').value = 10;
    sheet.addConditionalFormatting({
      ref: 'A1:A3',
      rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }] }],
    });

    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load(await workbook.xlsx.writeBuffer());

    const [format] = reread.getWorksheet('Sheet1').conditionalFormattings;
    assert.equal(format.rules[0].type, 'dataBar');
    assert.match(format.rules[0].x14Id, UPPERCASE_V4_GUID);
  });
});
