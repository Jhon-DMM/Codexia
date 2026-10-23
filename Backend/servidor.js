const app = require('./src/app');

const puerto = Number(process.env.PORT) || 3000;

app.listen(puerto, () => {
    console.log(`Servidor Codexia funcionando en http://localhost:${puerto}`);
});
