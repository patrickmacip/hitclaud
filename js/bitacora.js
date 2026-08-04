// hitclaud — bitacora.js
// Bitácora de actualizaciones: la lista que muestra la pantalla #actualizaciones.
// Módulo PURO, sin DOM. Corre igual en navegador (window.Bitacora) y en node
// (module.exports), como util.js/fisica.js/puntuacion.js.
//
// MANTENIMIENTO: para publicar una versión nueva, ANTEPONÉ una entrada al INICIO
// de `versiones` (la lista va del MÁS RECIENTE al MÁS VIEJO). Cada entrada:
//   { version, fecha, puntos: [ { texto } | { texto, retirado: true } ] }
// La marca `retirado: true` es un DATO (no texto pegado): la pantalla decide cómo
// mostrarla (menor contraste + la palabra "Retirado" al final de la línea).

(function (global) {
  'use strict';

  const versiones = [
    {
      version: '1.3', fecha: '3 de agosto',
      puntos: [
        { texto: 'Ahora todas tus partidas compiten por el ranking, no solo tus récords' },
        { texto: 'Los récords locales arrancan de cero para todos' },
      ],
    },
    {
      version: '1.2', fecha: '3 de agosto',
      puntos: [
        { texto: 'Nueva tabla de posiciones: los 20 mejores de cada modo, con podio' },
        { texto: 'Ya no puedes golpear targets que aún no han entrado a la pantalla' },
        { texto: 'Un target rojo ya no te mata antes de aparecer' },
        { texto: 'La carambola da 500 puntos por dos golpes, sin escalar' },
        { texto: 'Los puntos de carambola se suman justo cuando ves el número' },
        { texto: 'El multiplicador de racha se ve más grande y limpio' },
      ],
    },
    {
      version: '1.1', fecha: '2 de agosto',
      puntos: [
        { texto: 'Big Claude se rompe de verdad: los pedazos se separan, caen y giran cada uno por su lado' },
        { texto: 'Puedes seguir pegándole a los pedazos mientras caen' },
        { texto: 'Nuevo bono por encadenar golpes: 500, 1500, 5000 y sigue subiendo' },
        { texto: 'Cada golpe encadenado suelta su número en pantalla, más grande y más amarillo entre más vale' },
        { texto: 'Fuera el aviso emergente de novedades: ahora todo vive en esta bitácora' },
      ],
    },
    {
      version: '1.0', fecha: '1 y 2 de agosto',
      puntos: [
        { texto: 'Tu nombre se pide una sola vez y aparece en la barra' },
        { texto: 'Modos de 15 y 30 segundos, cada uno con su propio récord' },
        { texto: 'La hitball pesa 10% más: el impacto se siente más contundente' },
        { texto: 'Los targets se parten y los trozos sueltos caen' },
        { texto: 'Tu firma aparece entre los datos del fondo' },
        { texto: 'Modo Relax', retirado: true },
        { texto: 'Contador sin contorno' },
      ],
    },
    {
      version: '0.9', fecha: '31 de julio',
      puntos: [
        { texto: 'Pantalla de bienvenida con tu récord y botón de jugar' },
        { texto: 'El fondo es una cascada de datos reales del juego, en vivo' },
        { texto: 'Estela de meteoro: la bola deja rastro continuo' },
        { texto: 'El impacto pesa más: menos rebote, más contundencia' },
        { texto: 'Zoom de cámara en el CloudOver', retirado: true },
      ],
    },
    {
      version: '0.8', fecha: '25 al 28 de julio',
      puntos: [
        { texto: 'CloudOver: el target rojo termina la partida con explosión y congelamiento' },
        { texto: 'Big Claude: el target grande, con cuatro veces más cubitos y mínimo cuatro golpes' },
        { texto: 'Menú de pausa que detiene el reloj' },
        { texto: 'El récord solo se guarda si aguantas los 60 segundos' },
        { texto: 'Mira y disparo directo en computadora' },
        { texto: 'El juego corre mucho más suave' },
      ],
    },
    {
      version: '0.5', fecha: '18 y 24 de julio',
      puntos: [
        { texto: 'Racha continua: encadenar aciertos multiplica los puntos' },
        { texto: 'Los números de premio y de pérdida se ven grandes en pantalla' },
        { texto: 'El castigo escala: mientras más alto vas, más caro es fallar' },
        { texto: 'Estrella Bonanza, moneda de dispersión y disparo explosivo', retirado: true },
        { texto: 'Target morado enojado', retirado: true },
        { texto: 'Modo bola-chica y modo dispersión', retirado: true },
        { texto: 'Baño de color: la pantalla entera se teñía según el modo', retirado: true },
      ],
    },
    {
      version: '0.1', fecha: '17 de julio',
      puntos: [
        { texto: 'Primera versión jugable' },
        { texto: 'Arrastras desde el hitmaker para lanzar la bola' },
        { texto: 'Los targets se demuelen por pedazos, no de un golpe' },
        { texto: 'Puntos por demolición, rachas y castigo por fallar' },
        { texto: 'Explosión de cubitos al destruir' },
      ],
    },
  ];

  const Bitacora = { versiones: versiones };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Bitacora;
  } else {
    global.Bitacora = Bitacora;
  }
})(typeof window !== 'undefined' ? window : globalThis);
