import assert from 'node:assert/strict';
import { toTraditionalDisplayText } from '../../lib/ziwei/display-text';

assert.equal(
  toTraditionalDisplayText('财帛、命宫；太阴化禄、巨门化权、铃星'),
  '財帛、命宮；太陰化祿、巨門化權、鈴星',
);
assert.equal(
  toTraditionalDisplayText('轻松发展，农历命宫与大限34岁'),
  '輕鬆發展，農曆命宮與大限34歲',
);
assert.equal(
  toTraditionalDisplayText('空宫、仆役宫、三台、台辅'),
  '空宮、僕役宮、三臺、臺輔',
);

console.log('✓ 排盤動態文字繁體顯示回歸通過');
