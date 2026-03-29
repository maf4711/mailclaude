function run(argv) {
  var params = JSON.parse(argv[0]);
  var mail = Application("Mail");
  var targetId = params.id;
  var savePath = params.savePath || null;
  var attachmentName = params.attachmentName || null;

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

        // Message found — get attachments
        var attachments;
        try { attachments = msg.mailAttachments(); } catch (e) {
          return JSON.stringify([]);
        }
        var results = [];

        for (var a = 0; a < attachments.length; a++) {
          var att = attachments[a];
          var name, size, mimeType;
          try {
            name = att.name();
            size = att.fileSize();
            mimeType = att.mimeType();
          } catch (e) {
            name = name || "unknown";
            size = size || 0;
            mimeType = mimeType || "unknown";
          }

          if (savePath && (!attachmentName || attachmentName === name)) {
            var targetPath = savePath;
            if (attachmentName === null && attachments.length > 1) {
              if (params.savePaths && params.savePaths[a]) {
                targetPath = params.savePaths[a];
              }
            }
            try {
              var app = Application.currentApplication();
              app.includeStandardAdditions = true;
              att.save({ in: Path(targetPath) });
              results.push({
                name: name,
                size: size,
                mimeType: mimeType,
                saved: true,
                path: targetPath
              });
            } catch (saveErr) {
              results.push({
                name: name,
                size: size,
                mimeType: mimeType,
                saved: false,
                error: String(saveErr)
              });
            }
          } else {
            results.push({
              name: name,
              size: size,
              mimeType: mimeType
            });
          }
        }
        return JSON.stringify(results);
      }
    }
  }
  return JSON.stringify({ error: "Message not found: " + targetId });
}
