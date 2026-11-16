import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

const registerAppServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('App offline shell could not be enabled:', error);
    });
  }
};

if (document.readyState === 'complete') registerAppServiceWorker();
else window.addEventListener('load', registerAppServiceWorker, { once: true });
