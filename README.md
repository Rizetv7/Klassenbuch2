# 📓 Klassenbuch

Eine einfache Website, auf der eine ganze Klasse gemeinsam Zitate, Bilder und
Erinnerungen sammelt. Jede Person hat ihre eigene Seite (Steckbrief), auf der
andere Zitate und Bilder posten, liken und kommentieren können. Dazu gibt es
eine gemeinsame **Pinnwand** (Post-its & Bilder) und einen **Feed** auf der
Startseite.

Das hier ist eine **funktionstüchtige Basis** – bewusst schlicht gehalten,
damit später leicht ein schönes Design darübergelegt werden kann.

## Funktionen

- **Konten:** Registrieren, Anmelden, Profil + Profilbild
- **Klassen:** erstellen (mit Beitritts-Code), beitreten, moderieren
- **Mitglieder:** Schüler:innen & Lehrer:innen werden automatisch gelistet,
  sobald sie der Klasse beitreten
- **Steckbrief pro Person:** Zitate & Bilder, die andere über die Person posten
- **Pinnwand:** Notizen (Post-its) und Bilder für die ganze Klasse
- **Interaktion:** Liken & Kommentieren
- **Feed:** Startseite zeigt die neuesten Beiträge aus allen deinen Klassen
- **Moderation:** Ersteller:in (👑) kann moderieren, Mitglieder zu
  Moderator:innen (🛡️) machen, Mitglieder/Beiträge entfernen, Klasse löschen

## Technik

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma** ORM – lokal **SQLite** (kein Setup), Produktion **PostgreSQL**
- Eigene **Login-Logik** (E-Mail + Passwort, `bcrypt`, JWT im httpOnly-Cookie) –
  kein externer Dienst nötig

## Lokal starten

```bash
npm install            # Abhängigkeiten installieren
cp .env.example .env   # .env anlegen (Standardwerte reichen für lokal)
npm run db:push        # SQLite-Datenbank anlegen
npm run dev            # http://localhost:3000
```

Nützliche Befehle:

```bash
npm run db:studio      # Daten im Browser ansehen (Prisma Studio)
npm run build          # Produktions-Build
npm start              # Produktionsserver
```

## Projektstruktur

```
prisma/schema.prisma        Datenmodell (User, Class, Membership, Post, Comment, Like)
src/lib/                     DB-Client, Auth, Berechtigungen, Helfer
src/app/api/                 Backend (REST-Endpunkte)
src/app/                     Seiten (Feed, Login, Klassen, Steckbrief, Pinnwand, Profil)
src/components/              UI-Bausteine (Nav, PostCard, CreatePost)
```

---

## 🌐 Kostenlos online stellen – mit Datensicherheit

Wichtig zu verstehen: SQLite (die lokale Datei `dev.db`) eignet sich **nur für
die Entwicklung**. Beim Hosten auf modernen Plattformen wird das Dateisystem
nach jedem Deploy zurückgesetzt – die Daten wären weg. Für den echten Betrieb
brauchst du:

1. eine **gehostete Datenbank** (PostgreSQL) mit Backups, und
2. einen **Speicher für Bilder** (Object Storage), denn hochgeladene Dateien
   dürfen ebenfalls nicht im Webserver-Dateisystem liegen.

### Empfohlene, kostenlose Kombination (mit Backups)

| Baustein            | Dienst (Gratis-Tarif)        | Wofür                          |
| ------------------- | ---------------------------- | ------------------------------ |
| Webseite (Hosting)  | **Vercel**                   | Next.js läuft hier nativel     |
| Datenbank           | **Supabase** oder **Neon**   | PostgreSQL mit Backups         |
| Bild-Speicher       | **Supabase Storage** / **Cloudflare R2** | Profilbilder & Foto-Uploads |

Alle drei haben dauerhaft kostenlose Tarife, die für eine Schulklasse locker
reichen. **Supabase** ist besonders praktisch, weil es Datenbank *und*
Bild-Speicher in einem Konto bündelt und automatische Backups macht – so gehen
keine Daten verloren.

### Schritte zum Deployen (Variante Vercel + Supabase)

