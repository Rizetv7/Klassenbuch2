# Übergabe / Handoff — Maturaziitig

Stand-Dokument, damit jemand reibungslos weiterarbeiten kann. Beschreibt
Architektur, Hosting (Vercel + Supabase), Environment-Variablen, Datenbank-
Migrationen, lokalen Workflow und offene Punkte.

---

## 1. Was ist das?

Ein digitales Klassen-Erinnerungsbuch (Jahrbuch-Stil). Schüler:innen einer
Klasse sammeln **Zitate, Bilder und Notizen** — über Mitschüler:innen, über
selbst angelegte **Lehrpersonen** und in frei erstellbaren **Projekten**
(z. B. „Ausflug"). Mit Likes, Kommentaren, Profilbildern und einem Feed.

Design: weicher, animierter „Liquid"-Verlauf (Violett/Pink/Blau), helle,
leicht durchscheinende Karten, fette Grotesk-Titel.

## 2. Tech-Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma** ORM → **PostgreSQL** (Supabase). Lokal optional SQLite.
- Eigene Auth: **Login per Name + Passwort**, `bcryptjs`, JWT (`jose`) im
  httpOnly-Cookie. Kein externer Auth-Dienst.
- **WebGL**-Hintergrund (`src/components/LiquidBackground.tsx`).
- Bild-Upload → **Supabase Storage** (Bucket `uploads`, öffentlich), Bilder
  werden vorher **im Browser komprimiert** (`src/lib/uploadImage.ts`).

## 3. Hosting-Architektur

### Vercel (Webseite/Hosting)
- Hängt am GitHub-Repo `Rizetv7/Klassenbuch2`.
- **Production Branch = `claude/class-yearbook-mvp-iztzv1`** → ein Push dorthin
  löst automatisch ein Production-Deployment aus. (Es gibt auch `main`, aber
  Vercel deployt aktuell den genannten Branch. Wer auf `main` umstellt: in
  Vercel → Settings → Git → Production Branch ändern.)
- Build-Befehl: `npm run build` = `prisma generate && next build`.
  **Wichtig:** Der Build berührt die Datenbank NICHT (kein `db push`), damit er
  nicht an der DB scheitern kann. Schema-Änderungen müssen daher per SQL in
  Supabase eingespielt werden (siehe 5.).
- Serverless-Funktionen haben ein **Request-Limit von ~4,5 MB** → deshalb
  werden Bilder vor dem Upload clientseitig verkleinert.

### Supabase (Datenbank + Bild-Speicher)
- **Postgres-Datenbank**: Verbindung über den **Transaction-Pooler**
  (Host `...pooler.supabase.com:6543`, `?pgbouncer=true`).
- **Storage**: öffentlicher Bucket **`uploads`**. Wird beim ersten Upload
  automatisch angelegt, falls er fehlt (`src/app/api/upload/route.ts`).
- Storage-Requests brauchen **beide** Header: `apikey` UND
  `Authorization: Bearer` (service_role-Key).

## 4. Environment-Variablen (in Vercel + lokal in `.env`)

| Variable | Wofür | Quelle |
| --- | --- | --- |
| `DATABASE_URL` | Postgres-Verbindung (Pooler, Port 6543, `?pgbouncer=true`) | Supabase → Connect → ORM → Prisma |
| `AUTH_SECRET` | Signiert die Login-Sessions | selbst generieren (`openssl rand -base64 32`) |
| `SUPABASE_URL` | Projekt-URL `https://<ref>.supabase.co` (NUR Host, kein Pfad!) | Supabase → Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Geheimer Key für Storage-Uploads (nur serverseitig!) | Supabase → Settings → API Keys → service_role |

Diagnose-Endpoint: **`/api/health`** zeigt, ob DB erreichbar ist und welche
Variablen gesetzt sind (Passwörter maskiert).

## 5. Datenbank-Migrationen (wichtig!)

Da der Build kein `db push` macht, werden Tabellen/Spalten per SQL im
**Supabase SQL Editor** angelegt. Die Skripte liegen in `db/` und sind
idempotent (mehrfach ausführbar):

- `db/schema.sql` — komplettes Schema (Erstaufsetzung).
- `db/reset.sql` — löscht & legt alle Tabellen neu an (nur wenn leer!).
- `db/migrate_topics.sql` — fügt Projekte (`Topic`, `Post.topicId`) hinzu.
- `db/migrate_teachers.sql` — fügt Lehrpersonen-Einträge (`Teacher`) sowie
  `Post.teacherId`, `Post.saidByName`, `Post.anonymous` hinzu.

**Workflow bei Schema-Änderung:** `prisma/schema.prisma` anpassen → passendes
additives SQL schreiben (oder mit
`npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
generieren) → im Supabase SQL Editor ausführen → Code deployen.

> ⚠️ Nach dem letzten Stand muss `db/migrate_teachers.sql` noch in Supabase
> ausgeführt werden, damit Lehrpersonen/anonyme Zitate funktionieren.

## 6. Datenmodell (Prisma)

- **User** — Konto (Login per `name`, eindeutig). Hat `avatarUrl`, `accentColor`.
- **Class** — Klasse. `joinCode` zum Beitreten. Genau **eine Klasse pro User**
  (erzwungen in den API-Routen).
- **Membership** — User ↔ Class. Alle Mitglieder sind Schüler:innen.
- **Teacher** — Lehrperson als *Eintrag* (KEIN Konto). Wird von Schüler:innen
  erstellt, hat Name/Fach/Profilbild.
- **Topic** — Projekt (z. B. „Ausflug"), klassenweit.
- **Post** — Zitat | Bild | Notiz. Ziel: `subjectMembershipId` (Schüler) ODER
  `teacherId` (Lehrperson) ODER `topicId` (Projekt). Felder: `text`, `imageUrl`,
  `context`, `saidByName` (wer hat's gesagt, bei Projekten), `anonymous`.
- **Comment**, **Like**.

## 7. Verzeichnisstruktur

```
prisma/schema.prisma         Datenmodell
db/*.sql                      Migrations-SQL für Supabase
src/lib/                      db, auth, classAccess, serializePost, uploadImage
src/app/api/                  REST-Endpunkte (auth, classes, teachers, topics, posts, upload, health)
src/app/                      Seiten (Feed, Login, Klasse, Person, Lehrer, Projekt, Profil)
src/components/               Nav, PostCard, CreatePost, Icons, LiquidBackground
```

## 8. Lokal entwickeln

```bash
git clone https://github.com/Rizetv7/Klassenbuch2.git
cd Klassenbuch2
git checkout claude/class-yearbook-mvp-iztzv1
npm install
cp .env.example .env          # Werte eintragen (s. 4.)
npm run dev                    # http://localhost:3000
```
`.env` wird nicht committet. Für reines UI-Arbeiten kann man die DB auch lokal
auf SQLite stellen (Provider in `schema.prisma` auf `sqlite`, `DATABASE_URL="file:./dev.db"`,
`npx prisma db push`) — aber vor dem Commit wieder auf `postgresql` zurück.

## 9. Deploy-Workflow

```bash
git pull  origin claude/class-yearbook-mvp-iztzv1
# ...ändern...
git add -A
git commit -m "..."
git push  origin claude/class-yearbook-mvp-iztzv1   # Vercel deployt automatisch
```

## 10. Bekannte Punkte / Roadmap (noch offen)

- **Performance**: Hauptursache (Milchglas/`backdrop-blur`) wurde entfernt und
  der Hintergrund gedrosselt. Tiefer optimieren ließe sich durch
  Server-Components/Caching statt vieler Client-`fetch`-Aufrufe; Supabase-
  Pooler-Latenz bleibt bei Serverless ein Faktor.
- **Backups**: GitHub-Action `.github/workflows/backup.yml` (Secret
  `BACKUP_DATABASE_URL` nötig).
- Mögliche nächste Schritte: Suche (Personen/Zitate), „Best Of", Bild-Markierung
  mehrerer Personen, Benachrichtigungen, Editieren von Beiträgen.
