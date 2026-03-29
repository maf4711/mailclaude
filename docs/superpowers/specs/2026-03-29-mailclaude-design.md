# mailclaude — Apple Mail MCP Server

## Zweck

MCP Server fuer Claude Code, der Apple Mail auf macOS durchsuchen, Mails lesen, Anhaenge extrahieren, Statistiken liefern und Mails exportieren kann.

## Technologie

- **Runtime:** TypeScript / Node.js
- **MCP SDK:** `@modelcontextprotocol/sdk` (stdio-Transport)
- **Mail-Zugriff:** JXA (JavaScript for Automation) via `osascript -l JavaScript`
- **Anhaenge/Exports:** Dateisystem, organisiert nach Jahr/Monat

## Tools

### `list_mailboxes`

Listet alle verfuegbaren Mailboxen ueber alle Accounts.

**Parameter:** keine

**Rueckgabe:** Array von `{ account: string, mailbox: string, messageCount: number }`

### `search_emails`

Durchsucht Mails nach verschiedenen Kriterien.

**Parameter:**

| Name | Typ | Required | Default | Beschreibung |
|------|-----|----------|---------|-------------|
| `from` | string | nein | — | Absender (teilweise Uebereinstimmung) |
| `to` | string | nein | — | Empfaenger |
| `subject` | string | nein | — | Betreff-Text |
| `body` | string | nein | — | Inhalt-Text |
| `dateFrom` | string | nein | — | Ab Datum (ISO 8601) |
| `dateTo` | string | nein | — | Bis Datum (ISO 8601) |
| `mailbox` | string | nein | alle | Bestimmte Mailbox |
| `hasAttachments` | boolean | nein | — | Nur Mails mit Anhaengen |
| `attachmentType` | string | nein | — | MIME-Type Filter (z.B. `application/pdf`, `image/*`) |
| `limit` | number | nein | 20 | Max. Ergebnisse |

**Rueckgabe:** Array von `{ id: string, messageId: string, from: string, to: string[], subject: string, date: string, mailbox: string, hasAttachments: boolean }`

### `read_email`

Liest den vollen Inhalt einer Mail.

**Parameter:**

| Name | Typ | Required | Beschreibung |
|------|-----|----------|-------------|
| `id` | string | ja | Mail-ID aus search_emails |

**Rueckgabe:** `{ id: string, from: string, to: string[], cc: string[], subject: string, date: string, body: string, htmlBody: string }`

### `list_attachments`

Listet Anhaenge einer bestimmten Mail.

**Parameter:**

| Name | Typ | Required | Beschreibung |
|------|-----|----------|-------------|
| `id` | string | ja | Mail-ID |

**Rueckgabe:** Array von `{ name: string, size: number, mimeType: string }`

### `save_attachment`

Speichert einen einzelnen Anhang.

**Parameter:**

| Name | Typ | Required | Beschreibung |
|------|-----|----------|-------------|
| `id` | string | ja | Mail-ID |
| `attachmentName` | string | ja | Name des Anhangs |

**Rueckgabe:** `{ path: string, size: number }`

Speicherort: `/tmp/mailclaude/attachments/YYYY/MM/dateiname.ext`

### `save_all_attachments`

Bulk-Export aller Anhaenge aus einer Suche.

**Parameter:**

| Name | Typ | Required | Beschreibung |
|------|-----|----------|-------------|
| `searchParams` | object | ja | Gleiche Parameter wie `search_emails` |
| `attachmentType` | string | nein | MIME-Type Filter |

**Rueckgabe:** Array von `{ emailSubject: string, emailDate: string, attachments: { name: string, path: string, size: number }[] }`

### `email_stats`

Statistiken ueber den Mailbestand.

**Parameter:**

| Name | Typ | Required | Beschreibung |
|------|-----|----------|-------------|
| `mailbox` | string | nein | Bestimmte Mailbox (default: alle) |
| `dateFrom` | string | nein | Ab Datum |
| `dateTo` | string | nein | Bis Datum |

**Rueckgabe:** `{ totalEmails: number, topSenders: { address: string, count: number }[], emailsPerMonth: { month: string, count: number }[], attachmentTypes: { type: string, count: number }[] }`

### `export_emails`

Exportiert Mails als `.eml` Dateien.

**Parameter:**

| Name | Typ | Required | Beschreibung |
|------|-----|----------|-------------|
| `searchParams` | object | ja | Gleiche Parameter wie `search_emails` |

**Rueckgabe:** Array von `{ subject: string, date: string, path: string }`

Speicherort: `/tmp/mailclaude/exports/YYYY/MM/YYYY-MM-DD_Betreff.eml`

## Datei-Organisation

```
/tmp/mailclaude/
├── attachments/
│   └── 2024/
│       └── 03/
│           ├── rechnung.pdf
│           └── foto.jpg
└── exports/
    └── 2024/
        └── 03/
            └── 2024-03-15_Betreff.eml
```

- Ordner basierend auf Mail-Datum (nicht Speicher-Datum)
- Namenskollisionen: Suffix `_2`, `_3` etc.
- Betreff in Dateinamen wird sanitized (Sonderzeichen entfernt, max 50 Zeichen)

## Projektstruktur

```
mailclaude/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # MCP Server Setup + Tool-Handler
│   ├── applescript.ts      # JXA-Ausfuehrung via osascript
│   ├── file-organizer.ts   # Jahr/Monat-Ordner, Namenskollisionen, Sanitizing
│   └── scripts/
│       ├── search.js       # Mail-Suche
│       ├── read.js         # Mail lesen
│       ├── attachments.js  # Anhaenge listen/speichern
│       ├── mailboxes.js    # Mailboxen auflisten
│       ├── stats.js        # Statistiken berechnen
│       └── export.js       # .eml Export
```

## JXA-Ausfuehrung

Alle JXA-Skripte werden via `child_process.execFile('osascript', ['-l', 'JavaScript', scriptPath, ...args])` ausgefuehrt. Parameter werden als JSON-String uebergeben, Ergebnisse als JSON-String zurueckgegeben.

```typescript
// applescript.ts — Kern-Pattern
async function runScript<T>(scriptName: string, params: Record<string, unknown>): Promise<T> {
  const scriptPath = path.join(__dirname, 'scripts', scriptName);
  const result = await execFile('osascript', ['-l', 'JavaScript', scriptPath, JSON.stringify(params)]);
  return JSON.parse(result.stdout);
}
```

## Mail-ID-Strategie

Apple Mail hat keine stabile numerische ID ueber Sessions hinweg. Wir verwenden die `message id` (RFC 2822 Message-ID Header), die global eindeutig und persistent ist. Bei der Suche wird die Message-ID zurueckgegeben, bei nachfolgenden Aufrufen wird die Mail ueber diese ID wiedergefunden.

## Fehlerbehandlung

- Mail.app nicht gestartet: Klare Fehlermeldung mit Hinweis, Mail.app zu oeffnen
- Keine Berechtigung: Hinweis auf System Preferences > Privacy > Automation
- Leere Suche: Leeres Array, kein Fehler
- Ungueltige Mail-ID: Fehlermeldung mit Kontext

## Limitierungen

- Nur lokal auf macOS (Mail.app erforderlich)
- Performance abhaengig von Mailbox-Groesse (JXA ist single-threaded)
- Anhang-Speicherung nur in `/tmp/` (fluechtig nach Neustart)
- `search_emails` limit default 20, um Performance zu schuetzen
