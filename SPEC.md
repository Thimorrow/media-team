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
- Login ausschließlich über Name und Passwort. Admins legen Mitglieder direkt mit Name und Startpasswort an, verwalten Dienste und Vorlagen und sehen den Fortschritt. Keine E-Mail-Adressen, kein E-Mail-Versand und keine Einladungslinks.
- Arbeitsname: Media Team. Daten werden serverseitig gespeichert; der Browser erhält keine Datenbankschlüssel.
- Öffentliches Repository: https://github.com/Thimorrow/media-team. Aktueller Vorschau-Branch: `codex/preview/media-team`.
- Vercel-Vorschau ist beauftragt. Supabase wird direkt verwendet, ohne Vercel-Marketplace-Verknüpfung. Das vom Nutzer bereitgestellte Projekt ist `fhpsxgapmhcqwymtsloc`.
- Am 1. November wurde das vollständige UI-Redesign mit neuer Farbwelt und einer Emil-Prüfschleife beauftragt. Die frühere UI-Pause ist damit aufgehoben.

## Noch offen

- Der erste echte Admin wird auf ausdrücklichen Nutzerauftrag angelegt. Keine Demo-Konten in der Cloud.
- Tatsächliche Zuordnung der Dienste zu Mitgliedern erfolgt durch Admins in der App.
- Ist „Flur 2“ die richtige Ortsangabe?
- Vorschlag für nach dem Dienst: Kamera-Akkus an die Ladestation legen.
- Die Freigabe zur Veröffentlichung des öffentlichen Repositories und der Vercel-Vorschau ist erteilt. Ein Versand von Einladungen an andere ist nicht beauftragt.

## Akzeptanzkriterien für die Umsetzung

- [x] Ein Mitglied kann sich mit seinem eigenen Konto anmelden und abmelden. Lokal per API geprüft.
- [x] Unangemeldete Besucher erhalten keinen Zugriff auf Teamdaten. Lokal per API geprüft.
- [x] Mitglieder können keine Admin-Aktionen ausführen, auch nicht über direkte Anfragen. Lokal per API geprüft.
- [x] Gemeinsame und persönliche Aufgaben sowie Vor- und Nachbereitung sind lokal im gerenderten UI unterschieden und bedient. Menschliche Abnahme bleibt separat.
- [x] Abhaken, Rückgängigmachen und erneutes Laden erhalten den korrekten Zustand. Lokale API-Tests einschließlich Serverneustart.
- [x] Ein neuer Gottesdienst beginnt mit offenen Aufgaben; frühere Einheiten bleiben erhalten. Lokale API-Tests mit Vorlagen-Snapshots.
- [x] Fehlgeschlagene Speicherung und fehlende Verbindung sind im lokalen Browser sichtbar; Fehler-Rücknahme und erneutes Laden wurden mit isolierten Daten geprüft.
- [x] Admin-API für Mitglieder, Vorlagen, Einladungen und Gottesdienste ist lokal geprüft.
- [x] Die PWA hat Manifest, passende Icons und einen definierten Offline-Zustand; aktiver lokaler Service Worker, Cache v2 und Offline-Rückfall bei tatsächlich gestopptem Testserver bestätigt. Installation bleibt ein Gerätetest.
- [x] Kein horizontaler Überlauf in den lokal geprüften Ansichten bei 320–1440 px; lange Inhalte zusätzlich geprüft. Sichere Ränder und Tastaturverhalten sind im Code berücksichtigt; Hardwareprüfung bleibt offen.
- [x] Lokale Tastaturprüfung: Dialogfokus, Rückgabe, Formularvalidierung und keine Übergänge bei reduzierter Bewegung. Screenreader-Abnahme bleibt offen.
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
- Dokumentationsänderungen nach der geprüften Code-Revision ändern kein Laufzeitverhalten. Dieser Übergabestand dokumentierte die damalige UI-Pause. Der nachfolgende Redesign-Auftrag hebt diese Pause auf; diese Deployment-Nachweise beziehen sich weiterhin nur auf die oben genannte alte Code-Revision.
- Offen: erste echte Anmeldung durch den Nutzer; Installation, Bildschirmtastatur, sichere Bildschirmränder und tatsächliche Haptik auf echten Handys. Eine Desktop-Browseransicht ersetzt diese Abnahme nicht.

