/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // ── Extend the built-in users auth collection ──────────────────────────────
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "role" }));
  users.fields.add(new TextField({ name: "avatarUrl" }));

  users.listRule   = '@request.auth.id != ""';
  users.viewRule   = '@request.auth.id != ""';
  users.updateRule = 'id = @request.auth.id || @request.auth.role = "admin"';
  users.deleteRule = '@request.auth.role = "admin"';
  app.save(users);

  // ── patients ───────────────────────────────────────────────────────────────
  const patients = new Collection({
    name: "patients",
    type: "base",
    listRule:   '@request.auth.id != ""',
    viewRule:   '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  patients.fields.add(new TextField({ name: "name", required: true }));
  patients.fields.add(new TextField({ name: "authorUid" }));
  patients.fields.add(new TextField({ name: "authorEmail" }));
  patients.fields.add(new TextField({ name: "authorName" }));
  patients.fields.add(new JSONField({ name: "patientData" }));
  patients.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  patients.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(patients);

  // ── chat_messages ──────────────────────────────────────────────────────────
  const chat = new Collection({
    name: "chat_messages",
    type: "base",
    listRule:   '@request.auth.id != ""',
    viewRule:   '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  chat.fields.add(new TextField({ name: "from" }));
  chat.fields.add(new TextField({ name: "to" }));
  chat.fields.add(new TextField({ name: "message" }));
  chat.fields.add(new TextField({ name: "image" }));
  chat.fields.add(new BoolField({ name: "recalled" }));
  chat.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  chat.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(chat);

  // ── presence ───────────────────────────────────────────────────────────────
  const presence = new Collection({
    name: "presence",
    type: "base",
    listRule:   '@request.auth.id != ""',
    viewRule:   '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  presence.fields.add(new TextField({ name: "email" }));
  presence.fields.add(new TextField({ name: "lastSeen" }));
  presence.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  presence.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(presence);

  // ── vouchers ───────────────────────────────────────────────────────────────
  const vouchers = new Collection({
    name: "vouchers",
    type: "base",
    listRule:   '@request.auth.id != ""',
    viewRule:   '@request.auth.id != ""',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.role = "admin"',
  });
  vouchers.fields.add(new NumberField({ name: "milestoneCount" }));
  vouchers.fields.add(new TextField({ name: "url" }));
  vouchers.fields.add(new TextField({ name: "imageUrl" }));
  vouchers.fields.add(new TextField({ name: "claimedBy" }));
  vouchers.fields.add(new TextField({ name: "claimedByEmail" }));
  vouchers.fields.add(new TextField({ name: "claimedByName" }));
  vouchers.fields.add(new TextField({ name: "claimedAt" }));
  vouchers.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  vouchers.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(vouchers);

}, (app) => {
  // ── revert ────────────────────────────────────────────────────────────────
  for (const name of ["vouchers", "presence", "chat_messages", "patients"]) {
    try {
      const col = app.findCollectionByNameOrId(name);
      app.delete(col);
    } catch (_) {}
  }
});
