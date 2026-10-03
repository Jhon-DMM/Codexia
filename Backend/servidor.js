require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

// Inicializas el cliente apuntando a la API de Groq
const client = new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY
});

app.use(cors());
app.use(express.json());

app.post("/asistente", async (req, res) => {
    const { mensaje } = req.body;

    // Validación de seguridad para evitar errores si 'mensaje' es undefined
    if (!mensaje || mensaje.trim() === '') {
        return res.status(400).json({
            error: 'Debes escribir tu mensaje'
        });
    }

    try {
        // Usamos el cliente de OpenAI en lugar de fetch
        const chatCompletion = await client.chat.completions.create({
            model: "openai/gpt-oss-120b", // Modelo válido de Groq (puedes cambiarlo por mixtral o llama3-70b)
            messages: [
                {
                    role: "user",
                    content: mensaje
                }
            ]
        });

        // Retornamos la respuesta navegando por el objeto correcto
        res.status(200).json({
            mensaje: chatCompletion.choices[0].message.content
        });

    } catch (error) {
        console.error("Error en la API de Groq:", error);

        res.status(500).json({
            error: "Error interno del servidor"
        });
    }
});

app.listen(3000, () => {
    console.log('Servidor codexia funcionando en http://localhost:3000');
});

app.get("/prueba-api", async (req, res) => {
    const respuesta = await fetch("https://jsonplaceholder.typicode.com/users/1");

    const datos = await respuesta.json();

    res.json(datos);
});

app.post("/prueba-api", async (req, res) => {

    const respuesta = await fetch("https://jsonplaceholder.typicode.com/posts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            titulo: "Hola API",
            mensaje: req.body.mensaje
        })
    });

    const datos = await respuesta.json();

    res.json(datos);
});