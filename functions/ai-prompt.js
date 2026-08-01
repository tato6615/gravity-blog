/**
 * AI Product Review Prompt System
 * 
 * ใช้ร่วมกับ pipeline.js เพื่อสร้างรีวิวสินค้าที่มีคุณภาพสูง
 * ไม่ใช่ template ซ้ำๆ
 *
 * รวม 2 checkpoint เพิ่มเติม:
 *  - checkDemandSignal()      -> เช็คก่อน generate ว่าสินค้านี้น่าจะขายได้ไหม
 *  - scoreReviewMarketFit()   -> เช็คหลัง generate ว่ารีวิวคุณภาพพอจะ publish ไหม
 */

export const SYSTEM_PROMPT = `You are an expert product reviewer for GRAVITY OS. Your job is to write 
detailed, honest product reviews that read like they came from a real 
expert, not a template.

## Core Rules:
1. ALWAYS include at least 1 specific numeric spec (weight, dimensions, 
   battery hours, capacity, size, age rating, etc.)
2. ALWAYS identify at least 1 real downside or limitation 
   (not just "might not be for everyone")
3. ALWAYS write a "NOT recommended for" section that explains specific 
   use cases where this product fails
4. NEVER use filler phrases like "perfect for anyone" or "great for 
   everyone" — be specific about WHO benefits and WHO doesn't
5. Write analytically based on the product's real specs, listed reviews, 
   and comparable products. Vary sentence structure and phrasing so no 
   two reviews sound alike — but do NOT fabricate first-person testing 
   claims (e.g. "I tested this for 3 weeks", "when I used it at the 
   beach") unless a human reviewer has actually verified the product.
6. After the first mention, refer to the product using short forms 
   (pronouns like "it", "this jacket", "the vest", or just the brand 
   name) — NEVER repeat the full product name (brand + model + 
   descriptor) in every sentence or every FAQ answer.
7. FAQ entries must address real usage concerns (fit, comfort, safety, 
   durability, how it compares to alternatives) — do NOT create FAQ 
   entries that just restate the price, stock status, or size already 
   shown elsewhere on the page.

## Output Format:
Generate one JSON object with these EXACT keys (use empty string "" if N/A):

{
  "blog_draft": "1500-2000 word review body. Must have: intro para, 
    product context, detailed walkthrough with at least 2 specific specs, 
    honest assessment of downsides, conclusion. Use markdown headings. 
    Refer to the product by short form after the first mention.",
  "pros": "- Pro 1 (with ONE specific numeric detail)\\n- Pro 2\\n- Pro 3",
  "cons": "- Con 1 (with specific real limitation)\\n- Con 2\\n- Con 3",
  "target_audience": "Paragraph (2-3 sentences) describing EXACTLY who 
    benefits. E.g., 'Photographers with 200-500mm lens collections on 
    a travel budget' not 'people who like photography'",
  "not_approved_for": "- Not suitable for: X (explain why in one sentence)\\n
    - Not suitable for: Y",
  "specifications": "- Weight: XX grams\\n- Dimensions: X x Y x Z cm\\n
    - Battery life: XX hours\\n- [2-4 more real specs]",
  "buying_guide": "Paragraph format. Answer: 'When should I buy this? 
    What are the alternatives? How does price compare?' Include 1-2 
    competitor comparisons with specific price/feature diffs.",
  "faq": "Q: A real usage concern (fit, durability, comparison, safety)?\\nA: Direct answer\\n\\nQ: Second usage concern?\\nA: Answer. Do NOT ask about price or stock status here."
}

Return ONLY valid JSON, no preamble.`;

/**
 * Validation function - ทำให้แน่ใจว่า AI output มีคุณภาพ
 */
