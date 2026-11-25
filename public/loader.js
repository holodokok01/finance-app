// Монетка — тема прелоадера + мягкое пятно на фоне, которое летает вслед за монеткой (WebGL)
(function () {
  const loader = document.getElementById('loader');
  if (!loader) return;
  const tg = window.Telegram && window.Telegram.WebApp;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- палитры: фон и два оттенка пятна ----------
  const PALETTES = {
    light: { base: '#EAF4FF', a: '#84C2FF', b: '#B3DAFF' },
    dark:  { base: '#0B1622', a: '#11294A', b: '#0E2036' }
  };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

  // ---------- тема ----------
  function detectTheme() {
    if (tg && tg.colorScheme) return tg.colorScheme;
    return mq.matches ? 'dark' : 'light';
  }
  let forced = null, target = null;
  function apply() {
    const p = PALETTES[forced || detectTheme()];
    loader.dataset.theme = forced || detectTheme();
    target = { base: hex(p.base), a: hex(p.a), b: hex(p.b) };
  }
  apply();
  if (tg) tg.onEvent('themeChanged', apply);
  mq.addEventListener('change', apply);
  let cur = { base: target.base.slice(), a: target.a.slice(), b: target.b.slice() };

  // ---------- WebGL ----------
  const bg = loader.querySelector('.mk-bg');
  const canvas = document.createElement('canvas');
  canvas.className = 'mk-mesh';
  bg.appendChild(canvas);
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { bg.classList.add('mk-fallback'); return expose(null); }

  const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const fs = `precision mediump float;
uniform vec2 uRes;uniform float uT;uniform vec3 uBase,uA,uB;uniform vec2 uCtr;uniform float uSq;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  float t=uT;
  vec2 uv=gl_FragCoord.xy/uRes; uv.y=1.-uv.y;
  float asp=uRes.x/uRes.y;
  // центр пятна приходит из JS: следует за монеткой
  vec2 c=uCtr;
  vec2 p=vec2((uv.x-c.x)*asp,uv.y-c.y);
  p.y/=uSq; p.x*=sqrt(uSq); // вытягивается по вертикали на скорости
  float ang=atan(p.y,p.x), d=length(p);
  // волнистый край: несколько медленных волн по окружности
  float wob=1.+.075*sin(3.*ang+t*.42)+.05*sin(5.*ang-t*.31+1.3)+.035*sin(2.*ang+t*.23+2.1);
  float R=.5*min(asp,1.)*wob;
  float m=1.-smoothstep(R*.35,R*1.05,d);
  // внутри пятна два оттенка мягко перетекают
  float k=.5+.5*sin(dot(p,vec2(2.2,1.6))-t*.25);
  vec3 blob=mix(uA,uB,k*.8);
  vec3 col=mix(uBase,blob,m);
  col+=(h(gl_FragCoord.xy+t)-.5)/255.*2.;
  gl_FragColor=vec4(col,1.);
}`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { bg.classList.add('mk-fallback'); return expose(null); }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uT = U('uT'), uBase = U('uBase'), uA = U('uA'), uB = U('uB'), uCtr = U('uCtr'), uSq = U('uSq');
  const coin = loader.querySelector('.mk-coin');
  let cy = null, vy = 0; // текущее положение пятна и его скорость

  // половинное разрешение: пятно мягкое, разницы не видно, батарея экономится
  function resize() {
    canvas.width = Math.max(1, Math.round(loader.clientWidth * 0.5));
    canvas.height = Math.max(1, Math.round(loader.clientHeight * 0.5));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  let raf = 0, last = performance.now();
  const t0 = Math.random() * 100;
  const lerp = (x, y, k) => x.map((v, j) => v + (y[j] - v) * k);
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.pow(0.001, dt * 2); // плавная смена темы
    cur = { base: lerp(cur.base, target.base, k), a: lerp(cur.a, target.a, k), b: lerp(cur.b, target.b, k) };
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, t0 + now / 1000);
    gl.uniform3fv(uBase, cur.base); gl.uniform3fv(uA, cur.a); gl.uniform3fv(uB, cur.b);
    // где сейчас монетка (в долях экрана)
    const L = loader.getBoundingClientRect(), r = coin.getBoundingClientRect();
    const tx = (r.left + r.width / 2 - L.left) / L.width;
    const ty = (r.top + r.height / 2 - L.top) / L.height + 0.06; // чуть ниже монетки
    if (cy === null) cy = ty;
    // мягкая пружина: пятно догоняет монетку с небольшой задержкой
    const acc = (ty - cy) * 90 - vy * 14;
    vy += acc * dt; cy += vy * dt;
    const sq = 1 + Math.min(0.35, Math.abs(vy) * 0.25);
    gl.uniform2f(uCtr, tx, cy);
    gl.uniform1f(uSq, sq);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  expose(
    () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); },
    () => { if (reduce) { cur = { base: target.base, a: target.a, b: target.b }; requestAnimationFrame(frame); } }
  );

  // API: MonetkaLoader.setTheme('light' | 'dark' | null), MonetkaLoader.hide()
  function expose(stop, redraw) {
    window.MonetkaLoader = {
      setTheme(t) { forced = t; apply(); if (redraw) redraw(); },
      hide() {
        loader.classList.add('hide');
        setTimeout(() => { if (stop) stop(); loader.remove(); }, 400);
      }
    };
  }
})();
