import React from 'react';
import { Category } from '../../types/fin';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ICONS, ICONSET } from '../../assets/icons';
import { Squircle } from './Squircle';

export function catTint(hex: string, effectiveTheme: 'dark' | 'light'): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return effectiveTheme === 'light' ? '#f2f2f7' : '#1a1b1f';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const k = effectiveTheme === 'light' ? 0.15 : 0.2;
  const tb = effectiveTheme === 'light' ? [255, 255, 255] : [20, 21, 24];
  const mx = (a: number, z: number) => Math.round(a * k + z * (1 - k));
  return '#' + ((1 << 24) + (mx(r, tb[0]) << 16) + (mx(g, tb[1]) << 8) + mx(b, tb[2])).toString(16).slice(1);
}

interface CategoryTileProps {
  cat?: Category;
  radius?: number;
  className?: string;
  as?: 'div' | 'span';
}

export const CategoryTile: React.FC<CategoryTileProps> = ({
  cat,
  radius = 16,
  className = '',
  as = 'div',
}) => {
  const effectiveTheme = useSettingsStore(s => s.effectiveTheme);

  if (!cat) {
    return (
      <Squircle
        as={as}
        r={radius}
        className={`tile cc ${className}`}
        style={{ '--fill': 'var(--press)', color: '#8e8e93' } as React.CSSProperties}
      />
    );
  }

  const tint = catTint(cat.color, effectiveTheme);
  const iconKey = cat.icon || '';
  const iconSvg = iconKey ? ICONS[iconKey] || ICONSET[iconKey] || '' : '';

  return (
    <Squircle
      as={as}
      r={radius}
      className={`tile cc ${className}`}
      style={{
        '--fill': tint,
        color: cat.color,
      } as React.CSSProperties}
    >
      {cat.emoji ? (
        <span className="emo">{cat.emoji}</span>
      ) : (
        <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: iconSvg }} />
      )}
    </Squircle>
  );
};
