function run(argv) {
  var params = JSON.parse(argv[0]);
  var mail = Application("Mail");
  var targetId = params.id;

  var accounts = mail.accounts();
  for (var i = 0; i < accounts.length; i++) {
    var mailboxes = accounts[i].mailboxes();
    for (var j = 0; j < mailboxes.length; j++) {
      if (params.mailbox && mailboxes[j].name() !== params.mailbox) continue;
      var messages;
      try {
        messages = mailboxes[j].messages();
        if (!messages || !messages.length) continue;
      } catch (e) {
        continue;
      }
      for (var k = 0; k < messages.length; k++) {
        var msg = messages[k];
        var msgId;
        try { msgId = msg.messageId(); } catch (e) { continue; }
        if (msgId !== targetId) continue;

        // Message found — read details
        var toAddresses = [];
        try {
          var toRecips = msg.toRecipients();
          for (var t = 0; t < toRecips.length; t++) {
            toAddresses.push(toRecips[t].address());
          }
        } catch (e) {}
        var ccAddresses = [];
        try {
          var ccRecips = msg.ccRecipients();
          for (var c = 0; c < ccRecips.length; c++) {
            ccAddresses.push(ccRecips[c].address());
          }
        } catch (e) {}

        var body = "";
        try { body = msg.content(); } catch (e) {}
        var htmlBody = "";
        try { htmlBody = msg.htmlContent(); } catch (e) {}

        var from = "", subject = "", date = "";
        try { from = msg.sender(); } catch (e) {}
        try { subject = msg.subject(); } catch (e) {}
        try { date = msg.dateReceived().toISOString(); } catch (e) {}

        return JSON.stringify({
          id: msgId,
          from: from,
          to: toAddresses,
          cc: ccAddresses,
          subject: subject,
          date: date,
          body: body || "",
          htmlBody: htmlBody || ""
        });
      }
    }
  }
  return JSON.stringify({ error: "Message not found: " + targetId });
}
