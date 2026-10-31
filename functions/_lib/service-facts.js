// Owner-provided operating definition, not independent registration verification.
// Version identifies this code contract; it is not a retroactive effective date.
export const SERVICE_FACTS = Object.freeze({
  factsVersion: '1',
  definition: '클라임유심은 유심으로 받을 수 있는 혜택을 확인해주는 플랫폼입니다.',
  flow: Object.freeze([
    '유심 혜택 확인', '적용 대상 확인', '조건·보상금 안내', '진행 희망 확인',
    '희망 시 진행 지원', '조건 충족 확인', '조건에 맞는 보상금 지급'
  ]),
  customerCostWon: 0,
  separateContractRequired: false,
  separateTelecomPaymentRequired: false
});
