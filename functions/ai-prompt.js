/**
 * AI Product Review Prompt System
 * 
 * ใช้ร่วมกับ pipeline.js เพื่อสร้างรีวิวสินค้าที่มีคุณภาพสูง
 * ไม่ใช่ template ซ้ำๆ
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
5. Every review should sound different from the last — vary sentence 
   structure, use specific examples, tell micro-stories

## Output Format:
Generate one JSON object with these EXACT keys (use empty string "" if N/A):

{
  "blog_draft": "1500-2000 word review body. Must have: intro para, 
    product context, detailed walkthrough with at least 2 specific specs, 
    honest assessment of downsides, conclusion. Use markdown headings.",
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
  "faq": "Q: Most common user concern?\\nA: Direct answer\\n\\nQ: Second concern?\\nA: Answer"
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