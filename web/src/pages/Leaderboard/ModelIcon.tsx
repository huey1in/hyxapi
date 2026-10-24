import { getLobeHubIcon, getModelIcon } from '../../helpers';
import { inferModelBrand } from '../Home/modelBrands';

export default function ModelIcon({ name, size = 16 }: { name: string; size?: number }) {
  const icon = getModelIcon(name, inferModelBrand(name)?.icon);

  return <span className='leaderboard-model-icon' data-monochrome={!/color/i.test(icon) || undefined} aria-hidden='true'>
    {getLobeHubIcon(icon, size)}
  </span>;
}
