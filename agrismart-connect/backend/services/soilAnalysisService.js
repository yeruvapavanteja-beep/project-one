// ============================================================
// Soil Analysis Service
// Turns raw soil numbers into a plain-language summary.
// This is decision-support only — see disclaimer in output.
// ============================================================

function interpretPh(ph) {
  if (ph < 5.5) return { label: 'Acidic', note: 'Soil is on the acidic side; many vegetables prefer closer to neutral.' };
  if (ph > 7.5) return { label: 'Alkaline', note: 'Soil is on the alkaline side; this can limit nutrient uptake for some crops.' };
  return { label: 'Near Neutral', note: 'pH is in a generally favorable range for a wide variety of crops.' };
}

function interpretNutrient(value, thresholds, name) {
  if (value == null) return null;
  if (value < thresholds.low) return `${name} is on the lower side — consider organic matter or balanced fertilization.`;
  if (value > thresholds.high) return `${name} is on the higher side — avoid over-application to prevent nutrient imbalance.`;
  return `${name} is within a moderate, generally workable range.`;
}

function overallCondition(ph, n, p, k, organicMatter) {
  let score = 0;
  let total = 0;

  total++; if (ph >= 6.0 && ph <= 7.0) score++;
  if (n != null) { total++; if (n >= 60 && n <= 150) score++; }
  if (p != null) { total++; if (p >= 30 && p <= 80) score++; }
  if (k != null) { total++; if (k >= 30 && k <= 100) score++; }
  if (organicMatter != null) { total++; if (organicMatter >= 2) score++; }

  const ratio = total > 0 ? score / total : 0;
  if (ratio >= 0.75) return 'Good';
  if (ratio >= 0.4) return 'Moderate';
  return 'Needs Improvement';
}

function suitableCategories(ph, waterAvailability, soilType) {
  const categories = [];
  if (ph >= 5.5 && ph <= 7.5) categories.push('Vegetables');
  if (ph >= 5.5 && ph <= 7.5 && (waterAvailability === 'medium' || waterAvailability === 'high' || waterAvailability === 'abundant')) {
    categories.push('Fruits');
  }
  if (ph >= 6.0 && ph <= 7.5) categories.push('Leafy Vegetables');
  if (soilType && ['loamy', 'alluvial', 'black'].includes(soilType.toLowerCase())) categories.push('Grains & Pulses');
  return [...new Set(categories)];
}

/**
 * @param {object} input soil + farm parameters
 * @returns {object} soil analysis summary
 */
function analyzeSoil(input) {
  const { soilPh, nitrogen, phosphorus, potassium, organicMatter, soilType, waterAvailability } = input;

  const phInfo = interpretPh(soilPh);
  const observations = [phInfo.note];

  const nNote = interpretNutrient(nitrogen, { low: 60, high: 150 }, 'Nitrogen (N)');
  const pNote = interpretNutrient(phosphorus, { low: 30, high: 80 }, 'Phosphorus (P)');
  const kNote = interpretNutrient(potassium, { low: 30, high: 100 }, 'Potassium (K)');
  [nNote, pNote, kNote].forEach((n) => n && observations.push(n));

  if (organicMatter != null) {
    observations.push(
      organicMatter < 1.5
        ? 'Organic matter is low; adding compost or manure can improve soil structure and fertility over time.'
        : 'Organic matter level is reasonable for supporting healthy soil biology.'
    );
  }

  const condition = overallCondition(soilPh, nitrogen, phosphorus, potassium, organicMatter);
  const categories = suitableCategories(soilPh, waterAvailability, soilType);

  const nextSteps = [
    'Use these results as one input alongside seasonal and water conditions when choosing crops.',
    'Consider a professional laboratory soil test periodically to confirm field measurements.',
    'Re-test soil after major fertilization or crop cycles to track changes over time.'
  ];
  if (condition === 'Needs Improvement') {
    nextSteps.unshift('Consult a local agricultural extension officer before heavy investment in a new crop.');
  }

  return {
    phLabel: phInfo.label,
    condition, // Good / Moderate / Needs Improvement
    observations,
    suitableCategories: categories,
    nextSteps,
    disclaimer:
      'This soil analysis is a decision-support suggestion generated from the values you entered. ' +
      'It is not a substitute for a certified laboratory soil test or advice from a qualified agricultural expert.'
  };
}

module.exports = { analyzeSoil };