## UI-Redesign: Emil-Schleife

Auftrag: alle bestehenden Oberflächen neu gestalten, neue OKLCH-Farbwelt, hochwertige zweckmäßige Animationen. Keine Veröffentlichung, kein Commit oder Push im Rahmen dieses Auftrags. Echte Konten und Teamdaten bleiben unangetastet.

Prüfbare Abnahme: Anmeldung/Einladung/Einrichtung, Dienst, gemeinsame und persönliche Listen, Termine/Archiv, Team, Vorlagen, Profil und Dialoge; lesbare Farben, Maus und Tastatur, 320–1440 px ohne Überlauf, Laden/Leer/Fehler/Offline, reduzierte Bewegung. Pflichtchecks: `npm run check`, `npm test`, `npm run build`. Echte Hardware und menschliche Designabnahme bleiben gesondert.

- Run 1: Foundations + Color + Animations. Pflaume/Papier/Apricot, gemeinsame Aufgabenfläche, überarbeitete Navigation/Formulare/Anmeldung. Build und erster Desktop-/Mobilvergleich bestanden.
- Run 2: UI Review + UI Polish + Animations + Prep for Prod. Fokus, echte Formularvalidierung, Löschbestätigung, Seitenaufteilung, Browser-Titel und PWA-Farben verbessert. 13 API-Tests bestanden; Browser-Randfälle bestanden (`run2-browser.log`).
- Run 3: UI Review + UI Polish + Animations + Prep for Prod. Schutz ungespeicherter Vorlagen und dauerhaft sichtbare Speicherfehler; Fehler-/Leer-/Offlinezustände und Bewegungsvarianten lokal bestanden (`run3-states.log`, `run3-motion.log`).
- Run 4: unabhängige Quellprüfung und erneute Behebung ihrer konkreten Befunde. Lange Namen, Auswahlzeilen, Speichern/Navigation und Dialogausgänge geprüft.
- Run 5: damaliger abschließender UI Review + UI Polish + Prep for Prod + Animations. Keine weiteren konkreten Quellbefunde; finale Browserregression bei sechs Breiten, Langtextfälle, Kontraste, Typecheck, 13 API-Tests und Build bestanden. Keine Aussage objektiver Perfektion oder Geräteabnahme.

Vergleiche und Prüfberichte: `artifacts/emil/`. Entscheidungsprotokoll: `artifacts/emil/decisions.tsv`. Testdaten ausschließlich in separaten SQLite-Dateien unter `/tmp`: Randfälle auf Port 4311, frische Demo auf Port 4312 und isolierte erste Einrichtung auf Port 4310. Vollständiger Bericht: `artifacts/emil/REPORT.md`. Der UI-Stand ist lokal geändert und wurde nicht veröffentlicht.

### Fortsetzung: Mobile Native

Auf erneuten Nutzerauftrag wurden Run 6 mit ausdrücklich angefordertem `emil-mobile-native` und Run 7 mit UI Review / UI Polish / Prep for Prod und erneut Animations abgeschlossen. Farbwelt und bestehende Funktionen bleiben Grundlage. Konkreter Ausgangsbefund: Seitenleiste bei 844 × 390 px nicht scrollbar, Vorlagen und Profil außerhalb des sichtbaren Bereichs; seitliche Safe-Area-Werte werden in der breiten Ansicht ignoriert. Korrekturen und Browsernachweise: `artifacts/emil/mobile-native/`. Die Chromium-Simulation ersetzt weiterhin keine echte Bildschirmtastatur oder ein echtes Smartphone.

Ergebnis der mobilen Fortsetzung: scrollbar erreichbare Seitenleiste auch bei geringer Höhe, sichere Ränder in Hoch-/Querformat und kurze Dialoge, direkte Touch-/Stift-Druckdarstellung ohne vorgezogene Aktionen. Sechs Größen-/Randfälle sowie Druck, Abbruch, Loslassen, Tastatur und reduzierte Bewegung im lokalen Browser bestanden. Typecheck, Build und 13 API-Tests bestanden. Unabhängige Quellprüfung ohne weitere konkrete Befunde. Aktueller Detailbericht: `artifacts/emil/mobile-native/REPORT.md`. Echte Geräteabnahme bleibt offen.

