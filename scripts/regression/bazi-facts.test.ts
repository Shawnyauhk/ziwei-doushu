import assert from 'node:assert/strict';
import { calculateBaziFacts } from '../../lib/ziwei/bazi';

const facts = calculateBaziFacts(['甲子', '丙寅', '甲子', '丁卯']);
assert.ok(facts, 'valid four pillars should produce facts');
assert.equal(facts.dayMaster, '甲');
assert.equal(facts.dayMasterElement, '木');
assert.deepEqual(facts.pillars.map((pillar) => pillar.stemTenGod), ['比肩', '食神', '比肩', '傷官']);
assert.deepEqual(facts.pillars[0].hiddenStems, [
  { stem: '癸', element: '水', tenGod: '正印', weight: 3 },
]);
assert.deepEqual(facts.pillars[1].hiddenStems.map((hidden) => hidden.stem), ['甲', '丙', '戊']);
assert.equal(facts.pillars[1].hiddenStems[2].tenGod, '偏財');
assert.ok(Number.isFinite(facts.strength.score));
assert.ok(['偏強', '中和', '偏弱'].includes(facts.strength.label));
assert.equal(calculateBaziFacts(['甲子', '錯誤', '甲子', '丁卯']), undefined);
assert.equal(calculateBaziFacts(['甲子']), undefined);

console.log('bazi facts regression passed');
