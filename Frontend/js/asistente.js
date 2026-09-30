document.addEventListener('DOMContentLoaded', () => {
  const mensajeInput = document.getElementById('mensaje');
  const enviarBtn = document.getElementById('enviar');
  const chat = document.querySelector('.chat');

  async function enviarMensaje() {
  const mensaje = mensajeInput.value;
  
  if (mensaje.trim() === "") {
    return alert("Debes escribir tu mensaje");
  }

  const nuevoMensaje = document.createElement('p');
  nuevoMensaje.textContent = "Tú: " + mensaje;
  chat.appendChild(nuevoMensaje);
  
  mensajeInput.value = "";

  try {
    const respuesta = await fetch("http://localhost:3000/asistente", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mensaje: mensaje })
    });

    if (respuesta.status !== 200) {
      throw new Error("Error en la respuesta del servidor");
    }

    const datos = await respuesta.json();

    const asistenteRespuesta = document.createElement('p');
    asistenteRespuesta.textContent = "Asistente: " + datos.mensaje;
    chat.appendChild(asistenteRespuesta);

  } catch (error) {
    console.error("Hubo un problema con la petición:", error);  
  
    const mensajeError = document.createElement('p');
    mensajeError.textContent = "Asistente: Lo siento, hubo un error al procesar tu mensaje. Inténtalo de nuevo.";
    mensajeError.style.color = 'red';
    chat.appendChild(mensajeError);
  }
}

  enviarBtn.addEventListener('click', enviarMensaje);

  mensajeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      enviarMensaje();
    }
  });

});
