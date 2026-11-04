/**
 * 提示詞護欄回歸：鎖定「生活畫像 + 多宮位綜合 + 反單星定型」的必備條款。
 * 規則被誤刪、改弱或退回單星推導時，這裡先失敗。
 */
import { HEMING_PAIR_RULES, LIFE_PORTRAIT_RULES, MULTI_PALACE_RULES } from '../../lib/ai/prompt-style';

const failures: string[] = [];

function expectContains(text: string, keyword: string, label: string) {
  if (!text.includes(keyword)) failures.push(`${label} 缺少「${keyword}」`);
}

function expectNotContains(text: string, keyword: string, label: string) {
  if (text.includes(keyword)) failures.push(`${label} 不應包含「${keyword}」`);
}

// ── 生活畫像：寫什麼、怎麼寫、不能寫什麼 ──
expectContains(LIFE_PORTRAIT_RULES, '生活畫像佔比', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '三分之一', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '原生家庭', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '成長經歷', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '你很可能', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '這就是我', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '硬禁區', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '人名', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '年份', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '醫療診斷', 'LIFE_PORTRAIT_RULES');
expectContains(LIFE_PORTRAIT_RULES, '免責只說一次', 'LIFE_PORTRAIT_RULES');

// ── 多宮位綜合與反單星定型 ──
expectContains(MULTI_PALACE_RULES, '禁止單星定型', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '天府入命', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '福德宮', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '身宮', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '遷移宮', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '三方四正', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '父母宮', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '疾厄宮', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '借對宮', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '強制反差', 'MULTI_PALACE_RULES');
expectContains(MULTI_PALACE_RULES, '條件句', 'MULTI_PALACE_RULES');

// ── 合盤雙人對照 ──
expectContains(HEMING_PAIR_RULES, '先人後關係', 'HEMING_PAIR_RULES');
expectContains(HEMING_PAIR_RULES, '思想頻率', 'HEMING_PAIR_RULES');
expectContains(HEMING_PAIR_RULES, '福德宮', 'HEMING_PAIR_RULES');
expectContains(HEMING_PAIR_RULES, '禁止單星定型', 'HEMING_PAIR_RULES');
expectContains(HEMING_PAIR_RULES, '必然結婚', 'HEMING_PAIR_RULES');

// ── 規則本身不得示範空話或舊的單星語氣 ──
expectNotContains(MULTI_PALACE_RULES, '天生就是', 'MULTI_PALACE_RULES');
expectNotContains(LIFE_PORTRAIT_RULES, '請用溫柔的語氣', 'LIFE_PORTRAIT_RULES');

// ── 長度下限：規則被清空或大幅刪減時攔住 ──
const allRules: Array<[string, string]> = [
  ['LIFE_PORTRAIT_RULES', LIFE_PORTRAIT_RULES],
  ['MULTI_PALACE_RULES', MULTI_PALACE_RULES],
  ['HEMING_PAIR_RULES', HEMING_PAIR_RULES],
];
for (const [label, text] of allRules) {
  if (text.length < 200) failures.push(`${label} 過短（${text.length} 字），疑似被誤刪`);
}

if (failures.length) {
  console.error(`✗ prompt-guardrails 失敗 ${failures.length} 項：`);
  for (const failure of failures) console.error('  - ' + failure);
  process.exit(1);
}

const totalChars = allRules.reduce((sum, [, text]) => sum + text.length, 0);
console.log(`[prompt-guardrails] 三組規則共 ${totalChars} 字，必備條款齊全`);
