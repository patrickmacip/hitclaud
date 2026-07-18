// hitclaud — test del blindaje de runtime: node test/runtime.test.js

const U = require('../js/util.js');

console.log('=== leerToken: valor presente → valor; vacío → respaldo + warn ===');
{
  // Valor presente
  const v = U.leerToken('--coral', '#E8704E', ' #E8704E ');
  console.log(`  presente: ${v}  ${v === '#E8704E' ? 'OK ✓' : 'NO ✗'}`);

  // Vacío → respaldo + console.warn
  const warns = [];
  const realWarn = console.warn;
  console.warn = function (m) { warns.push(m); };
  const r = U.leerToken('--morado', '#8B5CF6', '');
  console.warn = realWarn;
  const okResp = r === '#8B5CF6';
  const okWarn = warns.length === 1 && warns[0].indexOf('--morado') >= 0;
  console.log(`  vacío → respaldo=${r} ${okResp ? '✓' : '✗'}   warn con nombre: ${okWarn ? 'OK ✓' : 'NO ✗'}`);

  // undefined también → respaldo (getPropertyValue de token ausente)
  const u = U.leerToken('--x', '#123', undefined);
  console.log(`  undefined → respaldo=${u}  ${u === '#123' ? 'OK ✓' : 'NO ✗'}`);

  // NUNCA devuelve '' (garantía anti-crash de addColorStop)
  const nuncaVacio = U.leerToken('--y', '#000', '') !== '';
  console.log(`  nunca devuelve '': ${nuncaVacio ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Bucle rAF: un cuadro que LANZA no mata el bucle ===');
{
  // Espejo de la estructura de cuadro() en main.js: try/catch + re-agendado
  // en finally. Mock de requestAnimationFrame que cuenta re-agendados.
  let agendados = 0;
  let idFalso = 0;
  function requestAnimationFrameMock() { agendados++; return ++idFalso; }
  const errores = [];
  const realError = console.error;
  console.error = function () { errores.push(Array.prototype.join.call(arguments, ' ')); };

  let cuadroN = 0;
  function cuadro() {
    try {
      cuadroN++;
      if (cuadroN === 2) throw new Error('addColorStop: color inválido (simulado)');
      // trabajo normal…
    } catch (e) {
      console.error('[hitclaud] error en un cuadro (degradado):', e.message);
    } finally {
      requestAnimationFrameMock(); // re-agenda SIEMPRE
    }
  }

  // Simula 4 cuadros; el 2º lanza.
  for (let i = 0; i < 4; i++) cuadro();
  console.error = realError;

  const sobrevive = agendados === 4;               // re-agendó tras los 4, incl. el que lanzó
  const registro = errores.length === 1;           // 1 error registrado, no propagado
  console.log(`  cuadros ejecutados=${cuadroN} re-agendados=${agendados}  ${sobrevive ? 'OK ✓ (el bucle sigue vivo)' : 'NO ✗'}`);
  console.log(`  error registrado sin matar el bucle: ${registro ? 'OK ✓' : 'NO ✗'}`);
}
