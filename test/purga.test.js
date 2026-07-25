// hitclaud — PURGA: sólo quedan dos tipos de target (naranja + rojo).
// node test/purga.test.js
// Verifica CERO referencias a los tipos eliminados (enojado/bola-chica,
// bonanza/fiesta, moneda/dispersión, CloudOver) en el código de juego.

const fs = require('fs');
const path = require('path');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

const JS = ['main.js', 'fisica.js', 'puntuacion.js', 'util.js', 'render.js']
  .map(function (f) { return { f: f, src: fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8') }; });

// Términos de los tipos/power-ups eliminados que NO deben aparecer en NINGÚN js.
const MUERTOS = [
  'bonanza', 'moneda', 'enojado', 'dispersa', 'dispersarMoneda',
  'debuff', 'debuffHasta', 'powerupHasta', 'fiestaHasta', 'powerFlash', 'fiestaFlash',
  'ESTRELLA_', 'MONEDA_', 'FIESTA_', 'ENOJADO_', 'POWERUP_', 'DISPERSION_', 'RADIO_DEBIL',
  'generarCloud', 'CLOUD_', 'cubos8Mundo', 'bola-chica', 'bola chica',
  'MODOS', 'modoActivo', 'aplicarModoCSS',
];

console.log('=== Cero referencias a los tipos eliminados en js/ ===');
MUERTOS.forEach(function (term) {
  const hits = JS.filter(function (m) { return m.src.indexOf(term) !== -1; }).map(function (m) { return m.f; });
  chk(`"${term}" ausente${hits.length ? ' (aparece en ' + hits.join(',') + ')' : ''}`, hits.length === 0);
});

console.log('\n=== La palabra "cloud" sólo sobrevive como token de color del ROJO ===');
{
  // El rojo reusa los tokens --cloudover-a/b (COLOR.cloudoverA/B). Eso está OK;
  // lo prohibido es la LÓGICA del CloudOver (t.cloud, generarCloud, CLOUD_*).
  const malos = JS.filter(function (m) {
    return /\bt\.cloud\b/.test(m.src) || /generarCloud/.test(m.src) || /\bCLOUD_[A-Z]/.test(m.src);
  }).map(function (m) { return m.f; });
  chk(`sin lógica CloudOver (t.cloud/generarCloud/CLOUD_*)${malos.length ? ' en ' + malos.join(',') : ''}`, malos.length === 0);
}

console.log('\n=== Quedan exactamente dos marcas de tipo: naranja (sin flag) y ROJO ===');
{
  const main = JS.find(function (m) { return m.f === 'main.js'; }).src;
  chk('existe el tipo ROJO (t.rojo / generarRojo)', /t\.rojo/.test(main) && /generarRojo/.test(main));
  chk('el naranja es el target por defecto (generarNaranja)', /generarNaranja/.test(main));
}
