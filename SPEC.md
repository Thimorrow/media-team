# Media-Team-App

Stand: 1. November 2026. Implementierung, direkte Supabase-Anbindung und Vercel-Vorschau sind geprüft. Einrichtung des ersten echten Admin-Kontos und Handy-Abnahme liegen beim Nutzer.

## Ziel

Eine auf dem Handy installierbare PWA für das Media-Team der Kirche. Jedes Mitglied hat einen eigenen Login, eine gemeinsame Checkliste und zusätzliche persönliche Aufgaben. Es gibt Admin-Konten.

## Vereinbart

- Gemeinsame Aufgaben werden einmal für das ganze Team abgehakt.
- Jeder Gottesdienst erhält neue, offene Aufgaben. Frühere Gottesdienste und ihre Haken bleiben erhalten.
- Zusätzlich gibt es eigene Aufgaben pro Person. Bisher benannte Dienste sind ProPresenter-Team, Tontechnik und Licht. Ihre Aufgaben stehen in `data/role-checklists.json`.
- Nach dem Dienst wird alles in umgekehrter Reihenfolge ausgeschaltet beziehungsweise weggeräumt. Abschließend wird die Sauberkeit geprüft.
- Die gemeinsame Checkliste steht in `data/common-checklist.json`. Einträge mit `confirmationRequired` sind Vorschläge und dürfen bis zur Klärung nicht als bestätigte Aufgaben übernommen werden.
- Der Beamer ist bestätigt und gehört zur Vor- und Nachbereitung.
- Der Soundcheck wird in beiden Dienstvorlagen aufgeführt. Als persönliche Aufgabe hakt ihn jede zugeordnete Person selbst ab.
- Der Lichtcomputer wird nach der angegebenen Zuständigkeit von der Tontechnik eingeschaltet. Der Licht-Dienst schaltet das Licht ein.
- Hintergründe werden bewusst und passend ausgewählt. Vorgabe des Nutzers: „kein Slop“.
- Für das Gebärdensprach-Team wird In-Ear benötigt. Annahme: „ieam“ bedeutet IEM beziehungsweise In-Ear-Monitoring.
- Schwerpunkt ist eine klare mobile Oberfläche mit großen antippbaren Aufgaben, sichtbarem Fortschritt und einer unten erreichbaren Navigation.
- Gestaltung nach `emil-ask-emil`, mobile Plattformdetails nach `emil-mobile-native`, kurze Rückmeldungen nach `emil-animations`.
- Lochies WebHaptics wird für dezentes haptisches Feedback vorgesehen. Tatsächliche Haptik und Bedienung als installierte PWA brauchen einen Test auf echten Handys.
- Login über E-Mail und Passwort. Admins erstellen Einladungslinks, verwalten Mitglieder und Dienste, bearbeiten Vorlagen und sehen den Fortschritt. Die App versendet keine E-Mails.
- Arbeitsname: Media Team. Daten werden serverseitig gespeichert; der Browser erhält keine Datenbankschlüssel.
- Öffentliches Repository: https://github.com/Thimorrow/media-team. Aktueller Vorschau-Branch: `codex/preview/media-team`.
- Vercel-Vorschau ist beauftragt. Supabase wird direkt verwendet, ohne Vercel-Marketplace-Verknüpfung. Das vom Nutzer bereitgestellte Projekt ist `fhpsxgapmhcqwymtsloc`.
- Seit der Anweisung „Fixe das ui noch nicht“ werden keine weiteren visuellen Verfeinerungen vorgenommen. Ein späterer UI-Umbau ist vom Nutzer vorgesehen.

## Noch offen

- Einmalige Einrichtung des ersten echten Admin-Kontos durch den Nutzer. Keine Demo-Konten in der Cloud.
- Tatsächliche Zuordnung der Dienste zu Mitgliedern erfolgt durch Admins in der App.
- Ist „Flur 2“ die richtige Ortsangabe?
- Vorschlag für nach dem Dienst: Kamera-Akkus an die Ladestation legen.
- Die Freigabe zur Veröffentlichung des öffentlichen Repositories und der Vercel-Vorschau ist erteilt. Ein Versand von Einladungen an andere ist nicht beauftragt.

## Akzeptanzkriterien für die Umsetzung

- [x] Ein Mitglied kann sich mit seinem eigenen Konto anmelden und abmelden. Lokal per API geprüft.
- [x] Unangemeldete Besucher erhalten keinen Zugriff auf Teamdaten. Lokal per API geprüft.
- [x] Mitglieder können keine Admin-Aktionen ausführen, auch nicht über direkte Anfragen. Lokal per API geprüft.
- [ ] Gemeinsame und persönliche Aufgaben sowie Vor- und Nachbereitung sind klar zu unterscheiden.
- [x] Abhaken, Rückgängigmachen und erneutes Laden erhalten den korrekten Zustand. Lokale API-Tests einschließlich Serverneustart.
- [x] Ein neuer Gottesdienst beginnt mit offenen Aufgaben; frühere Einheiten bleiben erhalten. Lokale API-Tests mit Vorlagen-Snapshots.
- [ ] Fehlgeschlagene Speicherung und fehlende Verbindung sind sichtbar; es wird kein ungespeicherter Erfolg angezeigt.
- [x] Admin-API für Mitglieder, Vorlagen, Einladungen und Gottesdienste ist lokal geprüft.
- [ ] Die PWA hat Manifest, passende Icons und einen definierten Offline-Zustand.
- [ ] Die mobile Oberfläche funktioniert ohne horizontales Scrollen; Formularfelder, sichere Bildschirmränder und Tastatur werden berücksichtigt.
- [ ] Bedienelemente sind per Tastatur und mit zugänglichen Namen nutzbar. Reduzierte Bewegung wird respektiert.
- [x] Login, Aufgaben, Rollen und Speicherung sind lokal mit getrennten Testkonten geprüft. SQLite- und PostgreSQL-Tests sind getrennt von Cloud-Nachweisen.
- [ ] Installation, Haptik, Bildschirmränder und Bildschirmtastatur werden auf einem echten Handy geprüft; Browser-Emulation ersetzt diese Abnahme nicht.

