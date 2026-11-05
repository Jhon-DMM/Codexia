import React from 'react';
import { createRoot } from 'react-dom/client';
import { inicializarCargaUI } from '../js/carga-ui.js';
import Account from './pages/Account.jsx';

inicializarCargaUI();
createRoot(document.getElementById('root')).render(<Account />);
