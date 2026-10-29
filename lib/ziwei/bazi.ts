import type { BaziFacts, BaziPillarFact, TenGod, WuXing } from './types';

const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
const ELEMENTS: WuXing[] = ['木', '火', '土', '金', '水'];
const STEM_ELEMENT: Record<string, WuXing> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土',
  庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const STEM_YIN_YANG: Record<string, '陽' | '陰'> = {
  甲: '陽', 乙: '陰', 丙: '陽', 丁: '陰', 戊: '陽', 己: '陰',
  庚: '陽', 辛: '陰', 壬: '陽', 癸: '陰',
};

// 各支藏干依「本氣、中氣、餘氣」排列；權重僅供透明的簡化強弱估算。
const HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'],
  未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'],
  戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
const HIDDEN_WEIGHTS = [3, 2, 1];

function elementRelation(dayElement: WuXing, otherElement: WuXing): 'same' | 'resource' | 'output' | 'wealth' | 'officer' {
  const dayIndex = ELEMENTS.indexOf(dayElement);
  const otherIndex = ELEMENTS.indexOf(otherElement);
  if (dayIndex === otherIndex) return 'same';
  if ((otherIndex + 1) % 5 === dayIndex) return 'resource';
  if ((dayIndex + 1) % 5 === otherIndex) return 'output';
  if ((dayIndex + 2) % 5 === otherIndex) return 'wealth';
  return 'officer';
}

function tenGod(dayMaster: string, otherStem: string): TenGod {
  const dayElement = STEM_ELEMENT[dayMaster];
  const otherElement = STEM_ELEMENT[otherStem];
  const samePolarity = STEM_YIN_YANG[dayMaster] === STEM_YIN_YANG[otherStem];
  const relation = elementRelation(dayElement, otherElement);
  if (relation === 'same') return samePolarity ? '比肩' : '劫財';
  if (relation === 'resource') return samePolarity ? '偏印' : '正印';
  if (relation === 'output') return samePolarity ? '食神' : '傷官';
  if (relation === 'wealth') return samePolarity ? '偏財' : '正財';
  return samePolarity ? '七殺' : '正官';
}

function validPillar(pillar: string): boolean {
  return [...pillar].length === 2 && STEMS.includes(pillar[0]) && BRANCHES.includes(pillar[1]);
}

export function calculateBaziFacts(pillars: readonly string[]): BaziFacts | undefined {
  if (pillars.length !== 4 || !pillars.every(validPillar)) return undefined;
  const dayMaster = pillars[2][0];
  const dayElement = STEM_ELEMENT[dayMaster];
  const pillarFacts: BaziPillarFact[] = pillars.map((pillar) => ({
    pillar,
    stemTenGod: tenGod(dayMaster, pillar[0]),
    hiddenStems: HIDDEN_STEMS[pillar[1]].map((stem, index) => ({
      stem,
      element: STEM_ELEMENT[stem],
      tenGod: tenGod(dayMaster, stem),
      weight: HIDDEN_WEIGHTS[index],
    })),
  }));

  const fiveElementWeights: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const roleWeight = { same: 1, resource: 0.8, output: 1, wealth: 1, officer: 1 };
  let supportWeight = 0;
  let drainWeight = 0;
  for (const [index, pillar] of pillars.entries()) {
    const stem = pillar[0];
    const stemElement = STEM_ELEMENT[stem];
    fiveElementWeights[stemElement] += 1;
    const stemRelation = elementRelation(dayElement, stemElement);
    const visibleWeight = index === 2 ? 1.25 : 1;
    if (stemRelation === 'same' || stemRelation === 'resource') supportWeight += roleWeight[stemRelation] * visibleWeight;
    else drainWeight += visibleWeight;

    for (const [hiddenIndex, hiddenStem] of HIDDEN_STEMS[pillar[1]].entries()) {
      const weight = HIDDEN_WEIGHTS[hiddenIndex];
      const element = STEM_ELEMENT[hiddenStem];
      fiveElementWeights[element] += weight;
      const relation = elementRelation(dayElement, element);
      const weightedSupport = weight * (relation === 'resource' ? 0.8 : 1);
      if (relation === 'same' || relation === 'resource') supportWeight += weightedSupport;
      else drainWeight += weight;
    }
  }

  // 月令只加作一項明示的季節修正，不宣稱取代完整格局、通根與合沖判讀。
  const monthMainStem = HIDDEN_STEMS[pillars[1][1]][0];
  const monthRelation = elementRelation(dayElement, STEM_ELEMENT[monthMainStem]);
  const monthModifier = monthRelation === 'same' ? 2
    : monthRelation === 'resource' ? 1.5
      : monthRelation === 'officer' ? -2
        : monthRelation === 'output' ? -1.5
          : -1;
  const score = Number((supportWeight - drainWeight + monthModifier).toFixed(2));
  const strengthLabel: BaziFacts['strength']['label'] = score >= 2 ? '偏強' : score <= -2 ? '偏弱' : '中和';

  return {
    dayMaster,
    dayMasterElement: dayElement,
    pillars: pillarFacts,
    fiveElementWeights,
    strength: {
      score,
      label: strengthLabel,
      supportWeight: Number(supportWeight.toFixed(2)),
      drainWeight: Number(drainWeight.toFixed(2)),
      monthModifier,
      method: '透干與藏干按本氣/中氣/餘氣加權，另以月令作簡化修正；未納入合沖刑害、調候或流派差異，僅作可重現的初步指標。',
    },
  };
}
