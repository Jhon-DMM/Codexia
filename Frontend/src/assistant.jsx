import React from 'react';
import { createRoot } from 'react-dom/client';
import { inicializarCargaUI } from '../js/carga-ui.js';
import Assistant from './pages/Assistant.jsx';

inicializarCargaUI();
createRoot(document.getElementById('root')).render(<Assistant />);