export function validateReviewContent(content) {
  const errors = [];
  const warnings = [];

  // Check blog_draft
  if (!content.blog_draft || content.blog_draft.trim().length < 800) {
    errors.push('blog_draft: Must be at least 800 characters');
  }

  // Check for numeric specs
  const allText = `${content.pros} ${content.cons} ${content.specifications}`.toLowerCase();
  const hasNumericSpec = /\d+\s*(g|kg|cm|mm|oz|lb|hour|day|mp|px|percent)/i.test(allText);
  if (!hasNumericSpec) {
    errors.push('Must include at least 1 specific numeric specification (weight, size, hours, etc.)');
  }

  // Check not_approved_for
  if (!content.not_approved_for || content.not_approved_for.trim().length < 20) {
    errors.push('not_approved_for: Must explicitly list who this product is NOT suitable for');
  }

  // Check target_audience is specific
  const genericPhrases = [
    'perfect for anyone',
    'anyone who likes',
    'great for everyone',
    'everyone',
    'anyone interested',
    'works for most people'
  ];
  const audienceText = (content.target_audience || '').toLowerCase();
  for (const phrase of genericPhrases) {
    if (audienceText.includes(phrase)) {
      errors.push(`target_audience: Remove generic phrasing like "${phrase}". Be specific.`);
    }
  }

  // Check cons
  const consText = (content.cons || '').toLowerCase();
  if (consText.length < 30 || consText.includes('might not be') || consText.includes('not for everyone')) {
    errors.push('cons: Must list specific real drawbacks (not template filler)');
  }

  // Check faq doesn't just restate price/stock
  const faqText = (content.faq || '').toLowerCase();
  const redundantFaqPhrases = ['ราคาเท่าไร', 'มีในสต๊อก', 'มีสต๊อกหรือไม่', 'what is the price', 'is it in stock'];
  for (const phrase of redundantFaqPhrases) {
    if (faqText.includes(phrase)) {
      warnings.push(`faq: Avoid restating price/stock info already shown on the page ("${phrase}")`);
      break;
    }
  }

  // Warning: specifications
  if (!content.specifications || content.specifications.trim().length < 30) {
    warnings.push('specifications: Add 2+ real specs (weight, dimensions, battery life, etc.)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/* ============================================================
 * 1) DEMAND CHECK — เรียกก่อน generate รีวิว
 *    ใช้ตัดสินว่าสินค้านี้คุ้มค่าที่จะเสีย AI token generate ไหม
 * ============================================================ */

export function checkDemandSignal(productData) {
  let score = 0;
  const reasons = [];

  if (productData.rating >= 3.5) {
    score += 20;
    reasons.push('✓ Rating ok (+20)');
  } else {
    reasons.push('✗ Rating too low');
  }

  if (productData.reviewCount >= 50) {
    score += 30;
    reasons.push('✓ Reviews ok (+30)');
  } else {
    reasons.push('✗ Not enough reviews');
  }

  if (productData.affiliateRate >= 5) {
    score += 25;
    reasons.push('✓ Affiliate rate ok (+25)');
  } else {
    reasons.push('✗ Affiliate rate too low');
  }

  if (productData.price >= 100 && productData.price <= 10000) {
    score += 15;
    reasons.push('✓ Price in range (+15)');
  } else {
    reasons.push('✗ Price out of range');
  }

  const titleLen = (productData.title || '').length;
  if (titleLen >= 10 && titleLen <= 120) {
    score += 10;
    reasons.push('✓ Title quality ok (+10)');
  } else {
    reasons.push('✗ Title too short/long');
  }

  const canGenerate = score >= 70;
  let recommendation;
  if (score >= 85) recommendation = '🟢 Strong demand — Highly recommended';
  else if (score >= 70) recommendation = '🟡 Moderate demand — Safe to generate';
  else if (score >= 50) recommendation = '🔴 Weak demand — Consider skipping';
  else recommendation = '⛔ Very weak — Do not generate';

  return { score, canGenerate, recommendation, reasons };
}

export function batchDemandCheck(products) {
  return products.map(p => ({ id: p.id, title: p.title, ...checkDemandSignal(p) }));
}

/* ============================================================
 * 2) QUALITY / MARKET-FIT SCORE — เรียกหลัง generate รีวิว
 *    ใช้ตัดสินว่ารีวิวที่ AI เขียนมาคุณภาพพอ publish ไหม
 * ============================================================ */

function scoreSpecificity(text) {
  const matches = ((text || '').match(/\d+\s?(g|kg|cm|mm|inch|hours?|hrs?|ml|l|%|hr)\b/gi) || []);
  const count = matches.length;
  if (count >= 4) return 25;
  if (count === 3) return 20;
  if (count === 2) return 14;
  if (count === 1) return 8;
  return 0;
}

function scoreAudience(text) {
  if (!text) return 0;
  const generic = /perfect for (anyone|everyone|everybody)/i;
  if (generic.test(text)) return 5;
  const specificHints = /\b(with|who|for)\b.{5,80}/i;
  if (text.length > 15 && specificHints.test(text)) return 22;
  if (text.length > 15) return 14;
  return 5;
}

function scoreCons(text) {
  if (!text) return 0;
  const filler = /(might not be for everyone|not for everyone|maybe not)/i;
  if (filler.test(text)) return 6;
  const hasNumberOrDetail = /\d/.test(text) || text.length > 30;
  if (hasNumberOrDetail) return 18;
  return 10;
}

function scoreMarketSignals(productData = {}) {
  let s = 0;
  if (productData.rating >= 3.5) s += 8;
  if (productData.reviewCount >= 50) s += 10;
  if (productData.affiliateRate >= 5) s += 8;
  if (productData.trend === 'rising') s += 4;
  return Math.min(s, 30);
}

export function scoreReviewMarketFit(review, productData = {}) {
  const specificity = scoreSpecificity(review.specifications || review.blog_draft || '');
  const audience = scoreAudience(review.target_audience || '');
  const cons = scoreCons(review.cons || review.not_approved_for || '');
  const market = scoreMarketSignals(productData);

  const totalScore = specificity + audience + cons + market;

  let tier;
  if (totalScore >= 90) tier = '🏆 Excellent';
  else if (totalScore >= 80) tier = '⭐ Very Good';
  else if (totalScore >= 70) tier = '✅ Good';
  else if (totalScore >= 60) tier = '⚠️ Fair';
  else tier = '❌ Poor';

  const publishable = totalScore >= 70;

  const warnings = [];
  if (specificity < 10) warnings.push('Missing numeric specs');
  if (audience < 14) warnings.push('Target audience too generic');
  if (cons < 12) warnings.push('Cons look like filler');

  return {
    totalScore,
    tier,
    publishable,
    breakdown: { specificity, audience, cons, market },
    warnings
  };
}

export function batchScoreReviews(reviews, products) {
  return reviews.map((r, i) => scoreReviewMarketFit(r, products[i] || {}));
}

/* ============================================================
 * 3) รวมทุกอย่างเป็นขั้นตอนเดียว ให้ pipeline.js เรียกใช้ง่ายๆ
 *    - เช็ค demand ก่อน -> ถ้าต่ำ ข้ามเลย ไม่ต้อง generate
 *    - หลัง generate แล้ว เช็ค validateReviewContent + market fit
 * ============================================================ */

export function evaluateProductBeforeGenerate(productData) {
  const demand = checkDemandSignal(productData);
  if (!demand.canGenerate) {
    return { proceed: false, reason: `Demand score too low (${demand.score}/100)`, demand };
  }
  return { proceed: true, demand };
}

export function evaluateReviewAfterGenerate(content, productData) {
  const validation = validateReviewContent(content);
  const quality = scoreReviewMarketFit(content, productData);

  const publishable = validation.valid && quality.publishable;

  return {
    publishable,
    validation,
    quality
  };
}