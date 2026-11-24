import React from 'react';

const CV_CC: Record<string, string> = {
  EUR: 'EU',
  ANG: 'CW',
  XAF: 'CM',
  XOF: 'SN',
  XCD: 'AG',
  XPF: 'PF',
};

function fH(c: string[], w?: number[]): string {
  const weights = w || c.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let y = 0;
  let h = '';
  c.forEach((col, i) => {
    const hh = (40 * weights[i]) / total;
    h += `<rect y="${y.toFixed(2)}" width="40" height="${(hh + 0.3).toFixed(2)}" fill="${col}"/>`;
    y += hh;
  });
  return h;
}

function fV(c: string[]): string {
  let h = '';
  c.forEach((col, i) => {
    h += `<rect x="${((40 * i) / c.length).toFixed(2)}" width="${(40 / c.length + 0.3).toFixed(2)}" height="40" fill="${col}"/>`;
  });
  return h;
}

function fStar(cx: number, cy: number, R: number, col: string, rot = -90): string {
  const p: string[] = [];
  const r = R * 0.382;
  const a0 = (rot * Math.PI) / 180;
  for (let i = 0; i < 10; i++) {
    const a = a0 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${col}"/>`;
}

function fCross(bg: string, c1: string, c2?: string): string {
  let h = `<rect width="40" height="40" fill="${bg}"/><rect x="11" width="10" height="40" fill="${c1}"/><rect y="15" width="40" height="10" fill="${c1}"/>`;
  if (c2) {
    h += `<rect x="13.5" width="5" height="40" fill="${c2}"/><rect y="17.5" width="40" height="5" fill="${c2}"/>`;
  }
  return h;
}

const UK =
  '<rect width="40" height="40" fill="#012169"/><path d="M0 0L40 40M40 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L40 40M40 0L0 40" stroke="#c8102e" stroke-width="2.6"/><path d="M20 0V40M0 20H40" stroke="#fff" stroke-width="13"/><path d="M20 0V40M0 20H40" stroke="#c8102e" stroke-width="8"/>';

function fUSdots(): string {
  let h = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      h += `<circle cx="${(4 + c * 4.5 + (r % 2) * 2.2).toFixed(2)}" cy="${(3.5 + r * 5).toFixed(2)}" r="1.1" fill="#fff"/>`;
    }
  }
  return h;
}

