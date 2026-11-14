const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const { load } = require("./resume-fixture.cjs");
const { editZ83, reusableZ83, z83FromProfile, initialZ83 } = load(
  "src/lib/z83/reusable.ts",
  { "./types": load("src/lib/z83/types.ts", {}) },
);
const { createSecureZ83 } = load("src/lib/z83/secure-store.ts", {});
const { mailtoURL } = load("src/lib/circular/email-contract.ts", {});
function secure() {
  const values = new Map();
  let owner = "alice",
    fail;
  const port = {
    owner: async () => owner,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      if (fail?.(key, value)) throw Error("keychain failure");
      values.set(key, value);
    },
    remove: async (key) => values.delete(key),
  };
  return {
    values,
    port,
    store: createSecureZ83(port),
    owner: (value) => (owner = value),
    fail: (fn) => (fail = fn),
  };
}
test("all explicitly retained reusable fields survive, but job/signature/date/initials are excluded", () => {
  const input = {
    surnameAndNames: "Fixture",
    idNumber: "0123456789012",
    race: "",
    gender: "female",
    disability: "no",
    saCitizen: "yes",
    languages: [
      { name: "English", speak: "good", write: "good", unknown: "secret" },
    ],
    qualifications: [
      { institution: "College", qualification: "Diploma", year: "2020" },
    ],
    jobs: [
      {
        employer: "Example",
        post: "Clerk",
        fromMonth: "01",
        fromYear: "20",
        toMonth: "02",
        toYear: "24",
        reason: "Study",
      },
    ],
    position: "OLD",
    department: "OLD",
    reference: "OLD",
    initials: "FP",
    signature: "data:image/png;base64,secret",
    declarationDate: "14/11/2026",
    reviewed: true,
  };
  const saved = reusableZ83(input);
  assert.equal(saved.idNumber, input.idNumber);
  assert.equal(saved.disability, "no");
  assert.equal(saved.race, "");
  for (const field of [
    "position",
    "department",
    "reference",
    "initials",
    "signature",
    "declarationDate",
    "reviewed",
  ])
    assert.equal(field in saved, false);
  assert.equal(saved.languages[0].unknown, undefined);
});
test("profile maps verified fields without inferring identity, equity, citizenship or language proficiency", () => {
  const result = z83FromProfile(
    {
      first_name: "Test",
      last_name: "Member",
      date_of_birth: "1998-05-09",
      email: "fixture@example.test",
      phone: "0123456789",
      address: "Fixture road",
      city: "Test city",
      languages: ["English"],
      highest_qualification: "Diploma",
      institution: "College",
      year_completed: 2020,
      race: "injected",
      gender: "injected",
    },
    [
      {
        company: "Example",
        job_title: "Clerk",
        start_date: "2020-01-01",
        end_date: null,
        currently_working: true,
      },
    ],
  );
  assert.equal(result.surnameAndNames, "MEMBER, Test");
  assert.equal(result.dateOfBirth, "09/05/1998");
  assert.match(result.contactDetails, /Fixture road/);
  assert.equal(result.languages[0].speak, "");
  assert.equal(result.jobs[0].toYear, "");
  for (const field of [
    "race",
    "gender",
    "saCitizen",
    "disability",
    "idNumber",
    "initials",
    "signature",
    "declarationDate",
  ])
    assert.equal(field in result, false);
  assert.deepEqual(z83FromProfile(null, []), {});
});
test("returning saved details remain editable; two jobs never share job identity or declaration", () => {
  const saved = {
    ...reusableZ83({
      surnameAndNames: "Returning",
      idNumber: "123",
      gender: "",
      disability: "",
      method: "",
      languages: [{ name: "isiZulu", speak: "good", write: "fair" }],
    }),
    position: "POISON",
    reference: "POISON",
    signature: "POISON",
    declarationDate: "yesterday",
  };
  const a = initialZ83({}, saved, {
    position: "Clerk A",
    department: "Department A",
    reference: "REF A",
  });
  const b = initialZ83({}, saved, {
    position: "Clerk B",
    department: "Department B",
    reference: "REF B",
  });
  assert.equal(a.position, "Clerk A");
  assert.equal(b.reference, "REF B");
  assert.equal(b.idNumber, "123");
  for (const field of ["initials", "signature", "declarationDate"])
    assert.equal(b[field], "");
  const snapshot = JSON.parse(JSON.stringify(a));
  b.surnameAndNames = "Edited";
  assert.equal(snapshot.surnameAndNames, "Returning");
  assert.equal(initialZ83({}, null).department, "");
  assert.equal(initialZ83({}, null).preferredLanguage, "");
  assert.equal(initialZ83({}, null).method, "");
});
test("secure persistence requires explicit consent and matching account", async () => {
  const f = secure();
  await assert.rejects(f.store.save("alice", { idNumber: "private" }, false));
  assert.equal(f.values.size, 0);
  f.owner("bob");
  await assert.rejects(f.store.save("alice", {}, true));
  await assert.rejects(f.store.read("alice"));
  assert.equal(f.values.size, 0);
});
test("large Unicode record is OS-secure chunks under 1200 bytes, with no plaintext-cache port", async () => {
  const f = secure(),
    data = { surnameAndNames: "Fixture 🌍", notes: "é🌍".repeat(900) };
  await f.store.save("alice", data, true);
  assert.deepEqual(await f.store.read("alice"), data);
  for (const value of f.values.values())
    assert.ok(Buffer.byteLength(value) <= 1200);
  assert.ok(f.values.size > 3);
});
test("account switch cannot read another user; returning to same account restores consented details", async () => {
  const f = secure();
  await f.store.save("alice", { name: "Alice" }, true);
  f.owner("bob");
  assert.equal(await f.store.read("bob"), null);
  await f.store.save("bob", { name: "Bob" }, true);
  await assert.rejects(f.store.read("alice"));
  f.owner("alice");
  assert.deepEqual(await f.store.read("alice"), { name: "Alice" });
  await f.store.clear("alice");
  f.owner("bob");
  assert.deepEqual(await f.store.read("bob"), { name: "Bob" });
});
test("failed secure update retains previous record, never falls back to AsyncStorage", async () => {
  const f = secure();
  await f.store.save("alice", { value: "before" }, true);
  f.fail((key) => key.endsWith(".b.0"));
  await assert.rejects(f.store.save("alice", { value: "after" }, true));
  f.fail(null);
  assert.deepEqual(await f.store.read("alice"), { value: "before" });
});
test("account switch during a secure write does not publish partial or cross-account details", async () => {
  const f = secure();
  await f.store.save("alice", { value: "old" }, true);
  f.fail((key) => {
    if (key.endsWith(".b.0")) f.owner("bob");
    return false;
  });
  await assert.rejects(f.store.save("alice", { value: "new" }, true));
  f.fail(null);
  f.owner("alice");
  assert.deepEqual(await f.store.read("alice"), { value: "old" });
});
test("interrupted write and corrupt manifest can be cleared using fixed slots", async () => {
  const f = secure();
  await f.store.save("alice", { name: "secret" }, true);
  f.values.set("fj.z83.v2.alice.b.0", "orphan");
  f.values.set("fj.z83.v2.alice", "not-json");
  await assert.rejects(f.store.read("alice"));
  await f.store.clear("alice");
  assert.equal(f.values.size, 0);
});
function native({
  mail = true,
  status = "cancelled",
  share = true,
  clients = [],
  defaultApp = false,
} = {}) {
  const files = new Map([
    ["file:///cache/source.pdf", "%PDF-1.7\nfixture"],
    ["file:///cache/cv.pdf", "%PDF-1.7\nCV"],
    ["file:///cache/z83.pdf", "%PDF-1.7\nZ83"],
    ["file:///cache/support.pdf", "%PDF-1.7\nSupport"],
  ]);
  const events = [];
  let statuses = [200];
  const fs = {
    cacheDirectory: "file:///cache/",
    EncodingType: { Base64: "base64" },
    makeDirectoryAsync: async () => {},
    copyAsync: async ({ from, to }) => {
      files.set(to, files.get(from));
      events.push(["copy", to]);
    },
    deleteAsync: async (uri) => {
      events.push(["remove", uri]);
      for (const key of files.keys())
        if (key === uri || key.startsWith(uri)) files.delete(key);
    },
    getInfoAsync: async (uri) => ({
      exists: files.has(uri),
      isDirectory: false,
      size: files.get(uri)?.length ?? 0,
    }),
    readAsStringAsync: async (uri, { position = 0, length }) =>
      Buffer.from(files.get(uri) || "")
        .subarray(
          position,
          length === undefined ? undefined : position + length,
        )
        .toString("base64"),
    downloadAsync: async (url, uri) => {
      const status = statuses.shift() ?? 200;
      files.set(uri, status === 200 ? "%PDF-1.7\ndownloaded" : "expired");
      events.push(["download", url, uri]);
      return { status, uri };
    },
  };
  const sharing = {
    isAvailableAsync: async () => share,
    shareAsync: async (uri, options) => {
      assert.ok(files.has(uri));
      events.push(["share", uri, options]);
    },
  };
  const doc = load("src/lib/document-export.ts", {
    "expo-file-system/legacy": fs,
    "expo-sharing": sharing,
    "./z83/pdf-lib": {
      PDFDocument: { load: async () => ({ getPageCount: () => 1 }) },
    },
  });
  const io = load("src/lib/circular/io.ts", {
    "../document-export": doc,
    "./email-contract": load("src/lib/circular/email-contract.ts", {}),
    "react-native": {
      Platform: { OS: "ios" },
      Linking: {
        canOpenURL: async () => defaultApp,
        openURL: async (url) => events.push(["open", url]),
      },
    },
    "expo-file-system/legacy": fs,
    "expo-intent-launcher": {},
    "expo-mail-composer": {
      isAvailableAsync: async () => mail,
      getClients: () => clients,
      composeAsync: async (options) => {
        events.push(["compose", options]);
        return { status };
      },
    },
    "expo-document-picker": {
      getDocumentAsync: async () => ({ canceled: true }),
    },
    "expo-clipboard": {
      setStringAsync: async (text) => events.push(["copy-text", text]),
    },
    "../save-pdf": { savePdfToDownloads: async () => {} },
    "./contract": load("src/lib/circular/contract.ts", {}),
  });
  return {
    files,
    events,
    fs,
    sharing,
    doc,
    io,
    statuses: (value) => (statuses = value),
  };
}
test("stored CV exports a fresh local document with correct extension/MIME and cleans temp only after handoff", async () => {
  const f = native();
  let signed = 0;
  const result = await f.doc.exportStoredDocument(
    {
      kind: "cv",
      file_name: "Member private name.pdf",
      file_path: "owner/private",
    },
    async () => `https://storage.example.test/signed-${++signed}`,
    async () => true,
  );
  assert.deepEqual(result, { handedOff: true });
  assert.equal(result.saved, undefined);
  const event = f.events.find((x) => x[0] === "share");
  assert.match(event[1], /\/CV.pdf$/);
  assert.equal(event[2].mimeType, "application/pdf");
  assert.equal(f.files.has(event[1]), false);
  assert.ok(f.files.has("file:///cache/source.pdf"));
  assert.equal(signed, 1);
});
test("expired stored link retries one GET with fresh URL, no cached signed link reuse", async () => {
  const f = native();
  f.statuses([403, 200]);
  let signed = 0;
  await f.doc.exportStoredDocument(
    { kind: "cv", file_name: "cv.pdf", file_path: "private" },
    async () => `https://storage.example.test/signed-${++signed}`,
    async () => true,
  );
  assert.equal(signed, 2);
  assert.equal(f.events.filter((x) => x[0] === "share").length, 1);
});
test("failed download and owner switch never present another account document", async () => {
  for (const switched of [false, true]) {
    const f = native();
    if (!switched) f.statuses([500]);
    let calls = 0;
    await assert.rejects(
      f.doc.exportStoredDocument(
        { kind: "cv", file_name: "cv.pdf", file_path: "private" },
        async () => "https://storage.example.test/file",
        async () => ++calls === 1 || !switched,
      ),
    );
    assert.equal(
      f.events.some((x) => x[0] === "share"),
      false,
    );
  }
});
test("empty/HTML documents and unavailable sharing fail without a saved-success claim", async () => {
  const f = native();
  f.files.set("file:///cache/empty.pdf", "");
  f.files.set("file:///cache/html.pdf", "<html>not a PDF</html>");
  await assert.rejects(f.doc.assertPdf("file:///cache/empty.pdf"));
  await assert.rejects(f.doc.assertPdf("file:///cache/html.pdf"));
  const no = native({ share: false });
  await assert.rejects(
    no.doc.exportStoredDocument(
      { kind: "cv", file_name: "cv.pdf", file_path: "x" },
      async () => "https://storage.test/file",
      async () => true,
    ),
  );
  assert.equal(no.events.length, 0);
});
test("Apple Mail composer gets exact recipient/subject, edited message and all selected PDFs; cancelled is not sent", async () => {
  const f = native();
  assert.equal(
    await f.io.compose(
      "jobs@example.test",
      "REF/42",
      "file:///cache/z83.pdf",
      "file:///cache/cv.pdf",
      "Edited body",
      ["file:///cache/support.pdf"],
    ),
    "cancelled",
  );
  assert.deepEqual(f.events.find((x) => x[0] === "compose")[1], {
    recipients: ["jobs@example.test"],
    subject: "REF/42",
    body: "Edited body",
    attachments: [
      "file:///cache/z83.pdf",
      "file:///cache/cv.pdf",
      "file:///cache/support.pdf",
    ],
  });
});
test("Apple Mail unavailable with Gmail installed returns manual handoff instead of a dead-end mail error", async () => {
  const f = native({
    mail: false,
    clients: [{ label: "Gmail", url: "googlegmail://" }],
  });
  assert.equal(
    await f.io.compose(
      "jobs@example.test",
      "REF",
      "file:///cache/z83.pdf",
      "file:///cache/cv.pdf",
    ),
    "manual",
  );
  const paths = await f.io.emailPaths();
  assert.equal(paths.composer, false);
  assert.equal(paths.clients[0].label, "Gmail");
  assert.equal(
    f.events.some((x) => x[0] === "compose"),
    false,
  );
});
test("no usable mail target preserves copy actions and gives manual save instructions", async () => {
  const f = native({ mail: false });
  assert.deepEqual(await f.io.emailPaths(), {
    composer: false,
    clients: [],
    defaultApp: false,
  });
  await assert.rejects(
    f.io.openEmail("jobs@example.test", "REF", "Body"),
    /Copy the details and save/,
  );
  await f.io.copy("jobs@example.test");
  assert.deepEqual(f.events[0], ["copy-text", "jobs@example.test"]);
});
test("mailto preserves exact details with Unicode/plus/reference encoding, never implies attachments", () => {
  const url = new URL(
    mailtoURL(
      "jobs+ref@example.test",
      "REF / 42 & role",
      "Edited body\nLine two",
    ),
  );
  assert.equal(decodeURIComponent(url.pathname), "jobs+ref@example.test");
  assert.equal(url.searchParams.get("subject"), "REF / 42 & role");
  assert.equal(url.searchParams.get("body"), "Edited body\nLine two");
  assert.equal(url.searchParams.has("attachment"), false);
  assert.throws(() => mailtoURL("bad\naddress", "REF", "Body"));
});
test("document picker cancellation is harmless and application closure prevents mail presentation", async () => {
  const f = native();
  assert.equal(await f.io.chooseCV(), null);
  await assert.rejects(
    f.io.compose(
      "jobs@example.test",
      "REF",
      "file:///cache/z83.pdf",
      "file:///cache/cv.pdf",
      "Body",
      [],
      () => false,
    ),
    /session ended/,
  );
  assert.equal(
    f.events.some((x) => x[0] === "compose"),
    false,
  );
});
test("generated Z83 PDF is non-empty, reopenable and uses a separate application snapshot", async () => {
  const { PDFDocument } = require("pdf-lib");
  const types = load("src/lib/z83/types.ts", {});
  const fill = load("src/lib/z83/fill.ts", {
    "./pdf-lib": require("pdf-lib"),
    "./coords": load("src/lib/z83/coords.ts", {}),
  });
  const template = await PDFDocument.create();
  template.addPage([612, 792]);
  template.addPage([612, 792]);
  const data = initialZ83(
    {},
    reusableZ83({ surnameAndNames: "Fixture Person", disability: "no" }),
    {
      position: "Clerk",
      department: "Example Department",
      reference: "REF/42",
    },
  );
  const bytes = await fill.fillZ83(data, await template.save());
  assert.ok(bytes.length > 1000);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  const reopened = await PDFDocument.load(bytes);
  assert.equal(reopened.getPageCount(), 2);
  assert.equal(data.declarationDate, "");
  assert.equal(types.emptyZ83().signature, "");
});