1. **Datenbank anlegen:** Bei [supabase.com](https://supabase.com) ein Projekt
   erstellen → unter *Project Settings → Database* die *Connection String*
   (URI) kopieren.
2. **Auf PostgreSQL umstellen:** in `prisma/schema.prisma`
   ```prisma
   datasource db {
     provider = "postgresql"   // vorher: "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. **Code zu GitHub pushen** (ist bereits passiert, wenn du das hier liest 🙂).
4. **Bei [vercel.com](https://vercel.com)** mit GitHub anmelden → Repository
   importieren. Unter *Environment Variables* setzen:
   - `DATABASE_URL` = der Supabase-Connection-String
   - `AUTH_SECRET` = ein langer Zufallswert (`openssl rand -base64 32`)
5. **Deploy starten.** Danach einmalig das Schema in die Produktions-DB
   schreiben – am einfachsten lokal mit gesetzter Produktions-`DATABASE_URL`:
   ```bash
   npx prisma db push
   ```
6. **Bild-Uploads aktivieren (Profilbilder & Fotos):** Die App lädt Bilder
   automatisch zu **Supabase Storage** hoch, sobald diese Env-Variablen
   gesetzt sind (sonst lokaler Datei-Fallback):
   - `SUPABASE_URL` = Supabase → Settings → Data API → *Project URL*
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Settings → API Keys → *service_role*
   Außerdem in Supabase unter **Storage** einen **öffentlichen** Bucket namens
   `uploads` anlegen. Danach funktionieren Uploads ohne Code-Änderung.

### Datensicherheit / kein Datenverlust

- **Automatische Backups:** Supabase und Neon sichern die Datenbank
  regelmäßig. Zusätzlich kannst du jederzeit selbst exportieren:
  ```bash
  pg_dump "$DATABASE_URL" > backup.sql
  ```
- **Bilder** liegen im Object Storage (eigene Versionierung/Backups je nach
  Dienst) – nicht auf dem flüchtigen Webserver.
- **Passwörter** werden nie im Klartext gespeichert, sondern als `bcrypt`-Hash.
- **`AUTH_SECRET`** geheim halten und nur als Umgebungsvariable setzen –
  niemals in den Code committen.

### Alternativen

- **Netlify** statt Vercel (ebenfalls gratis, Next.js wird unterstützt).
- **Railway** oder **Render**: bieten App-Hosting *und* PostgreSQL aus einer
  Hand (kleiner Gratis-/Trial-Tarif). Etwas einfacher, weil alles an einem Ort.

---

## Backups (automatisch, kostenlos)

Der kostenlose Supabase-Tarif macht **keine** automatischen Backups. Dieses
Repo enthält dafür einen fertigen GitHub-Action-Workflow
(`.github/workflows/backup.yml`), der die Datenbank **wöchentlich** (und auf
Knopfdruck) sichert und als herunterladbare Datei ablegt.

Einmalig aktivieren:

1. In Supabase: **Connect → ORM → Prisma** die `DIRECT_URL` (Port 5432) kopieren
   und `[YOUR-PASSWORD]` durch dein Datenbank-Passwort ersetzen.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository
   secret** anlegen:
   - Name: `BACKUP_DATABASE_URL`
   - Wert: die fertige `DIRECT_URL`
3. Der Workflow läuft danach jeden Sonntag automatisch. Manuell auslösen:
   Reiter **Actions → „Datenbank-Backup" → „Run workflow"**.

> Geplante (wöchentliche) Läufe funktionieren nur vom **Standard-Branch**
> (`main`). Der Branch muss also nach `main` gemergt sein.

Die fertige Backup-Datei findest du unter **Actions → der jeweilige Lauf →
Artifacts** (90 Tage abrufbar). Wiederherstellen geht mit:

```bash
gunzip -c backup_DATUM.sql.gz | psql "$DIRECT_URL"
```

## Nächste Schritte (Ideen)

- Schönes Design über die vorhandenen `.card`/`.btn`-Bausteine in
  `globals.css` legen
- Bild-Upload auf Object Storage umstellen (siehe oben)
- E-Mail-Bestätigung / Passwort-zurücksetzen
- Benachrichtigungen bei neuen Likes/Kommentaren
