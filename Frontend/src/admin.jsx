import React from 'react';
import { createRoot } from 'react-dom/client';
import { inicializarCargaUI } from '../js/carga-ui.js';
import Admin from './pages/Admin.jsx';

inicializarCargaUI();
createRoot(document.getElementById('root')).render(<Admin />);