test("Apple Mail saved draft is not a sent application", async () => {
  const f = native({ status: "saved" });
  assert.equal(
    await f.io.compose(
      "jobs@example.test",
      "REF",
      "file:///cache/z83.pdf",
      "file:///cache/cv.pdf",
    ),
    "cancelled",
  );
});
test("only discovered installed email-app URLs are offered; inbox launch promises no prefilled attachment payload", async () => {
  const f = native({
    mail: false,
    defaultApp: true,
    clients: [
      { label: "Gmail", url: "googlegmail://" },
      { label: "Outlook", url: "ms-outlook://" },
    ],
  });
  await f.io.openEmail("jobs@example.test", "REF", "Body", "googlegmail://");
  assert.deepEqual(f.events[0], ["open", "googlegmail://"]);
  await assert.rejects(
    f.io.openEmail("jobs@example.test", "REF", "Body", "unknown-app://"),
  );
});
test("supporting files are session-owned and removed on replacement, owner mismatch and completion", () => {
  const removed = [];
  const store = load("src/lib/circular/state.ts", {}).createApplications(
    (uri) => removed.push(uri),
  );
  const key = store.create("alice", {}, "email");
  store.setSupporting("alice", key, [{ uri: "cache:one", name: "one.pdf" }]);
  store.setSupporting("alice", key, [{ uri: "cache:two", name: "two.pdf" }]);
  assert.deepEqual(removed, ["cache:one"]);
  assert.equal(
    store.setSupporting("bob", key, [
      { uri: "cache:foreign", name: "foreign.pdf" },
    ]),
    false,
  );
  store.remove(key);
  assert.deepEqual(removed, ["cache:one", "cache:foreign", "cache:two"]);
});

