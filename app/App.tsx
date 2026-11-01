import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Archive, ArrowDownToLine, ArrowRight, AudioLines, CalendarDays, Check, CheckCheck, ChevronDown, ClipboardCheck, Headphones, KeyRound, LayoutTemplate, LogOut, Plus, Radio, Settings2, ShieldCheck, UserRound, Users, WifiOff, type LucideIcon } from 'lucide-react';
import { useWebHaptics } from 'web-haptics/react';
import { api, ApiError } from './api';
import { Brand, Chevron, Dialog, Empty, ErrorNotice, Ring, TaskRow } from './components';
import { CreateService, PersonalTaskForm, TeamPage, TemplatesPage } from './Admin';
import { date, initials, shortDate, time, type AppData, type Invite, type Phase, type Service, type ServiceDetail, type Task, type User } from './types';

type Page = 'duty' | 'services' | 'team' | 'profile' | 'templates';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function storedHaptics() { try { return localStorage.getItem('media-team:haptics') !== 'off'; } catch { return true; } }

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [data, setData] = useState<AppData | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [page, setPage] = useState<Page>('duty');
  const [scope, setScope] = useState<'common' | 'personal'>('common');
  const [phase, setPhase] = useState<Phase>('before');
  const [personalUserId, setPersonalUserId] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<'create' | 'personal' | 'password' | null>(null);
  const [haptics, setHaptics] = useState(storedHaptics);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);
  const { trigger } = useWebHaptics();
  const mutationCount = useRef(0);
  const mutationEpoch = useRef(0);
  const readEpoch = useRef({ app: 0, detail: 0 });
  const selectedRef = useRef(selectedId); selectedRef.current = selectedId;
  const userRef = useRef(user); userRef.current = user;

  const loseSession = useCallback(() => { setUser(null); setData(null); setDetail(null); setSelectedId(''); setSessionError('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.'); }, []);

  async function checkSession() {
    setCheckingSession(true); setSessionError('');
    try { const result = await api<{ user: User | null; needsSetup: boolean }>('/session'); setUser(result.user); setNeedsSetup(result.needsSetup); }
    catch (e) { setSessionError((e as Error).message); }
    finally { setCheckingSession(false); }
  }

  const loadApp = useCallback(async () => {
    const currentUser = userRef.current?.id;
    if (!currentUser) return;
    const version = ++readEpoch.current.app, mutations = mutationEpoch.current;
    try {
      const result = await api<AppData>('/app');
      if (userRef.current?.id !== currentUser || version !== readEpoch.current.app || mutations !== mutationEpoch.current) return;
      setData(result); setUser(result.user); setError('');
      setSelectedId(current => result.services.some(s => s.id === current) ? current : preferredService(result.services)?.id || '');
    } catch (e) { if (userRef.current?.id !== currentUser || version !== readEpoch.current.app || mutations !== mutationEpoch.current) return; if (e instanceof ApiError && e.status === 401) loseSession(); else setError((e as Error).message); }
  }, [loseSession]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id || !userRef.current) return;
    const currentUser = userRef.current.id;
    const version = ++readEpoch.current.detail, mutations = mutationEpoch.current;
    try {
      const result = await api<ServiceDetail>(`/services/${id}`);
      if (selectedRef.current !== id || userRef.current?.id !== currentUser || version !== readEpoch.current.detail || mutations !== mutationEpoch.current) return;
      setDetail(result); setDetailError('');
      setPersonalUserId(current => result.personal.some(p => p.userId === current) ? current : result.personal.find(p => p.userId === currentUser)?.userId || result.personal[0]?.userId || '');
    } catch (e) { if (selectedRef.current !== id || userRef.current?.id !== currentUser || version !== readEpoch.current.detail || mutations !== mutationEpoch.current) return; if (e instanceof ApiError && e.status === 401) loseSession(); else setDetailError((e as Error).message); }
  }, [loseSession]);

  useEffect(() => { void checkSession(); }, []);
  useEffect(() => { if (user?.id) void loadApp(); }, [user?.id, loadApp]);
  useEffect(() => { if (user?.id && selectedId) { setDetail(null); setDetailError(''); void loadDetail(selectedId); } }, [selectedId, user?.id, loadDetail]);
  useEffect(() => {
    const onlineChange = () => { setOnline(navigator.onLine); if (navigator.onLine) { void loadApp(); if (selectedRef.current) void loadDetail(selectedRef.current); } };
    window.addEventListener('online', onlineChange); window.addEventListener('offline', onlineChange);
    const poll = () => { if (document.visibilityState === 'visible' && navigator.onLine && userRef.current && mutationCount.current === 0) { void loadApp(); if (selectedRef.current) void loadDetail(selectedRef.current); } };
    const interval = window.setInterval(poll, 8000); document.addEventListener('visibilitychange', poll);
    return () => { window.clearInterval(interval); window.removeEventListener('online', onlineChange); window.removeEventListener('offline', onlineChange); document.removeEventListener('visibilitychange', poll); };
  }, [loadApp, loadDetail]);
  useEffect(() => {
    const beforeInstall = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    const didInstall = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', beforeInstall); window.addEventListener('appinstalled', didInstall);
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', didInstall); };
  }, []);
  useEffect(() => { if (!user?.isAdmin && (page === 'team' || page === 'templates')) setPage('duty'); }, [user?.isAdmin, page]);

  async function refresh() { await loadApp(); if (selectedRef.current) await loadDetail(selectedRef.current); }
  function feedback(kind: 'tap' | 'success' | 'error' = 'tap') { if (haptics) void trigger(kind === 'tap' ? 15 : kind); }

  async function toggleTask(task: Task) {
    if (!detail || detail.archived || !online || pending.has(task.id)) return;
    const id = detail.id; const actor = userRef.current; if (!actor) return;
    mutationCount.current++; mutationEpoch.current++; setPending(current => new Set(current).add(task.id)); setNotice(''); setError(''); feedback();
    const update = (current: ServiceDetail | null, changed: Task) => current?.id !== id ? current : { ...current, common: current.common.map(t => t.id === changed.id ? changed : t), personal: current.personal.map(p => ({ ...p, tasks: p.tasks.map(t => t.id === changed.id ? changed : t) })) };
    setDetail(current => update(current, { ...task, done: !task.done, doneBy: !task.done ? actor.name : null }));
    try {
      const result = await api<{ task: Task }>(`/services/${id}/tasks/${task.id}`, { done: !task.done, revision: task.revision }, 'PUT');
      if (userRef.current?.id === actor.id) { setDetail(current => update(current, result.task)); setNotice(result.task.done ? 'Aufgabe erledigt und gespeichert.' : 'Aufgabe wieder geöffnet.'); }
    } catch (e) {
      if (userRef.current?.id !== actor.id) return;
      setDetail(current => update(current, task)); feedback('error');
      if (e instanceof ApiError && e.status === 401) loseSession();
      else { setError(e instanceof ApiError && e.status === 409 ? 'Diese Aufgabe wurde gerade von jemand anderem geändert. Die Liste wird aktualisiert.' : (e as Error).message); if (e instanceof ApiError && e.status === 409) await loadDetail(id); }
    } finally {
      mutationCount.current--; setPending(current => { const next = new Set(current); next.delete(task.id); return next; });
      if (mutationCount.current === 0) void loadApp();
    }
  }

  async function logout() {
    try { await api('/logout', {}); setUser(null); setData(null); setDetail(null); setSelectedId(''); setSessionError(''); setPage('duty'); setError(''); setNotice(''); }
    catch (e) { setError((e as Error).message); }
  }
  async function archiveService(service: Service) {
    setError(''); mutationCount.current++;
    try { await api(`/services/${service.id}`, { archived: !service.archived }, 'PATCH'); await refresh(); feedback('success'); }
    catch (e) { if (e instanceof ApiError && e.status === 401) loseSession(); else setError((e as Error).message); }
    finally { mutationCount.current--; }
  }

  if (checkingSession) return <div className="boot"><Brand /><div className="boot-line" aria-label="Wird geladen" /></div>;
  if (!user) return <Auth needsSetup={needsSetup} error={sessionError} retry={checkSession} onAuthenticated={newUser => { setUser(newUser); setNeedsSetup(false); setSessionError(''); setError(''); setPage('duty'); }} />;

  const nav: { id: Page; label: string; mobile: string; icon: LucideIcon }[] = [{ id: 'duty', label: 'Mein Dienst', mobile: 'Dienst', icon: ClipboardCheck }, { id: 'services', label: 'Gottesdienste', mobile: 'Termine', icon: CalendarDays }, ...(user.isAdmin ? [{ id: 'team' as const, label: 'Team', mobile: 'Team', icon: Users }] : []), { id: 'profile', label: 'Mein Profil', mobile: 'Profil', icon: UserRound }];
  const currentSummary = data?.services.find(s => s.id === selectedId);
  const activeDetail = detail?.id === selectedId ? detail : null;
  const selectedPersonal = activeDetail?.personal.find(p => p.userId === personalUserId);
  const visibleTasks = (scope === 'common' ? activeDetail?.common : selectedPersonal?.tasks)?.filter(t => t.phase === phase) || [];
  const done = visibleTasks.filter(t => t.done).length;
  const future = data?.services.filter(s => !s.archived && s.id !== selectedId && new Date(s.startsAt).getTime() >= Date.now()).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)) || [];

  return <div className="app-shell">
    <a className="skip-link" href="#main">Zum Inhalt</a>
    <aside className="sidebar"><Brand /><nav aria-label="Hauptnavigation">{nav.map(item => <button key={item.id} onClick={() => setPage(item.id)} className={(page === item.id || page === 'templates' && item.id === 'team') ? 'nav-active' : ''} aria-current={page === item.id ? 'page' : undefined}><item.icon size={20} /><span>{item.label}</span>{item.id === 'duty' && currentSummary && <span className="nav-count">{Math.max(0, currentSummary.total - currentSummary.completed)}</span>}</button>)}</nav>{user.isAdmin && <div className="sidebar-tools"><span className="sidebar-label">ORGANISATION</span><button className={page === 'templates' ? 'nav-active' : ''} onClick={() => setPage('templates')}><LayoutTemplate size={19} />Vorlagen</button></div>}<button className="sidebar-profile" onClick={() => setPage('profile')}><span className="avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.isAdmin ? 'Admin' : 'Teammitglied'}</small></span><Settings2 size={17} /></button></aside>
    <div className="main-wrap"><header className="mobile-header"><Brand compact /><button className="avatar avatar-button" onClick={() => setPage('profile')} aria-label="Mein Profil öffnen">{initials(user.name)}</button></header><header className="desktop-header"><span>{date(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}</span><span className="session-status"><span />{online ? 'Verbunden' : 'Offline'}</span></header>
      <main id="main" className="main-content">
        {!online && <div className="notice offline-notice" role="status"><WifiOff size={18} /><span>Du bist offline. Aufgaben können erst mit Verbindung gespeichert werden.</span></div>}
        {error && <ErrorNotice message={error} retry={refresh} />}
        <div className="sr-only" role="status" aria-live="polite">{notice}</div>
        {!data && !error && <div className="loading-screen"><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-hero" /><div className="skeleton card" /></div>}
        {data && page === 'duty' && <>
          <div className="page-heading duty-heading"><div><p className="eyebrow">Hallo, {user.name.split(' ')[0]}</p><h1>Dein Dienst<span className="heading-dot">.</span></h1></div>{user.isAdmin && <button className="button secondary create-duty" onClick={() => setModal('create')}><Plus size={18} /><span>Gottesdienst</span></button>}</div>
          {!selectedId ? <div className="card"><Empty icon={<CalendarDays size={29} />} title="Noch kein Gottesdienst geplant" action={user.isAdmin ? <button className="button primary" onClick={() => setModal('create')}><Plus size={18} />Gottesdienst anlegen</button> : undefined}>{!user.isAdmin && 'Sobald du eingeteilt bist, erscheinen hier deine Aufgaben.'}</Empty></div> : <>
            <div className="duty-grid"><section className="service-hero" aria-label="Gottesdienst und Fortschritt"><div className="hero-top"><span className="hero-live"><span />{currentSummary?.archived ? 'Archiviert' : currentSummary && sameBerlinDay(currentSummary.startsAt) ? 'Heute' : 'Dein Gottesdienst'}</span><button onClick={() => setPage('services')} className="hero-change" aria-label="Anderen Gottesdienst auswählen"><CalendarDays size={17} /><ChevronDown size={14} /></button></div><div className="hero-center"><div><h2>{currentSummary?.title}</h2>{currentSummary && <p><span>{shortDate(currentSummary.startsAt)}</span><span className="hero-separator">/</span><span>{time(currentSummary.startsAt)} Uhr</span></p>}</div><Ring done={currentSummary?.completed || 0} total={currentSummary?.total || 0} large /></div><div className="hero-bottom"><div className="hero-avatars">{(activeDetail?.personal || []).slice(0, 4).map(p => <span key={p.userId} className="avatar" title={p.name}>{initials(p.name)}</span>)}</div><span><strong>{currentSummary?.completed || 0}</strong> von {currentSummary?.total || 0} Aufgaben erledigt</span></div></section>
              <aside className="duty-aside"><div className="your-roles"><span className="aside-icon"><Headphones size={20} /></span><h3>Deine Dienste</h3><div className="role-tags">{(activeDetail?.personal.find(p => p.userId === user.id)?.roles || user.roles).map(id => <span className="role-tag" key={id}>{data.roles.find(r => r.id === id)?.title || id}</span>)}{!user.roles.length && <span className="muted small">Noch kein Dienst zugeordnet</span>}</div></div>{future[0] && <button className="next-service" onClick={() => { setSelectedId(future[0].id); setPhase('before'); }}><span className="eyebrow">Danach im Kalender</span><strong>{shortDate(future[0].startsAt)}</strong><span>{time(future[0].startsAt)} Uhr <ArrowRight size={17} /></span></button>}</aside></div>
            <section className="checklist-section" aria-label="Aufgaben"><div className="checklist-toolbar"><div className="scope-switch" aria-label="Checkliste"><button className={scope === 'common' ? 'active' : ''} aria-pressed={scope === 'common'} onClick={() => setScope('common')}><Users size={17} />Gemeinsam</button><button className={scope === 'personal' ? 'active' : ''} aria-pressed={scope === 'personal'} onClick={() => { setScope('personal'); setPersonalUserId(activeDetail?.personal.find(p => p.userId === user.id)?.userId || activeDetail?.personal[0]?.userId || ''); }}><UserRound size={17} />Meine Aufgaben</button></div><div className="phase-switch" aria-label="Zeitpunkt"><button className={phase === 'before' ? 'active' : ''} aria-pressed={phase === 'before'} onClick={() => setPhase('before')}>Vor dem Dienst</button><button className={phase === 'after' ? 'active' : ''} aria-pressed={phase === 'after'} onClick={() => setPhase('after')}>Nach dem Dienst</button></div></div>
              {scope === 'personal' && user.isAdmin && (activeDetail?.personal.length || 0) > 0 && <div className="personal-picker"><label htmlFor="person-picker">Aufgaben von</label><select id="person-picker" value={personalUserId} onChange={e => setPersonalUserId(e.target.value)}>{activeDetail?.personal.map(p => <option value={p.userId} key={p.userId}>{p.name}{p.userId === user.id ? ' (du)' : ''}</option>)}</select><button className="icon-button" onClick={() => setModal('personal')} aria-label="Persönliche Aufgabe hinzufügen" disabled={activeDetail?.archived}><Plus size={20} /></button></div>}
              <div className="personal-role-tags role-tags">{scope === 'personal' && selectedPersonal?.roles.map(id => <span className="role-tag" key={id}>{data.roles.find(r => r.id === id)?.title || id}</span>)}</div><div className="section-heading task-section-heading"><h2>{scope === 'common' ? phase === 'before' ? 'Gemeinsam vorbereiten' : 'Gemeinsam abschließen' : personalUserId === user.id ? 'Deine Aufgaben' : `Aufgaben von ${selectedPersonal?.name || 'Teammitglied'}`}</h2>{activeDetail && <span className="task-count"><Check size={15} />{done}<span>/</span>{visibleTasks.length}</span>}</div>
              {detailError && <ErrorNotice message={`${detailError}${activeDetail ? ' Angezeigter Stand möglicherweise veraltet.' : ''}`} retry={() => void loadDetail(selectedId)} />}
              {activeDetail?.archived && <div className="notice archive-notice"><Archive size={17} />Dieser Gottesdienst ist archiviert. Die Aufgaben bleiben erhalten.</div>}
              {!activeDetail && !detailError ? <div className="skeleton card task-skeleton" /> : activeDetail && <div className="card task-list">{visibleTasks.map(task => <TaskRow key={task.id} task={task} showAuthor={scope === 'common'} busy={pending.has(task.id)} disabled={!online || activeDetail.archived || !!detailError} onToggle={() => void toggleTask(task)} />)}{!visibleTasks.length && <Empty icon={scope === 'personal' ? <UserRound size={26} /> : <CheckCheck size={26} />} title={scope === 'personal' ? 'Keine persönlichen Aufgaben' : 'Keine Aufgaben für diesen Abschnitt'} action={user.isAdmin && scope === 'personal' && !activeDetail.archived ? <button className="button secondary" onClick={() => setModal('personal')}><Plus size={17} />Aufgabe hinzufügen</button> : undefined} />}</div>}
              {visibleTasks.length > 0 && done === visibleTasks.length && <div className="complete-message"><span><CheckCheck size={20} /></span><div><strong>Alles erledigt.</strong><p>{scope === 'common' ? 'Dieser Abschnitt ist fürs ganze Team abgeschlossen.' : 'Du bist mit diesem Abschnitt fertig.'}</p></div></div>}
              <div className="checklist-footnote"><ShieldCheck size={14} /><span>{pending.size ? 'Änderung wird gespeichert…' : scope === 'common' ? 'Ein Haken gilt fürs ganze Team.' : 'Persönliche Aufgaben werden pro Person gespeichert.'}</span></div>
            </section>
          </>}
        </>}
        {data && page === 'services' && <><div className="page-heading"><div><h1>Gottesdienste<span className="heading-dot">.</span></h1></div>{user.isAdmin && <button className="button primary" onClick={() => setModal('create')}><Plus size={18} /><span>Anlegen</span></button>}</div>{data.services.length ? <div className="services-list">{[...data.services].sort((a, b) => Number(a.archived) - Number(b.archived) || +new Date(b.startsAt) - +new Date(a.startsAt)).map(service => <div className={`card service-list-card ${service.archived ? 'service-archived' : ''}`} key={service.id}><button className="service-open" onClick={() => { setSelectedId(service.id); setPage('duty'); setPhase('before'); }}><span className="date-tile"><span>{date(service.startsAt, { month: 'short' }).replace('.', '')}</span><strong>{date(service.startsAt, { day: '2-digit' })}</strong></span><span className="service-list-copy"><strong>{service.title}</strong><span>{date(service.startsAt, { weekday: 'long' })} · {time(service.startsAt)} Uhr{service.archived ? ' · Archiviert' : ''}</span></span><Ring done={service.completed} total={service.total} /><Chevron /></button>{user.isAdmin && <div className="service-card-footer"><span>{service.completed} von {service.total} erledigt</span><button className="text-button" onClick={() => void archiveService(service)}><Archive size={15} />{service.archived ? 'Wieder öffnen' : 'Archivieren'}</button></div>}</div>)}</div> : <div className="card"><Empty icon={<CalendarDays size={28} />} title="Noch keine Gottesdienste" action={user.isAdmin ? <button className="button primary" onClick={() => setModal('create')}>Ersten Gottesdienst anlegen<Plus size={18} /></button> : undefined} /></div>}</>}
        {data && page === 'team' && user.isAdmin && <TeamPage data={data} onChanged={refresh} onTemplates={() => setPage('templates')} />}
        {data && page === 'templates' && user.isAdmin && <TemplatesPage onBack={() => setPage('team')} />}
        {data && page === 'profile' && <><div className="page-heading"><div><h1>Mein Profil<span className="heading-dot">.</span></h1></div></div><div className="profile-grid"><section className="card profile-card"><span className="avatar avatar-large">{initials(user.name)}</span><h2>{user.name}</h2><p>{user.email}</p>{user.isAdmin && <span className="badge"><ShieldCheck size={14} />Admin</span>}<div className="role-tags">{user.roles.map(id => <span className="role-tag" key={id}>{data.roles.find(r => r.id === id)?.title || id}</span>)}</div></section><section className="card settings-card"><h2>Einstellungen</h2><label className="setting-row"><span><strong>Haptisches Feedback</strong><small>Dezente Rückmeldung beim Abhaken</small></span><input type="checkbox" role="switch" checked={haptics} onChange={e => { setHaptics(e.target.checked); try { localStorage.setItem('media-team:haptics', e.target.checked ? 'on' : 'off'); } catch { /* Storage may be unavailable in private browsing. */ } if (e.target.checked) void trigger(15); }} /></label><div className="install-setting"><span className="aside-icon"><ArrowDownToLine size={21} /></span><div><h3>{installed ? 'Auf dem Startbildschirm' : 'Als App installieren'}</h3>{installed ? <p>Du nutzt Media Team als installierte App.</p> : installEvent ? <button className="text-button" onClick={async () => { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); }}>App installieren<ArrowRight size={16} /></button> : <p>Öffne das Browsermenü oder „Teilen“ und wähle „Zum Home-Bildschirm“ oder „App installieren“.</p>}</div></div><button className="button secondary full password-button" onClick={() => setModal('password')}><KeyRound size={18} />Passwort ändern</button><button className="button secondary full logout-button" onClick={() => void logout()}><LogOut size={18} />Abmelden</button></section></div></>}
      </main><footer className="desktop-footer"><span>Media Team</span><span>{user.isAdmin ? 'Admin-Bereich' : ''}</span></footer>
    </div>
    <nav className="bottom-nav" aria-label="Mobile Navigation">{nav.map(item => <button key={item.id} onClick={() => setPage(item.id)} className={(page === item.id || page === 'templates' && item.id === 'team') ? 'nav-active' : ''} aria-current={page === item.id ? 'page' : undefined}><span className="bottom-icon"><item.icon size={21} /></span><span>{item.mobile}</span></button>)}</nav>
    {modal === 'password' && <PasswordForm onClose={() => setModal(null)} />}
    {modal === 'create' && data && <CreateService data={data} onClose={() => setModal(null)} onChanged={refresh} onCreated={id => { setSelectedId(id); setPage('duty'); setPhase('before'); }} />}
    {modal === 'personal' && activeDetail && <PersonalTaskForm detail={activeDetail} onClose={() => setModal(null)} onChanged={refresh} />}
  </div>;
}

