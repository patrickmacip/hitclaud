// hitclaud — FASE 24: bono de carambola (golpes encadenados de una misma bola).
// node test/carambola.test.js  (lógica pura P + grep del cableado en main.js)

const fs = require('fs');
const P = require('../js/puntuacion.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== ESCALERA bonoCarambola(n): 2→500, 3→1500, 4→5000, +5000/golpe extra ===');
{
  chk('bono(0) = 0', P.bonoCarambola(0) === 0);
  chk('bono(1) = 0 (un solo golpe no encadena)', P.bonoCarambola(1) === 0);
  chk('bono(2) = 500', P.bonoCarambola(2) === 500);
  chk('bono(3) = 1500', P.bonoCarambola(3) === 1500);
  chk('bono(4) = 5000', P.bonoCarambola(4) === 5000);
  chk('bono(5) = 10000', P.bonoCarambola(5) === 10000);
  chk('bono(6) = 15000', P.bonoCarambola(6) === 15000);
  chk('SIN TOPE: bono(10) = 35000', P.bonoCarambola(10) === 35000);
}

console.log('=== anotarCarambola suma exactamente el bono al marcador ===');
{
  const m = { puntos: 1000, racha: 0 };
  const g = P.anotarCarambola(m, 4);
  chk('devuelve 5000', g === 5000);
  chk('suma 5000 al marcador (1000 → 6000)', m.puntos === 6000);
}

console.log('=== Una bola con UN solo golpe (n<2) no anota carambola ===');
{
  const m = { puntos: 100, racha: 0 };
  const g = P.anotarCarambola(m, 1);
  chk('anotarCarambola(m,1) = 0 y no cambia los puntos', g === 0 && m.puntos === 100);
}

console.log('=== El bono NO se multiplica por la racha (entra limpio) ===');
{
  const m0 = { puntos: 0, racha: 0 };
  const m9 = { puntos: 0, racha: 50 }; // racha altísima → multRacha tope 3.0
  const g0 = P.anotarCarambola(m0, 6);
  const g9 = P.anotarCarambola(m9, 6);
  chk('con racha 0 y con racha alta el bono es idéntico', g0 === 15000 && g9 === 15000 && g0 === g9);
  chk('multRacha(50) = 3.0 pero el bono NO lo aplica (= bonoCarambola crudo)', P.multRacha(50) === 3.0 && g9 === P.bonoCarambola(6));
}

