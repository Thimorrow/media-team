export type Phase = 'before' | 'after';
export type User = { id: string; name: string; email: string; isAdmin: boolean; roles: string[] };
export type Member = User & { active: boolean };
export type Role = { id: string; title: string };
export type Service = { id: string; title: string; startsAt: string; archived: boolean; completed: number; total: number };
export type Task = { id: string; title: string; details?: string; phase: Phase; done: boolean; doneBy: string | null; revision: number };
export type PersonalList = { userId: string; name: string; roles: string[]; tasks: Task[] };
export type ServiceDetail = { id: string; title: string; startsAt: string; archived: boolean; common: Task[]; personal: PersonalList[] };
export type AppData = { user: User; services: Service[]; roles: Role[]; members: Member[] };
export type TemplateTask = { id: string; title: string; details?: string; phase: Phase };
export type Templates = { common: TemplateTask[]; roles: (Role & { tasks: TemplateTask[] })[] };
export type Invite = { email: string; isAdmin: boolean; roles: string[]; expiresAt: string };

export const date = (value: string, options: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ...options }).format(new Date(value));
export const shortDate = (value: string) => date(value, { weekday: 'short', day: 'numeric', month: 'long' });
export const time = (value: string) => date(value, { hour: '2-digit', minute: '2-digit' });
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
