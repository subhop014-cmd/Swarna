import { Decimal } from 'decimal.js';
import { GoldPurityCode, PurityStandard } from '../types';

// Configure Decimal.js precision for financial & metallurgical calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const PURITY_STANDARDS: Record<GoldPurityCode, PurityStandard> = {
  '24K': {
    code: '24K',
    name: '24 Karat (Fine Gold)',
    fineness: 999.9,
    hallmarkSymbol: '999',
    description: 'Pure 99.9% bullion gold, bars & coins',
  },
  '22K': {
    code: '22K',
    name: '22 Karat (BIS 916)',
    fineness: 916.0,
    hallmarkSymbol: '916',
    description: 'Standard Indian bridal & traditional jewellery',
  },
  '20K': {
    code: '20K',
    name: '20 Karat',
    fineness: 833.0,
    hallmarkSymbol: '833',
    description: 'Traditional antique & temple jewellery',
  },
  '18K': {
    code: '18K',
    name: '18 Karat (BIS 750)',
    fineness: 750.0,
    hallmarkSymbol: '750',
    description: 'Studded diamond jewellery, modern daily wear',
  },
  '14K': {
    code: '14K',
    name: '14 Karat (BIS 585)',
    fineness: 585.0,
    hallmarkSymbol: '585',
    description: 'Lightweight & stone-intensive ornaments',
  },
  '9K': {
    code: '9K',
    name: '9 Karat (BIS 375)',
    fineness: 375.0,
    hallmarkSymbol: '375',
    description: 'Affordable modern alloy jewellery',
  },
};

/**
 * Calculates Fine Gold equivalent (100% pure 999.9 equivalent)
 * Fine Gold = Net Weight * (Fineness / 1000)
 */
export function calculateFineGold(
  netWeightGrams: number | string | Decimal,
  fineness: number | string | Decimal
): Decimal {
  const w = new Decimal(netWeightGrams || 0);
  const f = new Decimal(fineness || 0);
  return w.mul(f).div(1000).toDecimalPlaces(4);
}

/**
 * Calculates net gold weight = gross weight - non-gold/stone weight
 */
export function calculateNetGoldWeight(
  grossWeight: number | string | Decimal,
  nonGoldWeight: number | string | Decimal
): Decimal {
  const g = new Decimal(grossWeight || 0);
  const ng = new Decimal(nonGoldWeight || 0);
  const net = g.minus(ng);
  return net.isNegative() ? new Decimal(0) : net.toDecimalPlaces(3);
}

export interface WastageReconciliationResult {
  issuedNet: Decimal;
  returnedJewelleryNet: Decimal;
  returnedScrap: Decimal;
  totalAccountedWeight: Decimal;
  actualLoss: Decimal;
  allowedWastage: Decimal;
  excessLoss: Decimal;
  isExcessLoss: boolean;
  recoveryPercentage: Decimal;
}

/**
 * Calculates Karigar production wastage & reconciles loss
 */
export function calculateWastageReconciliation(
  issuedNetGrams: number | string | Decimal,
  returnedJewelleryNetGrams: number | string | Decimal,
  returnedScrapGrams: number | string | Decimal,
  agreedWastagePercent: number | string | Decimal
): WastageReconciliationResult {
  const issued = new Decimal(issuedNetGrams || 0);
  const returnedJewellery = new Decimal(returnedJewelleryNetGrams || 0);
  const scrap = new Decimal(returnedScrapGrams || 0);
  const wastagePct = new Decimal(agreedWastagePercent || 0);

  const totalAccounted = returnedJewellery.plus(scrap);
  // Actual loss = Issued - (Finished + Scrap)
  const actualLoss = issued.minus(totalAccounted).toDecimalPlaces(3);
  // Allowed wastage = Issued * (agreedWastagePercent / 100)
  const allowedWastage = issued.mul(wastagePct).div(100).toDecimalPlaces(3);
  // Excess loss = actualLoss - allowedWastage
  const excessLoss = actualLoss.minus(allowedWastage).toDecimalPlaces(3);

  const recoveryPct = issued.isZero()
    ? new Decimal(100)
    : totalAccounted.div(issued).mul(100).toDecimalPlaces(2);

  return {
    issuedNet: issued,
    returnedJewelleryNet: returnedJewellery,
    returnedScrap: scrap,
    totalAccountedWeight: totalAccounted,
    actualLoss: actualLoss.isNegative() ? new Decimal(0) : actualLoss,
    allowedWastage,
    excessLoss: excessLoss.isNegative() ? new Decimal(0) : excessLoss,
    isExcessLoss: excessLoss.gt(0),
    recoveryPercentage: recoveryPct,
  };
}

/**
 * Calculates melting and conversion loss / yield
 */