## Namensanmeldung, 2. November 2026

Nutzerauftrag: Anmeldung nur mit Name und Passwort; der Agent soll den ersten echten Admin anlegen. Admins erstellen weitere Konten direkt, ohne E-Mail-Adressen oder Einladungslinks. Namen sind nach Vereinheitlichung von Groß-/Kleinschreibung und Leerzeichen eindeutig. Bestehende IDs, Passwörter, Sitzungen und Aufgaben bleiben bei der Umstellung erhalten; mehrdeutige alte Namen brechen die Migration ohne Änderung ab. Der frühere Hinweis auf eine ausschließlich menschliche Ersteinrichtung ist durch diesen Auftrag ersetzt.

Umsetzung separat im Worktree `/private/tmp/media-team-name-login`, Branch `codex/feat/name-login`. Veröffentlicht werden ausschließlich diese Anmeldeänderungen auf Basis des bisherigen veröffentlichten Stands. Das lokal vorhandene UI-Redesign bleibt unveröffentlicht. Startpasswort und alle Datenbankzugänge liegen ausschließlich in ignorierten lokalen Dateien beziehungsweise geschützten Servervariablen.

Prüfkriterien: Login nur mit Name/Passwort, nur Admins dürfen weitere Konten anlegen, doppelte Namen werden abgewiesen, Migration erhält vorhandene Daten, echtes Admin-Konto und Admin-Ansicht sind im Deployment zu prüfen.

### Fortsetzung: Formular-Randfälle und Abschluss

Auf erneuten Auftrag vom 2. November wurden Run 8 und Run 9 mit UI Review / UI Polish / Prep for Prod / Mobile Native, gezielt Forms and Inputs sowie abschließend erneut Animations durchgeführt. Behoben: verborgene leere Vorlagentitel führen direkt in die passende Rolle/Phase zum fokussierten Fehlerfeld; übermittelte Formulareingaben bleiben während der Anfrage gesperrt; ein nach dem Schließen bestätigter Gottesdienst überschreibt keine inzwischen gewählte Seite.

Vier Ansichtsbreiten (320, 390, 768, 1440 px), verzögerte Antworten einschließlich nachfolgender Aktualisierung, Fehlerversuch/erneutes Absenden und Bewegungsvarianten lokal bestanden. Typecheck, Build und alle aktuell 15 API-Tests bestanden; unabhängige Quellprüfung ohne weitere konkrete Befunde im Änderungsumfang. Die parallel beauftragte Umstellung der Anmeldung auf Namen/Startpasswörter wurde erhalten und ist keine Leistung oder vollständige Browserabnahme dieser UI-Runde. Detailnachweise: `artifacts/emil/round8/REPORT.md`. Gerätetests und menschliche Designabnahme bleiben offen. Keine Veröffentlichung durch diese Runde.

### Abschluss der Namensanmeldung: nur lokal

Der Nutzer hat die erneute Hinterlegung von Datenbankverbindung und Einrichtungscode im Vercel-Vorschau-Branch ausdrücklich abgelehnt und „nur lokal einrichten“ gewählt. Daher keine weiteren Vercel-Änderungen oder Cloud-Kontoanlage. Der zuvor veröffentlichte Auth-Code liegt auf `codex/feat/name-login` (Commit `5f6eb13`), CI erfolgreich; daraus ist keine nutzbare neue Cloud-Anmeldung eingerichtet worden.

Lokaler Start auf http://127.0.0.1:3000 mit SQLite `.local/media.sqlite`. Die lokale `.env.local` enthält keine Cloud-Verbindung; die frühere Konfiguration wurde geschützt in `.local/` gesichert. Das vom Nutzer gewünschte aktive Admin-Konto ist lokal angelegt. Abmeldung, erneute Namensanmeldung und Zugang zur Admin-Verwaltung sind im laufenden lokalen Browser geprüft. Startpasswort ausschließlich in `.local/admin-zugang.txt` mit Dateirechten 600, Passwort in der Datenbank ausschließlich als Hash. Keine E-Mail-Felder oder Einladungslinks.

