function run(argv) {
  var params = JSON.parse(argv[0]);
  var mail = Application("Mail");
  var dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  var dateTo = params.dateTo ? new Date(params.dateTo) : null;

  var totalEmails = 0;
  var senderCounts = {};
  var monthCounts = {};
  var attachmentTypeCounts = {};

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
        try {
          var msg = messages[k];
          var msgDate = msg.dateReceived();
          if (dateFrom && msgDate < dateFrom) continue;
          if (dateTo && msgDate > dateTo) continue;

          totalEmails++;

          var sender = msg.sender();
          senderCounts[sender] = (senderCounts[sender] || 0) + 1;

          var monthKey = msgDate.getFullYear() + "-" + String(msgDate.getMonth() + 1).padStart(2, "0");
          monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;

          if (msg.mailAttachments.length > 0) {
            var attachments = msg.mailAttachments();
            for (var a = 0; a < attachments.length; a++) {
              var mimeType = attachments[a].mimeType() || "unknown";
              attachmentTypeCounts[mimeType] = (attachmentTypeCounts[mimeType] || 0) + 1;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
  }

  // Sort senders by count, top 20
  var topSenders = Object.keys(senderCounts)
    .map(function (addr) { return { address: addr, count: senderCounts[addr] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 20);

  var emailsPerMonth = Object.keys(monthCounts)
    .map(function (m) { return { month: m, count: monthCounts[m] }; })
    .sort(function (a, b) { return a.month < b.month ? -1 : 1; });

  var attachmentTypes = Object.keys(attachmentTypeCounts)
    .map(function (t) { return { type: t, count: attachmentTypeCounts[t] }; })
    .sort(function (a, b) { return b.count - a.count; });

  return JSON.stringify({
    totalEmails: totalEmails,
    topSenders: topSenders,
    emailsPerMonth: emailsPerMonth,
    attachmentTypes: attachmentTypes
  });
}
