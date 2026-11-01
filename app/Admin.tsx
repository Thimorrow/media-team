import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Copy, Plus, Settings2, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from './api';
import { Chevron, Dialog, Empty, ErrorNotice } from './components';
import { initials, type AppData, type Member, type Phase, type ServiceDetail, type Templates, type TemplateTask } from './types';

type Changed = () => Promise<void>;

function RoleFields({ roles, selected, setSelected }: { roles: AppData['roles']; selected: string[]; setSelected: (roles: string[]) => void }) {
  return <fieldset className="field-group"><legend>Dienste</legend><div className="choice-list">{roles.map(role => <label className="choice" key={role.id}><input type="checkbox" checked={selected.includes(role.id)} onChange={e => setSelected(e.target.checked ? [...selected, role.id] : selected.filter(id => id !== role.id))} /><span>{role.title}</span></label>)}</div></fieldset>;
}

export function CreateService({ data, onClose, onChanged, onCreated }: { data: AppData; onClose: () => void; onChanged: Changed; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('Sonntagsgottesdienst');
  const [startsAt, setStartsAt] = useState('');
  const [members, setMembers] = useState(data.members.filter(m => m.active).map(m => m.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const iso = berlinTimeToISO(startsAt);
      const result = await api<{ id: string }>('/services', { title, startsAt: iso, memberIds: members });
      await onChanged(); onCreated(result.id); onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Dialog title="Gottesdienst anlegen" onClose={onClose}><form onSubmit={submit} className="form-stack">
    <label>Titel<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={120} /></label>
    <label>Datum und Uhrzeit · Berlin<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required /></label>
    <fieldset className="field-group"><legend>Wer ist dabei?</legend><div className="choice-list member-choices">{data.members.filter(m => m.active).map(member => <label key={member.id} className="choice"><input type="checkbox" checked={members.includes(member.id)} onChange={e => setMembers(e.target.checked ? [...members, member.id] : members.filter(id => id !== member.id))} /><span>{member.name}</span></label>)}</div></fieldset>
    {members.length === 0 && <p className="muted small">Wähle mindestens ein Teammitglied.</p>}
    {error && <ErrorNotice message={error} />}
    <button className="button primary full" disabled={busy || !members.length}>{busy ? 'Wird angelegt…' : 'Gottesdienst anlegen'}<Plus size={18} /></button>
  </form></Dialog>;
}

function berlinTimeToISO(value: string) {
  const [y, m, d, h, min] = value.split(/[-T:]/).map(Number);
  if (![y, m, d, h, min].every(Number.isFinite)) throw new Error('Bitte Datum und Uhrzeit auswählen.');
  const desired = Date.UTC(y, m - 1, d, h, min);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let instant = desired;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(parts.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const rendered = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    if (rendered === desired) return new Date(instant).toISOString();
    instant += desired - rendered;
  }
  throw new Error('Diese Uhrzeit gibt es wegen der Zeitumstellung nicht. Bitte wähle eine andere Uhrzeit.');
}

export function TeamPage({ data, onChanged, onTemplates }: { data: AppData; onChanged: Changed; onTemplates: () => void }) {
  const [modal, setModal] = useState<'invite' | Member | null>(null);
  return <><div className="page-heading"><div><p className="eyebrow">Verwaltung</p><h1>Dein Team<span className="heading-dot">.</span></h1></div><button className="button primary" onClick={() => setModal('invite')}><UserPlus size={18} />Einladen</button></div>
    <div className="section-heading"><h2>Mitglieder <span className="count">{data.members.filter(m => m.active).length}</span></h2><button className="text-button" onClick={onTemplates}><Settings2 size={17} />Vorlagen</button></div>
    <div className="card members-list">{data.members.map(member => <button key={member.id} className={`member-row ${!member.active ? 'member-inactive' : ''}`} onClick={() => setModal(member)}><span className="avatar">{initials(member.name)}</span><span className="member-copy"><strong>{member.name}</strong><span>{!member.active ? 'Deaktiviert' : member.roles.map(id => data.roles.find(r => r.id === id)?.title).filter(Boolean).join(' · ') || 'Noch kein Dienst'}</span></span>{member.isAdmin && <ShieldCheck size={17} className="muted" aria-label="Admin" />}<Chevron /></button>)}</div>
    {modal === 'invite' && <InviteForm data={data} onClose={() => setModal(null)} />}
    {typeof modal === 'object' && modal && <EditMember data={data} member={modal} onChanged={onChanged} onClose={() => setModal(null)} />}
  </>;
}

function InviteForm({ data, onClose }: { data: AppData; onClose: () => void }) {
  const [email, setEmail] = useState(''); const [roles, setRoles] = useState<string[]>([]); const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [link, setLink] = useState(''); const [copied, setCopied] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const result = await api<{ token: string }>('/invites', { email, roles, isAdmin }); setLink(`${location.origin}/#invite=${encodeURIComponent(result.token)}`); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function copy() { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError('Kopieren ist hier nicht möglich. Du kannst den Link im Feld auswählen und kopieren.'); } }
  return <Dialog title={link ? 'Einladung ist bereit' : 'Mitglied einladen'} onClose={onClose}>{link ? <div className="form-stack"><div className="invite-success"><Check size={28} /><p>Für {email}</p></div><label>Einladungslink<input value={link} readOnly onFocus={e => e.currentTarget.select()} /></label><p className="muted small">Der Link ist 7 Tage gültig und kann einmal verwendet werden. Teile ihn direkt mit der Person.</p><button className="button primary full" onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Link kopiert' : 'Link kopieren'}</button>{error && <ErrorNotice message={error} />}</div> : <form onSubmit={submit} className="form-stack"><label>E-Mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" required /></label><RoleFields roles={data.roles} selected={roles} setSelected={setRoles} /><label className="choice standalone-choice"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} /><span>Admin-Rechte</span></label>{error && <ErrorNotice message={error} />}<button className="button primary full" disabled={busy}>{busy ? 'Wird erstellt…' : 'Einladungslink erstellen'}<UserPlus size={18} /></button></form>}</Dialog>;
}

function EditMember({ data, member, onChanged, onClose }: { data: AppData; member: Member; onChanged: Changed; onClose: () => void }) {
  const [roles, setRoles] = useState(member.roles); const [isAdmin, setIsAdmin] = useState(member.isAdmin); const [active, setActive] = useState(member.active);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await api(`/members/${member.id}`, { roles, isAdmin, active }, 'PATCH'); await onChanged(); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Dialog title={member.name} onClose={onClose}><form onSubmit={submit} className="form-stack"><p className="muted small">{member.email}</p><RoleFields roles={data.roles} selected={roles} setSelected={setRoles} /><p className="muted small">Die Dienstauswahl gilt für neue Gottesdienste. Bereits angelegte Aufgaben bleiben erhalten.</p><label className="choice standalone-choice"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} /><span>Admin-Rechte</span></label><label className="choice standalone-choice"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /><span>Konto aktiv</span></label>{error && <ErrorNotice message={error} />}<button className="button primary full" disabled={busy}>{busy ? 'Wird gespeichert…' : 'Änderungen speichern'}<Check size={18} /></button></form></Dialog>;
}

export function PersonalTaskForm({ detail, onChanged, onClose }: { detail: ServiceDetail; onChanged: Changed; onClose: () => void }) {
  const [title, setTitle] = useState(''); const [userId, setUserId] = useState(detail.personal[0]?.userId || ''); const [phase, setPhase] = useState<Phase>('before');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await api(`/services/${detail.id}/personal-tasks`, { userId, title, phase }); await onChanged(); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Dialog title="Persönliche Aufgabe" onClose={onClose}><form onSubmit={submit} className="form-stack"><label>Für wen?<select value={userId} onChange={e => setUserId(e.target.value)} required>{detail.personal.map(p => <option value={p.userId} key={p.userId}>{p.name}</option>)}</select></label><label>Aufgabe<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={240} /></label><label>Zeitpunkt<select value={phase} onChange={e => setPhase(e.target.value as Phase)}><option value="before">Vor dem Dienst</option><option value="after">Nach dem Dienst</option></select></label>{error && <ErrorNotice message={error} />}<button className="button primary full" disabled={busy || !userId}>{busy ? 'Wird hinzugefügt…' : 'Aufgabe hinzufügen'}<Plus size={18} /></button></form></Dialog>;
}

export function TemplatesPage({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Templates | null>(null); const [selection, setSelection] = useState('common'); const [phase, setPhase] = useState<Phase>('before');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false);
  async function load() { setError(''); try { setData(await api<Templates>('/templates')); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { void load(); }, []);
  function updateTasks(change: (tasks: TemplateTask[]) => TemplateTask[]) { setSaved(false); setData(current => !current ? current : selection === 'common' ? { ...current, common: change(current.common) } : { ...current, roles: current.roles.map(r => r.id === selection ? { ...r, tasks: change(r.tasks) } : r) }); }
  async function save() { setBusy(true); setError(''); try { await api('/templates', data, 'PUT'); setSaved(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const tasks = data ? selection === 'common' ? data.common : data.roles.find(r => r.id === selection)?.tasks || [] : [];
  return <><button className="text-button back-button" onClick={onBack}><ArrowLeft size={17} />Team</button><div className="page-heading"><div><p className="eyebrow">Verwaltung</p><h1>Vorlagen<span className="heading-dot">.</span></h1></div>{data && <button className="button primary" disabled={busy} onClick={save}>{saved ? <Check size={18} /> : <Settings2 size={18} />}{busy ? 'Speichert…' : saved ? 'Gespeichert' : 'Speichern'}</button>}</div><p className="page-intro">Änderungen gelten für neue Gottesdienste.</p>{error && <ErrorNotice message={error} retry={data ? undefined : load} />}{!data && !error && <div className="skeleton card" />}{data && <><div className="template-select"><label className="sr-only" htmlFor="template-role">Vorlage</label><select id="template-role" value={selection} onChange={e => setSelection(e.target.value)}><option value="common">Gemeinsame Aufgaben</option>{data.roles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select><div className="phase-switch" aria-label="Zeitpunkt">{(['before', 'after'] as const).map(value => <button key={value} aria-pressed={phase === value} onClick={() => setPhase(value)} className={phase === value ? 'active' : ''}>{value === 'before' ? 'Vor dem Dienst' : 'Nach dem Dienst'}</button>)}</div></div><div className="card template-list">{tasks.filter(t => t.phase === phase).map((task, index) => <div className="template-task" key={task.id}><span className="template-number">{String(index + 1).padStart(2, '0')}</span><div className="template-fields"><label><span className="sr-only">Aufgabe {index + 1}</span><input value={task.title} maxLength={240} required onChange={e => updateTasks(tasks => tasks.map(t => t.id === task.id ? { ...t, title: e.target.value } : t))} /></label><label><span className="sr-only">Details für Aufgabe {index + 1}</span><textarea rows={2} value={task.details || ''} placeholder="Details, falls nötig" maxLength={1000} onChange={e => updateTasks(tasks => tasks.map(t => t.id === task.id ? { ...t, details: e.target.value } : t))} /></label></div><button className="icon-button delete-button" aria-label={`Aufgabe ${index + 1} entfernen`} onClick={() => updateTasks(tasks => tasks.filter(t => t.id !== task.id))}><Trash2 size={18} /></button></div>)}{!tasks.some(t => t.phase === phase) && <Empty icon={<Users size={25} />} title="Noch keine Aufgaben" />}<button className="template-add" onClick={() => updateTasks(tasks => [...tasks, { id: crypto.randomUUID(), title: '', details: '', phase }])}><Plus size={18} />Aufgabe hinzufügen</button></div></>}</>;
}
