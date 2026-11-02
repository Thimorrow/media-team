import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type RefObject } from 'react';
import { AudioLines, Check, ChevronRight, CircleAlert, Eye, EyeOff, X } from 'lucide-react';
import type { Task } from './types';

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <span className="password-input"><input {...props} type={visible ? 'text' : 'password'} /><button type="button" className="password-toggle" aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button></span>;
}

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
    <span className="task-copy"><span className="task-title">{task.title}</span>{task.details && <span className="task-details">{task.details}</span>}{showAuthor && <span className="task-author" title={task.done && task.doneBy ? `Erledigt von ${task.doneBy}` : undefined}>{task.done && task.doneBy ? `Erledigt von ${task.doneBy}` : '\u00a0'}</span>}</span>
    {busy && <span className="saving-dot" aria-label="Wird gespeichert" />}
  </button>;
}

export function useDialogDismiss() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dismiss = () => { dialogRef.current?.dispatchEvent(new Event('cancel', { cancelable: true })); };
  return { dialogRef, dismiss };
}

export function Dialog({ title, onClose, children, ref: forwardedRef }: { title: string; onClose: () => void; children: ReactNode; ref?: RefObject<HTMLDialogElement | null> }) {
  const ownRef = useRef<HTMLDialogElement>(null);
  const ref = forwardedRef || ownRef;
  const backdropPress = useRef(false);
  const titleId = useId();
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function dismiss() {
    const dialog = ref.current;
    if (!dialog || dialog.dataset.closing === 'true') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.input === 'keyboard') { closeRef.current(); return; }
    dialog.dataset.closing = 'true';
    dialog.inert = true;
    dialog.dataset.visible = 'false';
    timer.current = setTimeout(() => closeRef.current(), 170);
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    dialog.focus();
    const frame = requestAnimationFrame(() => { dialog.getBoundingClientRect(); if (dialog.dataset.closing !== 'true') dialog.dataset.visible = 'true'; });
    const close = () => closeRef.current();
    dialog.addEventListener('close', close);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(frame); clearTimeout(timer.current); document.body.style.overflow = previousOverflow; dialog.removeEventListener('close', close); dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="dialog" tabIndex={-1} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); dismiss(); }} onPointerDown={e => { const r = e.currentTarget.getBoundingClientRect(); backdropPress.current = e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom); }} onClick={e => { if (backdropPress.current && e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dismiss(); } }}>
    <div className="dialog-header"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={dismiss} aria-label="Schließen"><X size={21} /></button></div><div className="dialog-content">{children}</div>
  </dialog>;
}

export function Chevron() { return <ChevronRight size={19} className="muted" aria-hidden="true" />; }
