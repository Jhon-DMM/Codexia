import React from 'react';
import { createRoot } from 'react-dom/client';
import { inicializarCargaUI } from '../js/carga-ui.js';
import Home from './pages/Home.jsx';

inicializarCargaUI();
createRoot(document.getElementById('root')).render(<Home />);
