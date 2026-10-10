type DiagnosticValue = string | number | boolean | null | undefined;

export function tailoringDiagnostic(event: string, fields: Record<string, DiagnosticValue> = {}): void {
  const safeFields = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value === null || value === undefined || typeof value !== "object")
  );
  console.log(JSON.stringify({ scope: "job-tailoring", event, ...safeFields }));
}

export function tailoringDiagnosticWarning(event: string, fields: Record<string, DiagnosticValue> = {}): void {
  const safeFields = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value === null || value === undefined || typeof value !== "object")
  );
  console.warn(JSON.stringify({ scope: "job-tailoring", event, ...safeFields }));
}
