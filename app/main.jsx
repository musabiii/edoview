import { render } from 'preact';

import { App } from './App.jsx';
import './styles.css';

const root = document.getElementById('app');
// В index.html лежит статичный текст для поисковиков — убираем его перед запуском приложения.
root.textContent = '';
render(<App />, root);
