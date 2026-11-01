# Media Team

Media Team organisiert Aufgaben für Gottesdienste. Allgemeine Aufgaben werden gemeinsam abgehakt; persönliche Aufgaben gehören jeweils zu einer Person und Rolle. Für jeden Gottesdienst entsteht eine eigene Liste, abgeschlossene Dienste können ins Archiv.

Admins erstellen Einladungslinks und geben sie selbst weiter. Die App verschickt keine E-Mails. Änderungen an Vorlagen und Mitgliedsrollen gelten für zukünftige Termine beziehungsweise Dienste.

## Lokal starten

Voraussetzung ist Node.js 24 oder neuer.

```sh
npm ci
npm run build
npm start
```

Die App läuft unter [localhost:3000](http://localhost:3000). Beim ersten Start wird im Terminal ein Link zur Einrichtung des ersten Admin-Kontos ausgegeben. Lokale Daten liegen in `.local/`.

Für die Entwicklung startet `npm run dev` die Oberfläche auf Port 5173 und die API auf Port 3001. `npm run demo` startet eine lokale Demo mit Beispieldaten in der getrennten Datei `.local/demo.sqlite`; die Zugangsdaten stehen im Terminal. Es gibt keine Cloud-Demo.

## Auf dem Handy

Über eine HTTPS-Adresse lässt sich die App über das Browsermenü zum Home-Bildschirm hinzufügen. Dafür ist kein App-Store-Konto nötig. Ohne Internet zeigt sie eine Offline-Seite; Aufgaben können offline weder abgehakt noch später synchronisiert werden. Die App nutzt `web-haptics` für haptische Rückmeldungen. Die Wirkung auf echten Handys muss noch geprüft werden.

## Betrieb

Für eine Vercel Preview werden das Frontend und die Serverfunktion `api/index.mjs` verwendet. Eine direkte Supabase-Postgres-Verbindung wird über `DATABASE_URL` oder `POSTGRES_URL` und der Einrichtungscode über `SETUP_TOKEN` konfiguriert. Ein Marketplace ist dafür nicht erforderlich. Die Tabellen liegen im privaten Schema `media_team`; Datenbankschlüssel gehören nicht in den Browser. Zugangsdaten und andere Geheimnisse niemals committen. `.local/` und `.env`-Dateien sind von Git ausgeschlossen.

Die Datenbank für die Bereitstellung wird noch eingerichtet; eine funktionierende Bereitstellung ist damit noch nicht bestätigt.

## Prüfungen

```sh
npm run check
npm test
npm run build
```

Die Tests verwenden standardmäßig eine temporäre SQLite-Datenbank. Optional lässt sich mit `TEST_DATABASE_URL` eine Postgres-Datenbank testen; dafür wird ein isoliertes Testschema angelegt.
