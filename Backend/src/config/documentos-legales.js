const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const RUTA_DOCUMENTOS = path.resolve(__dirname, '../../../Frontend/es/legal');

const DOCUMENTOS_LEGALES = [
  { tipo: 'terminos', version: '1.0', archivo: 'terminos.html' },
  { tipo: 'privacidad', version: '1.0', archivo: 'privacidad.html' },
];

function obtenerDocumentosLegales() {
  return DOCUMENTOS_LEGALES.map((documento) => {
    const contenido = fs.readFileSync(path.join(RUTA_DOCUMENTOS, documento.archivo));
    return {
      ...documento,
      sha256: createHash('sha256').update(contenido).digest('hex'),
    };
  });
}

module.exports = { obtenerDocumentosLegales };