16/16 SQLite-Tests und 17/17 lokale PostgreSQL-Tests einschließlich Datenmigration und Widerruf von Admin-Rechten bestanden; Typecheck und Build bestanden. Lokale Browserprüfung des direkten Anlegens von Mitgliedern erfolgte zuvor ausschließlich in einer getrennten Demo. Supabase-Kontrolle danach bestätigt weiterhin 0 echte Cloud-Konten und das unveränderte bisherige Cloud-Schema. Unveröffentlichtes UI-Redesign bleibt erhalten. Keine weiteren Commits oder Deployments nach der Auswahl „nur lokal“.

## Online-Bereitstellung, 2. November 2026

Aktueller Auftrag: aktuelle App online bereitstellen. Der Nutzer hat die Übernahme des lokalen Kontos und der vorhandenen Daten ausdrücklich gewählt. Dies ersetzt die frühere Beschränkung auf lokalen Betrieb für diesen Auftrag. Bestehendes Vercel-Projekt und Supabase-Datenbank verwenden; kein Commit, Push oder Merge. Lokale Daten bleiben erhalten. Vor Übertragung beide Datenbestände sichern und leeren Cloud-Bestand prüfen. Akzeptanz: Typecheck, 16 SQLite-Tests, Build, vollständiger Datenvergleich nach Übertragung, Vercel READY und echte Online-Anmeldung mit Admin-Verwaltung. Geräteabnahme bleibt separat.

Bereitgestellt: `dpl_84fZ8AeRWZcpz1GKwk7KfyXT4roE`, Vercel-Ziel `staging` (Vorschau), Status READY. Feste Adresse https://media-team-lemon.vercel.app ist dieser Bereitstellung zugeordnet. Vollständiger lokaler Arbeitsstand mit Redesign und Namensanmeldung, direkt aus 29 erforderlichen Quelldateien hochgeladen; deren SHA-256-Werte liegen in `.local/online-source-manifest.json`. Kein neuer Commit, Push oder Merge.

Der Nutzer hat zusätzlich ausdrücklich den Zugang ohne Vercel-Konto für sein Team freigegeben. Die zusätzliche Vercel-SSO-Sperre ist für dieses App-Projekt entfernt; die Anmeldung mit Name und Passwort innerhalb der App bleibt aktiv. Kein temporärer Freigabelink erforderlich.

Datenübernahme: vorab SQLite-Sicherung und geschützte Cloud-Sicherung unter `.local/online-transfer-2026-11-02T11-39-01.196Z/`. Online waren keine Konten, Dienste, Teilnehmer oder Aufgaben vorhanden. Übernommen wurden 1 Konto und die Vorlagen/Einstellungen; Dienste, Teilnehmer und Aufgaben waren lokal leer. Alle fünf Geschäftstabellen wurden innerhalb der Übertragung vollständig verglichen, lokale Daten unverändert. Lokale Sitzungen und Anmeldebegrenzungen wurden nicht übertragen. Passwort-Hash übernommen, kein neues Passwort vergeben.

Prüfungen: Typecheck und Build bestanden. 16/16 SQLite-Tests mit Node 24 außerhalb der Sandbox bestanden; die Sandbox verhindert den lokalen Testserver und führte zuvor zu einem Node-Absturz. Online-Anmeldung mit dem übernommenen Admin-Konto an der festen Adresse bestätigt. Geräteabnahme bleibt offen.

Abschließender Browsernachweis: Team-Verwaltung mit 1 übernommenem Mitglied, Admin-Kennzeichnung und „Mitglied anlegen“ erfolgreich geladen. Nach vollständigem Neuladen weiterhin angemeldet, Team-Verwaltung erneut geladen. Keine neuen Mitglieder oder Test-Gottesdienste im echten Datenbestand angelegt. Die fertige App ist im Browser geöffnet.

## Teamaufnahme und Superadmin, 2. November 2026

