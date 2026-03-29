function run(argv) {
  var params = JSON.parse(argv[0]);
  var mail = Application("Mail");
  var app = Application.currentApplication();
  app.includeStandardAdditions = true;

  var targetIds = params.ids; // array of message IDs
  var paths = params.paths;   // array of save paths, same order

  var results = [];
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
        var idx = targetIds.indexOf(msgId);
        if (idx === -1) continue;

        // Message found — export it
        try {
          var source = msg.source();
          var savePath = paths[idx];

          var nsString = $.NSString.alloc.initWithUTF8String(source);
          nsString.writeToFileAtomicallyEncodingError(savePath, true, $.NSUTF8StringEncoding, null);

          var subject = "", date = "";
          try { subject = msg.subject(); } catch (e) {}
          try { date = msg.dateReceived().toISOString(); } catch (e) {}

          results.push({
            id: msgId,
            subject: subject,
            date: date,
            path: savePath
          });
        } catch (e) {
          results.push({
            id: msgId,
            error: String(e)
          });
        }

        targetIds[idx] = null;
      }
    }
  }

  return JSON.stringify(results);
}
