const keyFor = (subject: number) => `test-driven-study.exam-create.${subject}`;

export function freshCreationID(subject: number) {
  const id = crypto.randomUUID();
  try { sessionStorage.setItem(keyFor(subject), id); }
  catch { /* The caller also retains this ID in memory for retries. */ }
  return id;
}

export function creationID(subject: number) {
  try {
    const existing = sessionStorage.getItem(keyFor(subject));
    if (existing && /^[a-f0-9-]{36}$/i.test(existing)) return existing;
  } catch { /* Optional storage; fall back to an in-memory request ID. */ }
  return freshCreationID(subject);
}
