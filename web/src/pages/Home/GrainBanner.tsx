import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
import { useTheme } from '../../context/Theme';

const lightColors = ['#78A8F5', '#3D82E8', '#54C7B6', '#B1DCEB'];
const darkColors = ['#204B80', '#286AA4', '#207F80', '#193F64'];

export default function GrainBanner({ children }: PropsWithChildren) {
  const theme = useTheme();
  const [supported, setSupported] = useState(false);
  const [preferences, setPreferences] = useState(() => ({
    dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    compact: window.matchMedia('(max-width: 760px)').matches,
  }));

  useEffect(() => {
    const queries = {
      dark: window.matchMedia('(prefers-color-scheme: dark)'),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      compact: window.matchMedia('(max-width: 760px)'),
    };
    const update = () => setPreferences({
      dark: queries.dark.matches,
      reducedMotion: queries.reducedMotion.matches,
      compact: queries.compact.matches,
    });
    Object.values(queries).forEach((query) => query.addEventListener('change', update));
    return () => Object.values(queries).forEach((query) => query.removeEventListener('change', update));
  }, []);

  useEffect(() => {
    // Keep the CSS gradient on browsers without WebGL 2.
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      if (!context) return;
      context.getExtension('WEBGL_lose_context')?.loseContext();
      setSupported(true);
    } catch {}
  }, []);

  const dark = theme === 'dark' || (theme === 'auto' && preferences.dark);

  return (
    <section id='inside' className='studio-hero home-gradient-banner' aria-labelledby='home-title'>
      {supported && <MeshGradient
        className='home-gradient-shader'
        aria-hidden='true'
        colors={dark ? darkColors : lightColors}
        distortion={preferences.compact ? 0.35 : 0.5}
        swirl={0.1}
        grainMixer={0.02}
        grainOverlay={preferences.compact ? 0.025 : 0.035}
        speed={preferences.reducedMotion ? 0 : 0.5}
        minPixelRatio={1.5}
        maxPixelCount={preferences.compact ? 800_000 : 2_000_000}
      />}
      {children}
    </section>
  );
}