Auftrag: Zehn Personen online aufnehmen. Thimofej bleibt der einzige Superadmin. Mykola ist Admin und darf Vorlagen, Checklisten und Gottesdienste bearbeiten; Konten, Aktivierung und Rechte verwaltet ausschließlich der Superadmin. Die Superadmin-Rolle kann über die App weder vergeben noch entfernt werden. Vorhandene Konten, Passwörter, Sitzungen und Aufgaben müssen erhalten bleiben.

Zuordnungen: Danil → Tontechnik; Sophia → Foto; Mykola → Admin ohne persönlichen Dienst; Stevan → Allgemein; Max M und Max F → ProPresenter-Team; Eva und Julia → Foto; Arkadius → Allgemein und Foto; Iza → Allgemein. Annahme: „Allgemeini“ bedeutet Allgemein und „Ton“ Tontechnik. Allgemein und Foto werden als Dienste ohne zusätzliche persönliche Aufgaben ergänzt. Die allgemeine Checkliste gilt weiterhin gemeinsam. Foto-Aufgaben werden ohne fachliche Vorgabe nicht erfunden. Alle neuen Konten bekommen individuelle zufällige Startpasswörter; diese werden ausschließlich geschützt lokal übergeben.

Vorgehen: bestehende Online-Quelle und Daten prüfen, Rechteänderung samt Datenmigration lokal isoliert implementieren, Verhalten und Oberfläche prüfen, nur die zu diesem Auftrag gehörenden Änderungen bereitstellen, zehn Konten über die App anlegen und online kontrollieren. Backend und zugehörige Berechtigungstests liegen bei einem abgegrenzten Implementierungsagenten; UI, Bereitstellung und echte Daten bleiben beim Hauptagenten. Gemeinsame Datenbankänderungen erfolgen nacheinander. Kein Commit, Push oder Merge.

Akzeptanzkriterien:

- [x] Bestehender einzelner Admin wird genau einmal Superadmin, ohne Änderung der Zugangsdaten.
- [x] Mitglied, Admin und Superadmin sind serverseitig getrennt; Mykola kann weder Konten ändern noch sich selbst hochstufen.
- [x] Admins können Vorlagen und Gottesdienste bearbeiten; die Oberfläche bietet ihnen keine Kontoverwaltung an.
- [x] Typecheck, API-Tests und Build erfolgreich; betroffene Oberfläche mit getrennten Testdaten bedient.
- [x] Online sind alle zehn Namen mit den vereinbarten Diensten aktiv; nur Thimofej ist Superadmin.
- [x] Online-Anmeldung und Rechte von Superadmin, Admin und Mitglied geprüft; Zugangsliste geschützt bereitgestellt.

Abschluss: `access_level` unterscheidet Mitglied, Admin und Superadmin. Das alte Feld `is_admin` bleibt ausschließlich für den Superadmin gesetzt. So erhalten normale Admins auch über ältere öffentliche Versionen keine Kontoverwaltung. Die Umstellung des bestehenden einzelnen Kontos läuft transaktional und vergibt bei weiteren Starts keine Rechte; unklare Altdaten brechen ohne Änderung ab. Eine Datenbankregel verhindert einen zweiten Superadmin. Zusätzliche Superadmin-Felder in Kontoverwaltungsanfragen werden abgewiesen.

Typecheck und Build bestanden. 20/20 SQLite-API-Tests und 21/21 Tests mit einer getrennten lokalen PostgreSQL-Instanz bestanden, ausgeführt mit Node 24. Zusätzlich alte PostgreSQL-Tabelle migriert, Passworterhalt und wiederholten Start geprüft. Browserprüfung mit isolierten Daten: Superadmin kann Rollen bearbeiten, seine eigenen Rechte nicht abwählen; Admin sieht elf Mitglieder ohne bearbeitbare Konten und kann eine Foto-Vorlage speichern und nach Neuladen wiederfinden. Mobile Admin-Liste bei 390 px visuell geprüft.