export function calculateMeltingConversion(
  inputs: Array<{ weightGrams: number | string; fineness: number | string }>,
  outputGrossGrams: number | string,
  outputFineness: number | string
) {
  let totalInputNet = new Decimal(0);
  let totalInputFine = new Decimal(0);

  for (const item of inputs) {
    const w = new Decimal(item.weightGrams || 0);
    const f = new Decimal(item.fineness || 0);
    totalInputNet = totalInputNet.plus(w);
    totalInputFine = totalInputFine.plus(w.mul(f).div(1000));
  }

  const outWeight = new Decimal(outputGrossGrams || 0);
  const outFine = outWeight.mul(new Decimal(outputFineness || 0)).div(1000);

  const weightLoss = totalInputNet.minus(outWeight).toDecimalPlaces(3);
  const fineLoss = totalInputFine.minus(outFine).toDecimalPlaces(4);

  return {
    totalInputNetGrams: totalInputNet.toDecimalPlaces(3),
    totalInputFineGrams: totalInputFine.toDecimalPlaces(4),
    outputNetGrams: outWeight.toDecimalPlaces(3),
    outputFineGrams: outFine.toDecimalPlaces(4),
    weightLossGrams: weightLoss,
    fineGoldLossGrams: fineLoss,
  };
}

export interface PureToGoldAlloyResult {
  pureWeightGrams: Decimal;
  pureFineness: Decimal;
  targetFineness: Decimal;
  inputFineGoldGrams: Decimal;
  expectedTargetWeightGrams: Decimal;
  requiredAlloyGrams: Decimal;
  copperGrams: Decimal;
  silverGrams: Decimal;
  effectiveOutputGrams: Decimal;
  outputFineGoldGrams: Decimal;
  meltingLossGrams: Decimal;
  fineGoldLossGrams: Decimal;
}

/**
 * Calculates Pure Gold -> Ornament Gold alloying conversion (e.g. 24K 999.9 -> 22K 916.0)
 * Computes exact Copper + Silver alloy to add, expected yield weight, and furnace loss.
 */
export function calculatePureToGoldAlloy(params: {
  pureWeightGrams: number | string | Decimal;
  pureFineness?: number | string | Decimal;
  targetFineness: number | string | Decimal;
  copperRatioPercent?: number | string | Decimal;
  actualOutputGrams?: number | string | Decimal;
}): PureToGoldAlloyResult {
  const pureWt = Decimal.max(0, new Decimal(params.pureWeightGrams || 0));
  const pureFinePermille = Decimal.max(0, new Decimal(params.pureFineness ?? 999.9));
  const targetFinePermille = Decimal.max(0, new Decimal(params.targetFineness || 916.0));
  const cuRatio = Decimal.min(
    100,
    Decimal.max(0, new Decimal(params.copperRatioPercent ?? 70))
  );

  const inputFine = pureWt.mul(pureFinePermille).div(1000).toDecimalPlaces(4);

  let expectedTargetWt = new Decimal(0);
  if (pureWt.gt(0) && targetFinePermille.gt(0)) {
    if (targetFinePermille.gte(pureFinePermille)) {
      expectedTargetWt = pureWt.toDecimalPlaces(3);
    } else {
      expectedTargetWt = pureWt
        .mul(pureFinePermille)
        .div(targetFinePermille)
        .toDecimalPlaces(3);
    }
  }

  const requiredAlloy = Decimal.max(0, expectedTargetWt.minus(pureWt)).toDecimalPlaces(3);
  const copperWt = requiredAlloy.mul(cuRatio).div(100).toDecimalPlaces(3);
  const silverWt = Decimal.max(0, requiredAlloy.minus(copperWt)).toDecimalPlaces(3);

  const hasActualOutput =
    params.actualOutputGrams !== undefined &&
    params.actualOutputGrams !== '' &&
    new Decimal(params.actualOutputGrams || 0).gt(0);

  const effectiveOut = hasActualOutput
    ? new Decimal(params.actualOutputGrams || 0).toDecimalPlaces(3)
    : expectedTargetWt;

  const outFine = effectiveOut.mul(targetFinePermille).div(1000).toDecimalPlaces(4);
  const meltingLoss = expectedTargetWt.minus(effectiveOut).toDecimalPlaces(3);
  const fineLoss = inputFine.minus(outFine).toDecimalPlaces(4);

  return {
    pureWeightGrams: pureWt.toDecimalPlaces(3),
    pureFineness: pureFinePermille,
    targetFineness: targetFinePermille,
    inputFineGoldGrams: inputFine,
    expectedTargetWeightGrams: expectedTargetWt,
    requiredAlloyGrams: requiredAlloy,
    copperGrams: copperWt,
    silverGrams: silverWt,
    effectiveOutputGrams: effectiveOut,
    outputFineGoldGrams: outFine,
    meltingLossGrams: meltingLoss,
    fineGoldLossGrams: fineLoss,
  };
}

