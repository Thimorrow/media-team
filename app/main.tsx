import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

let pressedButton: { element: HTMLButtonElement; pointerId: number; bounds: DOMRect } | null = null;
function clearPress() {
  pressedButton?.element.removeAttribute('data-pressed');
  pressedButton = null;
}
document.addEventListener('keydown', () => { clearPress(); document.documentElement.dataset.input = 'keyboard'; }, true);
document.addEventListener('pointerdown', event => {
  document.documentElement.dataset.input = 'pointer';
  if (!event.isPrimary) return;
  clearPress();
  if (event.pointerType === 'mouse' || event.button !== 0) return;
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button || button.disabled) return;
  pressedButton = { element: button, pointerId: event.pointerId, bounds: button.getBoundingClientRect() };
  button.dataset.pressed = 'true';
}, true);
document.addEventListener('pointermove', event => {
  if (!pressedButton || event.pointerId !== pressedButton.pointerId) return;
  const { left, right, top, bottom } = pressedButton.bounds;
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) clearPress();
}, { capture: true, passive: true });
for (const type of ['pointerup', 'pointercancel'] as const) {
  document.addEventListener(type, event => { if (event.pointerId === pressedButton?.pointerId) clearPress(); }, true);
}
window.addEventListener('blur', clearPress);
window.addEventListener('resize', clearPress);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearPress(); });

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
