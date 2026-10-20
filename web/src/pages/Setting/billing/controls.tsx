export { Input, Select, Textarea } from '../../../components/ui';

export const variableLabels: Record<string, string> = {
  p: 'Text input', c: 'Text output', len: 'Input length', cr: 'Cache read', cc: 'Cache write', cc1h: 'Cache write (1 hour)',
  img: 'Image input', img_cr: 'Image cache', img_o: 'Image output', ai: 'Audio input', ao: 'Audio output',
  hour: 'Hour (0–23)', minute: 'Minute (0–59)', weekday: 'Weekday (0 is Sunday)', month: 'Month (1–12)', day: 'Day (1–31)',
};