function preferredService(services: Service[]) {
  const active = services.filter(s => !s.archived).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return active.find(s => sameBerlinDay(s.startsAt)) || active.find(s => +new Date(s.startsAt) >= Date.now()) || active.at(-1) || services[0];
}
function sameBerlinDay(value: string) { return date(value, { year: 'numeric', month: '2-digit', day: '2-digit' }) === date(new Date().toISOString(), { year: 'numeric', month: '2-digit', day: '2-digit' }); }

function PasswordForm({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/password', { currentPassword, password }); setCurrentPassword(''); setPassword(''); setSaved(true); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Dialog title="Passwort ändern" onClose={onClose}>{saved ? <div className="form-stack"><div className="invite-success" role="status"><Check size={23} /><p>Dein Passwort wurde geändert. Andere angemeldete Geräte wurden abgemeldet.</p></div><button className="button primary full" onClick={onClose}>Fertig<Check size={18} /></button></div> : <form className="form-stack" onSubmit={submit}><label>Aktuelles Passwort<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label><label>Neues Passwort<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={256} required /><small>Mindestens 12 Zeichen</small></label>{error && <ErrorNotice message={error} />}<button className="button primary full" disabled={busy}>{busy ? 'Wird gespeichert…' : 'Passwort speichern'}<KeyRound size={18} /></button></form>}</Dialog>;
}

function Auth({ needsSetup, error: sessionError, retry, onAuthenticated }: { needsSetup: boolean; error: string; retry: () => void; onAuthenticated: (user: User) => void }) {
  const [hash, setHash] = useState(() => new URLSearchParams(location.hash.slice(1)));
  const setupToken = hash.get('setup') || ''; const inviteToken = hash.get('invite') || '';
  const [invite, setInvite] = useState<Invite | null>(null); const [inviteError, setInviteError] = useState(''); const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState(setupToken);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const setup = needsSetup && !inviteToken;
  useEffect(() => { const change = () => { setHash(new URLSearchParams(location.hash.slice(1))); setInviteError(''); setInvite(null); setError(''); }; window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => {
    if (!inviteToken) { setInviteLoading(false); return; }
    let current = true; setInviteLoading(true);
    api<Invite>(`/invites/${encodeURIComponent(inviteToken)}`).then(result => { if (current) { setInvite(result); setEmail(result.email); } }).catch(e => { if (current) setInviteError((e as Error).message); }).finally(() => { if (current) setInviteLoading(false); });
    return () => { current = false; };
  }, [inviteToken]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<{ user: User }>(setup ? '/setup' : inviteToken ? '/join' : '/login', setup ? { token: code || setupToken, name, email, password } : inviteToken ? { token: inviteToken, name, password } : { email, password });
      history.replaceState(null, '', location.pathname + location.search); onAuthenticated(result.user);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <main className="auth-layout"><section className="auth-art" aria-hidden="true"><Brand /><div className="auth-visual"><div className="audio-orbit orbit-one" /><div className="audio-orbit orbit-two" /><div className="audio-orbit orbit-three" /><div className="auth-wave"><AudioLines size={100} strokeWidth={1.1} /></div><span className="visual-node node-one"><Headphones size={25} /></span><span className="visual-node node-two"><Radio size={25} /></span><span className="visual-node node-three"><Check size={27} /></span></div><div className="auth-art-footer"><span>MEDIA TEAM</span></div></section><section className="auth-panel"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><span className="auth-mark"><ClipboardCheck size={24} /></span><h1>{setup ? 'Admin-Konto erstellen' : inviteToken ? 'Konto erstellen' : 'Anmelden'}</h1><p className="auth-description">{setup ? 'Erstelle das erste Admin-Konto für euer Media-Team.' : inviteToken ? invite ? `Erstelle dein Konto für ${invite.email}.` : 'Deine Einladung wird geprüft.' : 'Melde dich mit deinem Team-Konto an.'}</p>
      {sessionError && <ErrorNotice message={sessionError} retry={retry} />}
      {inviteLoading ? <div className="skeleton auth-skeleton" /> : inviteError ? <div className="form-stack"><ErrorNotice message={inviteError} /><p className="muted small">Bitte einen Admin um einen neuen Einladungslink.</p><button className="button secondary full" onClick={() => { location.hash = ''; }}>Zur Anmeldung<ArrowRight size={18} /></button></div> : <form className="form-stack" onSubmit={submit}>
        {(setup || inviteToken) && <label>Dein Name<input name="name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" enterKeyHint="next" required maxLength={80} /></label>}
        {!inviteToken && <label>E-Mail<input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" required /></label>}
        <label>Passwort<input name="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={setup || inviteToken ? 'new-password' : 'current-password'} minLength={setup || inviteToken ? 12 : undefined} maxLength={256} enterKeyHint="done" required />{(setup || inviteToken) && <small>Mindestens 12 Zeichen</small>}</label>
        {setup && !setupToken && <label>Einrichtungscode<input name="token" value={code} onChange={e => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required /></label>}
        {error && <ErrorNotice message={error} />}
        <button className="button primary full auth-submit" disabled={busy || !navigator.onLine}>{busy ? 'Einen Moment…' : setup ? 'Admin-Konto erstellen' : inviteToken ? 'Konto erstellen' : 'Anmelden'}<ArrowRight size={19} /></button>
      </form>}
      {!setup && !inviteToken && <p className="auth-invite-note"><Users size={15} />Noch kein Konto? Frag einen Admin nach einer Einladung.</p>}
    </div><div className="auth-footer"><ShieldCheck size={15} />Nur für euer Team</div></section></main>;
}
