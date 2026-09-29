document.addEventListener('DOMContentLoaded', () => {
  const mensajeInput = document.getElementById('mensaje');
  const enviarBtn = document.getElementById('enviar');
  const chat = document.querySelector('.chat');

  function enviarMensaje() {
    const mensaje = mensajeInput.value;

    if (mensaje.trim() === '') {
      return alert('Debes escribir tu mensaje');
    }

    const nuevoMensaje = document.createElement('p');
    nuevoMensaje.textContent = mensaje;
    chat.appendChild(nuevoMensaje);

    const asistenteRespuesta = document.createElement('p');
    asistenteRespuesta.textContent = 'Asistente: Hola, lamento decirte que aún estamos preparando este apartado.';
    chat.appendChild(asistenteRespuesta);

    mensajeInput.value = '';
  }

  enviarBtn.addEventListener('click', enviarMensaje);

  mensajeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      enviarMensaje();
    }
  });

});
