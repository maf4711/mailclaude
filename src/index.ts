#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runScript } from "./applescript.js";
import { getAttachmentPath, getExportPath } from "./file-organizer.js";

interface MailboxInfo {
  account: string;
  mailbox: string;
  messageCount: number;
}

interface EmailResult {
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  mailbox: string;
  hasAttachments: boolean;
}

interface EmailDetail {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  body: string;
  htmlBody: string;
  error?: string;
}

interface AttachmentInfo {
  name: string;
  size: number;
  mimeType: string;
  saved?: boolean;
  path?: string;
  error?: string;
}

interface StatsResult {
  totalEmails: number;
  topSenders: { address: string; count: number }[];
  emailsPerMonth: { month: string; count: number }[];
  attachmentTypes: { type: string; count: number }[];
}

interface ExportResult {
  id: string;
  subject: string;
  date: string;
  path: string;
}

const server = new McpServer({
  name: "mailclaude",
  version: "1.0.0",
});

// --- list_mailboxes ---
server.tool("list_mailboxes", "List all mailboxes across all accounts in Apple Mail", {}, async () => {
  const results = await runScript<MailboxInfo[]>("mailboxes.js");
  return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
});

// --- search_emails ---
server.tool(
  "search_emails",
  "Search emails in Apple Mail by sender, subject, body, date, mailbox, and attachment filters",
  {
    from: z.string().optional().describe("Sender address or name (partial match)"),
    to: z.string().optional().describe("Recipient address (partial match)"),
    subject: z.string().optional().describe("Subject text (partial match)"),
    body: z.string().optional().describe("Body content (partial match)"),
    dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
    dateTo: z.string().optional().describe("End date (ISO 8601)"),
    mailbox: z.string().optional().describe("Specific mailbox name"),
    hasAttachments: z.boolean().optional().describe("Only emails with attachments"),
    attachmentType: z.string().optional().describe("MIME type filter (e.g. application/pdf, image/*)"),
    limit: z.number().optional().default(20).describe("Max results (default 20)"),
  },
  async (params) => {
    const results = await runScript<EmailResult[]>("search.js", params);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// --- read_email ---
server.tool(
  "read_email",
  "Read the full content of an email by its message ID",
  {
    id: z.string().describe("Message ID from search_emails"),
    mailbox: z.string().optional().describe("Mailbox name (from search_emails) to speed up lookup"),
  },
  async ({ id, mailbox }) => {
    const result = await runScript<EmailDetail>("read.js", { id, mailbox });
    if (result.error) {
      return { content: [{ type: "text", text: result.error }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- list_attachments ---
server.tool(
  "list_attachments",
  "List attachments of a specific email",
  {
    id: z.string().describe("Message ID"),
    mailbox: z.string().optional().describe("Mailbox name (from search_emails) to speed up lookup"),
  },
  async ({ id, mailbox }) => {
    const results = await runScript<AttachmentInfo[] | { error: string }>("attachments.js", { id, mailbox });
    if ("error" in results) {
      return { content: [{ type: "text", text: (results as { error: string }).error }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// --- save_attachment ---
server.tool(
  "save_attachment",
  "Save a specific attachment from an email to /tmp/mailclaude/attachments/YYYY/MM/",
  {
    id: z.string().describe("Message ID"),
    attachmentName: z.string().describe("Exact attachment filename"),
    mailDate: z.string().describe("Mail date (ISO 8601) for folder organization"),
    mailbox: z.string().optional().describe("Mailbox name (from search_emails) to speed up lookup"),
  },
  async ({ id, attachmentName, mailDate, mailbox }) => {
    const savePath = getAttachmentPath(mailDate, attachmentName);
    const results = await runScript<AttachmentInfo[] | { error: string }>("attachments.js", {
      id,
      savePath,
      attachmentName,
      mailbox,
    });
    if ("error" in results) {
      return { content: [{ type: "text", text: (results as { error: string }).error }], isError: true };
    }
    const saved = (results as AttachmentInfo[]).find((a) => a.saved);
    if (saved) {
      return { content: [{ type: "text", text: JSON.stringify({ path: saved.path, size: saved.size }, null, 2) }] };
    }
    return { content: [{ type: "text", text: "Attachment not found or could not be saved" }], isError: true };
  }
);

// --- save_all_attachments ---
server.tool(
  "save_all_attachments",
  "Save all attachments from emails matching a search to /tmp/mailclaude/attachments/YYYY/MM/",
  {
    from: z.string().optional(),
    to: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    mailbox: z.string().optional(),
    attachmentType: z.string().optional().describe("MIME type filter (e.g. application/pdf)"),
    limit: z.number().optional().default(20),
  },
  async (searchParams) => {
    // First search for emails
    const emails = await runScript<EmailResult[]>("search.js", {
      ...searchParams,
      hasAttachments: true,
    });

    const allResults: { emailSubject: string; emailDate: string; attachments: AttachmentInfo[] }[] = [];

    for (const email of emails) {
      // Get attachment list first
      const attachments = await runScript<AttachmentInfo[]>("attachments.js", { id: email.id, mailbox: email.mailbox });
      if (Array.isArray(attachments)) {
        const savePaths = attachments.map((a) => getAttachmentPath(email.date, a.name));
        const saved = await runScript<AttachmentInfo[]>("attachments.js", {
          id: email.id,
          mailbox: email.mailbox,
          savePath: savePaths[0],
          savePaths,
        });
        if (Array.isArray(saved)) {
          allResults.push({
            emailSubject: email.subject,
            emailDate: email.date,
            attachments: saved.filter((a) => a.saved),
          });
        }
      }
    }

    return { content: [{ type: "text", text: JSON.stringify(allResults, null, 2) }] };
  }
);

// --- email_stats ---
server.tool(
  "email_stats",
  "Get email statistics: counts per sender, month, attachment types",
  {
    mailbox: z.string().optional().describe("Specific mailbox (default: all)"),
    dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
    dateTo: z.string().optional().describe("End date (ISO 8601)"),
  },
  async (params) => {
    const results = await runScript<StatsResult>("stats.js", params);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// --- export_emails ---
server.tool(
  "export_emails",
  "Export emails as .eml files to /tmp/mailclaude/exports/YYYY/MM/",
  {
    from: z.string().optional(),
    to: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    mailbox: z.string().optional(),
    hasAttachments: z.boolean().optional(),
    limit: z.number().optional().default(20),
  },
  async (searchParams) => {
    // First search for emails
    const emails = await runScript<EmailResult[]>("search.js", searchParams);
    if (emails.length === 0) {
      return { content: [{ type: "text", text: "No emails found matching the search criteria" }] };
    }

    const ids = emails.map((e) => e.id);
    const paths = emails.map((e) => getExportPath(e.date, e.subject));

    const mailbox = searchParams.mailbox;
    const results = await runScript<ExportResult[]>("export.js", { ids, paths, mailbox });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
