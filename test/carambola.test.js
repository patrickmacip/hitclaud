// hitclaud — FASE 29: carambola de UN escalón (500), número ACOPLADO al marcador,
// por bola (no global). node test/carambola.test.js  (lógica pura P + grep de main.js)

const fs = require('fs');
const P = require('../js/puntuacion.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== UN SOLO ESCALÓN: siempre 500 (sin escalada) ===');
{
  chk('bono(1) = 0 (un golpe no encadena)', P.bonoCarambola(1) === 0);
  chk('bono(0) = 0', P.bonoCarambola(0) === 0);
  chk('bono(2) = 500', P.bonoCarambola(2) === 500);
  chk('bono(3) = 500 (ya no 1500)', P.bonoCarambola(3) === 500);
  chk('bono(5) = 500', P.bonoCarambola(5) === 500);
  chk('bono(10) = 500 (ya no 35000)', P.bonoCarambola(10) === 500);
  chk('el bono es SIEMPRE 500 para n>=2', [2, 3, 4, 5, 6, 10, 25].every(function (n) { return P.bonoCarambola(n) === 500; }));
}

console.log('=== anotarCarambola: 500 una sola vez, sin multiplicar por racha ===');
{
  const m = { puntos: 1000, racha: 0 };
  chk('anotarCarambola(m,2) devuelve 500 y suma 500', P.anotarCarambola(m, 2) === 500 && m.puntos === 1500);
  const m1 = { puntos: 0, racha: 0 };
  chk('un solo golpe (n=1) no anota (0)', P.anotarCarambola(m1, 1) === 0 && m1.puntos === 0);
  // NO se multiplica por la racha: con racha altísima el bono sigue siendo 500.
  const m0 = { puntos: 0, racha: 0 }, m9 = { puntos: 0, racha: 50 };
  chk('con racha 0 y racha alta el bono es idéntico (500, limpio)', P.anotarCarambola(m0, 4) === 500 && P.anotarCarambola(m9, 4) === 500);
  chk('multRacha(50)=3.0 pero el bono NO lo aplica', P.multRacha(50) === 3.0 && P.bonoCarambola(4) === 500);
}

console.log('=== Cableado: se cobra Y se muestra en el 2º golpe, JUNTOS, una vez por bola ===');
{
  chk('la bola nace con golpes:0', /golpes: 0,/.test(main));
  chk('cada impacto resuelto suma 1 golpe', /b\.golpes \+= 1;/.test(main));
  // El bono se ANOTA en el 2º golpe (=== 2, no >= 2 → una sola vez por bola).
  chk('anota +500 exactamente en el 2º golpe (b.golpes === 2)', /if \(b\.golpes === 2\) \{[\s\S]{0,120}P\.anotarCarambola\(marcador, 2\)/.test(main));
  // ACOPLADO: mostrar va JUNTO al anotar, en el mismo bloque, misma línea de ejecución.
  chk('muestra el número en el MISMO bloque del anotar (acoplado)', /P\.anotarCarambola\(marcador, 2\)[\s\S]{0,400}mostrarBonoCarambola\(r\.px, r\.py\)/.test(main));
  // No hay número sin puntos ni puntos sin número: mostrarBonoCarambola se llama UNA vez
  // (fuera de su definición) y SIEMPRE tras anotarCarambola.
  chk('mostrarBonoCarambola se llama UNA sola vez (tras anotar)', (main.match(/mostrarBonoCarambola\(r\.px, r\.py\)/g) || []).length === 1);
  chk('NO se anota carambola al morir la bola (bloque eliminado)', !/b\.golpes >= 2 && !secuencia/.test(main) && !/anotarCarambola\(marcador, b\.golpes\)/.test(main));
}

console.log('=== 3er golpe en adelante: NADA (ni puntos, ni número, ni relevo) ===');
{
  // Como el gate es ===2, del 3º en adelante no se ejecuta el bloque del bono.
  chk('el bloque del bono está gateado por ===2 (no >=2)', /if \(b\.golpes === 2\)/.test(main) && !/if \(b\.golpes >= 2\) mostrarBonoCarambola/.test(main));
}

console.log('=== NÚMERO POR BOLA (no global): lista `bonos`, sobrevive a su bola ===');
{
  chk('el número ya NO es una variable global bonoCaram', !/bonoCaram\b/.test(main));
  chk('existe una LISTA de números activos (bonos)', /const bonos = \[\];/.test(main));
  chk('mostrarBonoCarambola AGREGA a la lista (no reemplaza un global)', /function mostrarBonoCarambola\(x, y\) \{\s*bonos\.push\(/.test(main));
  // Cada número vive su animación completa aunque su bola muera: el draw recorre `bonos`
  // por edad propia (inicio del número), independiente de las bolas.
  chk('el draw recorre la lista `bonos` y expira por edad propia', /for \(let bi = bonos\.length - 1[\s\S]{0,200}age >= BONO_VIDA[\s\S]{0,60}bonos\.splice\(bi, 1\)/.test(main));
  chk('la muerte de la bola NO toca los números (no corta la animación)', !/if \(!b\.viva\)[\s\S]{0,300}bonos/.test(main));
  // Reinicio de partida limpia la lista.
  chk('reiniciarEstado limpia la lista `bonos`', /bonos\.length = 0/.test(main));
}

console.log('=== DOS BOLAS SIMULTÁNEAS → dos números distintos (lógica) ===');
{
  // mostrarBonoCarambola SIEMPRE hace push de un objeto NUEVO (sin dueño compartido):
  // dos llamadas (una por bola) = dos entradas independientes en `bonos`.
  const bonos = [];
  function mostrarBono(x, y) { bonos.push({ x: x, y: y, inicio: 0 }); }
  mostrarBono(100, 400); // bola A
  mostrarBono(250, 500); // bola B
  chk('dos carambolas → dos entradas distintas en la lista', bonos.length === 2 && bonos[0] !== bonos[1] && bonos[0].x !== bonos[1].x);
}

console.log('=== La racha sigue subiendo UNA vez por bola (sin cambios) ===');
{
  chk('anotarHit gateado por b.tocado (primer toque, una vez por bola)', /if \(!b\.tocado\) \{[\s\S]{0,120}b\.tocado = true;[\s\S]{0,200}P\.anotarHit\(marcador\)/.test(main));
  const m = { puntos: 0, racha: 0 };
  P.anotarHit(m); chk('anotarHit sube la racha en 1', m.racha === 1);
}

console.log('=== Sin restos de lo eliminado ===');
{
  chk('sin incrementoCarambola en puntuacion.js', !/incrementoCarambola/.test(fs.readFileSync(__dirname + '/../js/puntuacion.js', 'utf8')));
  chk('sin incrementoCarambola en main.js', !/incrementoCarambola/.test(main));
  chk('sin modo final / BONO_VIDA_INT/FIN / BONO_SUBE_INT-FIN', !/BONO_VIDA_INT|BONO_VIDA_FIN|BONO_SUBE_INT|BONO_SUBE_FIN|'final'/.test(main));
  chk('sin BONO_NIVELES ni nivelBono (un solo estilo)', !/BONO_NIVELES|nivelBono/.test(main));
}

console.log(`\n== RESUMEN carambola: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
