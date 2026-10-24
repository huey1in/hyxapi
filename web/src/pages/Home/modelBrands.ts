export interface ModelBrand { name: string; icon: string }
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const BRAND_RULES: [RegExp, ModelBrand][] = [
  [/gpt|o1|o3|o4|dall|whisper|text-embedding/i, { name: 'OpenAI', icon: 'OpenAI' }],
  [/claude/i, { name: 'Anthropic', icon: 'Claude.Color' }],
  [/gemini|gemma|palm/i, { name: 'Google', icon: 'Gemini.Color' }],
  [/deepseek/i, { name: 'DeepSeek', icon: 'DeepSeek.Color' }],
  [/grok|xai/i, { name: 'xAI', icon: 'XAI' }],
  [/mistral|mixtral|codestral/i, { name: 'Mistral AI', icon: 'Mistral.Color' }],
  [/qwen|qwq/i, { name: 'Qwen', icon: 'Qwen.Color' }],
  [/moonshot|kimi/i, { name: 'Moonshot', icon: 'Moonshot' }],
  [/minimax|abab/i, { name: 'MiniMax', icon: 'Minimax.Color' }],
  [/glm|chatglm/i, { name: 'Zhipu AI', icon: 'Zhipu.Color' }],
  [/llama/i, { name: 'Meta', icon: 'Meta.Color' }],
  [/command|cohere/i, { name: 'Cohere', icon: 'Cohere.Color' }],
  [/doubao/i, { name: 'Doubao', icon: 'Doubao.Color' }],
];

const inferBrand = (modelName: string) => BRAND_RULES.find(([pattern]) => pattern.test(modelName || ''))?.[1];

export const extractSupportedModelBrands = (models: unknown = [], vendors: unknown = []): ModelBrand[] => {
  if (!Array.isArray(models)) return [];
  const vendorMap = new Map((Array.isArray(vendors) ? vendors : []).map(object).filter((vendor): vendor is Record<string, unknown> => vendor !== null).map((vendor) => [String(vendor.id), vendor]));
  const seen = new Set<string>();
  const brands: ModelBrand[] = [];

  models.forEach((value: unknown) => {
    const model = object(value); if (!model || typeof model.model_name !== 'string') return;
    const vendor = model.vendor_id != null ? vendorMap.get(String(model.vendor_id)) : null;
    const brand = typeof vendor?.name === 'string' && vendor.name.trim()
      ? { name: vendor.name, icon: typeof vendor.icon === 'string' && vendor.icon ? vendor.icon : inferBrand(model.model_name)?.icon || '' }
      : inferBrand(model.model_name);
    if (!brand?.name || seen.has(brand.name)) return;
    seen.add(brand.name);
    brands.push(brand);
  });

  return brands;
};