Online bereitgestellt über die Vercel-Kommandozeile, Deployment `dpl_BfyR5XVMiN1WDDkq6cno8Twn2TRt`, Ziel `staging`, Status READY; feste Adresse https://media-team-lemon.vercel.app zugeordnet. Veröffentlicht wurden die gleichen 29 erforderlichen Quelldateien wie zuvor, davon fünf für diese Rechteänderung angepasst. Manifest unter `.local/team-onboarding-2026-11-02/source-after.json`; keine fremden lokalen Dateien oder Zugangsdaten im Quellpaket. Die zwei vorhandenen Servervariablen wurden geschützt als Laufzeitkonfiguration übergeben, weil die Plugin-Bereitstellung deren Branch-Zuordnung nicht übernahm. Supabase-Plugin wegen abgelaufenem OAuth nicht verfügbar; direkte Postgres-Verbindung für Sicherung und unabhängigen Datenvergleich verwendet. Kein Commit, Push oder Merge.

Alle zehn Konten angelegt, jede Online-Anmeldung geprüft, Zuordnungen und Rechte direkt aus der Online-Datenbank verglichen. Thimofejs bestehende Kontofelder einschließlich Passwort-Hash unverändert, alle bisherigen Vorlagen und sonstigen Geschäftsdaten erhalten. Mykola konnte online unveränderte Vorlagen speichern; Kontoneuanlage und Kontoänderung wurden für sämtliche neuen Personen abgewiesen. Browser zeigt Thimofej als Superadmin, Mykola als Admin ohne Kontoverwaltung und Sophia als Mitglied ohne Verwaltungsnavigation. Zusätzlich Mykolas verweigerte Verwaltung an der vorherigen öffentlichen Bereitstellung geprüft. Geschützte Sicherung, Zugangsliste und maschinenlesbare Nachweise liegen unter `.local/team-onboarding-2026-11-02/` (Verzeichnisrechte 700, Zugangsliste 600). Es wurden keine Nachrichten an Teammitglieder verschickt.

Offen: fachliche Aufgaben für Foto sind noch nicht vorgegeben. Der Dienst Foto und die Personen sind bereits zugeordnet; neue Foto-Aufgaben können über die Vorlagen ergänzt werden. Allgemein nutzt die vorhandene gemeinsame Checkliste. Physische Gerätetests und menschliche Designabnahme sind durch diese technische Aufnahme nicht belegt.

## Passwortvorgabe, 2. November 2026

Auf ausdrücklichen Nutzerauftrag beträgt die Mindestlänge für neue und geänderte Passwörter sechs Zeichen. Das gilt für Ersteinrichtung, Mitgliedsanlage und Passwortänderung in Oberfläche und API. Die Obergrenze bleibt 256 Zeichen; bestehende Passwörter bleiben gültig. Nach Veröffentlichung wird das angegebene neue Passwort für Thimofej über die reguläre Passwortänderung gesetzt. Passwörter werden nicht in dieser Spezifikation dokumentiert. Akzeptanz: fünf Zeichen abgewiesen und sechs Zeichen akzeptiert für die drei Schreibwege, Typecheck/API-Tests/Build, gerenderte Eingabefelder sowie neue Online-Anmeldung und Abweisung des alten Passworts. Abgeschlossen: Server und alle drei Formulare auf sechs Zeichen umgestellt. Typecheck, Build und 20/20 API-Tests bestanden. Ersteinrichtung, Mitgliedsanlage und Passwortänderung im Browser jeweils mit sechs Zeichen erfolgreich bedient; fünf Zeichen in allen drei Formularen und APIs abgewiesen. Online-Version `dpl_3zBUZXHgyBvMpA1U6VZum5rvDCMg` ist READY und der festen App-Adresse zugeordnet. Neue Anmeldung für Thimofej funktioniert, altes Passwort wird abgewiesen, Superadmin-Rechte und elf Konten erhalten. Das vom Nutzer bestimmte Passwort wurde nicht zusätzlich als Klartext gespeichert; `.local/admin-account.json` und `.local/admin-zugang.txt` beschreiben weiterhin ausschließlich den unveränderten lokalen SQLite-Zugang und gelten nicht mehr für die Online-Anmeldung. Nachweise unter `.local/password-minimum6/`. Kein Commit, Push oder Merge.


## Wöchentliche Gottesdienste, 2. November 2026

