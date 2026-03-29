function run(argv) {
  var mail = Application("Mail");
  var results = [];
  var accounts = mail.accounts();
  for (var i = 0; i < accounts.length; i++) {
    var account = accounts[i];
    var accountName = account.name();
    var mailboxes = account.mailboxes();
    for (var j = 0; j < mailboxes.length; j++) {
      var mb = mailboxes[j];
      results.push({
        account: accountName,
        mailbox: mb.name(),
        messageCount: mb.messages.length
      });
    }
  }
  return JSON.stringify(results);
}
