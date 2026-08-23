// ============================================================
// Crop Recommendation Engine (rule-based, v1)
// ------------------------------------------------------------
// Overall Recommendation Score =
//    soil_suitability   * weight
//  + season_suitability * weight
//  + water_suitability  * weight
//  + weather_suitability* weight
//  + demand_score       * weight
//
// Weights are configurable via the recommendation_weights table
// (see WeightModel) so they can be tuned without code changes,
// and this whole module can later be swapped for a Python/ML
// service without changing the controller/API contract —
// callers only depend on `generateRecommendations()`'s output shape.
// ============================================================

const CropMasterModel = require('../models/cropMasterModel');
const WeightModel = require('../models/weightModel');

const WATER_LEVELS = { low: 1, medium: 2, high: 3, abundant: 4 };
const CROP_WATER_LEVELS = { low: 1, medium: 2, high: 3 };

// --- Individual sub-scores, each normalized to a 0-10 scale ---

function scoreSoil(crop, soil) {
  if (!soil) return 5; // neutral if no soil data supplied
  let subScores = [];

  if (crop.ideal_ph_min != null && crop.ideal_ph_max != null && soil.soilPh != null) {
    const { ideal_ph_min: min, ideal_ph_max: max } = crop;
    if (soil.soilPh >= min && soil.soilPh <= max) {
      subScores.push(10);
    } else {
      const distance = soil.soilPh < min ? min - soil.soilPh : soil.soilPh - max;
      subScores.push(Math.max(0, 10 - distance * 4));
    }
  }

  const nutrientCheck = (value, ideal) => {
    if (value == null || ideal == null) return null;
    const diffRatio = Math.abs(value - ideal) / (ideal || 1);
    return Math.max(0, 10 - diffRatio * 10);
  };
  [
    nutrientCheck(soil.nitrogen, crop.ideal_n),
    nutrientCheck(soil.phosphorus, crop.ideal_p),
    nutrientCheck(soil.potassium, crop.ideal_k)
  ].forEach((s) => { if (s != null) subScores.push(s); });

  if (crop.suitable_soil_types && soil.soilType) {
    const types = crop.suitable_soil_types.split(',').map((t) => t.trim().toLowerCase());
    subScores.push(types.includes(soil.soilType.toLowerCase()) ? 10 : 3);
  }

  if (subScores.length === 0) return 5;
  return subScores.reduce((a, b) => a + b, 0) / subScores.length;
}

function scoreSeason(crop, season) {
  if (!season || !crop.suitable_seasons) return 5;
  const seasons = crop.suitable_seasons.split(',').map((s) => s.trim().toLowerCase());
  return seasons.includes(season.toLowerCase()) ? 10 : 2;
}

function scoreWater(crop, waterAvailability) {
  if (!waterAvailability || !crop.water_requirement) return 5;
  const available = WATER_LEVELS[waterAvailability.toLowerCase()] ?? 2;
  const required = CROP_WATER_LEVELS[crop.water_requirement.toLowerCase()] ?? 2;
  if (available >= required) return 10 - Math.min(3, (available - required)); // slight penalty for big oversupply mismatch is minimal
  const deficit = required - available;
  return Math.max(0, 10 - deficit * 4);
}

// Weather is a simple qualitative input from the farmer (temperature band,
// rainfall expectation) since no live weather API is wired in v1.
function scoreWeather(crop, weather) {
  if (!weather || (!weather.temperature && !weather.rainfall)) return 5;
  let score = 7; // default reasonably-favorable baseline
  if (weather.rainfall === 'heavy' && crop.water_requirement === 'low') score -= 3;
  if (weather.rainfall === 'low' && crop.water_requirement === 'high') score -= 3;
  if (weather.temperature === 'extreme_heat' && ['Spinach', 'Cabbage'].includes(crop.crop_name)) score -= 2;
  if (weather.temperature === 'cold' && ['Watermelon', 'Mango'].includes(crop.crop_name)) score -= 2;
  return Math.max(0, Math.min(10, score));
}

function labelFromScore(score) {
  if (score >= 7.5) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}

function buildExplanation(crop, scores) {
  const parts = [];
  if (scores.soil >= 7) parts.push('the entered soil pH and nutrient levels are within a suitable range');
  else if (scores.soil >= 5) parts.push('soil conditions are moderately suitable');
  else parts.push('soil conditions are only partially suitable and may need amendment');

  if (scores.season >= 7) parts.push('the current season is favorable for this crop');
  else if (scores.season < 5) parts.push('the current season is not ideal for this crop');

  if (scores.water >= 7) parts.push('available water supply matches this crop\'s needs well');
  else if (scores.water < 5) parts.push('water availability may be a limiting factor');

  if (scores.demand >= 7) parts.push('market demand outlook is relatively strong');
  else if (scores.demand < 5) parts.push('market demand outlook is currently modest');

  const joined = parts.join(', ');
  return `${crop.crop_name} is recommended because ${joined}.`;
}

/**
 * @param {object} params
 * @param {object} params.soil - { soilPh, nitrogen, phosphorus, potassium, soilType }
 * @param {string} params.season - e.g. 'kharif','rabi','zaid','summer','winter'
 * @param {string} params.waterAvailability - 'low'|'medium'|'high'|'abundant'
 * @param {object} params.weather - { temperature, rainfall } qualitative bands
 * @param {string} [params.district]
 * @returns {Promise<object[]>} ranked list of crop recommendations
 */
async function generateRecommendations({ soil, season, waterAvailability, weather, district }) {
  const [crops, weights] = await Promise.all([
    CropMasterModel.findAll(),
    WeightModel.getActiveWeights()
  ]);

  const w = {
    soil_suitability: weights.soil_suitability ?? 0.3,
    season_suitability: weights.season_suitability ?? 0.2,
    water_suitability: weights.water_suitability ?? 0.2,
    weather_suitability: weights.weather_suitability ?? 0.15,
    demand_score: weights.demand_score ?? 0.15
  };

  const results = [];
  for (const crop of crops) {
    const soilScore = scoreSoil(crop, soil);
    const seasonScore = scoreSeason(crop, season);
    const waterScore = scoreWater(crop, waterAvailability);
    const weatherScore = scoreWeather(crop, weather);
    const demandInfo = await CropMasterModel.getDemandScore(crop.id, { district, season });
    const demandScore = demandInfo.score;

    const overall =
      soilScore * w.soil_suitability +
      seasonScore * w.season_suitability +
      waterScore * w.water_suitability +
      weatherScore * w.weather_suitability +
      demandScore * w.demand_score;

    const scores = { soil: soilScore, season: seasonScore, water: waterScore, weather: weatherScore, demand: demandScore };

    results.push({
      cropMasterId: crop.id,
      cropName: crop.crop_name,
      suitability: labelFromScore(overall),
      overallScore: Math.round(overall * 100) / 100,
      expectedHarvestDays: crop.avg_days_to_harvest,
      waterRequirement: crop.water_requirement,
      demandOutlook: labelFromScore(demandScore),
      isDemandSampleData: demandInfo.isSampleData,
      scoreBreakdown: {
        soilSuitability: Math.round(soilScore * 100) / 100,
        seasonSuitability: Math.round(seasonScore * 100) / 100,
        waterSuitability: Math.round(waterScore * 100) / 100,
        weatherSuitability: Math.round(weatherScore * 100) / 100,
        demandScore: Math.round(demandScore * 100) / 100
      },
      whyThisCrop: buildExplanation(crop, scores)
    });
  }

  results.sort((a, b) => b.overallScore - a.overallScore);
  return results;
}

module.exports = { generateRecommendations };