const FLAGS: Record<string, () => string> = {
  US: () => {
    let h = '';
    for (let i = 0; i < 13; i++) {
      h += `<rect y="${((i * 40) / 13).toFixed(2)}" width="40" height="${(40 / 13 + 0.2).toFixed(2)}" fill="${i % 2 ? '#fff' : '#b22234'}"/>`;
    }
    return h + '<rect width="21" height="21.6" fill="#3c3b6e"/>' + fUSdots();
  },
  EU: () => {
    let h = '<rect width="40" height="40" fill="#039"/>';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      h += fStar(20 + 11 * Math.cos(a), 20 + 11 * Math.sin(a), 2.4, '#fc0');
    }
    return h;
  },
  GB: () => UK,
  UA: () => fH(['#0057b7', '#ffd700']),
  PL: () => fH(['#fff', '#dc143c']),
  BG: () => fH(['#fff', '#00966e', '#d62612']),
  RU: () => fH(['#fff', '#0039a6', '#d52b1e']),
  HU: () => fH(['#ce2939', '#fff', '#477050']),
  AM: () => fH(['#d90012', '#0033a0', '#f2a800']),
  ID: () => fH(['#ce1126', '#fff']),
  CO: () => fH(['#fcd116', '#003893', '#ce1126'], [2, 1, 1]),
  TH: () => fH(['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], [1, 1, 2, 1, 1]),
  RO: () => fV(['#002b7f', '#fcd116', '#ce1126']),
  MD: () => fV(['#0046ae', '#ffd200', '#cc092f']) + '<rect x="17" y="15" width="6" height="9" rx="2" fill="#8c5a2b"/>',
  MX: () => fV(['#006847', '#fff', '#ce1126']) + '<circle cx="20" cy="20" r="3.5" fill="#8c5a2b"/>',
  CA: () =>
    '<rect width="40" height="40" fill="#fff"/><rect width="10" height="40" fill="#d80621"/><rect x="30" width="10" height="40" fill="#d80621"/>' +
    fStar(20, 19, 7, '#d80621') +
    '<rect x="19.2" y="22" width="1.6" height="7" fill="#d80621"/>',
  CH: () =>
    '<rect width="40" height="40" fill="#da291c"/><rect x="16.5" y="9" width="7" height="22" fill="#fff"/><rect x="9" y="16.5" width="22" height="7" fill="#fff"/>',
  JP: () => '<rect width="40" height="40" fill="#fff"/><circle cx="20" cy="20" r="9" fill="#bc002d"/>',
  CN: () =>
    '<rect width="40" height="40" fill="#ee1c25"/>' +
    fStar(13, 15, 6.5, '#ffde00') +
    fStar(22, 8, 2, '#ffde00', -60) +
    fStar(25.5, 12.5, 2, '#ffde00', -80) +
    fStar(25.5, 18, 2, '#ffde00', -100) +
    fStar(22, 22, 2, '#ffde00', -120),
  TR: () =>
    '<rect width="40" height="40" fill="#e30a17"/><circle cx="16" cy="20" r="9" fill="#fff"/><circle cx="18.4" cy="20" r="7.2" fill="#e30a17"/>' +
    fStar(25.6, 20, 3.4, '#fff', 0),
  SE: () =>
    '<rect width="40" height="40" fill="#006aa7"/><rect x="12" width="6" height="40" fill="#fecc00"/><rect y="17" width="40" height="6" fill="#fecc00"/>',
  DK: () =>
    '<rect width="40" height="40" fill="#c8102e"/><rect x="12" width="5" height="40" fill="#fff"/><rect y="17.5" width="40" height="5" fill="#fff"/>',
  NO: () => fCross('#ba0c2f', '#fff', '#00205b'),
  IS: () => fCross('#02529c', '#fff', '#dc1e35'),
  GE: () => {
    let h =
      '<rect width="40" height="40" fill="#fff"/><rect x="17" width="6" height="40" fill="#ff0000"/><rect y="17" width="40" height="6" fill="#ff0000"/>';
    [
      [9, 9],
      [31, 9],
      [9, 31],
      [31, 31],
    ].forEach(p => {
      h += `<rect x="${(p[0] - 0.9).toFixed(2)}" y="${(p[1] - 3.5).toFixed(2)}" width="1.8" height="7" fill="#ff0000"/><rect x="${(p[0] - 3.5).toFixed(2)}" y="${(p[1] - 0.9).toFixed(2)}" width="7" height="1.8" fill="#ff0000"/>`;
    });
    return h;
  },
  CZ: () => fH(['#fff', '#d7141a']) + '<polygon points="0,0 21,20 0,40" fill="#11457e"/>',
  KZ: () =>
    '<rect width="40" height="40" fill="#00afca"/><circle cx="20" cy="17" r="6" fill="#fec50c"/><path d="M11 26q9 -5 18 0" stroke="#fec50c" stroke-width="2" fill="none"/>',
  BR: () =>
    '<rect width="40" height="40" fill="#009c3b"/><polygon points="4,20 20,8 36,20 20,32" fill="#ffdf00"/><circle cx="20" cy="20" r="7.2" fill="#002776"/><path d="M13 18.5q7 -2 14 2" stroke="#fff" stroke-width="1.3" fill="none"/>',
  AR: () => fH(['#74acdf', '#fff', '#74acdf']) + '<circle cx="20" cy="20" r="3.4" fill="#f6b40e"/>',
  CL: () =>
    '<rect width="40" height="40" fill="#fff"/><rect y="20" width="40" height="20" fill="#d52b1e"/><rect width="20" height="20" fill="#0039a6"/>' +
    fStar(11, 10.5, 4.5, '#fff'),
  AE: () => fH(['#00732f', '#fff', '#000']) + '<rect width="12" height="40" fill="#ff0000"/>',
  SA: () =>
    '<rect width="40" height="40" fill="#006c35"/><rect x="11" y="14" width="18" height="2" rx="1" fill="#fff"/><rect x="13" y="18" width="14" height="2" rx="1" fill="#fff"/><path d="M10 26H30" stroke="#fff" stroke-width="1.6"/>',
  ZA: () =>
    '<rect width="40" height="20" fill="#e03c31"/><rect y="20" width="40" height="20" fill="#001489"/><path d="M0 4L18 20L0 36M18 20H40" stroke="#fff" stroke-width="13" fill="none"/><path d="M0 4L18 20L0 36M18 20H40" stroke="#007749" stroke-width="8" fill="none"/><polygon points="0,9 12,20 0,31" fill="#ffb81c"/><polygon points="0,12.5 8.5,20 0,27.5" fill="#000"/>',
  HK: () => {
    let h = '<rect width="40" height="40" fill="#de2910"/>';
    for (let i = 0; i < 5; i++) {
      h += `<ellipse cx="20" cy="13.5" rx="3.3" ry="6.5" fill="#fff" transform="rotate(${i * 72} 20 20)"/>`;
    }
    return h + '<circle cx="20" cy="20" r="1.2" fill="#de2910"/>';
  },
  SG: () =>
    fH(['#ef3340', '#fff']) +
    '<circle cx="12" cy="10" r="5.5" fill="#fff"/><circle cx="14" cy="10" r="5" fill="#ef3340"/>' +
    fStar(17, 8, 1, '#fff') +
    fStar(20, 10.5, 1, '#fff') +
    fStar(18.5, 13.5, 1, '#fff'),
  VN: () => '<rect width="40" height="40" fill="#da251d"/>' + fStar(20, 21, 10, '#ff0'),
  PH: () =>
    fH(['#0038a8', '#ce1126']) +
    '<polygon points="0,0 22,20 0,40" fill="#fff"/><circle cx="7" cy="20" r="3.2" fill="#fcd116"/>',
  MY: () => {
    let h = '';
    for (let i = 0; i < 14; i++) {
      h += `<rect y="${((i * 40) / 14).toFixed(2)}" width="40" height="${(40 / 14 + 0.2).toFixed(2)}" fill="${i % 2 ? '#fff' : '#cc0001'}"/>`;
    }
    return (
      h +
      '<rect width="21" height="22.9" fill="#010066"/><circle cx="9.5" cy="11.5" r="6" fill="#fc0"/><circle cx="11.2" cy="11.5" r="5" fill="#010066"/>' +
      fStar(16, 11.5, 3.2, '#fc0')
    );
  },
  TW: () =>
    '<rect width="40" height="40" fill="#fe0000"/><rect width="21" height="20" fill="#000095"/><circle cx="10.5" cy="10" r="5" fill="#fff"/>',
  KR: () =>
    '<rect width="40" height="40" fill="#fff"/><g transform="rotate(34 20 20)"><path d="M12 20a8 8 0 0 1 16 0z" fill="#cd2e3a"/><path d="M12 20a8 8 0 0 0 16 0z" fill="#0047a0"/><circle cx="16" cy="20" r="4" fill="#cd2e3a"/><circle cx="24" cy="20" r="4" fill="#0047a0"/></g><path d="M6 10l5-4M7.5 12l5-4M28.5 8l5 4M27 10l5 4M6 30l5 4M7.5 28l5 4M28.5 32l5-4M27 30l5-4" stroke="#000" stroke-width="1.4"/>',
  IN: () =>
    fH(['#ff9933', '#fff', '#138808']) +
    '<circle cx="20" cy="20" r="3.6" fill="none" stroke="#000080" stroke-width="1.2"/>',
  IL: () =>
    '<rect width="40" height="40" fill="#fff"/><rect y="6" width="40" height="5" fill="#0038b8"/><rect y="29" width="40" height="5" fill="#0038b8"/><path d="M20 13.5L26 24H14zM20 26.5L14 16H26z" fill="none" stroke="#0038b8" stroke-width="1.6"/>',
  EG: () =>
    fH(['#ce1126', '#fff', '#000']) + '<rect x="17.5" y="16" width="5" height="8" rx="1" fill="#c09300"/>',
  UZ: () =>
    fH(['#0099b5', '#ce1126', '#fff', '#ce1126', '#1eb53a'], [10, 1, 10, 1, 10]) +
    '<circle cx="9" cy="7" r="3.5" fill="#fff"/><circle cx="10.4" cy="7" r="3" fill="#0099b5"/>',
  TJ: () => fH(['#cc0000', '#fff', '#006600'], [2, 3, 2]) + '<path d="M16 21h8l-1-3-3 1.5-3-1.5z" fill="#f8c300"/>',
  BY: () =>
    fH(['#c8313e', '#4aa657'], [2, 1]) +
    '<rect width="7" height="40" fill="#fff"/><path d="M3.5 0V40" stroke="#c8313e" stroke-width="3" stroke-dasharray="3 3"/>',
  AZ: () =>
    fH(['#00b5e2', '#ef3340', '#509e2f']) +
    '<circle cx="18.5" cy="20" r="4.5" fill="#fff"/><circle cx="19.8" cy="20" r="3.7" fill="#ef3340"/>' +
    fStar(24, 20, 2, '#fff', 0),
  RS: () =>
    fH(['#c6363c', '#0c4076', '#fff']) +
    '<rect x="9" y="12" width="7" height="10" rx="2" fill="#c6363c" stroke="#fff" stroke-width="1"/>',
  AU: () => {
    const h = '<rect width="40" height="40" fill="#012169"/><g transform="scale(.5)">' + UK + '</g>';
    return (
      h +
      fStar(10, 30, 4, '#fff') +
      fStar(30, 10, 2, '#fff') +
      fStar(26, 18, 2, '#fff') +
      fStar(34, 17, 2, '#fff') +
      fStar(30, 31, 2.2, '#fff')
    );
  },
  NZ: () => {
    const h = '<rect width="40" height="40" fill="#012169"/><g transform="scale(.5)">' + UK + '</g>';
    return (
      h +
      fStar(30, 10, 2.4, '#cc142b') +
      fStar(25, 18, 2.4, '#cc142b') +
      fStar(35, 17, 2.2, '#cc142b') +
      fStar(30, 31, 2.6, '#cc142b')
    );
  },
};

interface FlagProps {
  code: string;
  className?: string;
}

export const Flag: React.FC<FlagProps> = ({ code, className = '' }) => {
  const cc = CV_CC[code] || code.slice(0, 2);

  if (FLAGS[cc]) {
    return (
      <span className={`cv-flag ${className}`}>
        <svg
          viewBox="0 0 40 40"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: FLAGS[cc]() }}
        />
      </span>
    );
  }

  if (code.charAt(0) === 'X' && !CV_CC[code]) {
    return <span className={`cv-flag txt ${className}`}>{code}</span>;
  }

  const f = String.fromCodePoint(
    0x1f1e6 + cc.charCodeAt(0) - 65,
    0x1f1e6 + cc.charCodeAt(1) - 65
  );

  return (
    <span className={`cv-flag emo ${className}`}>
      <i>{f}</i>
    </span>
  );
};