test("PDF parser rejects structurally corrupt PDFs even with a valid header", async () => {
  const { PDFDocument } = require("pdf-lib");
  const valid = await PDFDocument.create();
  valid.addPage();
  const buffers = new Map([
    ["valid", Buffer.from(await valid.save())],
    ["broken", Buffer.from("%PDF-1.7\nnot a document")],
  ]);
  const helper = load("src/lib/document-export.ts", {
    "expo-file-system/legacy": {
      EncodingType: { Base64: "base64" },
      getInfoAsync: async (uri) => ({
        exists: true,
        size: buffers.get(uri).length,
        isDirectory: false,
      }),
      readAsStringAsync: async (uri, { position = 0, length }) =>
        buffers
          .get(uri)
          .subarray(
            position,
            length === undefined ? undefined : position + length,
          )
          .toString("base64"),
    },
    "expo-sharing": {},
    "./z83/pdf-lib": require("pdf-lib"),
  });
  await helper.assertPdf("valid");
  await assert.rejects(
    helper.assertPdf("broken"),
    /damaged or password-protected/,
  );
});

test("changing job identity clears prior signing details without rewriting generated snapshots", () => {
  const original = {
    ...initialZ83({}, null, {
      position: "Job A",
      department: "A",
      reference: "REF A",
    }),
    initials: "FA",
    signature: "explicit-old-signature",
    declarationDate: "14/11/2026",
  };
  const snapshot = JSON.parse(JSON.stringify(original));
  const next = editZ83(original, { position: "Job B" });
  assert.equal(next.signature, "");
  assert.equal(next.declarationDate, "");
  assert.equal(next.initials, "");
  assert.equal(snapshot.signature, "explicit-old-signature");
  assert.equal(original.position, "Job A");
});