Auftrag: jeden Sonntag Gottesdienst um 11:00 Uhr, Media-Versammlung um 10:30 Uhr; direkt in der Online-App. Zeiten gelten in Europe/Berlin einschließlich Sommer-/Winterzeit. Beim angemeldeten Öffnen hält die App die nächsten zwölf Sonntage bereit, einschließlich des heutigen Sonntags, und ergänzt fortlaufend weitere Termine. Alle aktuell aktiven Teammitglieder werden wie bei der bisherigen Vorauswahl aufgenommen. Jeder neu angelegte Termin erhält eigene offene Aufgaben aus den aktuellen Vorlagen; vorhandene Aufgaben und archivierte Termine bleiben erhalten. Bestehende Termine zur gleichen Startzeit werden nicht doppelt angelegt.

Umfang: serverseitige Wiederholung und dauerhafte Media-Uhrzeit, Anzeige beider Zeiten in Dienst und Terminübersicht, kommende Termine zuerst. Keine Nachrichten, kein Commit, Push oder Merge. Prüfziel: isolierte API-Prüfungen für Wiederholung, Zeitumstellung, Duplikate, Berechtigungen und Speicherung; Typecheck, vollständige Tests, Build, lokale gerenderte Prüfung, anschließend Online-Bereitstellung und Datenkontrolle. Abschlussnachweise folgen nach Ausführung.


Abgeschlossen: zwölf Sonntage vom 8. November 2026 bis 24. Januar 2027 sind online gespeichert. Die Serie wird bei späteren angemeldeten App-Aufrufen fortlaufend ergänzt. Je Termin 11:00 Uhr Gottesdienst und 10:30 Uhr Media-Versammlung in Berlin; alle elf aktiven Personen erhalten frische Aufgaben. Beide Uhrzeiten erscheinen in Dienst und Terminübersicht; kommende Termine stehen zuerst.

Prüfungen: Typecheck und Build bestanden; 27/27 SQLite-API-Tests sowie 21/21 Tests gegen getrenntes lokales PostgreSQL bestanden. Die SQLite-Serie prüft zusätzlich Zeitumstellung, Jahreswechsel, heutige Sonntage, gleichzeitiges Laden, Vorlagenstände, Archiv und Neustart. Lokale gerenderte Dienst-/Terminansicht sowie mobile Übersicht bei 390 px geprüft, kein horizontaler Überlauf. Echte Geräteabnahme bleibt separat.

Erste Online-Prüfungen erreichten das 30-Sekunden-Limit. Aufgaben/Teilnehmer werden jetzt gesammelt geschrieben; die eigentliche Abrufblockade wurde im gleichzeitigen Laden einzelner Fortschrittswerte reproduziert und durch eine gemeinsame, nach Berechtigungen gefilterte Fortschrittsabfrage beseitigt. Derselbe App-Code wurde danach direkt gegen die Online-Datenbank erfolgreich ausgeführt.

Endgültige Bereitstellung: `dpl_FRyWFu55SefbN3bKw8UgQ4D4uLnm`, Ziel `staging`, Status READY. Der Alias https://media-team-lemon.vercel.app zeigt bestätigt auf diese Version. Online-Prüfung mit Admin Mykola und Mitglied Sophia: zwölf korrekte Sonntage, beide Uhrzeiten, erneuter Abruf ohne Duplikate; elf persönliche Listen für den Admin, ausschließlich die eigene Liste für das Mitglied. Prüfsummen bestätigen unveränderte Kontozuordnungen und Vorlagen. Die automatische Freigabeprüfung lehnte eine vollständige Datenkopie ab; stattdessen wurden ausschließlich Prüfsummen gesichert. Kein Export von Kontoinhalten.

Nachweise und Quellmanifest unter `.local/sunday-services/`. Genau 30 notwendige App-Quelldateien veröffentlicht; gegenüber der zuvor veröffentlichten Version sind ausschließlich `app/App.tsx`, `app/styles.css`, `app/types.ts`, `server/app.mjs` und die neue Datei `server/services.mjs` geändert. Keine lokalen Zugangsdokumente im Quellpaket. Kein Commit, Push oder Merge und keine Nachrichten an Teammitglieder. Lokaler Wegwerf-Testserver beendet.