/**
 * Calculates an invoice item line with full Indian GST breakdown
 */
export function calculateInvoiceItem(params: {
  grossWeightGrams: number | string;
  stoneWeightGrams: number | string;
  fineness: number | string;
  goldRatePerGram: number | string;
  wastagePercent: number | string;
  makingChargeType: 'PER_GRAM' | 'PERCENTAGE' | 'FIXED';
  makingChargeRate: number | string;
  stoneChargesINR?: number | string;
  otherChargesINR?: number | string;
  gstRatePercent?: number | string; // default 3% for jewellery
}) {
  const gross = new Decimal(params.grossWeightGrams || 0);
  const stone = new Decimal(params.stoneWeightGrams || 0);
  const net = calculateNetGoldWeight(gross, stone);
  const fineness = new Decimal(params.fineness || 916);
  const fineGold = calculateFineGold(net, fineness);

  const goldRate = new Decimal(params.goldRatePerGram || 0);
  // Gold Value = net * goldRate
  const goldValue = net.mul(goldRate).toDecimalPlaces(2);

  // Wastage charge (Ghat / Kadas)
  const wastagePct = new Decimal(params.wastagePercent || 0);
  const wastageWeight = net.mul(wastagePct).div(100).toDecimalPlaces(3);
  const wastageValue = wastageWeight.mul(goldRate).toDecimalPlaces(2);

  // Making charges calculation
  const mcRate = new Decimal(params.makingChargeRate || 0);
  let makingCharges = new Decimal(0);
  if (params.makingChargeType === 'PER_GRAM') {
    makingCharges = gross.mul(mcRate).toDecimalPlaces(2);
  } else if (params.makingChargeType === 'PERCENTAGE') {
    makingCharges = goldValue.mul(mcRate).div(100).toDecimalPlaces(2);
  } else {
    // FIXED
    makingCharges = mcRate.toDecimalPlaces(2);
  }

  const stoneCharges = new Decimal(params.stoneChargesINR || 0).toDecimalPlaces(2);
  const otherCharges = new Decimal(params.otherChargesINR || 0).toDecimalPlaces(2);

  // Taxable amount before GST
  const taxableAmount = goldValue
    .plus(wastageValue)
    .plus(makingCharges)
    .plus(stoneCharges)
    .plus(otherCharges)
    .toDecimalPlaces(2);

  const gstRate = new Decimal(params.gstRatePercent !== undefined ? params.gstRatePercent : 3);
  const gstAmount = taxableAmount.mul(gstRate).div(100).toDecimalPlaces(2);
  const lineTotal = taxableAmount.plus(gstAmount).toDecimalPlaces(2);

  return {
    grossWeightGrams: gross.toNumber(),
    stoneWeightGrams: stone.toNumber(),
    netGoldWeightGrams: net.toNumber(),
    fineGoldWeightGrams: fineGold.toNumber(),
    goldValueINR: goldValue.toNumber(),
    wastageWeightGrams: wastageWeight.toNumber(),
    wastageValueINR: wastageValue.toNumber(),
    makingChargesINR: makingCharges.toNumber(),
    stoneChargesINR: stoneCharges.toNumber(),
    otherChargesINR: otherCharges.toNumber(),
    taxableAmountINR: taxableAmount.toNumber(),
    gstRatePercent: gstRate.toNumber(),
    gstAmountINR: gstAmount.toNumber(),
    lineTotalINR: lineTotal.toNumber(),
  };
}

/**
 * Format weights in Indian jewellery standard (3 decimal places, e.g. "12.450 g")
 */
export function formatGrams(weight: number | string | Decimal | null | undefined, decimals = 3): string {
  if (weight === null || weight === undefined) return '0.000 g';
  const d = new Decimal(weight);
  return `${d.toFixed(decimals)} g`;
}

/**
 * Format currency using standard Indian numbering format (Lakhs & Crores e.g. "₹ 1,25,000.00")
 */
export function formatINR(amount: number | string | Decimal | null | undefined): string {
  if (amount === null || amount === undefined) return '₹ 0.00';
  const d = new Decimal(amount);
  const isNeg = d.isNegative();
  const abs = d.abs().toFixed(2);
  const parts = abs.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian currency comma separation logic
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherDigits = integerPart.substring(0, integerPart.length - 3);
    const formattedOther = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    integerPart = formattedOther + ',' + lastThree;
  }

  return `${isNeg ? '-' : ''}₹ ${integerPart}.${decimalPart}`;
}
