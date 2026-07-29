const BRAND_RULES = [
  [/gpt|o1|o3|o4|dall|whisper|text-embedding/i, { name: 'OpenAI', icon: 'OpenAI' }],
  [/claude/i, { name: 'Anthropic', icon: 'Claude.Color' }],
  [/gemini|gemma|palm/i, { name: 'Google', icon: 'Gemini.Color' }],
  [/deepseek/i, { name: 'DeepSeek', icon: 'DeepSeek.Color' }],
  [/grok|xai/i, { name: 'xAI', icon: 'XAI' }],
  [/mistral|mixtral|codestral/i, { name: 'Mistral AI', icon: 'Mistral.Color' }],
  [/qwen|qwq/i, { name: 'Qwen', icon: 'Qwen.Color' }],
  [/moonshot|kimi/i, { name: 'Moonshot', icon: 'Moonshot' }],
  [/glm|chatglm/i, { name: 'Zhipu AI', icon: 'Zhipu.Color' }],
  [/llama/i, { name: 'Meta', icon: 'Meta.Color' }],
  [/command|cohere/i, { name: 'Cohere', icon: 'Cohere.Color' }],
  [/doubao/i, { name: 'Doubao', icon: 'Doubao.Color' }],
];

const inferBrand = (modelName) => BRAND_RULES.find(([pattern]) => pattern.test(modelName || ''))?.[1];

export const extractSupportedModelBrands = (models = [], vendors = []) => {
  const vendorMap = new Map(vendors.map((vendor) => [String(vendor.id), vendor]));
  const seen = new Set();
  const brands = [];

  models.forEach((model) => {
    const vendor = model.vendor_id != null ? vendorMap.get(String(model.vendor_id)) : null;
    const brand = vendor?.name
      ? { name: vendor.name, icon: vendor.icon || inferBrand(model.model_name)?.icon || '' }
      : inferBrand(model.model_name);
    if (!brand?.name || seen.has(brand.name)) return;
    seen.add(brand.name);
    brands.push(brand);
  });

  return brands;
};
