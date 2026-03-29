function run(argv) {
  var params = JSON.parse(argv[0]);
  var mail = Application("Mail");
  var limit = params.limit || 20;
  var results = [];

  var mailboxes = [];
  var accounts = mail.accounts();
  for (var i = 0; i < accounts.length; i++) {
    var acctMailboxes = accounts[i].mailboxes();
    for (var j = 0; j < acctMailboxes.length; j++) {
      if (params.mailbox && acctMailboxes[j].name() !== params.mailbox) continue;
      mailboxes.push(acctMailboxes[j]);
    }
  }

  var dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  var dateTo = params.dateTo ? new Date(params.dateTo) : null;

  for (var mi = 0; mi < mailboxes.length && results.length < limit; mi++) {
    var mb = mailboxes[mi];
    var messages;
    try {
      messages = mb.messages();
      if (!messages || !messages.length) continue;
    } catch (e) {
      continue;
    }

    for (var k = 0; k < messages.length && results.length < limit; k++) {
      var msg = messages[k];
      try {
        var msgDate = msg.dateReceived();
        var msgFrom = msg.sender();
        var msgSubject = msg.subject();

        if (dateFrom && msgDate < dateFrom) continue;
        if (dateTo && msgDate > dateTo) continue;
        if (params.from && msgFrom.toLowerCase().indexOf(params.from.toLowerCase()) === -1) continue;
        if (params.subject && msgSubject.toLowerCase().indexOf(params.subject.toLowerCase()) === -1) continue;

        if (params.to) {
          var recipients = msg.toRecipients();
          var toMatch = false;
          for (var r = 0; r < recipients.length; r++) {
            if (recipients[r].address().toLowerCase().indexOf(params.to.toLowerCase()) !== -1) {
              toMatch = true;
              break;
            }
          }
          if (!toMatch) continue;
        }

        if (params.body) {
          var content = msg.content();
          if (!content || content.toLowerCase().indexOf(params.body.toLowerCase()) === -1) continue;
        }

        var hasAttachments = msg.mailAttachments.length > 0;
        if (params.hasAttachments === true && !hasAttachments) continue;

        if (params.attachmentType && hasAttachments) {
          var attachments = msg.mailAttachments();
          var typeMatch = false;
          var pattern = params.attachmentType.replace("*", "");
          for (var a = 0; a < attachments.length; a++) {
            var mimeType = attachments[a].mimeType();
            if (mimeType && mimeType.indexOf(pattern) !== -1) {
              typeMatch = true;
              break;
            }
          }
          if (!typeMatch) continue;
        }

        var toAddresses = [];
        var toRecips = msg.toRecipients();
        for (var t = 0; t < toRecips.length; t++) {
          toAddresses.push(toRecips[t].address());
        }

        results.push({
          id: msg.messageId(),
          from: msgFrom,
          to: toAddresses,
          subject: msgSubject,
          date: msgDate.toISOString(),
          mailbox: mb.name(),
          hasAttachments: hasAttachments
        });
      } catch (e) {
        continue;
      }
    }
  }

  return JSON.stringify(results);
}
