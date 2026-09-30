const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hola desde el servidor de codexia");
});
app.get("/hola", (req, res) => {
    res.send("Hola desde la otra parte de codexia");
});

app.post("/asistente", (req, res) => {
   const {mensaje} = req.body;
   if (mensaje.trim() === '') {
      return res.status(400).send({error: 'Debes escribir tu mensaje'});
    }
        
    res.status(200).send({mensaje: `Hola!!, soy la asistente IA de Codexia,\n lamentablemente por ahora no nos podremos comunicar.\n estamos trabjando en eso.`});
});

app.listen(3000, () => {
    console.log('Servidor codexia funcionando en http://localhost:3000');
});