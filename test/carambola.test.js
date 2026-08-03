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

console.log(`\n== RESUMEN carambola: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