## Arbeitsstand

React/TypeScript/Vite-Oberfläche und native Node-API sind implementiert. SQLite ist für lokale Arbeit vorgesehen, PostgreSQL für die direkte Supabase-Anbindung. Cloud-Tabellen liegen im privaten Schema `media_team`. Das Schema bleibt im Eigentum des Datenbank-Admins, `media_team_app` hat dort ausschließlich USAGE und CREATE und besitzt die App-Tabellen. Keine Rollenmitgliedschaften wurden verändert. Der erste echte Admin bleibt dem Nutzer vorbehalten.

Prüfungsbefehle: `npm run check`, `npm test`, `npm run build`. Alle lokalen Checks und der erste GitHub-CI-Lauf für `3001060` bestanden. Außerdem bestanden 14/14 API-Tests gegen das echte separate Supabase-Testschema, einschließlich Neustart, gemeinsamen/persönlichen Haken, Berechtigungen, Einladungen und konkurrierenden Änderungen. Das Testschema wurde anschließend per MCP entfernt. Das echte App-Schema enthält weiterhin keine Konten.

Die lokale Browserprüfung hat Anmeldung, Checkbox-Speicherung über Neuladen sowie das Anlegen eines neuen Gottesdiensts mit offenen Aufgaben bestätigt. Das native Datumfeld wurde im Browser-Test über DOM-Eingabeereignisse gesetzt. Ein Smartphone und die installierte PWA wurden noch nicht geprüft. Die Demo verwendet ausschließlich `.local/demo.sqlite`.

## Ausführung

- Blockierende Schritte: direkte Datenbankverbindung und MCP-Anmeldung vervollständigen, bevor Cloud-Nutzung als erfolgreich gemeldet wird.
- Unabhängige Arbeit: Oberfläche, API und PWA-Dateien wurden getrennt umgesetzt und danach integriert.
- Geteilter Zustand: Team-Haken haben einen gemeinsamen Datensatz je Gottesdienst, persönliche Aufgaben einen Besitzer. Revisionsnummern verhindern unbemerkte Überschreibungen.
- Zuständigkeit: Hauptagent integriert und prüft; unabhängige Sicherheitsprüfung und isolierte API-Tests sind erfolgt. Kein Merge beauftragt.

## Bereitstellung und Übergabe

- Geprüfte Code-Revision: `974bf78e13ce15e606e58f647057c7cfa687cf42`. GitHub-CI für diese Revision erfolgreich.
- Funktionsfähige Vorschau: https://media-team-6hrxft4gg-zapkothimofej-2616s-projects.vercel.app
- Vercel-Deployment: `dpl_AtKWKSaiLByJsCMHvuCALG1VnYxv`, Status READY, Ziel Preview. Revision und Branch sind über Vercel bestätigt.
- Browser im Deployment: `/api/session` antwortet mit HTTP 200, Formular „Admin-Konto erstellen“ lädt ohne Datenbankfehler, ein absichtlich falscher Einrichtungscode wird abgewiesen, Service Worker ist aktiviert.
- Das erste echte Admin-Konto wurde nicht durch den Agenten angelegt. Das ungesendete Formular ist im Ego-Browser geöffnet; nur der Einrichtungscode wurde in sein vorgesehenes Feld eingetragen, keine Übergabe über die URL.
- `DATABASE_URL` und `SETUP_TOKEN` sind ausschließlich als geschützte Servervariablen am Vorschau-Branch hinterlegt. Keine Supabase-Marketplace-Ressource ist mit diesem Vercel-Projekt verbunden.
- Supabase MCP ist projektbezogen konfiguriert, per OAuth angemeldet und durch echte MCP-SQL-Abfragen geprüft. Die laufende Chat-Sitzung konnte neu hinzugefügte Tools nicht nachladen; frische Codex-Aufrufe verwendeten den authentifizierten MCP-Server.
- Repository ist öffentlich. Der aktuelle Stand liegt auf `codex/preview/media-team`; der ursprüngliche Standardbranch `codex/feat/media-team-app` wurde nicht verändert. Die automatische Freigabeprüfung hat einen Wechsel des Standardbranches abgelehnt. Aktuellen Quellstand daher über den Vorschau-Branch öffnen.
- Dokumentationsänderungen nach der geprüften Code-Revision ändern kein Laufzeitverhalten. Weitere visuelle Änderungen sind auf Nutzerwunsch gestoppt.
- Offen: erste echte Anmeldung durch den Nutzer; Installation, Bildschirmtastatur, sichere Bildschirmränder und tatsächliche Haptik auf echten Handys. Eine Desktop-Browseransicht ersetzt diese Abnahme nicht.
