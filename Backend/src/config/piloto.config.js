const DURACION_PILOTO_DIAS = 7;
const MENSAJE_PILOTO_FINALIZADO = 'Gracias por realizar las pruebas de Codexia';
const PILOTO_PREDETERMINADO = process.env.NODE_ENV === 'production' ? 'false' : 'true';
const PILOTO_ACTIVO =
  String(process.env.PILOTO_ACTIVO || PILOTO_PREDETERMINADO).toLowerCase() !== 'false';

function pilotoFinalizado(creadoEn, ahora = Date.now()) {
  return new Date(creadoEn).getTime() + DURACION_PILOTO_DIAS * 24 * 60 * 60 * 1000 <= ahora;
}

module.exports = {
  DURACION_PILOTO_DIAS,
  MENSAJE_PILOTO_FINALIZADO,
  PILOTO_ACTIVO,
  pilotoFinalizado,
};
