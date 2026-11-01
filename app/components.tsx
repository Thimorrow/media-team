import { useEffect, useRef, type ReactNode } from 'react';
import { AudioLines, Check, ChevronRight, CircleAlert, X } from 'lucide-react';
import type { Task } from './types';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-symbol"><AudioLines size={23} strokeWidth={2} /></span><span>media<span className="brand-light">team</span><span className="brand-dot">.</span></span></div>;
}

export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="notice notice-error" role="alert"><CircleAlert size={19} aria-hidden="true" /><span>{message}</span>{retry && <button className="text-button" onClick={retry}>Erneut versuchen</button>}</div>;
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><span className="empty-icon" aria-hidden="true">{icon}</span><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function Ring({ done, total, large = false }: { done: number; total: number; large?: boolean }) {
  const percent = total ? Math.round(done / total * 100) : 0;
  return <div className={`progress-ring ${large ? 'ring-large' : ''}`} role="img" aria-label={`${done} von ${total} Aufgaben erledigt`}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="ring-track" cx="50" cy="50" r="44" /><circle className="ring-value" cx="50" cy="50" r="44" pathLength="100" strokeDasharray={`${percent} 100`} /></svg>
    <span>{percent === 100 ? <Check size={large ? 34 : 20} /> : <>{percent}<small>%</small></>}</span>
  </div>;
}

export function TaskRow({ task, disabled, busy, onToggle, showAuthor = true }: { task: Task; disabled: boolean; busy: boolean; onToggle: () => void; showAuthor?: boolean }) {
  return <button className={`task-row ${task.done ? 'task-done' : ''} ${busy ? 'task-saving' : ''}`} role="checkbox" aria-checked={task.done} aria-busy={busy} disabled={disabled || busy} onClick={onToggle}>
    <span className="task-checkbox" aria-hidden="true"><Check size={16} strokeWidth={2.8} /></span>
    <span className="task-copy"><span className="task-title">{task.title}</span>{task.details && <span className="task-details">{task.details}</span>}{showAuthor && task.done && task.doneBy && <span className="task-author">Erledigt von {task.doneBy}</span>}</span>
    {busy && <span className="saving-dot" aria-label="Wird gespeichert" />}
  </button>;
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    dialog.focus();
    const close = () => onClose();
    dialog.addEventListener('close', close);
    return () => { dialog.removeEventListener('close', close); dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="dialog" tabIndex={-1} aria-labelledby="dialog-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className="dialog-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Schließen"><X size={21} /></button></div><div className="dialog-content">{children}</div>
  </dialog>;
}

export function Chevron() { return <ChevronRight size={19} className="muted" aria-hidden="true" />; }