console.log('=== Cableado en main.js: conteo por bola y guardas de muerte ===');
{
  chk('la bola nace con golpes:0 (contador por bola)', /golpes: 0,/.test(main));
  chk('cada impacto resuelto suma 1 (mismo target o no)', /b\.golpes \+= 1;/.test(main));
  // El incremento va JUSTO tras `if (!r) continue;` → cuenta CUALQUIER impacto
  // resuelto, incluidos dos golpes al MISMO Big Claude.
  chk('el conteo no está gateado por identidad de target (2 golpes al mismo = 2)', /if \(!r\) continue;[\s\S]{0,160}b\.golpes \+= 1;/.test(main));
  // Al morir la bola: si tocó y golpes>=2 y NO hay secuencia → carambola.
  chk('muerte con golpes>=2 y sin secuencia → anotarCarambola(marcador, b.golpes)', /else if \(b\.golpes >= 2 && !secuencia\) \{[\s\S]{0,360}anotarCarambola\(marcador, b\.golpes\)/.test(main));
  // Bola que no tocó nada → fallo, NO carambola (ramas mutuamente excluyentes).
  chk('bola sin tocar nada → anotarFallo (no carambola)', /if \(!b\.tocado\) \{[\s\S]{0,220}anotarFallo/.test(main));
  // Muerte por CloudOver no anota: el guard !secuencia lo bloquea (la partida terminó).
  chk('muerte por CloudOver no anota carambola (guard !secuencia)', /b\.golpes >= 2 && !secuencia/.test(main));
}

console.log('=== FASE 25: incremento por golpe (número EN VIVO) ===');
{
  chk('incremento(2) = 500', P.incrementoCarambola(2) === 500);
  chk('incremento(3) = 1000 (de 500 a 1500)', P.incrementoCarambola(3) === 1000);
  chk('incremento(4) = 3500 (de 1500 a 5000)', P.incrementoCarambola(4) === 3500);
  chk('incremento(5) = 5000', P.incrementoCarambola(5) === 5000);
  chk('incremento(6) = 5000', P.incrementoCarambola(6) === 5000);
}

console.log('=== La SUMA de incrementos 2..n = bono(n) (el TOTAL no cambia) ===');
{
  function sumaIncrementos(n) {
    let s = 0;
    for (let k = 2; k <= n; k++) s += P.incrementoCarambola(k);
    return s;
  }
  [2, 3, 4, 5, 6, 10].forEach(function (n) {
    chk(`suma incremento(2..${n}) = bono(${n}) = ${P.bonoCarambola(n)}`, sumaIncrementos(n) === P.bonoCarambola(n));
  });
  // El puntaje que recibe el marcador tras una cadena de n golpes sigue siendo bono(n)
  // (se anota entero al morir; los números en vivo son sólo el desglose visual).
  [2, 4, 6, 10].forEach(function (n) {
    const m = { puntos: 0, racha: 0 };
    P.anotarCarambola(m, n);
    chk(`total al marcador tras ${n} golpes = bono(${n}) = ${P.bonoCarambola(n)} (sin cambio)`, m.puntos === P.bonoCarambola(n));
  });
}

console.log('=== FASE 25: tres niveles visuales por el VALOR mostrado (config en main.js) ===');
{
  // La config de niveles vive en main.js (BONO_NIVELES); se verifica su literal exacto.
  chk('nivel 1: max 1000, pico 52, asiento 34, color #FF9E2C', /\{ max: 1000,\s*pico: 52, asiento: 34, color: '#FF9E2C' \}/.test(main));
  chk('nivel 2: max 3500, pico 62, asiento 40, color #FFC233', /\{ max: 3500,\s*pico: 62, asiento: 40, color: '#FFC233' \}/.test(main));
  chk('nivel 3: max Infinity, pico 74, asiento 48, color #FFE566', /\{ max: Infinity, pico: 74, asiento: 48, color: '#FFE566' \}/.test(main));
  chk('nivelBono elige por valor < max (más puntos → nivel más alto)', /for \(let i = 0; i < BONO_NIVELES\.length; i\+\+\) if \(valor < BONO_NIVELES\[i\]\.max\)/.test(main));
  // Espejo local de nivelBono (mismos umbrales) para probar las fronteras exactas.
  const NIV = [{ max: 1000, n: 1 }, { max: 3500, n: 2 }, { max: Infinity, n: 3 }];
  function nivelDe(v) { for (let i = 0; i < NIV.length; i++) if (v < NIV[i].max) return NIV[i].n; return 3; }
  chk('500 → nivel 1', nivelDe(500) === 1);
  chk('1000 → nivel 2', nivelDe(1000) === 2);
  chk('3499 → nivel 2', nivelDe(3499) === 2);
  chk('3500 → nivel 3', nivelDe(3500) === 3);
  chk('5000 → nivel 3', nivelDe(5000) === 3);
}

console.log('=== FASE 25: el número sale con el GOLPE; el 1º no muestra ===');
{
  // Desde el 2º golpe, cada golpe dispara su número en el impacto; el 1º no.
  chk('golpe >= 2 dispara el número en el impacto (intermedio, incremento del golpe)', /if \(b\.golpes >= 2\) mostrarBonoCarambola\(r\.px, r\.py, P\.incrementoCarambola\(b\.golpes\), b\.golpes, 'intermedio'\)/.test(main));
  chk('el 1er golpe NO muestra número (gateado por golpes >= 2)', !/if \(b\.golpes >= 1\) mostrarBonoCarambola/.test(main));
  // Al morir: el número vigente SE CONVIERTE en final en el sitio; si expiró, se crea.
  chk('al morir: el número vigente pasa a modo final en el sitio (sin re-pop)', /if \(bonoCaram\) bonoCaram\.modo = 'final';/.test(main));
  chk('al morir sin número vigente: se crea el final con el incremento del último golpe', /else mostrarBonoCarambola\(b\.ultimoX, b\.ultimoY, P\.incrementoCarambola\(b\.golpes\), b\.golpes, 'final'\)/.test(main));
}

console.log('=== FASE 25: sin contorno (strokeText) y sin shadowBlur en el bono ===');
{
  // Aísla el bloque de dibujo del bono para verificar que no tiene stroke ni blur.
  const iBono = main.indexOf('BONO DE CARAMBOLA flotante: dos renglones centrados en el impacto');
  const bloque = main.slice(iBono, main.indexOf('ctx.globalAlpha = 1;', iBono));
  chk('el bono NO usa strokeText (contorno retirado)', !/strokeText/.test(bloque) && !/haloTexto/.test(bloque));
  chk('el bono NO asigna ctx.shadowBlur', !/ctx\.shadowBlur/.test(bloque));
  chk('el halo es un disco cacheado dibujado con drawImage', /ctx\.drawImage\(niv\.disco\.canvas/.test(bloque));
  chk('el disco se escala con el rebote (fs / niv.asiento)', /niv\.disco\.r \* \(fs \/ niv\.asiento\)/.test(bloque));
}

console.log('=== FASE 25: discos cacheados una vez, sin gradientes en el bucle ===');
{
  const iDib = main.indexOf('function dibujar()');
  const finDib = main.indexOf('function dibujarEstela', iDib);
  const cuerpoDibujar = main.slice(iDib, finDib);
  chk('dibujar() NO crea gradientes (ni radial ni lineal) en el bucle', !/createRadialGradient|createLinearGradient/.test(cuerpoDibujar));
  chk('los 3 discos se construyen UNA vez al arrancar (BONO_NIVELES.forEach)', /BONO_NIVELES\.forEach\(function \(niv\) \{ try \{ niv\.disco = construirDiscoBono\(niv\); \}/.test(main));
  chk('construirDiscoBono crea el radial FUERA del bucle (en la fábrica del disco)', /function construirDiscoBono\(niv\)[\s\S]{0,400}createRadialGradient/.test(main));
}

console.log(`\n== RESUMEN carambola: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
