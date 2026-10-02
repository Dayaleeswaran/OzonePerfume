import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { S } from './lib/store.js';

/* Expose the store in development for debugging and browser tests */
if (import.meta.env.DEV) window.OZ = { store: S };

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
